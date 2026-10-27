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

router.get('/stats', authorizeRoles('admin', 'receptionist', 'doctor'), getAppointmentStats);
router.get('/', authorizeRoles('patient', 'doctor', 'receptionist', 'admin', 'nurse'), getAppointments);
router.get('/:id', authorizeRoles('patient', 'doctor', 'receptionist', 'admin', 'nurse'), getAppointmentById);
router.post('/', authorizeRoles('patient', 'receptionist', 'admin'), createAppointment);
router.patch('/:id/status', authorizeRoles('patient', 'doctor', 'receptionist', 'admin'), updateAppointmentStatus);
router.delete('/:id', authorizeRoles('admin', 'receptionist'), deleteAppointment);

export default router;
