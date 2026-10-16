import { Router } from 'express';
import {
  getMedicalRecords,
  getMedicalRecordById,
  createMedicalRecord,
  getPrescriptions,
  getPrescriptionById,
  createPrescription
} from '../controllers/emrController';
import { authenticateJWT, authorizeRoles } from '../middleware/auth';

const router = Router();

router.use(authenticateJWT);

// Medical Records
router.get('/records', getMedicalRecords);
router.get('/records/:id', getMedicalRecordById);
router.post('/records', authorizeRoles('doctor', 'admin'), createMedicalRecord);

// Prescriptions
router.get('/prescriptions', getPrescriptions);
router.get('/prescriptions/:id', getPrescriptionById);
router.post('/prescriptions', authorizeRoles('doctor', 'admin'), createPrescription);

export default router;
