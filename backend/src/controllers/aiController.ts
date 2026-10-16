import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { recommendDepartment } from '../services/aiService';
import { predictInventoryStatus } from '../services/inventoryService';
import { departmentRepo, doctorRepo, medicineRepo } from '../repositories';
import { queryAll, queryPage } from '../db/dynamo';
import { typePartition } from '../db/keys';
import { populate } from '../db/populate';
import { symptomCheckSchema } from '../validators/schemas';

export const analyzeSymptoms = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const validated = symptomCheckSchema.parse(req.body);
    const recommendation = recommendDepartment(validated.symptoms);

    // Look up department by code (exact, case-insensitive) or name (contains).
    // Departments are a small catalog, so it is loaded and matched in memory.
    const code = recommendation.departmentCode.toLowerCase();
    const name = recommendation.departmentName.toLowerCase();
    const departmentItems = await queryAll({ index: 'GSI1', pk: typePartition('DEPT') });
    const found = departmentItems.find(
      (d) => String(d.code ?? '').toLowerCase() === code || String(d.name ?? '').toLowerCase().includes(name)
    );
    const department = found ? departmentRepo.fromItem(found) : null;

    let doctors: any[] = [];
    if (department) {
      // Doctors of a department: GSI2 DEPT#<id>
      const { items } = await queryPage({
        index: 'GSI2',
        pk: `DEPT#${department._id}`,
        sk: { beginsWith: 'DOCTOR#' },
        filter: (d) => d.status === 'active',
        limit: 5,
      });
      doctors = items.map((i) => doctorRepo.fromItem(i));
    } else {
      // Return top active doctors
      const { items } = await queryPage({
        index: 'GSI1',
        pk: typePartition('DOCTOR'),
        filter: (d) => d.status === 'active',
        limit: 3,
      });
      doctors = items.map((i) => doctorRepo.fromItem(i));
    }
    await populate(doctors, 'department', departmentRepo, ['name', 'code']);

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
    // Medicine catalog (small, GSI1 TYPE#MED), sorted by quantity ascending in memory.
    const medicines = (await queryAll({ index: 'GSI1', pk: typePartition('MED') }))
      .map((i) => medicineRepo.fromItem(i))
      .sort((a, b) => a.quantity - b.quantity);
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
    // Beds are a small catalog: one query, counted in memory.
    const beds = await queryAll({ index: 'GSI1', pk: typePartition('BED') });
    const totalBeds = beds.length;
    const occupied = beds.filter((b) => b.status === 'occupied').length;
    const available = beds.filter((b) => b.status === 'available').length;
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
