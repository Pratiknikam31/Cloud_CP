import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { inventoryTransactionRepo, medicineRepo, prescriptionRepo, userRepo } from '../repositories';
import { Item, nowIso, queryAll, queryPage, QueryOptions, transactWrite, TxOp } from '../db/dynamo';
import { typePartition } from '../db/keys';
import { populate } from '../db/populate';
import { IInventoryTransaction, IMedicine } from '../types/entities';
import { createMedicineSchema, updateMedicineSchema } from '../validators/schemas';
import { logAudit } from '../utils/auditLogger';
import { parseDate } from '../utils/dates';
import { paginationMeta, parseCursor, parseLimit, queryString } from '../utils/pagination';
import { newMedicineId } from '../utils/ids';
import { AppError, ConflictError } from '../utils/errors';
import { predictInventoryStatus } from '../services/inventoryService';

// Stock changes are atomic: the new quantity is computed inside
// medicineRepo.update's change() from the version that was just read, and the
// write only succeeds if nobody changed the medicine in between (version check).
// The InventoryTransaction is written in the same DynamoDB transaction, so the
// ledger and the stock level can never disagree.

type MedicineStatus = IMedicine['status'];
const TRANSACTION_TYPES: IInventoryTransaction['type'][] = ['stock_in', 'stock_out', 'expired', 'adjustment'];

// Same status rules as the original controller.
const computeStatus = (m: Pick<IMedicine, 'expiryDate' | 'quantity' | 'minStockLevel'>): MedicineStatus => {
  if (new Date(m.expiryDate) < new Date()) return 'expired';
  if (m.quantity === 0) return 'out_of_stock';
  if (m.quantity <= m.minStockLevel) return 'low_stock';
  return 'in_stock';
};

// When two requests change the same item at the same moment, one of them gets a
// version conflict. For stock adjustments and dispensing we simply re-run the
// whole read-check-write a few times: the retry sees the new state, so e.g. a
// second stock_out correctly fails with "Insufficient stock available".
const withRetry = async <R>(fn: () => Promise<R>, attempts = 5): Promise<R> => {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (err) {
      if (!(err instanceof ConflictError) || i >= attempts) throw err;
      await new Promise((r) => setTimeout(r, 20 * i + Math.random() * 30));
    }
  }
};

const publicMedicines = (items: Item[]) => items.map((i) => medicineRepo.fromItem(i));

const includesText = (value: unknown, search: string) => String(value ?? '').toLowerCase().includes(search);

export const getMedicines = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const limit = parseLimit(req.query.limit, 20, 100);
    const cursor = parseCursor(req.query.cursor);
    const search = (queryString(req.query.search) ?? '').toLowerCase();
    const category = queryString(req.query.category);
    const status = queryString(req.query.status);

    // Medicines are a small catalog sorted by name on GSI1 (TYPE#MED).
    // The original regex search becomes a case-insensitive substring match.
    const { items, nextCursor } = await queryPage({
      index: 'GSI1',
      pk: typePartition('MED'),
      forward: true,
      limit,
      cursor,
      filter: (m) =>
        (!search ||
          includesText(m.name, search) ||
          includesText(m.genericName, search) ||
          includesText(m.manufacturer, search) ||
          includesText(m.batchNumber, search)) &&
        (!category || m.category === category) &&
        (!status || m.status === status),
    });

    const medicines = publicMedicines(items);
    res.status(200).json({
      success: true,
      data: {
        medicines,
        pagination: paginationMeta(limit, medicines.length, nextCursor),
      },
    });
  } catch (err) {
    next(err);
  }
};

export const getMedicineById = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const medicine = await medicineRepo.get(req.params.id);
    if (!medicine) {
      res.status(404).json({ success: false, message: 'Medicine not found' });
      return;
    }
    res.status(200).json({ success: true, data: { medicine } });
  } catch (err) {
    next(err);
  }
};

