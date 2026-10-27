import { Router } from 'express';
import { getUsers, createUser, updateUserRole, updateUserStatus } from '../controllers/userController';
import { authenticateJWT, authorizeRoles } from '../middleware/auth';

const router = Router();

router.use(authenticateJWT);
router.use(authorizeRoles('admin', 'super_admin'));

router.get('/', getUsers);
router.post('/', createUser);
router.patch('/:id/role', updateUserRole);
router.patch('/:id/status', updateUserStatus);

export default router;
