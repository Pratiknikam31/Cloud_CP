import { Router } from 'express';
import {
  getAppointments,
  getAppointmentById,
  createAppointment,
  updateAppointmentStatus,
  deleteAppointment,
  getAppointmentStats
} from '../controllers/appointmentController';
import { authenticateJWT, authorizeRoles } from '../middleware/auth';

const router = Router();

router.use(authenticateJWT);

router.get('/stats', getAppointmentStats);
router.get('/', getAppointments);
router.get('/:id', getAppointmentById);
router.post('/', createAppointment);
router.patch('/:id/status', updateAppointmentStatus);
router.delete('/:id', authorizeRoles('admin', 'receptionist'), deleteAppointment);

export default router;
