import { Router } from 'express';
import {
  getBills,
  getBillById,
  createBill,
  recordPayment,
  getBillingStats,
  deleteBill
} from '../controllers/billingController';
import { authenticateJWT, authorizeRoles } from '../middleware/auth';

const router = Router();

router.use(authenticateJWT);

router.get('/stats', authorizeRoles('admin', 'receptionist'), getBillingStats);
router.get('/', getBills);
router.get('/:id', getBillById);
router.post('/', authorizeRoles('admin', 'receptionist'), createBill);
router.post('/:id/pay', authorizeRoles('admin', 'receptionist', 'patient'), recordPayment);
router.delete('/:id', authorizeRoles('admin'), deleteBill);

export default router;
