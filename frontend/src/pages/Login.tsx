import React, { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  Activity, 
  ShieldCheck, 
  User, 
  Lock, 
  ArrowRight, 
  Stethoscope, 
  AlertCircle,
  CheckCircle2
} from 'lucide-react';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const [email, setEmail] = useState((location.state as any)?.registeredEmail || '');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState((location.state as any)?.successMessage || '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const loggedUser = await login(email, password);
      redirectRole(loggedUser.role);
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const redirectRole = (role: string) => {
    switch (role) {
      case 'super_admin':
      case 'hospital_admin':
        navigate('/admin/dashboard');
        break;
      case 'doctor':
        navigate('/doctor/dashboard');
        break;
      case 'patient':
        navigate('/patient/dashboard');
        break;
      case 'receptionist':
        navigate('/reception/dashboard');
        break;
      case 'lab_staff':
        navigate('/lab/dashboard');
        break;
      case 'pharmacist':
        navigate('/pharmacy/dashboard');
        break;
      default:
        navigate('/dashboard');
    }
  };

  const handleDemoLogin = async (demoEmail: string, demoRole: string) => {
    setEmail(demoEmail);
    setPassword('password123');
    setError('');
    setLoading(true);

    try {
      const loggedUser = await login(demoEmail, 'password123');
      redirectRole(loggedUser.role);
    } catch (err: any) {
      setError(`Demo login error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const DEMO_ACCOUNTS = [
    { role: 'Hospital Admin', email: 'admin@smarthospital.org', icon: ShieldCheck, color: 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100' },
    { role: 'Chief Doctor', email: 'doctor@smarthospital.org', icon: Stethoscope, color: 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100' },
    { role: 'Patient', email: 'patient@smarthospital.org', icon: User, color: 'bg-brand-50 border-brand-200 text-brand-700 hover:bg-brand-100' },
  ];

  return (
    <div className="min-h-screen flex bg-slate-900 font-sans selection:bg-brand-500 selection:text-white">
      {/* Left Column: Visual Healthcare SaaS Hero */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-slate-900 via-brand-950 to-slate-900 p-12 flex-col justify-between overflow-hidden border-r border-slate-800">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-brand-500/20 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-medical-teal/20 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10">
          <Link to="/" className="flex items-center space-x-3 text-white">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-brand-600 to-medical-teal flex items-center justify-center shadow-lg shadow-brand-500/30">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="text-2xl font-bold tracking-tight">Smart<span className="text-brand-400">Hospital</span></span>
              <span className="block text-xs text-slate-400 tracking-wider font-mono">ENTERPRISE SAAS</span>
            </div>
          </Link>
        </div>

        <div className="relative z-10 my-auto py-12">
          <h1 className="text-4xl xl:text-5xl font-extrabold text-white leading-tight tracking-tight mb-4">
            Unified Smart Platform for Modern Hospitals.
          </h1>
          <p className="text-slate-300 text-lg leading-relaxed max-w-lg mb-8">
            A comprehensive healthcare management system with secure access controls and real-time operations.
          </p>
        </div>

        <div className="relative z-10 text-xs text-slate-500 flex items-center justify-between border-t border-slate-800 pt-6">
          <span>&copy; 2026 SmartHospital System Inc. All rights reserved.</span>
          <span>v1.0.0 Production</span>
        </div>
      </div>

      {/* Right Column: Login Form & One-Click Demo Portal */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 bg-white">
        <div className="w-full max-w-md space-y-8">
          <div>
            <Link to="/" className="lg:hidden flex items-center space-x-2 text-slate-900 mb-6">
              <div className="w-9 h-9 rounded-lg bg-brand-600 flex items-center justify-center text-white">
                <Activity className="w-5 h-5" />
              </div>
              <span className="text-xl font-bold tracking-tight">Smart<span className="text-brand-600">Hospital</span></span>
            </Link>
            <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Portal Access</h2>
            <p className="text-slate-500 mt-2 text-sm">
              Sign in to your hospital account or select a demo role below.
            </p>
          </div>

          {/* Success Banner */}
          {success && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-start space-x-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>{success}</div>
            </div>
          )}

          {/* Alert Banner */}
          {error && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
              <div>{error}</div>
            </div>
          )}

          {/* One-Click Role Selector */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Quick Demo Login (Select Role)</label>
              <span className="text-xs font-semibold text-brand-600 bg-brand-50 px-2 py-0.5 rounded">Auto-fills credentials</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {DEMO_ACCOUNTS.map((acc) => {
                const IconComponent = acc.icon;
                return (
                  <button
                    key={acc.role}
                    type="button"
                    onClick={() => handleDemoLogin(acc.email, acc.role)}
                    disabled={loading}
                    className={`p-4 rounded-xl border text-left transition-all duration-200 flex flex-col justify-between ${acc.color} ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:shadow-md hover:-translate-y-0.5'}`}
                  >
                    <IconComponent className="w-6 h-6 mb-2" />
                    <div>
                      <span className="block font-bold text-sm leading-snug">{acc.role}</span>
                      <span className="block text-[11px] opacity-75 truncate">{acc.email}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="relative flex items-center justify-center">
            <div className="border-t border-slate-200 w-full"></div>
            <span className="bg-white px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider absolute">or login with credentials</span>
          </div>

          {/* Standard Credentials Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Email Address</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="w-5 h-5" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="doctor@smarthospital.org"
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-sm bg-slate-50 focus:bg-white transition-all"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">Password</label>
                <Link to="/forgot-password" className="text-xs font-semibold text-brand-600 hover:text-brand-700">
                  Forgot Password?
                </Link>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-5 h-5" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-sm bg-slate-50 focus:bg-white transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-brand-600 to-medical-teal text-white font-bold text-sm shadow-md hover:shadow-lg hover:from-brand-700 hover:to-teal-700 transition-all duration-200 flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <span>Sign In to Dashboard</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <p className="text-center text-xs text-slate-500">
            Don't have a patient account?{' '}
            <Link to="/register" className="font-bold text-brand-600 hover:underline">
              Register as New Patient
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};
