import { Outlet } from 'react-router-dom';
import { BarChart3, ShieldCheck, Activity, Globe } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function AdminLayout() {
  const [time, setTime] = useState(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
      {/* Admin Command Center Header */}
      <header className="bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 text-white shadow-xl sticky top-0 z-50 border-b border-indigo-900/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* National Command Brand */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-tr from-indigo-500 to-sky-400 rounded-xl flex items-center justify-center shadow-md shadow-indigo-950/50">
                <BarChart3 className="w-5 h-5 text-slate-950" />
              </div>
              <div>
                <span className="text-xl font-black tracking-tight flex items-center gap-2">
                  AnnSetu <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-bold border border-indigo-500/30">Nodal Command Center</span>
                </span>
                <span className="text-[10px] text-indigo-300/80 block -mt-0.5 font-medium">
                  Department of Agriculture & Farmers Welfare • Pan-India Mandi Monitoring
                </span>
              </div>
            </div>

            {/* National Telemetry Badges */}
            <div className="flex items-center gap-4">
              <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-slate-800/80 rounded-lg border border-slate-700/60 text-xs text-slate-300">
                <span className="font-mono">{time} IST</span>
              </div>

              <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-950/70 text-emerald-300 rounded-lg border border-emerald-500/30 text-xs font-semibold">
                <Activity className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                <span>4,129 APMC Mandis Monitored</span>
              </div>

              <div className="hidden md:flex items-center gap-1 text-xs text-slate-300">
                <Globe className="w-3.5 h-3.5 text-sky-400" />
                <span>All 36 States/UTs Connected</span>
              </div>

              <div className="flex items-center gap-1.5 text-xs text-indigo-300 font-mono bg-indigo-900/40 px-2.5 py-1 rounded-md border border-indigo-700/50">
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                <span>Officer ID: ND-HQ-01</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Page Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>© 2026 AnnSetu Nodal Command Center • Government of India</div>
          <div className="text-slate-400 font-mono">
            Portal Path: /admin • National Agmarknet Network
          </div>
        </div>
      </footer>
    </div>
  );
}
