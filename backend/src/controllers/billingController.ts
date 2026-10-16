import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { Bill } from '../models/Bill';
import { Patient } from '../models/Patient';
import { createBillSchema, recordPaymentSchema } from '../validators/schemas';
import { logAudit } from '../utils/auditLogger';

export const getBills = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as string;
    const patientId = req.query.patientId as string;
    const search = (req.query.search as string) || '';

    const query: any = {};
    if (status) query.status = status;
    if (patientId) query.patient = patientId;

    if (search) {
      query.billId = { $regex: search, $options: 'i' };
    }

    // Patient role scoped to their own bills
    if (req.user?.role === 'patient') {
      const patientProfile = await Patient.findOne({ user: req.user._id });
      if (patientProfile) {
        query.patient = patientProfile._id;
      } else {
        res.status(200).json({
          success: true,
          data: { bills: [], pagination: { total: 0, page: 1, pages: 0, limit } }
        });
        return;
      }
    }

    const skip = (page - 1) * limit;
    const [bills, total] = await Promise.all([
      Bill.find(query)
        .populate('patient', 'name patientId phone email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Bill.countDocuments(query)
    ]);

    res.status(200).json({
      success: true,
      data: {
        bills,
        pagination: {
          total,
          page,
          pages: Math.ceil(total / limit),
          limit
        }
      }
    });
  } catch (err) {
    next(err);
  }
};

export const getBillById = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const bill = await Bill.findById(req.params.id).populate('patient');
    if (!bill) {
      res.status(404).json({ success: false, message: 'Bill not found' });
      return;
    }
    res.status(200).json({ success: true, data: { bill } });
  } catch (err) {
    next(err);
  }
};

export const createBill = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const validated = createBillSchema.parse(req.body);
    const billId = `INV-${Math.floor(100000 + Math.random() * 900000)}`;

    const subtotal = validated.items.reduce((sum, item) => sum + item.amount * (item.quantity || 1), 0);
    const discount = validated.discount || 0;
    const tax = validated.tax || 0;
    const totalAmount = Math.max(0, subtotal - discount + tax);
    const balance = totalAmount;

    const bill = await Bill.create({
      billId,
      patient: validated.patient,
      items: validated.items,
      subtotal,
      discount,
      tax,
      totalAmount,
      paidAmount: 0,
      balance,
      status: 'pending',
      dueDate: new Date(validated.dueDate),
      invoiceDate: new Date()
    });

    const populated = await Bill.findById(bill._id).populate('patient', 'name patientId phone email');

    if (req.user) {
      await logAudit(
        req.user._id.toString(),
        req.user.name,
        req.user.role,
        'CREATE',
        'Bill',
        bill._id.toString(),
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
    const bill = await Bill.findById(req.params.id);
    if (!bill) {
      res.status(404).json({ success: false, message: 'Bill not found' });
      return;
    }

    bill.paidAmount += validated.amount;
    bill.balance = Math.max(0, bill.totalAmount - bill.paidAmount);

    if (bill.balance === 0) {
      bill.status = 'paid';
    } else if (bill.paidAmount > 0) {
      bill.status = 'partially_paid';
    }

    await bill.save();
    const populated = await Bill.findById(bill._id).populate('patient', 'name patientId');

    if (req.user) {
      await logAudit(
        req.user._id.toString(),
        req.user.name,
        req.user.role,
        'PAYMENT',
        'Bill',
        bill._id.toString(),
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
    const bills = await Bill.find();
    const totalRevenue = bills.reduce((sum, b) => sum + b.paidAmount, 0);
    const totalPending = bills.reduce((sum, b) => sum + b.balance, 0);
    const paidCount = bills.filter((b) => b.status === 'paid').length;
    const pendingCount = bills.filter((b) => b.status === 'pending' || b.status === 'partially_paid').length;

    res.status(200).json({
      success: true,
      data: {
        totalRevenue,
        totalPending,
        totalInvoices: bills.length,
        paidCount,
        pendingCount
      }
    });
  } catch (err) {
    next(err);
  }
};

export const deleteBill = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const bill = await Bill.findByIdAndDelete(req.params.id);
    if (!bill) {
      res.status(404).json({ success: false, message: 'Bill not found' });
      return;
    }

    if (req.user) {
      await logAudit(
        req.user._id.toString(),
        req.user.name,
        req.user.role,
        'DELETE',
        'Bill',
        bill._id.toString(),
        `Deleted invoice ${bill.billId}`
      );
    }

    res.status(200).json({ success: true, message: 'Invoice deleted successfully' });
  } catch (err) {
    next(err);
  }
};
