import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import {
  LogOut,
  Home,
  Calendar,
  Truck,
  CreditCard,
  User,
  Menu,
  X,
  Globe,
  PackageCheck,
  PhoneCall
} from 'lucide-react';
import { useState } from 'react';
import { SUPPORTED_LANGUAGES, speakText } from '../utils/i18n';
import HelplineModal from './HelplineModal';
import toast from 'react-hot-toast';

const farmerNav = [
  { name: 'Dashboard', href: '/farmer/dashboard', icon: Home },
  { name: 'Book Slot', href: '/farmer/booking', icon: Calendar },
  { name: 'Live Queue', href: '/farmer/queue', icon: Truck },
  { name: 'Procurement', href: '/farmer/procurement', icon: PackageCheck },
  { name: 'Payment Status', href: '/farmer/payment', icon: CreditCard },
  { name: 'My Profile', href: '/farmer/profile', icon: User },
];

export default function FarmerLayout() {
  const { farmer, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [currentLang, setCurrentLang] = useState('en');
  const [isHelplineOpen, setIsHelplineOpen] = useState(false);
  const [helplineTab, setHelplineTab] = useState<'ivr' | 'ussd' | 'voice_updates'>('ivr');

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleLangChange = (code: string) => {
    setCurrentLang(code);
    const selected = SUPPORTED_LANGUAGES.find((l) => l.code === code);
    toast.success(`Language set to ${selected?.nativeName || code}`);
    speakText(`AnnSetu platform language set to ${selected?.name || code}`);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Farmer Portal Header */}
      <header className="bg-gradient-to-r from-emerald-950 via-emerald-900 to-primary-950 text-white shadow-lg sticky top-0 z-50 border-b border-emerald-800/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo & Brand */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-tr from-amber-500 to-emerald-400 rounded-xl flex items-center justify-center shadow-md shadow-emerald-950/50">
                <span className="text-2xl font-black text-primary-950">अ</span>
              </div>
              <div>
                <span className="text-xl font-black tracking-tight flex items-center gap-1.5">
                  AnnSetu <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">Kisan Portal</span>
                </span>
                <span className="text-[10px] text-emerald-300/80 block -mt-0.5 font-medium hidden sm:block">
                  Smart Farmer Procurement & Queue Platform
                </span>
              </div>
            </div>

            {/* Language Selector + Helpline + Profile / Logout (Desktop) */}
            <div className="hidden md:flex items-center gap-3">
              {/* Toll-Free Helpline & USSD Gateway Trigger */}
              <button
                onClick={() => {
                  setHelplineTab('ivr');
                  setIsHelplineOpen(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-bold text-xs shadow-md shadow-amber-950/40 hover:scale-105 active:scale-95 transition-all border border-amber-300"
                title="Toll-Free Helpline & USSD Gateway for Low-Literacy / 2G Phones"
              >
                <PhoneCall className="w-3.5 h-3.5 animate-pulse text-slate-950" />
                <span>1800-180-SETU / *555#</span>
              </button>

              {/* Language Selector */}
              <div className="flex items-center gap-1 bg-white/10 px-2.5 py-1.5 rounded-lg border border-white/10">
                <Globe className="w-4 h-4 text-emerald-300" />
                <select
                  value={currentLang}
                  onChange={(e) => handleLangChange(e.target.value)}
                  aria-label="Select language"
                  className="bg-transparent text-xs font-semibold text-white focus:outline-none cursor-pointer"
                >
                  {SUPPORTED_LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code} className="bg-primary-950 text-white">
                      {l.nativeName} ({l.name})
                    </option>
                  ))}
                </select>
              </div>

              {/* User Profile */}
              <NavLink
                to="/farmer/profile"
                className="flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/15 rounded-lg border border-white/10 transition-colors"
              >
                <User className="w-4 h-4 text-emerald-300" />
                <span className="text-xs font-semibold">{farmer?.name || 'Farmer'}</span>
              </NavLink>

              <button
                onClick={handleLogout}
                className="p-2 text-emerald-200 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>

            {/* Mobile Menu Hamburger */}
            <button
              className="md:hidden p-2 rounded-lg text-emerald-100 hover:bg-emerald-800"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

          {/* Subnav for Farmer Navigation Links (Desktop) */}
          <div className="hidden md:flex items-center gap-1 py-2 border-t border-white/10">
            {farmerNav.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.name}
                  to={item.href}
                  className={({ isActive }) =>
                    `flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      isActive
                        ? 'bg-white/20 text-white shadow-sm'
                        : 'text-emerald-100 hover:text-white hover:bg-white/10'
                    }`
                  }
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{item.name}</span>
                </NavLink>
              );
            })}
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-emerald-950/95 backdrop-blur-md border-t border-emerald-800/80 px-4 pt-3 pb-6 space-y-3">
            {/* Toll-Free Quick Dial Button Mobile */}
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                setHelplineTab('ivr');
                setIsHelplineOpen(true);
              }}
              className="w-full flex items-center justify-center gap-2 p-2.5 rounded-lg bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-bold text-xs shadow-md"
            >
              <PhoneCall className="w-4 h-4" />
              <span>टोल-फ्री हेल्पलाइन (1800-180-SETU / *555#)</span>
            </button>

            {/* Language Selector Mobile */}
            <div className="flex items-center justify-between p-2.5 bg-white/5 rounded-lg">
              <span className="text-xs font-semibold text-emerald-200 flex items-center gap-1.5">
                <Globe className="w-4 h-4" /> Voice & Language
              </span>
              <select
                value={currentLang}
                onChange={(e) => handleLangChange(e.target.value)}
                className="bg-emerald-900 text-xs font-semibold text-white px-2 py-1 rounded border border-white/20"
              >
                {SUPPORTED_LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code} className="bg-emerald-950 text-white">
                    {l.nativeName} ({l.name})
                  </option>
                ))}
              </select>
            </div>

            {/* Nav Links */}
            <div className="space-y-1 pt-1">
              {farmerNav.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.name}
                    to={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${
                        isActive
                          ? 'bg-emerald-700 text-white font-bold'
                          : 'text-emerald-100 hover:bg-white/5 hover:text-white'
                      }`
                    }
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.name}</span>
                  </NavLink>
                );
              })}
            </div>

            {/* Mobile User & Logout */}
            <div className="pt-3 border-t border-white/10 flex items-center justify-between">
              <div className="text-xs text-emerald-200">
                Logged in as <span className="font-bold text-white">{farmer?.name || 'Farmer'}</span>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 text-xs text-rose-300 hover:text-rose-100 font-semibold px-2 py-1 bg-rose-950/50 rounded"
              >
                <LogOut className="w-3.5 h-3.5" /> Logout
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Main Page Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Outlet />
      </main>

      {/* Toll-Free Helpline & USSD Modal */}
      <HelplineModal
        isOpen={isHelplineOpen}
        onClose={() => setIsHelplineOpen(false)}
        defaultTab={helplineTab}
      />

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>© 2026 AnnSetu Kisan Portal • Department of Agriculture & Farmers Welfare</div>
          <div className="flex items-center gap-4 text-slate-400">
            <span>AgriStack Enabled</span>
            <span>•</span>
            <span>Little's Law Dynamic Queuing</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
