import { Router } from 'express';
import { getHospitalOverview, globalSearch } from '../controllers/analyticsController';
import { authenticateJWT, authorizeRoles } from '../middleware/auth';

const router = Router();

router.use(authenticateJWT);

router.get('/overview', authorizeRoles('admin', 'doctor', 'receptionist'), getHospitalOverview);
router.get('/search', authorizeRoles('admin', 'doctor', 'receptionist', 'nurse'), globalSearch);

export default router;
