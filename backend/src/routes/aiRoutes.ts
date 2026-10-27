import { Router } from 'express';
import {
  analyzeSymptoms,
  getInventoryForecast,
  getBedOccupancyForecast
} from '../controllers/aiController';
import { authenticateJWT, authorizeRoles } from '../middleware/auth';

const router = Router();

// Public symptom triage or authenticated
router.post('/symptoms', analyzeSymptoms);

router.use(authenticateJWT);
router.get('/inventory-forecast', authorizeRoles('admin', 'pharmacist'), getInventoryForecast);
router.get('/bed-forecast', authorizeRoles('admin', 'doctor', 'nurse', 'receptionist'), getBedOccupancyForecast);

export default router;
