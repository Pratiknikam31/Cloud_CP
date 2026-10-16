import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { billRepo, patientRepo } from '../repositories';
import { findPatientByUser } from '../repositories/profiles';
import { getItem, Item, queryPage, QueryOptions } from '../db/dynamo';
import { patientPartition, STATS, statsAdd, typePartition } from '../db/keys';
import { populate } from '../db/populate';
import { IBill, PaymentStatus } from '../types/entities';
import { createBillSchema, recordPaymentSchema } from '../validators/schemas';
import { logAudit } from '../utils/auditLogger';
import { parseDate } from '../utils/dates';
import { newBillId } from '../utils/ids';
import { paginationMeta, parseCursor, parseLimit, queryString } from '../utils/pagination';
import { retryOnConflict } from '../services/facilitiesFinanceService';

// Billing totals for GET /api/billing/stats live in one aggregate item
// (STATS#BILLING) instead of being summed over every bill on each request:
//   totalBilled, totalPaid, totalBalance, count, count_<status>
// Every write that changes a bill updates it with an atomic ADD in the same
// transaction, so the totals can never drift from the bills themselves.

type BillTotals = Pick<IBill, 'totalAmount' | 'paidAmount' | 'balance' | 'status'>;

// Change in the aggregate when a bill goes from `before` to `after`
// (null = the bill does not exist on that side, i.e. create / delete).
const statsDelta = (before: BillTotals | null, after: BillTotals | null): Record<string, number> => {
  const deltas: Record<string, number> = {};
  const add = (key: string, value: number) => {
    // Rounded so float noise such as 30.3 - 20.1 = 10.200000000000001 does not accumulate.
    deltas[key] = Math.round(((deltas[key] ?? 0) + value) * 1e6) / 1e6;
  };
  for (const [bill, sign] of [[before, -1], [after, 1]] as const) {
    if (!bill) continue;
    add('totalBilled', sign * bill.totalAmount);
    add('totalPaid', sign * bill.paidAmount);
    add('totalBalance', sign * bill.balance);
    add('count', sign);
    add(`count_${bill.status}`, sign);
  }
  return deltas;
};

export const getBills = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const limit = parseLimit(req.query.limit, 20, 100);
    const cursor = parseCursor(req.query.cursor);
    const status = queryString(req.query.status);
    let patientId = queryString(req.query.patientId);
    const search = queryString(req.query.search) || '';

    // Patient role scoped to their own bills
    if (req.user?.role === 'patient') {
      const patientProfile = await findPatientByUser(req.user._id);
      if (patientProfile) {
        patientId = patientProfile._id;
      } else {
        res.status(200).json({
          success: true,
          data: { bills: [], pagination: paginationMeta(limit, 0) }
        });
        return;
      }
    }

    const matches = (b: Item) => (!status || b.status === status) && (!patientId || b.patient === patientId);

    let bills: any[];
    let nextCursor: string | undefined;
    if (search) {
      // Bill IDs are searched by prefix (e.g. "INV-0001") through search tokens
      // instead of a regex over every bill. Results are a single page. More
      // candidates than `limit` are fetched so the patient/status filter still
      // leaves up to `limit` results.
      const found = await billRepo.search(search, 100);
      bills = found
        .filter(matches)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, limit);
    } else {
      // One patient's bills: GSI2 PATIENT#<id>; otherwise all bills: GSI1 TYPE#BILL.
      // Both are sorted by createdAt; newest first like the original.
      const query: QueryOptions = patientId
        ? { index: 'GSI2', pk: patientPartition(patientId), sk: { beginsWith: 'BILL#' } }
        : { index: 'GSI1', pk: typePartition('BILL') };
      const page = await queryPage({ ...query, forward: false, limit, cursor, filter: status ? matches : undefined });
      bills = page.items.map((i) => billRepo.fromItem(i));
      nextCursor = page.nextCursor;
    }

    bills = bills.map((b) => billRepo.toPublic(b));
    await populate(bills, 'patient', patientRepo, ['name', 'patientId', 'phone', 'email']);

    res.status(200).json({
      success: true,
      data: {
        bills,
        pagination: paginationMeta(limit, bills.length, nextCursor)
      }
    });
  } catch (err) {
    next(err);
  }
};

export const getBillById = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const found = await billRepo.get(req.params.id);
    if (!found) {
      res.status(404).json({ success: false, message: 'Bill not found' });
      return;
    }
    const bill: any = billRepo.toPublic(found);
    await populate([bill], 'patient', patientRepo);
    res.status(200).json({ success: true, data: { bill } });
  } catch (err) {
    next(err);
  }
};