export const createMedicine = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const validated = createMedicineSchema.parse(req.body);
    const expiryDate = parseDate(validated.expiryDate, 'expiryDate').toISOString();
    const medicineId = await newMedicineId();

    const { entity: medicine, ops } = medicineRepo.prepareCreate({
      medicineId,
      ...validated,
      expiryDate,
      status: computeStatus({ expiryDate, quantity: validated.quantity, minStockLevel: validated.minStockLevel }),
    });

    // Medicine and its initial stock entry are written in one transaction.
    const extra: TxOp[] = [];
    if (validated.quantity > 0 && req.user) {
      extra.push(
        ...inventoryTransactionRepo.prepareCreate({
          medicine: medicine._id,
          type: 'stock_in',
          quantity: validated.quantity,
          reason: 'Initial stock entry',
          performedBy: req.user._id,
          timestamp: nowIso(),
        }).ops
      );
    }
    await transactWrite([...ops, ...extra]);

    if (req.user) {
      await logAudit(
        req.user._id.toString(),
        req.user.name,
        req.user.role,
        'CREATE',
        'Medicine',
        medicine._id.toString(),
        `Created medicine ${medicine.name} (${medicine.medicineId})`
      );
    }

    res.status(201).json({
      success: true,
      message: 'Medicine created successfully',
      data: { medicine },
    });
  } catch (err) {
    next(err);
  }
};

export const updateMedicine = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const validated = updateMedicineSchema.parse(req.body);
    const expiryDate = validated.expiryDate ? parseDate(validated.expiryDate, 'expiryDate').toISOString() : undefined;

    const medicine = await medicineRepo.update(req.params.id, (current) => {
      const patch: Partial<IMedicine> = {};
      for (const [k, v] of Object.entries(validated)) {
        if (v !== undefined) (patch as any)[k] = v;
      }
      if (expiryDate) patch.expiryDate = expiryDate;
      // Status is recomputed from the merged (current + changes) values.
      patch.status = computeStatus({ ...current, ...patch });
      return patch;
    });
    if (!medicine) {
      res.status(404).json({ success: false, message: 'Medicine not found' });
      return;
    }

    if (req.user) {
      await logAudit(
        req.user._id.toString(),
        req.user.name,
        req.user.role,
        'UPDATE',
        'Medicine',
        medicine._id.toString(),
        `Updated medicine ${medicine.name}`
      );
    }

    res.status(200).json({
      success: true,
      message: 'Medicine updated successfully',
      data: { medicine },
    });
  } catch (err) {
    next(err);
  }
};

export const deleteMedicine = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const medicine = await medicineRepo.remove(req.params.id);
    if (!medicine) {
      res.status(404).json({ success: false, message: 'Medicine not found' });
      return;
    }

    if (req.user) {
      await logAudit(
        req.user._id.toString(),
        req.user.name,
        req.user.role,
        'DELETE',
        'Medicine',
        medicine._id.toString(),
        `Deleted medicine ${medicine.name}`
      );
    }

    res.status(200).json({ success: true, message: 'Medicine deleted successfully' });
  } catch (err) {
    next(err);
  }
};

export const adjustStock = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { quantity, type, reason } = req.body;
    if (!quantity || !type || !reason) {
      res.status(400).json({ success: false, message: 'Quantity, type, and reason are required' });
      return;
    }

    // Mongoose used to reject these through the model schema (enum / Number cast).
    const delta = Number(quantity);
    if (!Number.isFinite(delta)) {
      res.status(400).json({ success: false, message: 'Quantity must be a number' });
      return;
    }
    if (!TRANSACTION_TYPES.includes(type)) {
      res.status(400).json({ success: false, message: 'Invalid transaction type' });
      return;
    }

    let transaction: IInventoryTransaction | undefined;
    const medicine = await withRetry(() =>
      medicineRepo.update(
        req.params.id,
        (current) => {
          // Runs on the version just read; the write fails if it changed meanwhile.
          let newQuantity = current.quantity;
          if (type === 'stock_in') {
            newQuantity += delta;
          } else if (type === 'stock_out' || type === 'expired') {
            if (current.quantity < delta) throw new AppError('Insufficient stock available', 400);
            newQuantity -= delta;
          } else if (type === 'adjustment') {
            newQuantity = delta;
          }
          if (newQuantity < 0) throw new AppError('Insufficient stock available', 400);
          return { quantity: newQuantity, status: computeStatus({ ...current, quantity: newQuantity }) };
        },
        {
          // The ledger entry is written in the same transaction as the new stock level.
          extra: (current) => {
            const created = inventoryTransactionRepo.prepareCreate({
              medicine: current._id,
              type,
              quantity: delta,
              reason: String(reason),
              performedBy: req.user!._id,
              timestamp: nowIso(),
            });
            transaction = created.entity;
            return created.ops;
          },
        }
      )
    );
    if (!medicine) {
      res.status(404).json({ success: false, message: 'Medicine not found' });
      return;
    }

    if (req.user) {
      await logAudit(
        req.user._id.toString(),
        req.user.name,
        req.user.role,
        'STOCK_ADJUSTMENT',
        'Medicine',
        medicine._id.toString(),
        `Adjusted stock for ${medicine.name}: ${type} (${delta} units)`
      );
    }

    res.status(200).json({
      success: true,
      message: 'Stock updated successfully',
      data: { medicine, transaction },
    });
  } catch (err) {
    next(err);
  }
};

