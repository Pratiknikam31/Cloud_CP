import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  register,
  login,
  getMe,
  updateProfile,
  changePassword,
  sendRegistrationOtp,
  forgotPassword,
  resetPassword,
} from '../controllers/authController';
import { authenticateJWT } from '../middleware/auth';

const router = Router();

// Rate limiters for sensitive authentication endpoints (disabled in test mode)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'test' ? 1000 : 20, // 20 requests per 15 min in prod/dev
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many authentication attempts. Please try again after 15 minutes.' },
  skip: () => process.env.NODE_ENV === 'test',
});

const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 1000 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many verification code requests. Please try again later.' },
  skip: () => process.env.NODE_ENV === 'test',
});

router.post('/send-otp', otpLimiter, sendRegistrationOtp);
router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/forgot-password', authLimiter, forgotPassword);
router.post('/reset-password', authLimiter, resetPassword);

router.get('/me', authenticateJWT, getMe);
router.put('/profile', authenticateJWT, updateProfile);
router.post('/change-password', authenticateJWT, changePassword);

export default router;

