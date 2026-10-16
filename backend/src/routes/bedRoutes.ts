import { Router } from 'express';
import {
  getRooms,
  createRoom,
  updateRoom,
  deleteRoom,
  getBeds,
  getBedById,
  createBed,
  updateBed,
  assignBed,
  dischargeBed,
  deleteBed
} from '../controllers/bedController';
import { authenticateJWT, authorizeRoles } from '../middleware/auth';

const router = Router();

router.use(authenticateJWT);

// Rooms
router.get('/rooms', getRooms);
router.post('/rooms', authorizeRoles('admin'), createRoom);
router.put('/rooms/:id', authorizeRoles('admin'), updateRoom);
router.delete('/rooms/:id', authorizeRoles('admin'), deleteRoom);

// Beds
router.get('/beds', getBeds);
router.get('/beds/:id', getBedById);
router.post('/beds', authorizeRoles('admin'), createBed);
router.put('/beds/:id', authorizeRoles('admin', 'nurse', 'receptionist'), updateBed);
router.post('/beds/:id/assign', authorizeRoles('admin', 'receptionist', 'nurse', 'doctor'), assignBed);
router.post('/beds/:id/discharge', authorizeRoles('admin', 'receptionist', 'nurse', 'doctor'), dischargeBed);
router.delete('/beds/:id', authorizeRoles('admin'), deleteBed);

export default router;
