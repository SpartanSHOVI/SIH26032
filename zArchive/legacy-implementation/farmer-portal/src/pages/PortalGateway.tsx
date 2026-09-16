import { useNavigate } from 'react-router-dom';
import { Building2, BarChart3, ArrowRight, ShieldCheck, Database } from 'lucide-react';

export default function PortalGateway() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-primary-950 to-emerald-950 text-white flex flex-col justify-between font-sans">
      {/* Header */}
      <header className="px-6 py-6 max-w-7xl mx-auto w-full flex items-center justify-between border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-tr from-amber-500 to-emerald-400 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-950/50">
            <span className="text-2xl font-black text-primary-950">अ</span>
          </div>
          <div>
            <span className="text-xl font-black tracking-tight">AnnSetu 2026</span>
            <span className="text-xs text-emerald-300 block -mt-1 font-medium">
              National Agricultural Procurement & Dynamic Queue Platform
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono bg-white/10 px-3 py-1.5 rounded-full border border-white/15">
          <Database className="w-3.5 h-3.5 text-emerald-400" />
          <span>4,129 APMC Mandis • All 36 States/UTs</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-12 w-full space-y-10">
        <div className="text-center space-y-3 max-w-3xl mx-auto">
          <span className="text-xs font-bold uppercase tracking-widest text-emerald-400 bg-emerald-950/80 px-3 py-1 rounded-full border border-emerald-500/30">
            Role-Based Enterprise Access
          </span>
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            Select Your Designated Portal Path
          </h1>
          <p className="text-sm sm:text-base text-slate-300">
            AnnSetu maintains distinct website paths and isolated dashboard environments for each operational role.
          </p>
        </div>

        {/* Role Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* 1. Farmer Portal */}
          <div
            onClick={() => navigate('/farmer')}
            className="group bg-slate-800/80 hover:bg-emerald-950/40 rounded-2xl p-6 border-2 border-emerald-800/50 hover:border-emerald-500 transition-all cursor-pointer shadow-xl flex flex-col justify-between relative overflow-hidden"
          >
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                🌾
              </div>
              <div>
                <div className="text-xs font-bold text-emerald-400 font-mono uppercase tracking-wider">Website Path: /farmer</div>
                <h2 className="text-xl font-bold text-white mt-1">Kisan Portal</h2>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Dedicated interface for registered farmers. Discover APMC Mandis by State and District, book 4 hourly slot windows, monitor live queue position with Little's Law, and track DBT payments.
              </p>
            </div>
            <div className="pt-6 mt-6 border-t border-white/10 flex items-center justify-between text-emerald-400 text-xs font-bold group-hover:text-emerald-300">
              <span>Open Farmer Portal</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* 2. Procurement Center Operator */}
          <div
            onClick={() => navigate('/center')}
            className="group bg-slate-800/80 hover:bg-amber-950/40 rounded-2xl p-6 border-2 border-amber-800/50 hover:border-amber-500 transition-all cursor-pointer shadow-xl flex flex-col justify-between relative overflow-hidden"
          >
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-amber-600/20 text-amber-400 border border-amber-500/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Building2 className="w-6 h-6" />
              </div>
              <div>
                <div className="text-xs font-bold text-amber-400 font-mono uppercase tracking-wider">Website Path: /center</div>
                <h2 className="text-xl font-bold text-white mt-1">Mandi Operator Terminal</h2>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Dedicated terminal for procurement center staff. Manage physical queue entries, trigger the next farmer with audio chimes, advance procurement stages, record weight, and broadcast emergency alerts.
              </p>
            </div>
            <div className="pt-6 mt-6 border-t border-white/10 flex items-center justify-between text-amber-400 text-xs font-bold group-hover:text-amber-300">
              <span>Open Operator Terminal</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* 3. Admin Command Center */}
          <div
            onClick={() => navigate('/admin')}
            className="group bg-slate-800/80 hover:bg-indigo-950/40 rounded-2xl p-6 border-2 border-indigo-800/50 hover:border-indigo-500 transition-all cursor-pointer shadow-xl flex flex-col justify-between relative overflow-hidden"
          >
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                <BarChart3 className="w-6 h-6" />
              </div>
              <div>
                <div className="text-xs font-bold text-indigo-400 font-mono uppercase tracking-wider">Website Path: /admin</div>
                <h2 className="text-xl font-bold text-white mt-1">Nodal Command Center</h2>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Command center for state and national agricultural nodal officers. Real-time congestion monitoring across 4,129 mandis, 14-day historical weekday demand prediction, and smart slot balancing tools.
              </p>
            </div>
            <div className="pt-6 mt-6 border-t border-white/10 flex items-center justify-between text-indigo-400 text-xs font-bold group-hover:text-indigo-300">
              <span>Open Admin Command</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </div>

        {/* Role Isolation Note */}
        <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-center max-w-2xl mx-auto flex items-center justify-center gap-2 text-xs text-slate-400">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Each portal is strictly isolated to its designated path without cross-role navigation on dashboards.</span>
        </div>
      </main>

      {/* Footer */}
      <footer className="px-6 py-4 max-w-7xl mx-auto w-full text-center text-xs text-slate-500 border-t border-white/10">
        AnnSetu 2026 • Department of Agriculture & Farmers Welfare • Government of India
      </footer>
    </div>
  );
}
