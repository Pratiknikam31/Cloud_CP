import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { AuditLog } from '../models/AuditLog';

export const getAuditLogs = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 25;
    const action = req.query.action as string;
    const entity = req.query.entity as string;
    const search = (req.query.search as string) || '';
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;

    const query: any = {};
    if (action) query.action = action;
    if (entity) query.entity = entity;
    if (search) {
      query.$or = [
        { userName: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { entityId: { $regex: search, $options: 'i' } }
      ];
    }
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;
    const [logs, total] = await Promise.all([
      AuditLog.find(query)
        .populate('user', 'name email role')
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit),
      AuditLog.countDocuments(query)
    ]);

    res.status(200).json({
      success: true,
      data: {
        logs,
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

export const getAuditLogStats = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const totalLogs = await AuditLog.countDocuments();
    const actionCounts = await AuditLog.aggregate([
      { $group: { _id: '$action', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    const entityCounts = await AuditLog.aggregate([
      { $group: { _id: '$entity', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalLogs,
        actionCounts,
        entityCounts
      }
    });
  } catch (err) {
    next(err);
  }
};
