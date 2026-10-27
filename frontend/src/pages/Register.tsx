import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { sendOtpApi } from '../api/authApi';
import { 
  Activity, 
  User, 
  Mail, 
  Lock, 
  Phone, 
  ArrowRight, 
  ArrowLeft, 
  ShieldAlert, 
  KeyRound, 
  CheckCircle2, 
  RefreshCw 
} from 'lucide-react';
import { UserRole } from '../types';

export const Register: React.FC = () => {
  const navigate = useNavigate();
  const { register } = useAuth();

  // Form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<UserRole>('patient');
  const [otp, setOtp] = useState('');

  // Flow states
  const [step, setStep] = useState<'form' | 'otp'>('form');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [devOtpNotice, setDevOtpNotice] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  // Countdown timer for resend OTP
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  // Step 1: Send OTP to user's email
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setDevOtpNotice('');

    if (!name.trim() || !email.trim() || !password || password.length < 6) {
      setError('Please fill in all required fields and ensure password is at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      const res = await sendOtpApi(email.trim().toLowerCase());
      if (res.devOtp) {
        setDevOtpNotice(res.devOtp);
      }
      setStep('otp');
      setResendCooldown(45);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to send OTP to email.');
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    setError('');
    setDevOtpNotice('');
    setLoading(true);
    try {
      const res = await sendOtpApi(email.trim().toLowerCase());
      if (res.devOtp) {
        setDevOtpNotice(res.devOtp);
      }
      setResendCooldown(45);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to resend verification code.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTP and finalize registration
  const handleVerifyAndRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!otp.trim()) {
      setError('Please enter the 6-digit OTP code sent to your email.');
      return;
    }

    setLoading(true);
    try {
      await register({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        phone: phone.trim(),
        role,
        otp: otp.trim(),
      });

      navigate('/login', {
        state: {
          successMessage: 'Email verified & account registered successfully! Please log in.',
          registeredEmail: email.trim().toLowerCase(),
        },
      });
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Verification failed. Please check OTP code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 font-sans p-6 selection:bg-brand-500 selection:text-white">
      <div className="w-full max-w-lg bg-white rounded-3xl p-8 sm:p-10 shadow-2xl space-y-6">
        
        {/* Header */}
        <div className="text-center">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-brand-600 to-medical-teal flex items-center justify-center text-white mx-auto mb-4 shadow-lg shadow-brand-500/20">
            {step === 'form' ? <Activity className="w-6 h-6" /> : <KeyRound className="w-6 h-6" />}
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {step === 'form' ? 'Create SmartHospital Account' : 'Verify Your Email'}
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            {step === 'form'
              ? 'Enter your details to receive an OTP verification code via AWS SES.'
              : `We sent a 6-digit verification code to ${email}`}
          </p>
        </div>

        {/* Error notification */}
        {error && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-start space-x-3">
            <ShieldAlert className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
            <div>{error}</div>
          </div>
        )}

        {/* Dev / SES notice banner */}
        {devOtpNotice && (
          <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-xs sm:text-sm space-y-1">
            <div className="flex items-center space-x-2 font-bold text-blue-800">
              <CheckCircle2 className="w-4 h-4 text-blue-600" />
              <span>AWS Verification Code Active</span>
            </div>
            <p className="text-blue-700">
              Email sent via AWS SES. (Sandbox testing code: <strong className="font-mono text-base text-blue-950 bg-blue-100 px-2 py-0.5 rounded">{devOtpNotice}</strong>)
            </p>
          </div>
        )}

        {step === 'form' ? (
          /* ================= STEP 1: REGISTRATION FORM ================= */
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div className="p-3.5 bg-brand-50 border border-brand-200 rounded-xl flex items-center justify-between">
              <div>
                <span className="block text-xs font-bold text-brand-900 uppercase tracking-wider">Account Type</span>
                <span className="text-sm font-semibold text-brand-700">Patient Portal Account</span>
              </div>
              <span className="text-[11px] font-medium text-slate-500 bg-white px-2 py-1 rounded-md border border-brand-100 shadow-sm">
                Staff provisioned by Admin
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Full Name</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="w-5 h-5" />
                </div>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Dr. Eleanor Vance / Jane Doe"
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm bg-slate-50 focus:bg-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Email Address</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-5 h-5" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@gmail.com"
                    className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm bg-slate-50 focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Phone Number</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Phone className="w-5 h-5" />
                  </div>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1 (555) 019-2834"
                    className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm bg-slate-50 focus:bg-white"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-5 h-5" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm bg-slate-50 focus:bg-white"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-brand-600 to-medical-teal text-white font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center space-x-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <span>Send OTP Verification Code</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        ) : (
          /* ================= STEP 2: OTP INPUT FORM ================= */
          <form onSubmit={handleVerifyAndRegister} className="space-y-6">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 text-center">
                Enter 6-Digit Verification Code
              </label>
              <div className="relative max-w-xs mx-auto">
                <input
                  type="text"
                  maxLength={6}
                  required
                  autoFocus
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="------"
                  className="w-full py-3 text-center text-3xl font-mono font-bold tracking-[0.5em] rounded-xl border-2 border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/20 text-slate-900 bg-slate-50 focus:bg-white"
                />
              </div>
              <p className="text-center text-xs text-slate-500 mt-2">
                Check your inbox (or spam) for the code sent to <strong className="text-slate-800">{email}</strong>.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || otp.length < 4}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-brand-600 to-medical-teal text-white font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Verify Email & Complete Registration</span>
                </>
              )}
            </button>

            <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setStep('form');
                  setError('');
                }}
                className="flex items-center space-x-1 text-slate-600 hover:text-slate-900 font-semibold"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Change Email / Details</span>
              </button>

              <button
                type="button"
                disabled={resendCooldown > 0 || loading}
                onClick={handleResendOtp}
                className={`flex items-center space-x-1 font-semibold ${
                  resendCooldown > 0 ? 'text-slate-400 cursor-not-allowed' : 'text-brand-600 hover:underline'
                }`}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>{resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend Code'}</span>
              </button>
            </div>
          </form>
        )}

        <p className="text-center text-xs text-slate-500 border-t border-slate-100 pt-4">
          Already have an account?{' '}
          <Link to="/login" className="font-bold text-brand-600 hover:underline">
            Sign In Here
          </Link>
        </p>
      </div>
    </div>
  );
};
