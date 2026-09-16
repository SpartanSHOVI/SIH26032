import { useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Shield, Eye, EyeOff, Loader2, ArrowRight, Phone, Lock, UserCheck, AlertTriangle, Search, TicketCheck } from 'lucide-react';
import LanguageSelector from '../components/LanguageSelector';
import toast from 'react-hot-toast';

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isExpired = searchParams.get('expired') === 'true';
  const { login } = useAuth();
  const [credential, setCredential] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [trackingValue, setTrackingValue] = useState('');

  const handleLogin = async (credToUse?: string, pwdToUse?: string) => {
    const cred = (credToUse || credential).trim();
    const pwd = (pwdToUse || password).trim();

    if (!cred) {
      toast.error('Please enter your 10-digit mobile number or Aadhaar number');
      return;
    }
    if (!pwd) {
      toast.error('Please enter your password or OTP');
      return;
    }

    setLoading(true);
    try {
      await login(cred, pwd);
      toast.success('Login successful! Welcome to AnnSetu.');
      navigate('/farmer/dashboard');
    } catch (error: any) {
      toast.error(
        error.response?.data?.error ||
        error.response?.data?.message ||
        'Authentication failed. Please verify your mobile number or register as a new farmer.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handlePublicTracking = (event: React.FormEvent) => {
    event.preventDefault();
    const value = trackingValue.trim();
    if (!value) {
      toast.error('Enter the mobile number used for booking or your token number');
      return;
    }
    navigate(`/track?value=${encodeURIComponent(value)}`);
  };

  return (
    <div className="min-h-screen gov-page text-slate-800 flex flex-col justify-center items-center px-4 py-10 font-sans relative">
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-10">
        <LanguageSelector theme="light" />
      </div>

      <div className="w-full max-w-xl space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="gov-emblem mx-auto">
            <span className="text-3xl font-black text-primary-950">अ</span>
          </div>
          <h1 className="text-3xl font-bold text-slate-900">AnnSetu Kisan Login</h1>
          <p className="text-sm text-gov-blue">
            Log in, register, or track an Assistant Booking without an account.
          </p>
        </div>

        {isExpired && (
          <div className="p-4 bg-amber-50/90 border border-amber-300 rounded-lg text-amber-900 text-sm flex items-center gap-3 shadow-xs">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <p className="font-semibold">Session Expired</p>
              <p className="text-xs text-amber-800">Your previous session timed out. Please sign in again to continue.</p>
            </div>
          </div>
        )}

        {/* Farmer Login Form */}
        <div className="gov-card p-6 sm:p-8 space-y-5">
          <div className="border-b border-gray-100 pb-3">
            <h2 className="text-lg font-bold text-gray-900">Sign in with Mobile or Aadhaar</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Enter your registered mobile number or 12-digit Aadhaar number
            </p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleLogin();
            }}
            className="space-y-4"
          >
            {/* Credential Field */}
            <div>
              <label htmlFor="credential" className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                Mobile Number or 12-Digit Aadhaar
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <Phone className="w-4 h-4" />
                </div>
                <input
                  id="credential"
                  autoComplete="username"
                  inputMode="numeric"
                  type="text"
                  value={credential}
                  onChange={(e) => setCredential(e.target.value)}
                  placeholder="e.g. 98XXXXXXXX or 12-digit Aadhaar"
                  className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:bg-white focus:border-emerald-500 transition-colors"
                  disabled={loading}
                  required
                />
              </div>
            </div>

            {/* Password / OTP Field */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="password" className="block text-xs font-bold uppercase tracking-wider text-gray-700">
                  Password or OTP
                </label>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="password"
                  autoComplete="current-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password or OTP"
                  className="w-full pl-9 pr-10 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:bg-white focus:border-emerald-500 transition-colors"
                  disabled={loading}
                  required
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || !credential}
              className="w-full bg-gov-navy hover:bg-gov-blue text-white font-bold py-3 px-4 rounded-lg transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verifying credentials...</span>
                </>
              ) : (
                <>
                  <UserCheck className="w-4 h-4" />
                  <span>Log In to Farmer Portal</span>
                </>
              )}
            </button>
          </form>

          {/* Direct link to Register */}
          <div className="pt-4 border-t border-gray-100 text-center space-y-2">
            <p className="text-xs text-gray-600">
              New to AnnSetu?
            </p>
            <Link
              to="/register"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-4 py-2 rounded-lg transition-colors"
            >
              <span>Register as a farmer</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="flex items-center justify-center gap-1.5 text-xs text-gray-400 pt-2">
            <Shield className="w-3.5 h-3.5 text-emerald-600" />
            <span>AnnSetu farmer procurement services</span>
          </div>
        </div>

        {/* Assisted booking access — no AnnSetu account required */}
        <div className="gov-card overflow-hidden border-emerald-200">
          <div className="bg-emerald-50 border-b border-emerald-200 px-6 py-4 flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-700 text-white flex items-center justify-center shrink-0">
              <TicketCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Assistant Booking — track without login</h2>
              <p className="text-xs text-emerald-900 mt-0.5">
                If a procurement-centre assistant booked your slot, view the complete journey without registering or signing in.
              </p>
            </div>
          </div>

          <form onSubmit={handlePublicTracking} className="p-6 space-y-3">
            <label htmlFor="public-booking-lookup" className="block text-xs font-bold uppercase tracking-wider text-gray-700">
              Mobile number or token number
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  id="public-booking-lookup"
                  type="text"
                  inputMode="text"
                  autoComplete="tel"
                  value={trackingValue}
                  onChange={(event) => setTrackingValue(event.target.value)}
                  placeholder="e.g. 98XXXXXXXX or PUN0011001"
                  className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:bg-white focus:border-emerald-500 transition-colors"
                />
              </div>
              <button
                type="submit"
                className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-5 py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <span>View my booking</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[11px] text-gray-500 flex items-start gap-1.5">
              <Shield className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
              Read-only access shows masked personal details, live queue position, procurement progress and payment status.
            </p>
          </form>
        </div>

        {/* Back to Portal Gateway */}
        <div className="text-center">
          <Link to="/" className="text-xs text-slate-600 hover:text-gov-navy transition-colors">
            ← Back to AnnSetu services
          </Link>
        </div>
      </div>
    </div>
  );
}
