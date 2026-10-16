import api from './client';

// ==================== PATIENTS ====================
export const patientApi = {
  getAll: (params?: any) => api.get('/patients', { params }).then((res) => res.data),
  getById: (id: string) => api.get(`/patients/${id}`).then((res) => res.data),
  getTimeline: (id: string) => api.get(`/patients/${id}/timeline`).then((res) => res.data),
  create: (data: any) => api.post('/patients', data).then((res) => res.data),
  update: (id: string, data: any) => api.put(`/patients/${id}`, data).then((res) => res.data),
  delete: (id: string) => api.delete(`/patients/${id}`).then((res) => res.data),
};

// ==================== DOCTORS ====================
export const doctorApi = {
  getAll: (params?: any) => api.get('/doctors', { params }).then((res) => res.data),
  getById: (id: string) => api.get(`/doctors/${id}`).then((res) => res.data),
  getSlots: (id: string) => api.get(`/doctors/${id}/slots`).then((res) => res.data),
  create: (data: any) => api.post('/doctors', data).then((res) => res.data),
  update: (id: string, data: any) => api.put(`/doctors/${id}`, data).then((res) => res.data),
  delete: (id: string) => api.delete(`/doctors/${id}`).then((res) => res.data),
};

// ==================== DEPARTMENTS ====================
export const departmentApi = {
  getAll: () => api.get('/departments').then((res) => res.data),
  getById: (id: string) => api.get(`/departments/${id}`).then((res) => res.data),
  create: (data: any) => api.post('/departments', data).then((res) => res.data),
  update: (id: string, data: any) => api.put(`/departments/${id}`, data).then((res) => res.data),
  delete: (id: string) => api.delete(`/departments/${id}`).then((res) => res.data),
};

// ==================== APPOINTMENTS ====================
export const appointmentApi = {
  getAll: (params?: any) => api.get('/appointments', { params }).then((res) => res.data),
  getById: (id: string) => api.get(`/appointments/${id}`).then((res) => res.data),
  getStats: () => api.get('/appointments/stats').then((res) => res.data),
  create: (data: any) => api.post('/appointments', data).then((res) => res.data),
  updateStatus: (id: string, status: string, notes?: string) =>
    api.patch(`/appointments/${id}/status`, { status, notes }).then((res) => res.data),
  delete: (id: string) => api.delete(`/appointments/${id}`).then((res) => res.data),
};

// ==================== EMR & PRESCRIPTIONS ====================
export const emrApi = {
  getRecords: (params?: any) => api.get('/emr/records', { params }).then((res) => res.data),
  getRecordById: (id: string) => api.get(`/emr/records/${id}`).then((res) => res.data),
  createRecord: (data: any) => api.post('/emr/records', data).then((res) => res.data),
  getPrescriptions: (params?: any) => api.get('/emr/prescriptions', { params }).then((res) => res.data),
  getPrescriptionById: (id: string) => api.get(`/emr/prescriptions/${id}`).then((res) => res.data),
  createPrescription: (data: any) => api.post('/emr/prescriptions', data).then((res) => res.data),
};

// ==================== PHARMACY ====================
export const pharmacyApi = {
  getMedicines: (params?: any) => api.get('/pharmacy/medicines', { params }).then((res) => res.data),
  getMedicineById: (id: string) => api.get(`/pharmacy/medicines/${id}`).then((res) => res.data),
  getPredictions: () => api.get('/pharmacy/medicines/predictions').then((res) => res.data),
  createMedicine: (data: any) => api.post('/pharmacy/medicines', data).then((res) => res.data),
  updateMedicine: (id: string, data: any) => api.put(`/pharmacy/medicines/${id}`, data).then((res) => res.data),
  deleteMedicine: (id: string) => api.delete(`/pharmacy/medicines/${id}`).then((res) => res.data),
  adjustStock: (id: string, data: { quantity: number; type: string; reason: string }) =>
    api.post(`/pharmacy/medicines/${id}/adjust-stock`, data).then((res) => res.data),
  getTransactions: (params?: any) => api.get('/pharmacy/transactions', { params }).then((res) => res.data),
  dispensePrescription: (prescriptionId: string) =>
    api.post('/pharmacy/dispense', { prescriptionId }).then((res) => res.data),
};

