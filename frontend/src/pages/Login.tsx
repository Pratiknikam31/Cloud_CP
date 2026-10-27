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
    <div className="min-h-screen flex bg-[#0a0f1d] font-sans selection:bg-brand-500 selection:text-white">
      {/* Left Column: Visual Healthcare SaaS Hero */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-[#070b14] via-[#0d1527] to-[#080d1a] p-12 flex-col justify-between overflow-hidden border-r border-slate-800/80">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-brand-500/15 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-medical-teal/15 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10">
          <Link to="/" className="flex items-center space-x-3 text-white">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-brand-500 via-brand-600 to-medical-teal flex items-center justify-center shadow-lg shadow-brand-500/30 ring-2 ring-brand-400/20">
              <Activity className="w-6 h-6 text-white animate-pulse-subtle" />
            </div>
            <div>
              <span className="text-2xl font-black tracking-tight">Cloud<span className="bg-gradient-to-r from-brand-400 to-medical-teal bg-clip-text text-transparent">Care</span></span>
              <span className="block text-[10px] text-slate-400 tracking-widest font-mono uppercase font-bold">Smart Healthcare Cloud</span>
            </div>
          </Link>
        </div>

        <div className="relative z-10 my-auto py-12 max-w-lg">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/30 text-brand-300 text-xs font-bold uppercase tracking-wider mb-6">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Enterprise Clinical Core</span>
          </div>
          <h1 className="text-4xl xl:text-5xl font-black text-white leading-[1.15] tracking-tight mb-5">
            Intelligent Care Operations for Modern Hospitals.
          </h1>
          <p className="text-slate-300 text-base leading-relaxed mb-8">
            High-availability clinical orchestration platform with zero-latency synchronization, role-based workflows, and patient management.
          </p>

          {/* Live telemetry trust badges */}
          <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-800/80">
            <div className="p-3 rounded-2xl bg-slate-900/60 border border-slate-800/80">
              <p className="text-xs font-bold text-white flex items-center space-x-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>HIPAA & SOC-2</span>
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">End-to-end encrypted</p>
            </div>
            <div className="p-3 rounded-2xl bg-slate-900/60 border border-slate-800/80">
              <p className="text-xs font-bold text-white flex items-center space-x-1.5">
                <CheckCircle2 className="w-4 h-4 text-brand-400" />
                <span>99.99% Uptime</span>
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">Cloud redundancy active</p>
            </div>
          </div>
        </div>

        <div className="relative z-10 text-xs text-slate-500 flex items-center justify-between border-t border-slate-800/80 pt-6">
          <span>&copy; 2026 CloudCare Smart Hospital System.</span>
          <span className="font-mono text-slate-400 text-[11px]">v2.4.0 High-Availability</span>
        </div>
      </div>

      {/* Right Column: Login Form & One-Click Demo Portal */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 bg-slate-50">
        <div className="w-full max-w-md space-y-7 bg-white p-8 sm:p-10 rounded-3xl border border-slate-200/90 shadow-xl">
          <div>
            <Link to="/" className="lg:hidden flex items-center space-x-2 text-slate-900 mb-6">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 to-medical-teal flex items-center justify-center text-white shadow-md">
                <Activity className="w-5 h-5" />
              </div>
              <span className="text-xl font-black tracking-tight">Cloud<span className="text-brand-600">Care</span></span>
            </Link>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Portal Access</h2>
            <p className="text-slate-500 mt-1.5 text-xs sm:text-sm">
              Sign in with your clinical credentials or launch with one-click demo role.
            </p>
          </div>

          {/* Success Banner */}
          {success && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm flex items-start space-x-3 shadow-xs">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>{success}</div>
            </div>
          )}

          {/* Alert Banner */}
          {error && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs sm:text-sm flex items-start space-x-3 shadow-xs">
              <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
              <div>{error}</div>
            </div>
          )}

          {/* One-Click Role Selector */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Instant Demo Roles</label>
              <span className="text-[10px] font-bold text-brand-600 bg-brand-50 px-2 py-0.5 rounded-full border border-brand-200/50">Auto credentials</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {DEMO_ACCOUNTS.map((acc) => {
                const IconComponent = acc.icon;
                return (
                  <button
                    key={acc.role}
                    type="button"
                    onClick={() => handleDemoLogin(acc.email, acc.role)}
                    disabled={loading}
                    className={`p-3.5 rounded-2xl border text-left transition-all duration-200 flex flex-col justify-between ${acc.color} ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:shadow-md hover:-translate-y-0.5'}`}
                  >
                    <IconComponent className="w-5 h-5 mb-2" />
                    <div>
                      <span className="block font-black text-xs leading-snug">{acc.role}</span>
                      <span className="block text-[10px] opacity-75 truncate font-mono mt-0.5">{acc.email}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="relative flex items-center justify-center">
            <div className="border-t border-slate-200 w-full"></div>
            <span className="bg-white px-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest absolute">or sign in with password</span>
          </div>

          {/* Standard Credentials Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[10px] font-black text-slate-700 uppercase tracking-widest mb-1.5">Email Address</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@smarthospital.org"
                  className="w-full pl-10 pr-4 py-3 rounded-2xl border border-slate-200/90 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 text-xs sm:text-sm bg-slate-50/70 focus:bg-white shadow-2xs transition-all"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[10px] font-black text-slate-700 uppercase tracking-widest">Password</label>
                <Link to="/forgot-password" className="text-xs font-bold text-brand-600 hover:text-brand-700">
                  Forgot Password?
                </Link>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-3 rounded-2xl border border-slate-200/90 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 text-xs sm:text-sm bg-slate-50/70 focus:bg-white shadow-2xs transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-brand-600 via-brand-500 to-medical-teal text-white font-extrabold text-sm shadow-md hover:shadow-xl hover:from-brand-700 hover:to-teal-700 transition-all duration-200 flex items-center justify-center space-x-2 disabled:opacity-50 transform hover:-translate-y-0.5"
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
            <Link to="/register" className="font-extrabold text-brand-600 hover:underline">
              Register as New Patient
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};
