import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Shield, Eye, EyeOff, Loader2, ArrowRight, UserCheck, Sparkles, Phone, Lock, ChevronDown, ChevronUp } from 'lucide-react';
import toast from 'react-hot-toast';

// Available registered demo profiles for fast role-based multi-user evaluation
const DEMO_PROFILES = [
  {
    name: 'Balwinder Singh',
    mobile: '9811223344',
    state: 'Punjab',
    district: 'Ludhiana',
    crop: 'Paddy',
    icon: '🌾',
    badge: 'Punjab Central Mandi',
  },
  {
    name: 'Anita Devi',
    mobile: '9822334455',
    state: 'Uttar Pradesh',
    district: 'Varanasi',
    crop: 'Mustard',
    icon: '🌱',
    badge: 'Varanasi Grain Mandi',
  },
  {
    name: 'Ramesh Patel',
    mobile: '9876543210',
    state: 'Maharashtra',
    district: 'Nagpur',
    crop: 'Wheat',
    icon: '🌾',
    badge: 'Wardha Road Mandi',
  },
  {
    name: 'Rajesh Kumar Sharma',
    mobile: '9833445566',
    state: 'Rajasthan',
    district: 'Jaipur',
    crop: 'Bajra',
    icon: '🌽',
    badge: 'Jaipur Grain APMC',
  },
  {
    name: 'Suresh Gowda',
    mobile: '9844556677',
    state: 'Karnataka',
    district: 'Bagalkot',
    crop: 'Ragi',
    icon: '🌾',
    badge: 'Bagalkot APMC',
  },
];

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [credential, setCredential] = useState('');
  const [password, setPassword] = useState('123456');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showProfiles, setShowProfiles] = useState(true);

  const handleLogin = async (credToUse?: string, pwdToUse?: string) => {
    const cred = (credToUse || credential).trim();
    const pwd = (pwdToUse || password).trim() || '123456';

    if (!cred) {
      toast.error('Please enter your 10-digit mobile number or Aadhaar number');
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

  const handleQuickLogin = async (profile: typeof DEMO_PROFILES[0]) => {
    setCredential(profile.mobile);
    setPassword('123456');
    await handleLogin(profile.mobile, '123456');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-primary-950 to-emerald-950 flex flex-col justify-center items-center px-4 py-10 font-sans">
      <div className="w-full max-w-xl space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 bg-gradient-to-tr from-amber-500 to-emerald-400 rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-emerald-950/60">
            <span className="text-3xl font-black text-primary-950">अ</span>
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">AnnSetu Kisan Login</h1>
          <p className="text-sm text-emerald-300">
            Dynamic Authentication • Every Farmer Gets Their Unique Identity & Queue
          </p>
        </div>

        {/* 1. Interactive Demo Farmer Switcher */}
        <div className="bg-slate-800/90 border border-emerald-500/30 rounded-2xl p-5 shadow-xl backdrop-blur-md">
          <div
            onClick={() => setShowProfiles(!showProfiles)}
            className="flex items-center justify-between cursor-pointer select-none"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                1-Click Test Accounts ({DEMO_PROFILES.length} Diverse State Profiles)
              </span>
            </div>
            <button className="text-emerald-400 hover:text-emerald-200">
              {showProfiles ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>

          {showProfiles && (
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {DEMO_PROFILES.map((p) => (
                <button
                  key={p.mobile}
                  onClick={() => handleQuickLogin(p)}
                  disabled={loading}
                  className="group text-left p-3 rounded-xl bg-slate-900/80 hover:bg-emerald-950/60 border border-white/10 hover:border-emerald-500 transition-all flex items-center justify-between shadow-sm"
                >
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center gap-1.5 font-bold text-white text-xs group-hover:text-emerald-300 transition-colors truncate">
                      <span>{p.icon}</span>
                      <span className="truncate">{p.name}</span>
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                      {p.mobile} • {p.crop}
                    </div>
                    <div className="text-[10px] text-emerald-400/90 font-medium truncate">
                      {p.state} ({p.district})
                    </div>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 2. Standard Unique Farmer Login Form */}
        <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 space-y-5">
          <div className="border-b border-gray-100 pb-3">
            <h2 className="text-lg font-bold text-gray-900">Sign in with Mobile or Aadhaar</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Enter your registered credentials or demo OTP (<code className="bg-gray-100 px-1 py-0.5 rounded text-primary-700 font-mono">123456</code>)
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
                  type="text"
                  value={credential}
                  onChange={(e) => setCredential(e.target.value)}
                  placeholder="e.g. 9811223344 or 12-digit Aadhaar"
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
                  Password or Demo OTP
                </label>
                <span className="text-[11px] text-emerald-600 font-semibold cursor-pointer hover:underline" onClick={() => setPassword('123456')}>
                  Use OTP 123456
                </span>
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
                  placeholder="Enter password or 123456"
                  className="w-full pl-9 pr-10 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:bg-white focus:border-emerald-500 transition-colors"
                  disabled={loading}
                />
                <button
                  type="button"
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
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-md shadow-emerald-600/30 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
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
              Want to create your own unique profile?
            </p>
            <Link
              to="/register"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-4 py-2 rounded-lg transition-colors"
            >
              <span>🌾 Register as New Unique Farmer</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="flex items-center justify-center gap-1.5 text-[11px] text-gray-400 pt-2">
            <Shield className="w-3.5 h-3.5 text-emerald-600" />
            <span>DPDP Act 2023 Compliant • Secure Role-Isolated Access</span>
          </div>
        </div>

        {/* Back to Portal Gateway */}
        <div className="text-center">
          <Link to="/" className="text-xs text-slate-400 hover:text-white transition-colors">
            ← Back to Role Gateway Selection (/portal)
          </Link>
        </div>
      </div>
    </div>
  );
}