export const createBill = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const validated = createBillSchema.parse(req.body);
    const dueDate = parseDate(validated.dueDate, 'dueDate').toISOString();
    if (!(await patientRepo.get(validated.patient))) {
      res.status(404).json({ success: false, message: 'Patient not found' });
      return;
    }

    const billId = await newBillId();

    const subtotal = validated.items.reduce((sum, item) => sum + item.amount * (item.quantity || 1), 0);
    const discount = validated.discount || 0;
    const tax = validated.tax || 0;
    const totalAmount = Math.max(0, subtotal - discount + tax);
    const balance = totalAmount;

    // Retried on 409: concurrent transactions that touch the shared STATS#BILLING
    // item can be cancelled by DynamoDB with a TransactionConflict.
    const bill = await retryOnConflict(() => billRepo.create(
      {
        billId,
        patient: validated.patient,
        items: validated.items.map((i) => ({ ...i, quantity: i.quantity ?? 1 })),
        subtotal,
        discount,
        tax,
        totalAmount,
        paidAmount: 0,
        balance,
        status: 'pending' as PaymentStatus,
        dueDate,
        invoiceDate: new Date().toISOString()
      },
      // The bill and its contribution to the billing totals are written together.
      { extra: [statsAdd(STATS.billing, statsDelta(null, { totalAmount, paidAmount: 0, balance, status: 'pending' }))] }
    ));

    const populated: any = billRepo.toPublic(bill);
    await populate([populated], 'patient', patientRepo, ['name', 'patientId', 'phone', 'email']);

    if (req.user) {
      await logAudit(
        req.user._id,
        req.user.name,
        req.user.role,
        'CREATE',
        'Bill',
        bill._id,
        `Created invoice ${bill.billId} for total $${bill.totalAmount}`
      );
    }

    res.status(201).json({
      success: true,
      message: 'Invoice created successfully',
      data: { bill: populated }
    });
  } catch (err) {
    next(err);
  }
};

export const recordPayment = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const validated = recordPaymentSchema.parse(req.body);

    // Read-modify-write with a version check: the payment is added to the
    // amount stored at that moment. If another payment lands at the same time
    // the write fails and is retried on the fresh values, so no payment is lost.
    const bill = await retryOnConflict(() =>
      billRepo.update(
        req.params.id,
        (current) => {
          const paidAmount = current.paidAmount + validated.amount;
          const balance = Math.max(0, current.totalAmount - paidAmount);
          let status = current.status;
          if (balance === 0) {
            status = 'paid';
          } else if (paidAmount > 0) {
            status = 'partially_paid';
          }
          return { paidAmount, balance, status };
        },
        { extra: (current, next) => [statsAdd(STATS.billing, statsDelta(current, next))] }
      )
    );
    if (!bill) {
      res.status(404).json({ success: false, message: 'Bill not found' });
      return;
    }

    const populated: any = billRepo.toPublic(bill);
    await populate([populated], 'patient', patientRepo, ['name', 'patientId']);

    if (req.user) {
      await logAudit(
        req.user._id,
        req.user.name,
        req.user.role,
        'PAYMENT',
        'Bill',
        bill._id,
        `Recorded payment of $${validated.amount} on invoice ${bill.billId}`
      );
    }

    res.status(200).json({
      success: true,
      message: 'Payment recorded successfully',
      data: { bill: populated }
    });
  } catch (err) {
    next(err);
  }
};

export const getBillingStats = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    // One GetItem on the aggregate item instead of loading every bill.
    const stats = (await getItem(STATS.billing.PK, STATS.billing.SK)) ?? {};
    const n = (key: string) => Number(stats[key] ?? 0);

    res.status(200).json({
      success: true,
      data: {
        totalRevenue: n('totalPaid'),
        totalPending: n('totalBalance'),
        totalInvoices: n('count'),
        paidCount: n('count_paid'),
        pendingCount: n('count_pending') + n('count_partially_paid')
      }
    });
  } catch (err) {
    next(err);
  }
};

export const deleteBill = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Retried on 409 like createBill (a retry re-reads the bill; if it is gone -> 404).
    const bill = await retryOnConflict(() => billRepo.remove(req.params.id, {
      // Remove this bill's contribution from the billing totals in the same transaction.
      extra: (current) => [statsAdd(STATS.billing, statsDelta(current, null))],
    }));
    if (!bill) {
      res.status(404).json({ success: false, message: 'Bill not found' });
      return;
    }

    if (req.user) {
      await logAudit(
        req.user._id,
        req.user.name,
        req.user.role,
        'DELETE',
        'Bill',
        bill._id,
        `Deleted invoice ${bill.billId}`
      );
    }

    res.status(200).json({ success: true, message: 'Invoice deleted successfully' });
  } catch (err) {
    next(err);
  }
};
