import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Activity, 
  Stethoscope, 
  Calendar, 
  BrainCircuit, 
  ListOrdered, 
  Package, 
  BedDouble, 
  FileText, 
  ShieldCheck, 
  ArrowRight, 
  CheckCircle2, 
  Star, 
  Building2, 
  HeartPulse, 
  Microscope,
  PhoneCall
} from 'lucide-react';

export const Landing: React.FC = () => {
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
            <a href="#features" className="hover:text-brand-600 transition">Features</a>
            <a href="#departments" className="hover:text-brand-600 transition">Departments</a>
            <a href="#smart-ai" className="hover:text-brand-600 transition">Smart AI</a>
            <a href="#security" className="hover:text-brand-600 transition">Security</a>
            <a href="#testimonials" className="hover:text-brand-600 transition">Testimonials</a>
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

              <p className="text-lg sm:text-xl text-slate-600 font-normal leading-relaxed max-w-2xl">
                An enterprise-grade SaaS platform uniting electronic medical records, symptom-assisted AI department routing, live digital queue management, and pharmacy inventory forecasting.
              </p>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
                <Link
                  to="/login"
                  className="px-8 py-4 rounded-2xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-base shadow-xl shadow-brand-500/25 hover:shadow-brand-500/40 transition-all flex items-center justify-center space-x-3 group"
                >
                  <span>Explore Live Demo</span>
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link
                  to="/register"
                  className="px-8 py-4 rounded-2xl bg-white hover:bg-slate-100 text-slate-800 font-bold text-base border border-slate-200 transition-all flex items-center justify-center space-x-2 shadow-sm"
                >
                  <span>Patient Portal</span>
                </Link>
              </div>

              <div className="pt-4 flex items-center space-x-6 text-slate-500 text-xs font-semibold">
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span>8 Role-Based Access Controls</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span>HIPAA & GDPR Ready</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span>99.99% Cloud SLA</span>
                </div>
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

                  {/* AI Symptom Routing Snippet */}
                  <div className="p-3.5 rounded-2xl bg-gradient-to-r from-brand-950 to-slate-800 border border-brand-500/30 text-xs space-y-1.5">
                    <div className="flex items-center justify-between text-brand-300 font-bold">
                      <span className="flex items-center space-x-1">
                        <BrainCircuit className="w-4 h-4" />
                        <span>AI Symptom Assister</span>
                      </span>
                      <span className="text-[10px] bg-brand-500/20 px-2 py-0.5 rounded text-brand-300">95% Match</span>
                    </div>
                    <p className="text-slate-300 text-[11px]">
                      "Chest tightness and dyspnea after exertion" → Recommended Department: <strong className="text-white">Cardiology</strong>
                    </p>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Hospital Metrics & Statistics Banner */}
      <section className="bg-slate-900 text-white py-12 border-y border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <p className="text-4xl sm:text-5xl font-extrabold text-brand-400 tracking-tight">50,000+</p>
              <p className="text-slate-400 text-sm font-semibold mt-1">Patients Served</p>
            </div>
            <div>
              <p className="text-4xl sm:text-5xl font-extrabold text-medical-teal tracking-tight">120+</p>
              <p className="text-slate-400 text-sm font-semibold mt-1">Specialist Doctors</p>
            </div>
            <div>
              <p className="text-4xl sm:text-5xl font-extrabold text-emerald-400 tracking-tight">99.8%</p>
              <p className="text-slate-400 text-sm font-semibold mt-1">Prescription Accuracy</p>
            </div>
            <div>
              <p className="text-4xl sm:text-5xl font-extrabold text-indigo-400 tracking-tight">24 / 7</p>
              <p className="text-slate-400 text-sm font-semibold mt-1">Real-time Emergency Queue</p>
            </div>
          </div>
        </div>
      </section>

      {/* Core Features Grid */}
      <section id="features" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <h2 className="text-xs font-bold text-brand-600 uppercase tracking-widest">Comprehensive Modules</h2>
            <p className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Engineered for Complete Clinical & Administrative Excellence
            </p>
            <p className="text-slate-600 text-base">
              Everything modern medical centers require, built into one cohesive cloud interface.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="p-8 rounded-3xl bg-slate-50 border border-slate-200/80 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 group">
              <div className="w-12 h-12 rounded-2xl bg-brand-100 text-brand-600 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Stethoscope className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Electronic Medical Records</h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                Complete longitudinal patient timelines, vital sign trends, clinical diagnosis notes, and past consultation history.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="p-8 rounded-3xl bg-slate-50 border border-slate-200/80 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 group">
              <div className="w-12 h-12 rounded-2xl bg-teal-100 text-medical-teal flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <BrainCircuit className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">AI Department Recommendation</h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                Smart natural language symptom evaluation routing patients to appropriate specialty departments instantly.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="p-8 rounded-3xl bg-slate-50 border border-slate-200/80 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 group">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Activity className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Smart Queue Orchestration</h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                Real-time digital patient token queue, call-next patient actions, live wait-time forecasting, and check-in desk sync.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="p-8 rounded-3xl bg-slate-50 border border-slate-200/80 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 group">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Package className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Pharmacy Stock Forecasting</h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                Automated depletion prediction algorithms calculating remaining operational days and triggering low-stock reorder warnings.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="p-8 rounded-3xl bg-slate-50 border border-slate-200/80 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 group">
              <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <BedDouble className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Visual Bed & Room Grid</h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                Interactive floor-by-floor room grid showing real-time available, occupied, reserved, and maintenance status beds.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="p-8 rounded-3xl bg-slate-50 border border-slate-200/80 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 group">
              <div className="w-12 h-12 rounded-2xl bg-purple-100 text-purple-600 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <FileText className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Billing & Invoice Generator</h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                Itemized hospital charges for consultation, room, laboratory, and pharmacy with instant PDF receipt printing.
              </p>
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

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
            {[
              { name: 'Cardiology', code: 'CARD', count: '14 Specialists', icon: HeartPulse, color: 'text-rose-500 bg-rose-50' },
              { name: 'Neurology', code: 'NEUR', count: '10 Specialists', icon: BrainCircuit, color: 'text-indigo-500 bg-indigo-50' },
              { name: 'Orthopedics', code: 'ORTH', count: '12 Specialists', icon: Activity, color: 'text-emerald-500 bg-emerald-50' },
              { name: 'Pediatrics', code: 'PED', count: '9 Specialists', icon: Stethoscope, color: 'text-amber-500 bg-amber-50' },
              { name: 'Dermatology', code: 'DERM', count: '7 Specialists', icon: Microscope, color: 'text-purple-500 bg-purple-50' },
              { name: 'Gynecology', code: 'OBGYN', count: '11 Specialists', icon: Building2, color: 'text-pink-500 bg-pink-50' },
              { name: 'ENT Specialist', code: 'ENT', count: '8 Specialists', icon: PhoneCall, color: 'text-cyan-500 bg-cyan-50' },
              { name: 'Emergency Room', code: 'EMERG', count: '24/7 Response', icon: ShieldCheck, color: 'text-rose-600 bg-rose-100 font-bold' },
            ].map((dept) => {
              const IconComp = dept.icon;
              return (
                <div key={dept.code} className="p-6 rounded-2xl bg-white border border-slate-200 hover:shadow-md transition text-center space-y-3">
                  <div className={`w-12 h-12 rounded-2xl mx-auto flex items-center justify-center ${dept.color}`}>
                    <IconComp className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-base">{dept.name}</h4>
                    <span className="text-xs text-slate-500 font-medium">{dept.count}</span>
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
                {['AES-256 Data Encryption at rest and in transit', 'Immutable Audit Logs for every clinical action', 'Granular 8-Role Access Control (RBAC) Matrix'].map((item) => (
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
                <p className="text-emerald-400">✓ RBAC Check: Doctor / Admin privileges required</p>
                <p className="text-emerald-400">✓ Data Sanitization: MongoDB Injection Protected</p>
                <p className="text-brand-400">✓ Audit Logged: User Doctor_101 viewed P-2026-001</p>
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
