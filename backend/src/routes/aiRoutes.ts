import { Router } from 'express';
import {
  analyzeSymptoms,
  getInventoryForecast,
  getBedOccupancyForecast
} from '../controllers/aiController';
import { authenticateJWT } from '../middleware/auth';

const router = Router();

// Public symptom triage or authenticated
router.post('/symptoms', analyzeSymptoms);

router.use(authenticateJWT);
router.get('/inventory-forecast', getInventoryForecast);
router.get('/bed-forecast', getBedOccupancyForecast);

export default router;
