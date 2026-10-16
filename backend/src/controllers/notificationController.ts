import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { Notification } from '../models/Notification';
import { createNotificationSchema } from '../validators/schemas';

export const getUserNotifications = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const unreadOnly = req.query.unread === 'true';
    const limit = parseInt(req.query.limit as string) || 20;

    const query: any = { recipient: req.user!._id };
    if (unreadOnly) query.read = false;

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(limit);

    const unreadCount = await Notification.countDocuments({
      recipient: req.user!._id,
      read: false
    });

    res.status(200).json({
      success: true,
      data: {
        notifications,
        unreadCount
      }
    });
  } catch (err) {
    next(err);
  }
};

export const markNotificationRead = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user!._id },
      { read: true },
      { new: true }
    );

    if (!notification) {
      res.status(404).json({ success: false, message: 'Notification not found' });
      return;
    }

    res.status(200).json({ success: true, data: { notification } });
  } catch (err) {
    next(err);
  }
};

export const markAllNotificationsRead = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    await Notification.updateMany(
      { recipient: req.user!._id, read: false },
      { read: true }
    );

    res.status(200).json({ success: true, message: 'All notifications marked as read' });
  } catch (err) {
    next(err);
  }
};

export const createNotification = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const validated = createNotificationSchema.parse(req.body);
    const notification = await Notification.create(validated);

    res.status(201).json({
      success: true,
      message: 'Notification sent',
      data: { notification }
    });
  } catch (err) {
    next(err);
  }
};
