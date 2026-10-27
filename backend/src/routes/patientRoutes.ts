import { Router } from 'express';
import {
  getPatients,
  getPatientById,
  createPatient,
  updatePatient,
  deletePatient,
  getPatientTimeline
} from '../controllers/patientController';
import { authenticateJWT, authorizeRoles } from '../middleware/auth';

const router = Router();

router.use(authenticateJWT);

router.get('/', authorizeRoles('admin', 'doctor', 'receptionist', 'nurse'), getPatients);
router.get('/:id', authorizeRoles('admin', 'doctor', 'receptionist', 'nurse', 'patient'), getPatientById);
router.get('/:id/timeline', authorizeRoles('admin', 'doctor', 'receptionist', 'nurse', 'patient'), getPatientTimeline);
router.post('/', authorizeRoles('admin', 'receptionist'), createPatient);
router.put('/:id', authorizeRoles('admin', 'receptionist', 'patient'), updatePatient);
router.delete('/:id', authorizeRoles('admin'), deletePatient);

export default router;
