import { Router } from 'express';
import {
  getNurseDashboard,
  getCareTasks,
  createCareTask,
  updateCareTask,
} from '../controllers/nurseController';
import { authenticateJWT, authorizeRoles } from '../middleware/auth';

const router = Router();

router.use(authenticateJWT);
router.use(authorizeRoles('nurse', 'admin', 'doctor'));

router.get('/dashboard', getNurseDashboard);
router.get('/tasks', getCareTasks);
router.post('/tasks', createCareTask);
router.patch('/tasks/:id', updateCareTask);

export default router;
