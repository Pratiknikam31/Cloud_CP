import { Router } from 'express';
import {
  getDepartments,
  getDepartmentById,
  createDepartment,
  updateDepartment,
  deleteDepartment
} from '../controllers/departmentController';
import { authenticateJWT, authorizeRoles } from '../middleware/auth';

const router = Router();

router.get('/', getDepartments);
router.get('/:id', getDepartmentById);

router.use(authenticateJWT);
router.post('/', authorizeRoles('admin'), createDepartment);
router.put('/:id', authorizeRoles('admin'), updateDepartment);
router.delete('/:id', authorizeRoles('admin'), deleteDepartment);

export default router;
