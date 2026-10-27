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

router.get('/stats', authorizeRoles('admin', 'receptionist', 'billing_staff'), getBillingStats);
router.get('/', authorizeRoles('admin', 'receptionist', 'patient', 'billing_staff'), getBills);
router.get('/:id', authorizeRoles('admin', 'receptionist', 'patient', 'billing_staff'), getBillById);
router.post('/', authorizeRoles('admin', 'receptionist', 'billing_staff'), createBill);
router.post('/:id/pay', authorizeRoles('admin', 'receptionist', 'patient', 'billing_staff'), recordPayment);
router.delete('/:id', authorizeRoles('admin'), deleteBill);

export default router;