export const getInventoryTransactions = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const limit = parseLimit(req.query.limit, 20, 100);
    const cursor = parseCursor(req.query.cursor);
    const medicineId = queryString(req.query.medicineId);

    // One medicine's ledger lives on GSI2 (MED#<id>); the hospital-wide ledger on
    // GSI1 (TYPE#INVTX). Both are sorted by timestamp, newest first.
    const query: QueryOptions = medicineId
      ? { index: 'GSI2', pk: `MED#${medicineId}`, sk: { beginsWith: 'INVTX#' } }
      : { index: 'GSI1', pk: typePartition('INVTX') };

    const { items, nextCursor } = await queryPage({ ...query, forward: false, limit, cursor });
    const transactions: any[] = items.map((i) => inventoryTransactionRepo.fromItem(i));
    await Promise.all([
      populate(transactions, 'medicine', medicineRepo, ['name', 'genericName', 'medicineId']),
      populate(transactions, 'performedBy', userRepo, ['name', 'role']),
    ]);

    res.status(200).json({
      success: true,
      data: {
        transactions,
        pagination: paginationMeta(limit, transactions.length, nextCursor),
      },
    });
  } catch (err) {
    next(err);
  }
};

export const getInventoryPredictions = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Small catalog: load all medicines from GSI1 and sort by quantity in memory.
    const medicines = publicMedicines(await queryAll({ index: 'GSI1', pk: typePartition('MED') }));
    medicines.sort((a, b) => a.quantity - b.quantity);

    const predictions = medicines.map((med) =>
      predictInventoryStatus(med.medicineId, med.name, med.quantity, med.minStockLevel, med.dailyAvgUsage)
    );

    const critical = predictions.filter((p) => p.urgency === 'critical');
    const warning = predictions.filter((p) => p.urgency === 'warning');
    const normal = predictions.filter((p) => p.urgency === 'normal');

    res.status(200).json({
      success: true,
      data: {
        summary: {
          total: predictions.length,
          criticalCount: critical.length,
          warningCount: warning.length,
          normalCount: normal.length,
        },
        predictions,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const dispensePrescription = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { prescriptionId } = req.body;

    // The "already dispensed" check runs inside change() on the current version,
    // so two pharmacists dispensing at once cannot both succeed.
    const prescription = await withRetry(() =>
      prescriptionRepo.update(prescriptionId, (current) => {
        if (current.status === 'dispensed') throw new AppError('Prescription already dispensed', 400);
        return { status: 'dispensed' };
      })
    );
    if (!prescription) {
      res.status(404).json({ success: false, message: 'Prescription not found' });
      return;
    }

    if (req.user) {
      await logAudit(
        req.user._id.toString(),
        req.user.name,
        req.user.role,
        'DISPENSE',
        'Prescription',
        prescription._id.toString(),
        `Dispensed prescription for patient ${prescription.patient}`
      );
    }

    // The medicines array is embedded in the prescription (the original
    // populate('medicines') was a no-op), so it is returned as stored.
    res.status(200).json({
      success: true,
      message: 'Prescription marked as dispensed',
      data: { prescription },
    });
  } catch (err) {
    next(err);
  }
};
