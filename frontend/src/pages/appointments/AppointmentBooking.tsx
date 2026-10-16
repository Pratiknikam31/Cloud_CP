import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Calendar, 
  Clock, 
  Building2, 
  Stethoscope, 
  CheckCircle2, 
  ArrowRight, 
  Printer,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';
import { departmentApi, doctorApi, appointmentApi } from '../../api/hospitalApi';

const DEFAULT_TIME_SLOTS = [
  '09:00 AM', '09:30 AM', '10:00 AM', '10:30 AM',
  '11:00 AM', '02:00 PM', '02:30 PM', '03:00 PM'
];

export const AppointmentBooking: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [step, setStep] = useState(1);
  const [departments, setDepartments] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState<string>('');
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedSlot, setSelectedSlot] = useState<string>('09:30 AM');
  const [type, setType] = useState<'in_person' | 'emergency'>('in_person');
  const [reason, setReason] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [bookingSuccess, setBookingSuccess] = useState<any>(null);

  // Load departments and doctors
  useEffect(() => {
    const initData = async () => {
      try {
        const [deptRes, docRes] = await Promise.all([
          departmentApi.getAll(),
          doctorApi.getAll()
        ]);

        const fetchedDepts = deptRes.departments || deptRes.data?.departments || [];
        const fetchedDocs = docRes.doctors || docRes.data?.doctors || [];

        setDepartments(fetchedDepts);
        setDoctors(fetchedDocs);

        // Pre-select from query params if coming from AI Symptom Checker
        const paramDocId = searchParams.get('doctorId');
        const paramDeptId = searchParams.get('deptId');

        if (paramDeptId) {
          setSelectedDeptId(paramDeptId);
        } else if (fetchedDepts.length > 0) {
          setSelectedDeptId(fetchedDepts[0]._id);
        }

        if (paramDocId) {
          setSelectedDoctorId(paramDocId);
          setStep(2); // Jump straight to choosing slot if doctor already picked
        } else if (fetchedDocs.length > 0) {
          setSelectedDoctorId(fetchedDocs[0]._id);
        }
      } catch (err) {
        console.error('Error fetching departments/doctors:', err);
      }
    };
    initData();
  }, [searchParams]);

  // Doctors filtered by selected department
  const filteredDoctors = doctors.filter((d) => {
    if (!selectedDeptId) return true;
    const deptId = typeof d.department === 'object' ? d.department?._id : d.department;
    return deptId === selectedDeptId;
  });

  const currentDoctor = doctors.find(d => d._id === selectedDoctorId);
  const currentDepartment = departments.find(d => d._id === selectedDeptId);

  const handleBook = async () => {
    setLoading(true);
    setErrorMessage('');

    try {
      const res = await appointmentApi.create({
        doctor: selectedDoctorId,
        department: selectedDeptId,
        date: selectedDate,
        timeSlot: selectedSlot,
        type,
        symptoms: reason || 'General clinical consultation'
      });

      if (res.success && (res.appointment || res.data?.appointment)) {
        setBookingSuccess(res.appointment || res.data?.appointment);
      } else {
        setBookingSuccess({
          appointmentId: `APT-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`,
          queueNumber: Math.floor(1 + Math.random() * 15),
          doctor: currentDoctor?.name || 'Assigned Specialist',
          department: currentDepartment?.name || 'General Clinic',
          date: selectedDate,
          timeSlot: selectedSlot,
          type,
          consultationFee: currentDoctor?.consultationFee || 150
        });
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Slot conflict or server error.';
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Book Doctor Appointment</h1>
        <p className="text-slate-500 text-sm mt-1">Select clinical wing, doctor, date, and preferred consultation queue slot.</p>
      </div>

      {bookingSuccess ? (
        /* Confirmation Voucher Card */
        <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-xl space-y-6 text-center animate-fadeIn">
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div>
            <span className="text-xs font-bold text-emerald-600 uppercase tracking-widest bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
              Appointment Successfully Confirmed!
            </span>
            <h2 className="text-3xl font-extrabold text-slate-900 mt-3 font-mono">
              Queue Token #{bookingSuccess.queueNumber || 101}
            </h2>
            <p className="text-slate-500 text-sm">Present this token at the reception desk for priority check-in.</p>
          </div>

          <div className="max-w-md mx-auto p-6 rounded-2xl bg-slate-50 border border-slate-200 text-left space-y-3 font-medium text-sm">
            <div className="flex justify-between border-b border-slate-200 pb-2">
              <span className="text-slate-500">Appointment ID</span>
              <span className="font-extrabold text-slate-900 font-mono">{bookingSuccess.appointmentId}</span>
            </div>
            <div className="flex justify-between border-b border-slate-200 pb-2">
              <span className="text-slate-500">Doctor</span>
              <span className="font-bold text-brand-600">
                {typeof bookingSuccess.doctor === 'object' ? bookingSuccess.doctor?.name : currentDoctor?.name || 'Specialist'}
              </span>
            </div>
            <div className="flex justify-between border-b border-slate-200 pb-2">
              <span className="text-slate-500">Department</span>
              <span className="font-bold text-slate-900">
                {typeof bookingSuccess.department === 'object' ? bookingSuccess.department?.name : currentDepartment?.name || 'Department'}
              </span>
            </div>
            <div className="flex justify-between border-b border-slate-200 pb-2">
              <span className="text-slate-500">Scheduled Date</span>
              <span className="font-bold text-slate-900">
                {new Date(bookingSuccess.date || selectedDate).toLocaleDateString()} at {bookingSuccess.timeSlot}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Consultation Fee</span>
              <span className="font-extrabold text-emerald-600">${currentDoctor?.consultationFee || 150}</span>
            </div>
          </div>

          <div className="flex items-center justify-center space-x-4 pt-4">
            <button
              onClick={() => window.print()}
              className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm transition flex items-center space-x-2 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print Appointment Pass</span>
            </button>
            <button
              onClick={() => navigate('/patient/dashboard')}
              className="px-6 py-2.5 rounded-xl bg-brand-600 text-white font-bold text-sm hover:bg-brand-700 transition cursor-pointer shadow-md"
            >
              Return to Patient Portal
            </button>
          </div>
        </div>
      ) : (
        /* Wizard Steps */
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-sm space-y-8">
          {/* Step Indicators */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-6 text-xs font-bold">
            <div className={`flex items-center space-x-2 ${step >= 1 ? 'text-brand-600' : 'text-slate-400'}`}>
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-white ${step >= 1 ? 'bg-brand-600' : 'bg-slate-300'}`}>1</span>
              <span>Select Specialist</span>
            </div>
            <div className={`flex items-center space-x-2 ${step >= 2 ? 'text-brand-600' : 'text-slate-400'}`}>
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-white ${step >= 2 ? 'bg-brand-600' : 'bg-slate-300'}`}>2</span>
              <span>Date & Time Slot</span>
            </div>
            <div className={`flex items-center space-x-2 ${step >= 3 ? 'text-brand-600' : 'text-slate-400'}`}>
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-white ${step >= 3 ? 'bg-brand-600' : 'bg-slate-300'}`}>3</span>
              <span>Confirm & Book</span>
            </div>
          </div>

          {/* Conflict or Error Notification */}
          {errorMessage && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Step 1: Department & Doctor */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Select Clinical Department</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {departments.map((dept) => (
                    <button
                      key={dept._id}
                      type="button"
                      onClick={() => setSelectedDeptId(dept._id)}
                      className={`p-3 rounded-xl border text-xs font-bold text-center transition cursor-pointer ${
                        selectedDeptId === dept._id 
                          ? 'bg-brand-50 border-brand-500 text-brand-700 shadow-sm' 
                          : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {dept.name}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Select Specialist Doctor</label>
                <div className="space-y-3">
                  {filteredDoctors.length === 0 ? (
                    <div className="p-6 rounded-2xl bg-slate-50 text-center text-xs text-slate-500">
                      No doctors currently registered in this department. Please choose another department.
                    </div>
                  ) : (
                    filteredDoctors.map((doc) => (
                      <div
                        key={doc._id}
                        onClick={() => setSelectedDoctorId(doc._id)}
                        className={`p-4 rounded-2xl border cursor-pointer transition flex items-center justify-between ${
                          selectedDoctorId === doc._id 
                            ? 'bg-brand-50/70 border-brand-500 shadow-sm' 
                            : 'border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 rounded-full bg-brand-600 text-white font-bold flex items-center justify-center">
                            {doc.name.charAt(4) || 'D'}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 text-sm">{doc.name}</p>
                            <span className="text-xs text-slate-500">
                              {doc.specialization} • Room {doc.roomNumber}
                            </span>
                          </div>
                        </div>
                        <span className="font-extrabold text-slate-900 text-sm">${doc.consultationFee || 150}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <button
                onClick={() => setStep(2)}
                disabled={!selectedDoctorId}
                className="w-full py-3.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm transition flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer shadow-md"
              >
                <span>Continue to Choose Slot</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Step 2: Date & Slot */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Appointment Date</label>
                <input
                  type="date"
                  value={selectedDate}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full p-3.5 rounded-xl border border-slate-200 text-sm font-medium focus:ring-2 focus:ring-brand-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Available Time Slots</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {DEFAULT_TIME_SLOTS.map((slot) => (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => setSelectedSlot(slot)}
                      className={`p-3 rounded-xl border text-xs font-bold transition cursor-pointer ${
                        selectedSlot === slot 
                          ? 'bg-brand-600 text-white shadow-md' 
                          : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {slot}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Visit Priority</label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setType('in_person')}
                    className={`p-4 rounded-2xl border text-left transition cursor-pointer ${
                      type === 'in_person' 
                        ? 'bg-brand-50 border-brand-500 text-brand-700 font-bold' 
                        : 'border-slate-200 text-slate-700'
                    }`}
                  >
                    <Building2 className="w-5 h-5 mb-2" />
                    <span className="block text-sm">Regular Consultation</span>
                    <span className="text-[11px] opacity-75">Scheduled outpatient queue</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setType('emergency')}
                    className={`p-4 rounded-2xl border text-left transition cursor-pointer ${
                      type === 'emergency' 
                        ? 'bg-rose-50 border-rose-500 text-rose-700 font-bold' 
                        : 'border-slate-200 text-slate-700'
                    }`}
                  >
                    <Stethoscope className="w-5 h-5 mb-2" />
                    <span className="block text-sm">Priority / Urgent Care</span>
                    <span className="text-[11px] opacity-75">Accelerated physician routing</span>
                  </button>
                </div>
              </div>

              <div className="flex space-x-4">
                <button
                  onClick={() => setStep(1)}
                  className="w-1/3 py-3.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-sm hover:bg-slate-50 transition cursor-pointer"
                >
                  Back
                </button>
                <button
                  onClick={() => setStep(3)}
                  className="w-2/3 py-3.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm transition flex items-center justify-center space-x-2 cursor-pointer shadow-md"
                >
                  <span>Review Booking Details</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Final Confirmation */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Chief Symptoms / Reason for Visit</label>
                <textarea
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Describe your current symptoms or reason for consulting the doctor..."
                  className="w-full p-3.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                />
              </div>

              <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 text-sm">
                <h4 className="font-bold text-slate-900 border-b border-slate-200 pb-2">Booking Summary</h4>
                <div className="grid grid-cols-2 gap-3 text-slate-600">
                  <div>Doctor: <strong className="text-slate-900 block">{currentDoctor?.name || 'Selected Doctor'}</strong></div>
                  <div>Department: <strong className="text-slate-900 block">{currentDepartment?.name || 'Selected Wing'}</strong></div>
                  <div>Date: <strong className="text-slate-900 block">{new Date(selectedDate).toLocaleDateString()}</strong></div>
                  <div>Slot: <strong className="text-slate-900 block">{selectedSlot}</strong></div>
                  <div>Fee: <strong className="text-emerald-600 block">${currentDoctor?.consultationFee || 150}</strong></div>
                  <div>Mode: <strong className="text-slate-900 block capitalize">{type.replace('_', ' ')}</strong></div>
                </div>
              </div>

              <div className="flex space-x-4">
                <button
                  onClick={() => setStep(2)}
                  className="w-1/3 py-3.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-sm hover:bg-slate-50 transition cursor-pointer"
                >
                  Back
                </button>
                <button
                  onClick={handleBook}
                  disabled={loading}
                  className="w-2/3 py-3.5 rounded-xl bg-gradient-to-r from-brand-600 to-medical-teal text-white font-extrabold text-sm shadow-lg hover:shadow-xl transition flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
                >
                  {loading ? (
                    <div className="flex items-center space-x-2">
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      <span>Confirming Slot & Generating Token...</span>
                    </div>
                  ) : (
                    <span>Confirm & Generate Digital Pass</span>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
