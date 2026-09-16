import { Outlet, useNavigate } from 'react-router-dom';
import { BarChart3, ShieldCheck, Activity, Globe, LogOut } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useTranslation } from '../context/TranslationContext';
import { useAdminAuth } from '../context/AdminAuthContext';
import { SUPPORTED_LANGUAGES, languageByCode, speakText } from '../utils/i18n';
import toast from 'react-hot-toast';

export default function AdminLayout() {
  const navigate = useNavigate();
  const { officer, logoutAdmin } = useAdminAuth();
  const { language, setLanguage, translating } = useTranslation();
  const [time, setTime] = useState(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleLangChange = (code: string) => {
    setLanguage(code);
    const selected = languageByCode(code);
    toast.success(`Nodal Portal language set to ${selected?.nativeName || code}`);
    speakText(`Nodal portal language set to ${selected?.name || code}`, selected.speechCode);
  };

  const handleLogout = () => {
    logoutAdmin();
    navigate('/admin/login');
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
      {/* Admin Command Center Header */}
      <header className="gov-header sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3 min-h-16 py-3">
            {/* National Command Brand */}
            <div className="flex items-center gap-3">
              <div className="gov-emblem shrink-0">
                <BarChart3 className="w-5 h-5 text-gov-navy" />
              </div>
              <div>
                <span className="text-xl font-bold tracking-tight flex items-center gap-2">
                  AnnSetu <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-blue-100 font-bold border border-indigo-500/30">Nodal Officer Portal</span>
                </span>
                <span className="text-xs text-blue-100 block -mt-0.5 font-medium">
                  Department of Agriculture & Farmers Welfare • Pan-India Mandi Monitoring
                </span>
              </div>
            </div>

            {/* National Telemetry Badges & Language Selector */}
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              {/* Language Selector */}
              <div className="flex items-center gap-1.5 bg-white/10 px-2 py-1 rounded-lg border border-white/10">
                <Globe className="w-3.5 h-3.5 text-blue-100" />
                <select
                  value={language}
                  onChange={(e) => handleLangChange(e.target.value)}
                  aria-label="Select Nodal Portal Language"
                  className="bg-transparent text-xs font-semibold text-white focus:outline-none cursor-pointer"
                >
                  {SUPPORTED_LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code} className="bg-slate-900 text-white">
                      {l.nativeName} ({l.name})
                    </option>
                  ))}
                </select>
                {translating && <span className="text-[10px] text-amber-300 animate-pulse font-medium">...</span>}
              </div>

              <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 bg-slate-800/80 rounded-lg border border-slate-700/60 text-xs text-slate-300">
                <span className="font-mono">{time}</span>
              </div>

              <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 bg-emerald-950/70 text-blue-100 rounded-lg border border-emerald-500/30 text-xs font-semibold">
                <Activity className="w-3.5 h-3.5 text-blue-100" />
                <span>4,129 Mandis</span>
              </div>

              <div className="flex items-center gap-1.5 text-xs text-blue-100 font-mono bg-indigo-900/40 px-2.5 py-1 rounded-md border border-indigo-700/50">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-100" />
                <span className="font-semibold">{officer?.officer_id || 'ND-HQ-01'}</span>
              </div>

              {/* Logout Button */}
              <button
                onClick={handleLogout}
                className="p-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors border border-slate-700"
                title="Sign out of Nodal Officer Portal"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Page Body */}
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <main id="main-content" tabIndex={-1} className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>© 2026 AnnSetu • Nodal Officer Portal</div>
          <div className="text-slate-400 font-mono">
            Procurement monitoring
          </div>
        </div>
      </footer>
    </div>
  );
}
