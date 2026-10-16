import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProtectedRoute } from './routes/ProtectedRoute';
import { DashboardLayout } from './layouts/DashboardLayout';

// Public Pages
import { Landing } from './pages/Landing';
import { Login } from './pages/Login';
import { Register } from './pages/Register';

// Dashboard Pages
import { AdminDashboard } from './pages/dashboards/AdminDashboard';
import { DoctorDashboard } from './pages/dashboards/DoctorDashboard';
import { PatientDashboard } from './pages/dashboards/PatientDashboard';
import { ReceptionistDashboard } from './pages/dashboards/ReceptionistDashboard';
import { LabDashboard } from './pages/dashboards/LabDashboard';
import { PharmacyDashboard } from './pages/dashboards/PharmacyDashboard';

// Feature Pages
import { SymptomChecker } from './pages/ai/SymptomChecker';
import { AppointmentBooking } from './pages/appointments/AppointmentBooking';
import { EMRConsultation } from './pages/emr/EMRConsultation';
import { InventoryManager } from './pages/pharmacy/InventoryManager';
import { BedManager } from './pages/beds/BedManager';
import { BillingInvoice } from './pages/billing/BillingInvoice';
import { AuditLogViewer } from './pages/admin/AuditLogViewer';

// Role Dashboard Dispatcher Component
const DashboardDispatcher: React.FC = () => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;

  switch (user.role) {
    case 'super_admin':
    case 'hospital_admin':
      return <AdminDashboard />;
    case 'doctor':
      return <DoctorDashboard />;
    case 'patient':
      return <PatientDashboard />;
    case 'receptionist':
      return <ReceptionistDashboard />;
    case 'lab_staff':
      return <LabDashboard />;
    case 'pharmacist':
      return <PharmacyDashboard />;
    default:
      return <PatientDashboard />;
  }
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Protected Dashboard Routes */}
          <Route element={<ProtectedRoute />}>
            <Route element={<DashboardLayout />}>
              <Route path="/dashboard" element={<DashboardDispatcher />} />

              {/* Admin Routes */}
              <Route path="/admin/dashboard" element={<AdminDashboard />} />
              <Route path="/admin/patients" element={<AdminDashboard />} />
              <Route path="/admin/doctors" element={<AdminDashboard />} />
              <Route path="/admin/departments" element={<AdminDashboard />} />
              <Route path="/admin/appointments" element={<AppointmentBooking />} />
              <Route path="/admin/queue" element={<ReceptionistDashboard />} />
              <Route path="/admin/beds" element={<BedManager />} />
              <Route path="/admin/pharmacy" element={<InventoryManager />} />
              <Route path="/admin/laboratory" element={<LabDashboard />} />
              <Route path="/admin/billing" element={<BillingInvoice />} />
              <Route path="/admin/audit-logs" element={<AuditLogViewer />} />

              {/* Doctor Routes */}
              <Route path="/doctor/dashboard" element={<DoctorDashboard />} />
              <Route path="/doctor/appointments" element={<DoctorDashboard />} />
              <Route path="/doctor/patients" element={<DoctorDashboard />} />
              <Route path="/doctor/consultations" element={<EMRConsultation />} />
              <Route path="/doctor/prescriptions" element={<EMRConsultation />} />
              <Route path="/doctor/lab-reports" element={<LabDashboard />} />

              {/* Patient Routes */}
              <Route path="/patient/dashboard" element={<PatientDashboard />} />
              <Route path="/patient/ai-recommendation" element={<SymptomChecker />} />
              <Route path="/patient/book-appointment" element={<AppointmentBooking />} />
              <Route path="/patient/appointments" element={<AppointmentBooking />} />
              <Route path="/patient/medical-records" element={<EMRConsultation />} />
              <Route path="/patient/prescriptions" element={<EMRConsultation />} />
              <Route path="/patient/lab-reports" element={<LabDashboard />} />
              <Route path="/patient/bills" element={<BillingInvoice />} />
              <Route path="/patient/profile" element={<PatientDashboard />} />

              {/* Receptionist Routes */}
              <Route path="/reception/dashboard" element={<ReceptionistDashboard />} />
              <Route path="/reception/queue" element={<ReceptionistDashboard />} />
              <Route path="/reception/appointments" element={<AppointmentBooking />} />
              <Route path="/reception/patients" element={<ReceptionistDashboard />} />
              <Route path="/reception/beds" element={<BedManager />} />

              {/* Lab Staff Routes */}
              <Route path="/lab/dashboard" element={<LabDashboard />} />
              <Route path="/lab/tests" element={<LabDashboard />} />
              <Route path="/lab/reports" element={<LabDashboard />} />

              {/* Pharmacist Routes */}
              <Route path="/pharmacy/dashboard" element={<PharmacyDashboard />} />
              <Route path="/pharmacy/inventory" element={<InventoryManager />} />
              <Route path="/pharmacy/dispense" element={<InventoryManager />} />
              <Route path="/pharmacy/alerts" element={<InventoryManager />} />
            </Route>
          </Route>

          {/* Catch-all Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
};

export default App;
