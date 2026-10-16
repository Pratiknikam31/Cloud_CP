import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { Medicine } from '../models/Medicine';
import { InventoryTransaction } from '../models/InventoryTransaction';
import { Prescription } from '../models/Prescription';
import { createMedicineSchema, updateMedicineSchema } from '../validators/schemas';
import { logAudit } from '../utils/auditLogger';
import { predictInventoryStatus } from '../services/inventoryService';

export const getMedicines = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = (req.query.search as string) || '';
    const category = (req.query.category as string) || '';
    const status = (req.query.status as string) || '';

    const query: any = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { genericName: { $regex: search, $options: 'i' } },
        { manufacturer: { $regex: search, $options: 'i' } },
        { batchNumber: { $regex: search, $options: 'i' } }
      ];
    }
    if (category) query.category = category;
    if (status) query.status = status;

    const skip = (page - 1) * limit;
    const [medicines, total] = await Promise.all([
      Medicine.find(query).sort({ name: 1 }).skip(skip).limit(limit),
      Medicine.countDocuments(query)
    ]);

    res.status(200).json({
      success: true,
      data: {
        medicines,
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

export const getMedicineById = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const medicine = await Medicine.findById(req.params.id);
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

    const medicineId = `MED-${Math.floor(100000 + Math.random() * 900000)}`;
    let status: 'in_stock' | 'low_stock' | 'out_of_stock' | 'expired' = 'in_stock';
    const now = new Date();
    if (new Date(validated.expiryDate) < now) {
      status = 'expired';
    } else if (validated.quantity === 0) {
      status = 'out_of_stock';
    } else if (validated.quantity <= validated.minStockLevel) {
      status = 'low_stock';
    }

    const medicine = await Medicine.create({
      medicineId,
      ...validated,
      expiryDate: new Date(validated.expiryDate),
      status
    });

    if (validated.quantity > 0 && req.user) {
      await InventoryTransaction.create({
        medicine: medicine._id,
        type: 'stock_in',
        quantity: validated.quantity,
        reason: 'Initial stock entry',
        performedBy: req.user._id
      });
    }

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
      data: { medicine }
    });
  } catch (err) {
    next(err);
  }
};

export const updateMedicine = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const validated = updateMedicineSchema.parse(req.body);
    const medicine = await Medicine.findById(req.params.id);
    if (!medicine) {
      res.status(404).json({ success: false, message: 'Medicine not found' });
      return;
    }

    Object.assign(medicine, validated);
    if (validated.expiryDate) {
      medicine.expiryDate = new Date(validated.expiryDate);
    }

    const now = new Date();
    if (medicine.expiryDate < now) {
      medicine.status = 'expired';
    } else if (medicine.quantity === 0) {
      medicine.status = 'out_of_stock';
    } else if (medicine.quantity <= medicine.minStockLevel) {
      medicine.status = 'low_stock';
    } else {
      medicine.status = 'in_stock';
    }

    await medicine.save();

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
      data: { medicine }
    });
  } catch (err) {
    next(err);
  }
};

export const deleteMedicine = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const medicine = await Medicine.findByIdAndDelete(req.params.id);
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

    const medicine = await Medicine.findById(req.params.id);
    if (!medicine) {
      res.status(404).json({ success: false, message: 'Medicine not found' });
      return;
    }

    const delta = Number(quantity);
    if (type === 'stock_in') {
      medicine.quantity += delta;
    } else if (type === 'stock_out' || type === 'expired') {
      if (medicine.quantity < delta) {
        res.status(400).json({ success: false, message: 'Insufficient stock available' });
        return;
      }
      medicine.quantity -= delta;
    } else if (type === 'adjustment') {
      medicine.quantity = delta;
    }

    const now = new Date();
    if (medicine.expiryDate < now) {
      medicine.status = 'expired';
    } else if (medicine.quantity === 0) {
      medicine.status = 'out_of_stock';
    } else if (medicine.quantity <= medicine.minStockLevel) {
      medicine.status = 'low_stock';
    } else {
      medicine.status = 'in_stock';
    }

    await medicine.save();

    const transaction = await InventoryTransaction.create({
      medicine: medicine._id,
      type,
      quantity: delta,
      reason,
      performedBy: req.user!._id
    });

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
      data: { medicine, transaction }
    });
  } catch (err) {
    next(err);
  }
};

export const getInventoryTransactions = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const medicineId = req.query.medicineId as string;

    const query: any = {};
    if (medicineId) query.medicine = medicineId;

    const skip = (page - 1) * limit;
    const [transactions, total] = await Promise.all([
      InventoryTransaction.find(query)
        .populate('medicine', 'name genericName medicineId')
        .populate('performedBy', 'name role')
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit),
      InventoryTransaction.countDocuments(query)
    ]);

    res.status(200).json({
      success: true,
      data: {
        transactions,
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

export const getInventoryPredictions = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const medicines = await Medicine.find().sort({ quantity: 1 });
    const predictions = medicines.map((med) =>
      predictInventoryStatus(
        med.medicineId,
        med.name,
        med.quantity,
        med.minStockLevel,
        med.dailyAvgUsage
      )
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
          normalCount: normal.length
        },
        predictions
      }
    });
  } catch (err) {
    next(err);
  }
};

export const dispensePrescription = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { prescriptionId } = req.body;
    const prescription = await Prescription.findById(prescriptionId).populate('medicines');
    if (!prescription) {
      res.status(404).json({ success: false, message: 'Prescription not found' });
      return;
    }

    if (prescription.status === 'dispensed') {
      res.status(400).json({ success: false, message: 'Prescription already dispensed' });
      return;
    }

    prescription.status = 'dispensed';
    await prescription.save();

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

    res.status(200).json({
      success: true,
      message: 'Prescription marked as dispensed',
      data: { prescription }
    });
  } catch (err) {
    next(err);
  }
};
