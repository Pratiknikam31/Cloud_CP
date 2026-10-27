import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { forgotPasswordApi, resetPasswordApi } from '../api/authApi';
import { Activity, Mail, Lock, KeyRound, ArrowRight, ShieldCheck, CheckCircle2, AlertCircle } from 'lucide-react';

export const ForgotPassword: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<'request' | 'reset'>('request');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [devOtp, setDevOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!email.trim()) {
      setError('Please provide your registered email address.');
      return;
    }

    setLoading(true);
    try {
      const res = await forgotPasswordApi(email.trim().toLowerCase());
      if (res.devOtp) {
        setDevOtp(res.devOtp);
      }
      setSuccess('If an account matches that email, a password reset code has been sent.');
      setStep('reset');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to send reset code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await resetPasswordApi({
        email: email.trim().toLowerCase(),
        otp: otp.trim(),
        newPassword,
      });
      setSuccess('Password reset successfully! Redirecting to login...');
      setTimeout(() => {
        navigate('/login', {
          state: { successMessage: 'Your password has been updated. Please sign in with your new password.' },
        });
      }, 1500);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to reset password. Please check your verification code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-slate-900 font-sans selection:bg-brand-500 selection:text-white">
      {/* Left Column: Branding banner */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-slate-950 via-slate-900 to-brand-950 p-12 flex-col justify-between overflow-hidden border-r border-slate-800">
        <div className="absolute top-0 right-0 -mt-20 -mr-20 w-96 h-96 rounded-full bg-brand-500/10 blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-96 h-96 rounded-full bg-medical-teal/10 blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex items-center justify-between">
          <Link to="/" className="flex items-center space-x-3 text-white group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-medical-teal flex items-center justify-center text-white shadow-lg shadow-brand-500/30 group-hover:scale-105 transition-transform">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <span className="text-2xl font-bold tracking-tight">
                Smart<span className="text-brand-400">Hospital</span>
              </span>
              <span className="block text-xs text-slate-400 tracking-wider font-mono">ACCOUNT RECOVERY</span>
            </div>
          </Link>
        </div>

        <div className="relative z-10 my-auto py-12 max-w-lg">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/30 text-brand-300 text-xs font-semibold uppercase tracking-wider mb-6">
            <ShieldCheck className="w-4 h-4 text-brand-400" />
            <span>Secure Password Recovery</span>
          </div>
          <h1 className="text-4xl font-extrabold text-white leading-tight tracking-tight mb-4">
            Regain access to your health records and services.
          </h1>
          <p className="text-slate-300 text-base leading-relaxed">
            We use multi-factor verification to safeguard patient records and clinical information. Follow the instructions to securely reset your credentials.
          </p>
        </div>

        <div className="relative z-10 text-xs text-slate-500 flex items-center justify-between border-t border-slate-800 pt-6">
          <span>&copy; 2026 SmartHospital System Inc.</span>
          <span>Security Protocol 256-bit AES</span>
        </div>
      </div>

      {/* Right Column: Reset Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 bg-white min-h-screen">
        <div className="w-full max-w-md space-y-8">
          <div>
            <Link to="/login" className="inline-flex items-center space-x-1.5 text-xs font-bold text-brand-600 hover:text-brand-700 uppercase tracking-wider mb-4">
              <span>&larr; Back to Sign In</span>
            </Link>
            <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">
              {step === 'request' ? 'Reset your password' : 'Enter verification code'}
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              {step === 'request'
                ? 'Enter your registered email address and we will generate a secure OTP verification code.'
                : `We sent a 6-digit verification code to ${email}.`}
            </p>
          </div>

          {error && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-start space-x-3 text-red-700 text-sm animate-shake">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start space-x-3 text-emerald-800 text-sm">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5 text-emerald-600" />
              <span>{success}</span>
            </div>
          )}

          {devOtp && (
            <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-xs">
              <span className="font-semibold block mb-1">Development Testing Code:</span>
              <span className="font-mono text-base font-bold text-blue-700 bg-white px-2.5 py-1 rounded border border-blue-200 inline-block">
                {devOtp}
              </span>
            </div>
          )}

          {step === 'request' ? (
            <form onSubmit={handleRequestOtp} className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-5 h-5" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@smarthospital.org"
                    className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-sm bg-slate-50 focus:bg-white transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-brand-600 to-medical-teal text-white font-bold text-sm shadow-md hover:shadow-lg hover:from-brand-700 hover:to-teal-700 transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    <span>Send Verification Code</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  6-Digit OTP Code
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <KeyRound className="w-5 h-5" />
                  </div>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    placeholder="123456"
                    className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-sm font-mono tracking-widest bg-slate-50 focus:bg-white transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  New Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-5 h-5" />
                  </div>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-sm bg-slate-50 focus:bg-white transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Confirm New Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-5 h-5" />
                  </div>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat password"
                    className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-sm bg-slate-50 focus:bg-white transition-all"
                  />
                </div>
              </div>

              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={() => setStep('request')}
                  className="w-1/3 py-3 px-4 rounded-xl border border-slate-200 text-slate-700 font-bold text-sm hover:bg-slate-50 transition-all"
                >
                  Change Email
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-2/3 py-3.5 px-4 rounded-xl bg-gradient-to-r from-brand-600 to-medical-teal text-white font-bold text-sm shadow-md hover:shadow-lg hover:from-brand-700 hover:to-teal-700 transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <span>Update Password</span>
                  )}
                </button>
              </div>
            </form>
          )}

          <p className="text-center text-xs text-slate-500">
            Remembered your password?{' '}
            <Link to="/login" className="font-bold text-brand-600 hover:underline">
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};
