import { Outlet, Navigate, useNavigate } from 'react-router-dom';
import { Building2, ShieldCheck, Volume2, Clock, LogOut, RefreshCw, Tag, MapPin } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useCenterAuth } from '../context/CenterAuthContext';

export default function CenterLayout() {
  const navigate = useNavigate();
  const { currentCenter, logoutCenter } = useCenterAuth();
  const [time, setTime] = useState(
    new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  );

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(
        new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Redirect to Center Operator Login if no center is currently authenticated
  if (!currentCenter) {
    return <Navigate to="/center/login" replace />;
  }

  return (
    <div className="min-h-screen bg-amber-50/40 flex flex-col font-sans">
      {/* Center Operator Terminal Header */}
      <header className="bg-gradient-to-r from-amber-950 via-amber-900 to-stone-900 text-white shadow-lg sticky top-0 z-50 border-b border-amber-800/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Operator Terminal Brand & Active Mandi Info */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-tr from-amber-500 to-amber-300 rounded-xl flex items-center justify-center shadow-md shadow-amber-950/50 shrink-0">
                <Building2 className="w-5 h-5 text-stone-950" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-base sm:text-lg font-black tracking-tight text-white line-clamp-1">
                    {currentCenter.center_name}
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                    {currentCenter.center_code}
                  </span>
                  <span className="hidden md:inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-amber-400/10 text-amber-200 border border-amber-400/20 font-semibold">
                    <Tag className="w-2.5 h-2.5" />
                    {currentCenter.classification || 'APMC Yard'}
                  </span>
                </div>
                <div className="text-[11px] text-amber-300/80 flex items-center gap-1.5 font-medium mt-0.5">
                  <MapPin className="w-3 h-3 text-amber-400 shrink-0" />
                  <span>{currentCenter.district}, {currentCenter.state}</span>
                  <span className="text-amber-500">•</span>
                  <span>Terminal Node: Gate 1 Active</span>
                </div>
              </div>
            </div>

            {/* Status Indicators, Clock & Switch Mandi Button */}
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 bg-amber-900/60 rounded-lg border border-amber-700/50 text-xs text-amber-200">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span className="font-mono font-bold">{time}</span>
              </div>

              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-emerald-950/60 text-emerald-300 rounded-lg border border-emerald-500/30 text-xs font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Gates Open</span>
              </div>

              <div className="hidden md:flex items-center gap-1 text-xs text-amber-200/80">
                <Volume2 className="w-3.5 h-3.5 text-amber-400" />
                <span>Chimes On</span>
              </div>

              <div className="flex items-center gap-1.5 text-xs text-amber-300 font-mono bg-white/10 px-2.5 py-1 rounded-md border border-white/10">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                <span className="line-clamp-1">{currentCenter.operator_name || currentCenter.operator_id}</span>
              </div>

              {/* Switch Mandi / Change Center Button */}
              <button
                onClick={() => navigate('/center/login')}
                className="flex items-center gap-1.5 px-3 py-1 bg-amber-500 hover:bg-amber-400 text-stone-950 rounded-lg text-xs font-bold transition-all shadow-sm shadow-amber-950/40"
                title="Switch Mandi or Classification"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Switch Mandi</span>
              </button>

              <button
                onClick={() => {
                  logoutCenter();
                  navigate('/center/login');
                }}
                className="p-1.5 bg-stone-800/80 hover:bg-stone-700 text-stone-300 hover:text-white rounded-lg transition-colors border border-stone-700"
                title="Sign out of Mandi Terminal"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Page Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-amber-200/60 py-4 text-center text-xs text-stone-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            © 2026 AnnSetu Mandi Operator Terminal • Authenticated Session:{' '}
            <strong>{currentCenter.center_name}</strong> ({currentCenter.center_code})
          </div>
          <div className="text-stone-400 font-mono">
            Classification: {currentCenter.classification || 'APMC Regulated'} • Node: /center
          </div>
        </div>
      </footer>
    </div>
  );
}