// ==================== LAB ====================
export const labApi = {
  getTests: (params?: any) => api.get('/lab/tests', { params }).then((res) => res.data),
  getTestById: (id: string) => api.get(`/lab/tests/${id}`).then((res) => res.data),
  createTest: (data: any) => api.post('/lab/tests', data).then((res) => res.data),
  updateTest: (id: string, data: any) => api.put(`/lab/tests/${id}`, data).then((res) => res.data),
  deleteTest: (id: string) => api.delete(`/lab/tests/${id}`).then((res) => res.data),
  getReports: (params?: any) => api.get('/lab/reports', { params }).then((res) => res.data),
  getReportById: (id: string) => api.get(`/lab/reports/${id}`).then((res) => res.data),
  createReport: (data: any) => api.post('/lab/reports', data).then((res) => res.data),
  updateReport: (id: string, data: any) => api.put(`/lab/reports/${id}`, data).then((res) => res.data),
  deleteReport: (id: string) => api.delete(`/lab/reports/${id}`).then((res) => res.data),
};

// ==================== BEDS & ROOMS ====================
export const bedApi = {
  getRooms: () => api.get('/beds/rooms').then((res) => res.data),
  createRoom: (data: any) => api.post('/beds/rooms', data).then((res) => res.data),
  updateRoom: (id: string, data: any) => api.put(`/beds/rooms/${id}`, data).then((res) => res.data),
  deleteRoom: (id: string) => api.delete(`/beds/rooms/${id}`).then((res) => res.data),
  getBeds: (params?: any) => api.get('/beds/beds', { params }).then((res) => res.data),
  getBedById: (id: string) => api.get(`/beds/beds/${id}`).then((res) => res.data),
  createBed: (data: any) => api.post('/beds/beds', data).then((res) => res.data),
  updateBed: (id: string, data: any) => api.put(`/beds/beds/${id}`, data).then((res) => res.data),
  assignBed: (id: string, patientId: string) => api.post(`/beds/beds/${id}/assign`, { patientId }).then((res) => res.data),
  dischargeBed: (id: string) => api.post(`/beds/beds/${id}/discharge`).then((res) => res.data),
  deleteBed: (id: string) => api.delete(`/beds/beds/${id}`).then((res) => res.data),
};

// ==================== BILLING ====================
export const billingApi = {
  getBills: (params?: any) => api.get('/billing', { params }).then((res) => res.data),
  getBillById: (id: string) => api.get(`/billing/${id}`).then((res) => res.data),
  getStats: () => api.get('/billing/stats').then((res) => res.data),
  createBill: (data: any) => api.post('/billing', data).then((res) => res.data),
  recordPayment: (id: string, amount: number) => api.post(`/billing/${id}/pay`, { amount }).then((res) => res.data),
  deleteBill: (id: string) => api.delete(`/billing/${id}`).then((res) => res.data),
};

// ==================== NOTIFICATIONS ====================
export const notificationApi = {
  getAll: (params?: any) => api.get('/notifications', { params }).then((res) => res.data),
  markRead: (id: string) => api.patch(`/notifications/${id}/read`).then((res) => res.data),
  markAllRead: () => api.patch('/notifications/read-all').then((res) => res.data),
  create: (data: any) => api.post('/notifications', data).then((res) => res.data),
};

// ==================== AUDIT LOGS ====================
export const auditApi = {
  getAll: (params?: any) => api.get('/audit-logs', { params }).then((res) => res.data),
  getStats: () => api.get('/audit-logs/stats').then((res) => res.data),
};

// ==================== AI FEATURES ====================
export const aiApi = {
  checkSymptoms: (symptoms: string) => api.post('/ai/symptoms', { symptoms }).then((res) => res.data),
  getInventoryForecast: () => api.get('/ai/inventory-forecast').then((res) => res.data),
  getBedForecast: () => api.get('/ai/bed-forecast').then((res) => res.data),
};

// ==================== ANALYTICS & SEARCH ====================
export const analyticsApi = {
  getOverview: () => api.get('/analytics/overview').then((res) => res.data),
  search: (q: string) => api.get('/analytics/search', { params: { q } }).then((res) => res.data),
};
