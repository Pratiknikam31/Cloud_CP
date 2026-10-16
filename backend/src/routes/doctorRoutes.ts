import { Router } from 'express';
import {
  getDoctors,
  getDoctorById,
  createDoctor,
  updateDoctor,
  deleteDoctor,
  getDoctorSlots
} from '../controllers/doctorController';
import { authenticateJWT, authorizeRoles } from '../middleware/auth';

const router = Router();

// Publicly viewable for booking, but authenticated users get full info
router.get('/', getDoctors);
router.get('/:id', getDoctorById);
router.get('/:id/slots', getDoctorSlots);

router.use(authenticateJWT);
router.post('/', authorizeRoles('admin'), createDoctor);
router.put('/:id', authorizeRoles('admin', 'doctor'), updateDoctor);
router.delete('/:id', authorizeRoles('admin'), deleteDoctor);

export default router;
