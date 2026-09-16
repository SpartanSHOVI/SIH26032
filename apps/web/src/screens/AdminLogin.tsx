import { useState } from 'react';
import { useNavigate, useLocation, Link, useSearchParams } from 'react-router-dom';
import { ShieldCheck, Lock, User, ArrowRight, Sparkles, AlertCircle, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { useAdminAuth } from '../context/AdminAuthContext';
import LanguageSelector from '../components/LanguageSelector';

export default function AdminLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const isExpired = searchParams.get('expired') === 'true';
  const { loginAdmin, loading } = useAdminAuth();

  const [credential, setCredential] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const from = (location.state as any)?.from?.pathname || '/admin';

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg('');
    try {
      await loginAdmin(credential, password);
      navigate(from, { replace: true });
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.error || 'Authentication rejected. Verify credentials.');
    }
  };

  const handleQuickDemoLogin = async () => {
    setCredential('admin');
    setPassword('admin123');
    setErrorMsg('');
    try {
      await loginAdmin('admin', 'admin123');
      navigate(from, { replace: true });
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.error || 'Quick demo authentication failed.');
    }
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
          <h1 className="text-3xl font-bold text-slate-900">AnnSetu Nodal Officer Login</h1>
          <p className="text-sm text-gov-blue">
            Government of India • National & State Procurement Command System
          </p>
        </div>

        {isExpired && (
          <div className="p-4 bg-amber-50/90 border border-amber-300 rounded-lg text-amber-900 text-sm flex items-center gap-3 shadow-xs">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <p className="font-semibold">Session Expired</p>
              <p className="text-xs text-amber-800">Your officer session timed out. Please authenticate again to continue.</p>
            </div>
          </div>
        )}

        {/* Nodal Officer Login Form */}
        <div className="gov-card p-6 sm:p-8 space-y-5">
          <div className="border-b border-gray-100 pb-3">
            <h2 className="text-lg font-bold text-gray-900">Sign in with Officer Credentials</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Authorized National and State Nodal Procurement Officers only
            </p>
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            {/* Officer ID Field */}
            <div>
              <label htmlFor="credential" className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                Officer Login Identifier / Service ID
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  id="credential"
                  type="text"
                  value={credential}
                  onChange={(e) => setCredential(e.target.value)}
                  placeholder="e.g. admin or ND-HQ-01"
                  className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:bg-white focus:border-emerald-500 transition-colors"
                  disabled={loading}
                  required
                />
              </div>
            </div>

            {/* Password / Access Key Field */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="password" className="block text-xs font-bold uppercase tracking-wider text-gray-700">
                  Access Key / Security PIN
                </label>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
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
              className="w-full bg-gov-navy hover:bg-gov-blue text-white font-bold py-3 px-4 rounded-lg transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Authenticate Officer Session</span>
                  <ArrowRight className="w-4 h-4 ml-1" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Access Button for SIH Demonstration */}
          <div className="pt-4 border-t border-gray-100 space-y-2">
            <button
              type="button"
              onClick={handleQuickDemoLogin}
              disabled={loading}
              className="w-full py-2.5 px-3 bg-slate-50 hover:bg-slate-100 text-gov-navy border border-slate-300 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>1-Click Quick Demo Login (Nodal Admin)</span>
            </button>
            <p className="text-[11px] text-gray-500 text-center">
              Pre-configured for SIH evaluations • Role: <code className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-700 font-mono">ADMIN</code>
            </p>
          </div>

          <div className="flex items-center justify-center gap-1.5 text-xs text-gray-400 pt-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Enclave Security Suite • TLS 1.3 Strict</span>
          </div>
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
