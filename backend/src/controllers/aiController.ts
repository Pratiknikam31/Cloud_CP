import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { recommendDepartment } from '../services/aiService';
import { predictInventoryStatus } from '../services/inventoryService';
import { Doctor } from '../models/Doctor';
import { Department } from '../models/Department';
import { Medicine } from '../models/Medicine';
import { Bed } from '../models/Bed';
import { symptomCheckSchema } from '../validators/schemas';

export const analyzeSymptoms = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const validated = symptomCheckSchema.parse(req.body);
    const recommendation = recommendDepartment(validated.symptoms);

    // Look up department by code or name
    const department = await Department.findOne({
      $or: [
        { code: { $regex: new RegExp(`^${recommendation.departmentCode}$`, 'i') } },
        { name: { $regex: new RegExp(recommendation.departmentName, 'i') } }
      ]
    });

    let doctors: any[] = [];
    if (department) {
      doctors = await Doctor.find({ department: department._id, status: 'active' })
        .populate('department', 'name code')
        .limit(5);
    } else {
      // Return top active doctors
      doctors = await Doctor.find({ status: 'active' })
        .populate('department', 'name code')
        .limit(3);
    }

    res.status(200).json({
      success: true,
      data: {
        recommendation,
        matchedDepartment: department,
        recommendedDoctors: doctors
      }
    });
  } catch (err) {
    next(err);
  }
};

export const getInventoryForecast = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const medicines = await Medicine.find().sort({ quantity: 1 });
    const predictions = medicines.map((m) =>
      predictInventoryStatus(m.medicineId, m.name, m.quantity, m.minStockLevel, m.dailyAvgUsage)
    );

    const highRisk = predictions.filter((p) => p.urgency === 'critical');
    const mediumRisk = predictions.filter((p) => p.urgency === 'warning');

    res.status(200).json({
      success: true,
      data: {
        totalAnalyzed: medicines.length,
        highRiskCount: highRisk.length,
        mediumRiskCount: mediumRisk.length,
        highRisk,
        mediumRisk,
        all: predictions
      }
    });
  } catch (err) {
    next(err);
  }
};

export const getBedOccupancyForecast = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const totalBeds = await Bed.countDocuments();
    const occupied = await Bed.countDocuments({ status: 'occupied' });
    const available = await Bed.countDocuments({ status: 'available' });
    const rate = totalBeds > 0 ? (occupied / totalBeds) * 100 : 0;

    let predictionText = 'Normal hospital intake capacity expected.';
    let riskLevel = 'low';

    if (rate >= 90) {
      predictionText = 'CRITICAL OVERCAPACITY ALERT: Surge protocols advised. Less than 10% beds available.';
      riskLevel = 'critical';
    } else if (rate >= 75) {
      predictionText = 'HIGH ADMISSION WARNING: Ward capacity nearing saturation. Accelerated discharge review suggested.';
      riskLevel = 'warning';
    }

    res.status(200).json({
      success: true,
      data: {
        totalBeds,
        occupied,
        available,
        occupancyRate: Math.round(rate),
        predictionText,
        riskLevel
      }
    });
  } catch (err) {
    next(err);
  }
};
