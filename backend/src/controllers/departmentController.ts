import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { Department } from '../models/Department';
import { createDepartmentSchema, updateDepartmentSchema } from '../validators/schemas';
import { logAudit } from '../utils/auditLogger';

export const getDepartments = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { search, status, page = '1', limit = '50' } = req.query;
    const filter: any = {};
    if (search) {
      filter.$or = [
        { name: { $regex: String(search), $options: 'i' } },
        { code: { $regex: String(search), $options: 'i' } },
      ];
    }
    if (status) filter.status = status;

    const pageNum = Math.max(1, parseInt(String(page)));
    const limitNum = Math.min(100, Math.max(1, parseInt(String(limit))));

    const [departments, total] = await Promise.all([
      Department.find(filter).sort('name').skip((pageNum - 1) * limitNum).limit(limitNum),
      Department.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      departments,
      pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
    });
  } catch (error) {
    next(error);
  }
};

export const getDepartmentById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const department = await Department.findById(req.params.id);
    if (!department) return res.status(404).json({ success: false, message: 'Department not found' });
    return res.json({ success: true, department });
  } catch (error) {
    next(error);
  }
};

export const createDepartment = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = createDepartmentSchema.parse(req.body);
    const existing = await Department.findOne({ $or: [{ name: data.name }, { code: data.code.toUpperCase() }] });
    if (existing) return res.status(400).json({ success: false, message: 'Department name or code already exists' });

    const department = await Department.create({ ...data, code: data.code.toUpperCase() });

    await logAudit({
      user: req.user, action: 'DEPARTMENT_CREATED', entity: 'Department',
      entityId: department._id.toString(), description: `Department ${data.name} created`,
      ipAddress: req.ip,
    });

    return res.status(201).json({ success: true, message: 'Department created successfully', department });
  } catch (error) {
    next(error);
  }
};

export const updateDepartment = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = updateDepartmentSchema.parse(req.body);
    const department = await Department.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true });
    if (!department) return res.status(404).json({ success: false, message: 'Department not found' });

    await logAudit({
      user: req.user, action: 'DEPARTMENT_UPDATED', entity: 'Department',
      entityId: department._id.toString(), description: `Department ${department.name} updated`,
      ipAddress: req.ip,
    });

    return res.json({ success: true, message: 'Department updated', department });
  } catch (error) {
    next(error);
  }
};

export const deleteDepartment = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const department = await Department.findByIdAndDelete(req.params.id);
    if (!department) return res.status(404).json({ success: false, message: 'Department not found' });

    await logAudit({
      user: req.user, action: 'DEPARTMENT_DELETED', entity: 'Department',
      entityId: department._id.toString(), description: `Department ${department.name} deleted`,
      ipAddress: req.ip,
    });

    return res.json({ success: true, message: 'Department deleted' });
  } catch (error) {
    next(error);
  }
};
