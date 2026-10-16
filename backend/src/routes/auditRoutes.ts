import { Router } from 'express';
import { getAuditLogs, getAuditLogStats } from '../controllers/auditLogController';
import { authenticateJWT, authorizeRoles } from '../middleware/auth';

const router = Router();

router.use(authenticateJWT);
router.use(authorizeRoles('admin', 'super_admin'));

router.get('/', getAuditLogs);
router.get('/stats', getAuditLogStats);

export default router;
