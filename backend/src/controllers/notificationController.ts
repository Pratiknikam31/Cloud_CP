import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { notificationRepo } from '../repositories';
import { createNotification as createNotificationItem } from '../repositories/notifications';
import { queryAll, queryCount, queryPage } from '../db/dynamo';
import { userPartition } from '../db/keys';
import { createNotificationSchema } from '../validators/schemas';
import { parseLimit } from '../utils/pagination';
import { ConflictError } from '../utils/errors';

// Key design (see repositories/index.ts):
//   all of a user's notifications -> GSI2 USER#<userId>, sort key "NOTIF#<createdAt>#<id>"
//   unread only                   -> GSI3 UNREAD#<userId> (sparse: read items have no GSI3 keys)
const unreadPartition = (userId: string) => `UNREAD#${userId}`;

export const getUserNotifications = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!._id;
    const unreadOnly = req.query.unread === 'true';
    // Capped at 100 so one request can never read an unbounded number of items.
    const limit = parseLimit(req.query.limit, 20, 100);

    const query = unreadOnly
      ? { index: 'GSI3' as const, pk: unreadPartition(userId) }
      : { index: 'GSI2' as const, pk: userPartition(userId), sk: { beginsWith: 'NOTIF#' } };

    const [{ items }, unreadCount] = await Promise.all([
      queryPage({ ...query, forward: false, limit }), // newest first
      queryCount({ index: 'GSI3', pk: unreadPartition(userId) }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        notifications: items.map((i) => notificationRepo.fromItem(i)),
        unreadCount
      }
    });
  } catch (err) {
    next(err);
  }
};

export const markNotificationRead = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!._id;
    const current = await notificationRepo.get(req.params.id);

    // Like the original filter { _id, recipient }: someone else's notification is "not found".
    if (!current || current.recipient !== userId) {
      res.status(404).json({ success: false, message: 'Notification not found' });
      return;
    }

    let notification = current;
    if (!current.read) {
      try {
        // Setting read=true also removes the item from the sparse unread index.
        notification = (await notificationRepo.update(current._id, () => ({ read: true }))) ?? current;
      } catch (err) {
        // A concurrent request changed it first (e.g. "mark all read"); marking
        // as read is idempotent, so return the latest version instead of 409.
        if (!(err instanceof ConflictError)) throw err;
        notification = (await notificationRepo.get(current._id)) ?? current;
      }
    }

    res.status(200).json({ success: true, data: { notification } });
  } catch (err) {
    next(err);
  }
};

export const markAllNotificationsRead = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Bounded set: only this user's unread notifications (sparse GSI3 partition).
    const unread = await queryAll({ index: 'GSI3', pk: unreadPartition(req.user!._id) });

    const markRead = async (id: string) => {
      try {
        await notificationRepo.update(id, () => ({ read: true }));
      } catch (err) {
        // Changed concurrently (most likely already marked read): skip it.
        if (!(err instanceof ConflictError)) throw err;
      }
    };
    // Update in groups of 25 so a large backlog does not fire hundreds of writes at once.
    for (let i = 0; i < unread.length; i += 25) {
      await Promise.all(unread.slice(i, i + 25).map((item) => markRead(item._id)));
    }

    res.status(200).json({ success: true, message: 'All notifications marked as read' });
  } catch (err) {
    next(err);
  }
};

export const createNotification = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const validated = createNotificationSchema.parse(req.body);
    const notification = await createNotificationItem(validated);

    res.status(201).json({
      success: true,
      message: 'Notification sent',
      data: { notification }
    });
  } catch (err) {
    next(err);
  }
};
