import React, { useState, useEffect } from 'react';
import { 
  User, 
  Mail, 
  Calendar, 
  MapPin, 
  Shield, 
  Save, 
  CheckCircle2, 
  RefreshCw,
  AlertTriangle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getMeApi } from '../api/authApi';
import { patientApi } from '../api/hospitalApi';

export const PatientProfile: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [patientId, setPatientId] = useState('');
  const [patientDocId, setPatientDocId] = useState('');

  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | 'other'>('male');
  const [bloodGroup, setBloodGroup] = useState<string>('O+');
  const [address, setAddress] = useState('');

  // Emergency Contact
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyRelation, setEmergencyRelation] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');

  // Insurance
  const [insuranceProvider, setInsuranceProvider] = useState('');
  const [insurancePolicyNumber, setInsurancePolicyNumber] = useState('');

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const res = await getMeApi();
      if (res.user) {
        setName(res.user.name || '');
        setEmail(res.user.email || '');
        setPhone(res.user.phone || '');
      }

      if (res.profile) {
        const p = res.profile;
        setPatientDocId(p._id || '');
        setPatientId(p.patientId || '');
        if (p.phone) setPhone(p.phone);
        if (p.dob) setDob(p.dob.slice(0, 10));
        if (p.gender) setGender(p.gender);
        if (p.bloodGroup) setBloodGroup(p.bloodGroup);
        if (p.address) setAddress(p.address);
        if (p.emergencyContact) {
          setEmergencyName(p.emergencyContact.name || '');
          setEmergencyRelation(p.emergencyContact.relationship || '');
          setEmergencyPhone(p.emergencyContact.phone || '');
        }
        if (p.insuranceProvider) setInsuranceProvider(p.insuranceProvider);
        if (p.insurancePolicyNumber) setInsurancePolicyNumber(p.insurancePolicyNumber);
      }
    } catch (err: any) {
      console.error('Failed to load patient profile:', err);
      setFeedback({ type: 'error', message: 'Failed to load profile details.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    setSaving(true);

    try {
      if (!patientDocId) {
        setFeedback({ type: 'error', message: 'No patient record identifier found to update.' });
        return;
      }

      const payload = {
        name: name.trim(),
        phone: phone.trim(),
        dob,
        gender,
        bloodGroup,
        address: address.trim(),
        emergencyContact: {
          name: emergencyName.trim(),
          relationship: emergencyRelation.trim(),
          phone: emergencyPhone.trim(),
        },
        insuranceProvider: insuranceProvider.trim(),
        insurancePolicyNumber: insurancePolicyNumber.trim(),
      };

      await patientApi.update(patientDocId, payload);
      setFeedback({ type: 'success', message: 'Profile updated successfully!' });
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: any) {
      setFeedback({ 
        type: 'error', 
        message: err.response?.data?.message || err.message || 'Failed to update patient profile.' 
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center">
        <div className="w-8 h-8 border-3 border-brand-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
        <p className="text-sm text-slate-500 font-medium">Loading medical profile records...</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-16 font-sans">
      {/* Top Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-brand-600 to-medical-teal text-white flex items-center justify-center font-extrabold text-2xl shadow-md">
            {name.slice(0, 2).toUpperCase() || 'PT'}
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">{name || 'Patient Profile'}</h1>
              {patientId && (
                <span className="font-mono text-xs font-bold bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-full border border-slate-200">
                  {patientId}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1 flex items-center space-x-3">
              <span>{email}</span>
              <span>•</span>
              <span className="text-brand-600 font-bold">{bloodGroup}</span>
              <span>•</span>
              <span className="capitalize">{gender}</span>
            </p>
          </div>
        </div>

        <button
          onClick={fetchProfile}
          className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
          title="Reload Profile"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {feedback && (
        <div className={`p-4 rounded-xl border flex items-center space-x-3 text-sm animate-fade-in ${
          feedback.type === 'success' 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
            : 'bg-rose-50 border-rose-200 text-rose-800'
        }`}>
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Main Profile Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Demographics */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
              <User className="w-4 h-4 text-brand-600" />
              <span>Personal Demographics</span>
            </h2>
            <p className="text-xs text-slate-500">Legal medical identity and patient contact information</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Full Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-xl px-3.5 py-2.5 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Email Address</label>
              <input
                type="email"
                disabled
                value={email}
                className="w-full text-sm border border-slate-200 rounded-xl px-3.5 py-2.5 bg-slate-100 text-slate-500 cursor-not-allowed font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Phone Number</label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 555-0192"
                className="w-full text-sm border border-slate-200 rounded-xl px-3.5 py-2.5 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Date of Birth</label>
              <input
                type="date"
                required
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-xl px-3.5 py-2.5 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Gender</label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value as any)}
                className="w-full text-sm border border-slate-200 rounded-xl px-3.5 py-2.5 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium"
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Blood Group</label>
              <select
                value={bloodGroup}
                onChange={(e) => setBloodGroup(e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-xl px-3.5 py-2.5 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 font-bold text-rose-700"
              >
                <option value="A+">A+</option>
                <option value="A-">A-</option>
                <option value="B+">B+</option>
                <option value="B-">B-</option>
                <option value="AB+">AB+</option>
                <option value="AB-">AB-</option>
                <option value="O+">O+</option>
                <option value="O-">O-</option>
              </select>
            </div>

            <div className="sm:col-span-2 lg:col-span-3">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Residential Address</label>
              <input
                type="text"
                required
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Street address, City, State, ZIP code"
                className="w-full text-sm border border-slate-200 rounded-xl px-3.5 py-2.5 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Emergency Contact & Health Insurance */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Emergency Contact */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <Shield className="w-4 h-4 text-rose-600" />
                <span>Emergency Contact</span>
              </h2>
              <p className="text-xs text-slate-500">Designated contact in clinical emergencies</p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Contact Name</label>
                <input
                  type="text"
                  required
                  value={emergencyName}
                  onChange={(e) => setEmergencyName(e.target.value)}
                  placeholder="Primary contact person"
                  className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Relationship</label>
                <input
                  type="text"
                  required
                  value={emergencyRelation}
                  onChange={(e) => setEmergencyRelation(e.target.value)}
                  placeholder="e.g. Spouse, Parent, Sibling"
                  className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Emergency Phone</label>
                <input
                  type="tel"
                  required
                  value={emergencyPhone}
                  onChange={(e) => setEmergencyPhone(e.target.value)}
                  placeholder="+1 555-0987"
                  className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>
          </div>

          {/* Insurance */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <Shield className="w-4 h-4 text-blue-600" />
                <span>Health Insurance</span>
              </h2>
              <p className="text-xs text-slate-500">Coverage details for automated claims processing</p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Insurance Provider</label>
                <input
                  type="text"
                  value={insuranceProvider}
                  onChange={(e) => setInsuranceProvider(e.target.value)}
                  placeholder="e.g. Blue Cross Blue Shield, Aetna, Cigna"
                  className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Policy / Member ID</label>
                <input
                  type="text"
                  value={insurancePolicyNumber}
                  onChange={(e) => setInsurancePolicyNumber(e.target.value)}
                  placeholder="e.g. POL-9843210-BC"
                  className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Submit Bar */}
        <div className="flex items-center justify-end space-x-4 pt-4 border-t border-slate-200">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center space-x-2 px-6 py-3 rounded-xl bg-gradient-to-r from-brand-600 to-medical-teal text-white font-bold text-sm shadow-md hover:shadow-lg transition-all disabled:opacity-50"
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>{saving ? 'Saving Updates...' : 'Save Profile Changes'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
