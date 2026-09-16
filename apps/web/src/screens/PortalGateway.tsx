import { useNavigate } from 'react-router-dom';
import { ArrowRight, BarChart3, Building2, Database, ShieldCheck, UserRound } from 'lucide-react';
import LanguageSelector from '../components/LanguageSelector';

const portals = [
  {
    title: 'Farmer Portal',
    path: '/farmer',
    description: 'Book procurement slots, check token status, view queue movement, and track payment updates.',
    icon: UserRound,
    accent: 'border-l-[#2f7d32]',
  },
  {
    title: 'Procurement Center',
    path: '/center',
    description: 'Manage the daily queue, call the next farmer, update procurement stages, and record payment details.',
    icon: Building2,
    accent: 'border-l-[#d97706]',
  },
  {
    title: 'Nodal Dashboard',
    path: '/admin',
    description: 'Review center load, farmer registrations, demand prediction, slot generation, and mandi balancing.',
    icon: BarChart3,
    accent: 'border-l-[#1f5f99]',
  },
];

export default function PortalGateway() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen gov-page text-slate-800 flex flex-col relative overflow-hidden">
      {/* Subtle field background with low opacity */}
      <div
        className="absolute inset-0 pointer-events-none z-0 bg-cover bg-center bg-no-repeat opacity-50"
        style={{ backgroundImage: "url('/field-bg.jpg')" }}
        aria-hidden="true"
      />

      <header className="gov-header relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="gov-emblem">अ</div>
            <div>
              <p className="text-xs text-blue-100">Farmer procurement services</p>
              <h1 className="text-xl sm:text-2xl font-bold tracking-normal">AnnSetu</h1>
              <p className="text-sm text-blue-100">Farmer Procurement and Queue Service</p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <LanguageSelector theme="dark" />
            <div className="inline-flex items-center gap-2 rounded-md border border-white/25 bg-white/10 px-3 py-2 text-xs text-white self-start sm:self-auto">
              <Database className="w-4 h-4" />
              <span>APMC mandi network and state procurement support</span>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 relative z-10">
        <section className="border-b border-slate-200/80 bg-white/85 backdrop-blur-xs">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold text-[#d97706]">Procurement services</p>
              <h2 className="mt-2 text-3xl sm:text-4xl font-bold text-slate-950 tracking-normal">
                Select the AnnSetu service you want to use
              </h2>
              <p className="mt-3 text-base text-slate-700">
                A simple procurement support system for farmers, mandi operators, and nodal officers.
              </p>
            </div>
          </div>
        </section>

        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {portals.map((portal) => {
              const Icon = portal.icon;
              return (
                <button
                  key={portal.path}
                  onClick={() => navigate(portal.path)}
                  className={`gov-card border-l-4 ${portal.accent} p-5 text-left bg-white/90 backdrop-blur-xs hover:border-slate-400 hover:bg-white transition-all shadow-sm hover:shadow-md cursor-pointer`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="w-10 h-10 rounded-md bg-slate-100 border border-slate-200 flex items-center justify-center text-[#12385b]">
                      <Icon className="w-5 h-5" />
                    </div>
                    <ArrowRight className="w-5 h-5 text-slate-400 mt-1" />
                  </div>
                  <h3 className="mt-1 text-lg font-bold text-slate-950">{portal.title}</h3>
                  <p className="mt-2 text-sm text-slate-600 leading-6">{portal.description}</p>
                </button>
              );
            })}
          </div>

          <div className="mt-6 gov-card p-4 flex flex-col sm:flex-row sm:items-center gap-3 text-sm text-slate-700 bg-white/90 backdrop-blur-xs">
            <ShieldCheck className="w-5 h-5 text-[#2f7d32] shrink-0" />
            <span>Each portal opens only the tools required for that role, with clear navigation and secure access.</span>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200/80 bg-white/90 backdrop-blur-xs py-4 text-sm text-slate-600 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <span>AnnSetu - Farmer procurement services</span>
          <span>SIH demonstration project</span>
        </div>
      </footer>
    </div>
  );
}
