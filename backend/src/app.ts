import express, { Application, NextFunction, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { errorHandler } from './middleware/errorHandler';
import { env } from './config/env';
import { getItem } from './db/dynamo';

import authRoutes from './routes/authRoutes';
import patientRoutes from './routes/patientRoutes';
import doctorRoutes from './routes/doctorRoutes';
import departmentRoutes from './routes/departmentRoutes';
import appointmentRoutes from './routes/appointmentRoutes';
import emrRoutes from './routes/emrRoutes';
import pharmacyRoutes from './routes/pharmacyRoutes';
import labRoutes from './routes/labRoutes';
import bedRoutes from './routes/bedRoutes';
import billingRoutes from './routes/billingRoutes';
import notificationRoutes from './routes/notificationRoutes';
import auditRoutes from './routes/auditRoutes';
import aiRoutes from './routes/aiRoutes';
import analyticsRoutes from './routes/analyticsRoutes';
import userRoutes from './routes/userRoutes';
import nurseRoutes from './routes/nurseRoutes';

const app: Application = express();

// CLIENT_URL is a comma-separated allow-list of frontend origins, e.g.
// "https://hms-web.vercel.app,http://localhost:5173". An entry may contain one
// "*" wildcard (e.g. "https://hms-web-*-myteam.vercel.app" for preview deployments).
const isAllowedOrigin = (origin: string) =>
  env.clientUrls().some((allowed) => {
    if (!allowed.includes('*')) return allowed === origin;
    const [prefix, suffix] = allowed.split('*');
    return origin.startsWith(prefix) && origin.endsWith(suffix) && origin.length > prefix.length + suffix.length;
  });

// Global Middlewares
app.use(helmet({ contentSecurityPolicy: false }));
app.use(
  cors({
    // Requests without an Origin header (curl, server-to-server) are allowed;
    // browsers are limited to the configured frontend origins.
    origin: (origin, callback) => callback(null, !origin || isAllowedOrigin(origin)),
    credentials: true
  })
);
// Vercel Functions accept request bodies up to 4.5 MB.
app.use(express.json({ limit: '4mb' }));
app.use(express.urlencoded({ extended: true, limit: '4mb' }));
if (process.env.NODE_ENV !== 'test') app.use(morgan('dev'));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/nurse', nurseRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/emr', emrRoutes);
app.use('/api/pharmacy', pharmacyRoutes);
app.use('/api/lab', labRoutes);
app.use('/api/beds', bedRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/audit-logs', auditRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/analytics', analyticsRoutes);


// Health check endpoint.
// GET /api/health?db=1 also performs one DynamoDB GetItem to verify region,
// table name and credentials (reports only success/failure, never secrets).
app.get('/api/health', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body: Record<string, unknown> = {
      status: 'online',
      system: 'Cloud-Based Smart Hospital Management System API',
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    };
    if (req.query.db === '1' || req.query.db === 'true') {
      try {
        await getItem('HEALTH#CHECK', 'HEALTH');
        body.database = { status: 'ok', table: env.tableName(), region: env.awsRegion() };
      } catch (err: any) {
        console.error('[Health] DynamoDB check failed:', err?.name, err?.message);
        return res.status(503).json({ ...body, status: 'degraded', database: { status: 'error', error: err?.name || 'Error' } });
      }
    }
    res.status(200).json(body);
  } catch (err) {
    next(err);
  }
});

// Unknown API routes return JSON instead of Express's HTML 404 page.
app.use('/api', (req: Request, res: Response) => {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` });
});

// Centralized Error Handling Middleware
app.use(errorHandler);

export default app;
