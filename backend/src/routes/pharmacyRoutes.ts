import { Router } from 'express';
import {
  getMedicines,
  getMedicineById,
  createMedicine,
  updateMedicine,
  deleteMedicine,
  adjustStock,
  getInventoryTransactions,
  getInventoryPredictions,
  dispensePrescription
} from '../controllers/pharmacyController';
import { authenticateJWT, authorizeRoles } from '../middleware/auth';

const router = Router();

router.use(authenticateJWT);

router.get('/medicines', getMedicines);
router.get('/medicines/predictions', getInventoryPredictions);
router.get('/medicines/:id', getMedicineById);
router.post('/medicines', authorizeRoles('admin', 'pharmacist'), createMedicine);
router.put('/medicines/:id', authorizeRoles('admin', 'pharmacist'), updateMedicine);
router.delete('/medicines/:id', authorizeRoles('admin'), deleteMedicine);

router.post('/medicines/:id/adjust-stock', authorizeRoles('admin', 'pharmacist'), adjustStock);
router.get('/transactions', authorizeRoles('admin', 'pharmacist'), getInventoryTransactions);
router.post('/dispense', authorizeRoles('admin', 'pharmacist'), dispensePrescription);

export default router;
