import { Router } from 'express';
import {
  getUserNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  createNotification
} from '../controllers/notificationController';
import { authenticateJWT, authorizeRoles } from '../middleware/auth';

const router = Router();

router.use(authenticateJWT);

router.get('/', getUserNotifications);
router.patch('/read-all', markAllNotificationsRead);
router.patch('/:id/read', markNotificationRead);
router.post('/', authorizeRoles('admin'), createNotification);

export default router;
