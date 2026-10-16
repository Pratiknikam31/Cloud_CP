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
router.get('/:id', getPatientById);
router.get('/:id/timeline', getPatientTimeline);
router.post('/', authorizeRoles('admin', 'receptionist'), createPatient);
router.put('/:id', authorizeRoles('admin', 'receptionist', 'doctor', 'patient'), updatePatient);
router.delete('/:id', authorizeRoles('admin'), deletePatient);

export default router;
