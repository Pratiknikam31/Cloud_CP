import { Router } from 'express';
import { register, login, getMe, updateProfile, changePassword } from '../controllers/authController';
import { authenticateJWT } from '../middleware/auth';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', authenticateJWT, getMe);
router.put('/profile', authenticateJWT, updateProfile);
router.post('/change-password', authenticateJWT, changePassword);

export default router;
