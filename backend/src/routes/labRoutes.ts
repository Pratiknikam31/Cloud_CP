import { Router } from 'express';
import {
  getLabTests,
  getLabTestById,
  createLabTest,
  updateLabTest,
  deleteLabTest,
  getLabReports,
  getLabReportById,
  createLabReport,
  updateLabReport,
  deleteLabReport
} from '../controllers/labController';
import { authenticateJWT, authorizeRoles } from '../middleware/auth';

const router = Router();

// Test catalog (viewable by authenticated users)
router.use(authenticateJWT);

router.get('/tests', getLabTests);
router.get('/tests/:id', getLabTestById);
router.post('/tests', authorizeRoles('admin', 'lab_technician'), createLabTest);
router.put('/tests/:id', authorizeRoles('admin', 'lab_technician'), updateLabTest);
router.delete('/tests/:id', authorizeRoles('admin'), deleteLabTest);

// Reports
router.get('/reports', getLabReports);
router.get('/reports/:id', getLabReportById);
router.post('/reports', authorizeRoles('admin', 'doctor', 'lab_technician'), createLabReport);
router.put('/reports/:id', authorizeRoles('admin', 'lab_technician'), updateLabReport);
router.delete('/reports/:id', authorizeRoles('admin'), deleteLabReport);

export default router;
