import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Activity, 
  BrainCircuit, 
  ShieldCheck, 
  ArrowRight, 
  CheckCircle2, 
  HeartPulse, 
  Baby
} from 'lucide-react';
import { doctorApi } from '../api/hospitalApi';

export const Landing: React.FC = () => {
  const [specialistCounts, setSpecialistCounts] = useState<Record<string, number>>({
    CARD: 1,
    NEUR: 1,
    ORTH: 1,
    PED: 1,
  });

  useEffect(() => {
    doctorApi.getAll()
      .then((res: any) => {
        const doctors = res.doctors || res.data?.doctors || [];
        if (Array.isArray(doctors) && doctors.length > 0) {
          const counts: Record<string, number> = { CARD: 0, NEUR: 0, ORTH: 0, PED: 0 };
          doctors.forEach((doc: any) => {
            const deptCode = doc.department?.code;
            if (deptCode && deptCode in counts) {
              counts[deptCode]++;
            }
          });
          setSpecialistCounts((prev) => ({ ...prev, ...counts }));
        }
      })
      .catch(() => {
        // Keep initial fallback counts
      });
  }, []);
  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-brand-500 selection:text-white">
      {/* Navigation Bar */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <Link to="/" className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-medical-teal flex items-center justify-center text-white shadow-md shadow-brand-500/20">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xl font-extrabold tracking-tight text-slate-900">Smart<span className="text-brand-600">Hospital</span></span>
              <span className="block text-[10px] text-slate-400 font-mono tracking-wider">CLOUD HEALTHCARE SAAS</span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center space-x-8 text-sm font-semibold text-slate-600">
            <a href="#departments" className="hover:text-brand-600 transition">Departments</a>
            <a href="#security" className="hover:text-brand-600 transition">Security</a>
          </nav>

          <div className="flex items-center space-x-4">
            <Link 
              to="/login" 
              className="text-sm font-bold text-slate-700 hover:text-brand-600 px-4 py-2 rounded-xl transition"
            >
              Sign In
            </Link>
            <Link 
              to="/login" 
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-medical-teal text-white font-bold text-sm shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5 flex items-center space-x-2"
            >
              <span>Book Appointment</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-20 lg:pt-20 lg:pb-32 bg-gradient-to-b from-white via-brand-50/30 to-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            <div className="lg:col-span-7 space-y-8">
              <div className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-full bg-brand-50 border border-brand-200 text-brand-700 text-xs font-bold uppercase tracking-wider">
                <BrainCircuit className="w-4 h-4 text-brand-600" />
                <span>Next-Gen Smart Healthcare Platform</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 tracking-tight leading-[1.15]">
                Smart Healthcare.<br />
                <span className="bg-gradient-to-r from-brand-600 via-medical-cyan to-medical-teal bg-clip-text text-transparent">
                  Connected Hospital.
                </span>
              </h1>

              <p className="text-base sm:text-lg text-slate-600 font-normal leading-relaxed max-w-2xl">
                An enterprise-grade cloud healthcare platform powering end-to-end hospital operations, specialist coordination, real-time clinical workflows, and patient telemetry.
              </p>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
                <Link
                  to="/login"
                  className="px-8 py-4 rounded-2xl bg-gradient-to-r from-brand-600 via-brand-500 to-medical-teal hover:from-brand-700 hover:to-teal-700 text-white font-extrabold text-sm shadow-xl shadow-brand-500/30 hover:shadow-brand-500/50 transition-all flex items-center justify-center space-x-3 group transform hover:-translate-y-0.5"
                >
                  <span>Explore Live Portal</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link
                  to="/register"
                  className="px-8 py-4 rounded-2xl bg-white hover:bg-slate-50 text-slate-800 font-extrabold text-sm border border-slate-200/90 transition-all flex items-center justify-center space-x-2 shadow-xs hover:shadow-sm"
                >
                  <span>Register Patient</span>
                </Link>
              </div>
            </div>

            {/* Interactive Hero SaaS Mockup */}
            <div className="lg:col-span-5 relative">
              <div className="relative mx-auto rounded-3xl bg-slate-900 p-4 shadow-2xl border border-slate-800 text-white">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                  <div className="flex space-x-2">
                    <div className="w-3 h-3 rounded-full bg-rose-500"></div>
                    <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                    <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">SmartHospital Live Queue & Analytics</span>
                </div>

                <div className="space-y-4">
                  {/* KPI snippet card */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-800/80 p-3 rounded-2xl border border-slate-700">
                      <span className="text-xs text-slate-400 font-medium block">Occupied Beds</span>
                      <div className="flex items-baseline space-x-2 mt-1">
                        <span className="text-2xl font-bold text-brand-400">78%</span>
                        <span className="text-[10px] text-emerald-400 font-semibold">↑ 4% today</span>
                      </div>
                    </div>
                    <div className="bg-slate-800/80 p-3 rounded-2xl border border-slate-700">
                      <span className="text-xs text-slate-400 font-medium block">Live Queue Wait</span>
                      <div className="flex items-baseline space-x-2 mt-1">
                        <span className="text-2xl font-bold text-medical-teal">14 min</span>
                        <span className="text-[10px] text-slate-400">Avg consultation</span>
                      </div>
                    </div>
                  </div>

                  {/* Live Queue widget */}
                  <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700/80 space-y-3">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                      <span className="flex items-center space-x-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                        <span>Cardiology Desk Queue</span>
                      </span>
                      <span className="text-brand-400 font-mono">Dr. Eleanor Vance</span>
                    </div>

                    <div className="bg-slate-900 p-3 rounded-xl flex items-center justify-between text-xs">
                      <div>
                        <span className="text-slate-400 block text-[10px]">CURRENT CONSULTATION</span>
                        <span className="font-extrabold text-white text-sm">P-2026-0012 (Robert Chen)</span>
                      </div>
                      <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 font-bold">Token #102</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Hospital Departments */}
      <section id="departments" className="py-20 bg-slate-100 border-y border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="text-xs font-bold text-brand-600 uppercase tracking-widest">Specialist Care</h2>
            <p className="text-3xl font-extrabold text-slate-900 mt-2">Clinical Departments</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { name: 'Cardiology', code: 'CARD', icon: HeartPulse, color: 'text-rose-500 bg-rose-50' },
              { name: 'Neurology', code: 'NEUR', icon: BrainCircuit, color: 'text-indigo-500 bg-indigo-50' },
              { name: 'Orthopedics', code: 'ORTH', icon: Activity, color: 'text-emerald-500 bg-emerald-50' },
              { name: 'Pediatrics', code: 'PED', icon: Baby, color: 'text-amber-500 bg-amber-50' },
            ].map((dept) => {
              const IconComp = dept.icon;
              const count = specialistCounts[dept.code] ?? 1;
              const countText = `${count} ${count === 1 ? 'Specialist' : 'Specialists'}`;
              return (
                <div key={dept.code} className="p-6 rounded-2xl bg-white border border-slate-200 hover:shadow-md transition text-center space-y-3">
                  <div className={`w-12 h-12 rounded-2xl mx-auto flex items-center justify-center ${dept.color}`}>
                    <IconComp className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-base">{dept.name}</h4>
                    <span className="text-xs text-slate-500 font-medium">{countText}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Security Banner */}
      <section id="security" className="py-20 bg-slate-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-6 space-y-6">
              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold uppercase">
                <ShieldCheck className="w-4 h-4" />
                <span>Enterprise Security</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
                Bank-Grade Encryption & HIPAA Compliance Built-In
              </h2>
              <p className="text-slate-400 text-base leading-relaxed">
                Protect sensitive patient data with JWT token verification, password hashing, automated immutable audit trails, and strict server-side role-based authorization.
              </p>
              <div className="space-y-3 pt-2">
                {['JWT Token Authentication & Verification', 'Comprehensive Audit Logging for all actions', 'Granular Role-Based Access Control (RBAC)'].map((item) => (
                  <div key={item} className="flex items-center space-x-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                    <span className="text-sm font-semibold text-slate-200">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-6 bg-slate-800 p-8 rounded-3xl border border-slate-700 space-y-6">
              <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                <ShieldCheck className="w-5 h-5 text-brand-400" />
                <span>System Security Architecture</span>
              </h3>
              <div className="font-mono text-xs text-slate-300 space-y-2 bg-slate-950 p-4 rounded-2xl border border-slate-800">
                <p className="text-emerald-400">✓ Auth Middleware: JWT Bearer Token Verified</p>
                <p className="text-emerald-400">✓ RBAC Check: Role-based access enforced</p>
                <p className="text-emerald-400">✓ Password Security: Bcrypt hashing enabled</p>
                <p className="text-brand-400">✓ Audit Logged: All user actions tracked</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-950 text-slate-400 py-12 border-t border-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between space-y-4 sm:space-y-0 text-xs">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center text-white font-bold">
              <Activity className="w-5 h-5" />
            </div>
            <span className="text-sm font-bold text-white tracking-tight">SmartHospital SaaS</span>
          </div>
          <p>&copy; 2026 SmartHospital System. Enterprise Healthcare SaaS Platform.</p>
          <div className="flex space-x-6">
            <Link to="/login" className="hover:text-white transition">Staff Login</Link>
            <Link to="/register" className="hover:text-white transition">Patient Portal</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};
