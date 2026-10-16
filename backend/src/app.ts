import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { errorHandler } from './middleware/errorHandler';

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

const app: Application = express();

// Global Middlewares
app.use(helmet({ contentSecurityPolicy: false }));
app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('dev'));

// API Routes
app.use('/api/auth', authRoutes);
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

// Health check endpoint
app.get('/api/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'online',
    system: 'Cloud-Based Smart Hospital Management System API',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Centralized Error Handling Middleware
app.use(errorHandler);

export default app;
