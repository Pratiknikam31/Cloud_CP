import { Router } from 'express';
import {
  getMedicalRecords,
  getMedicalRecordById,
  createMedicalRecord,
  getPrescriptions,
  getPrescriptionById,
  createPrescription,
  recordVitals,
} from '../controllers/emrController';
import { authenticateJWT, authorizeRoles } from '../middleware/auth';

const router = Router();

router.use(authenticateJWT);

// Medical Records
router.get('/records', authorizeRoles('doctor', 'admin', 'nurse', 'patient'), getMedicalRecords);
router.get('/records/:id', authorizeRoles('doctor', 'admin', 'nurse', 'patient'), getMedicalRecordById);
router.post('/records', authorizeRoles('doctor', 'admin'), createMedicalRecord);

// Vitals & Nursing Observations (NUR-01)
router.post('/vitals', authorizeRoles('nurse', 'doctor', 'admin'), recordVitals);

// Prescriptions
router.get('/prescriptions', authorizeRoles('doctor', 'admin', 'nurse', 'pharmacist', 'patient'), getPrescriptions);
router.get('/prescriptions/:id', authorizeRoles('doctor', 'admin', 'nurse', 'pharmacist', 'patient'), getPrescriptionById);
router.post('/prescriptions', authorizeRoles('doctor', 'admin'), createPrescription);

export default router;
