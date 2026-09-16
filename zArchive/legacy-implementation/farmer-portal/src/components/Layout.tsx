import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
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
  Building2,
  BarChart3,
  Globe
} from 'lucide-react';
import { useState } from 'react';
import { SUPPORTED_LANGUAGES, speakText } from '../utils/i18n';
import toast from 'react-hot-toast';

const farmerNav = [
  { name: 'Dashboard', href: '/dashboard', icon: Home },
  { name: 'Book Slot', href: '/booking', icon: Calendar },
  { name: 'Live Queue', href: '/queue', icon: Truck },
  { name: 'Payment Status', href: '/payment', icon: CreditCard },
  { name: 'My Profile', href: '/profile', icon: User },
];

export default function Layout() {
  const { farmer, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [currentLang, setCurrentLang] = useState('en');

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

  const isCenterRoute = location.pathname.startsWith('/center');
  const isAdminRoute = location.pathname.startsWith('/admin');

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Top Banner / Role Switcher Header */}
      <header className="bg-gradient-to-r from-primary-950 via-primary-900 to-emerald-950 text-white shadow-lg sticky top-0 z-50 border-b border-primary-800/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo & Brand */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-tr from-amber-500 to-emerald-400 rounded-xl flex items-center justify-center shadow-md shadow-emerald-950/50">
                <span className="text-2xl font-black text-primary-950">अ</span>
              </div>
              <div>
                <span className="text-xl font-black tracking-tight flex items-center gap-1.5">
                  AnnSetu <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30 hidden sm:inline">2026</span>
                </span>
                <span className="text-[10px] text-emerald-300/80 block -mt-1 font-medium hidden sm:block">
                  Smart Farmer Procurement & Queue Platform
                </span>
              </div>
            </div>

            {/* Role Switcher Pill (Desktop) */}
            <div className="hidden lg:flex items-center bg-black/30 p-1 rounded-xl border border-white/10 shadow-inner">
              <NavLink
                to="/dashboard"
                className={() =>
                  `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    !isCenterRoute && !isAdminRoute
                      ? 'bg-emerald-600 text-white shadow'
                      : 'text-primary-200 hover:text-white hover:bg-white/5'
                  }`
                }
              >
                <span>🌾</span> Farmer Portal
              </NavLink>
              <NavLink
                to="/center"
                className={() =>
                  `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    isCenterRoute
                      ? 'bg-amber-600 text-white shadow'
                      : 'text-primary-200 hover:text-white hover:bg-white/5'
                  }`
                }
              >
                <Building2 className="w-3.5 h-3.5" /> Center Operator
              </NavLink>
              <NavLink
                to="/admin"
                className={() =>
                  `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    isAdminRoute
                      ? 'bg-indigo-600 text-white shadow'
                      : 'text-primary-200 hover:text-white hover:bg-white/5'
                  }`
                }
              >
                <BarChart3 className="w-3.5 h-3.5" /> Admin Command
              </NavLink>
            </div>

            {/* Language Selector + Profile / Logout */}
            <div className="hidden md:flex items-center gap-3">
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
                className="p-2 text-primary-200 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>

            {/* Mobile Menu Hamburger */}
            <button
              className="lg:hidden p-2 rounded-lg text-primary-100 hover:bg-primary-800"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

          {/* Subnav for Farmer Portal Navigation */}
          {!isCenterRoute && !isAdminRoute && (
            <div className="hidden md:flex items-center gap-1 py-2 border-t border-white/10">
              {farmerNav.map((item) => (
                <NavLink
                  key={item.name}
                  to={item.href}
                  className={({ isActive }) =>
                    `flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      isActive
                        ? 'bg-white/20 text-white shadow-sm'
                        : 'text-primary-200 hover:bg-white/10 hover:text-white'
                    }`
                  }
                >
                  <item.icon className="w-4 h-4" />
                  {item.name}
                </NavLink>
              ))}
            </div>
          )}

          {/* Mobile Menu Dropdown */}
          {mobileMenuOpen && (
            <div className="lg:hidden py-4 border-t border-primary-800 space-y-3">
              <div className="space-y-1">
                <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 px-3">Switch Role</div>
                <NavLink
                  to="/dashboard"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold text-white hover:bg-white/10"
                >
                  <span>🌾</span> Farmer Portal
                </NavLink>
                <NavLink
                  to="/center"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold text-amber-300 hover:bg-white/10"
                >
                  <Building2 className="w-4 h-4" /> Center Operator Dashboard
                </NavLink>
                <NavLink
                  to="/admin"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold text-indigo-300 hover:bg-white/10"
                >
                  <BarChart3 className="w-4 h-4" /> Admin Command Center
                </NavLink>
              </div>

              {!isCenterRoute && !isAdminRoute && (
                <div className="border-t border-white/10 pt-2 space-y-1">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400 px-3">Farmer Menu</div>
                  {farmerNav.map((item) => (
                    <NavLink
                      key={item.name}
                      to={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-200 hover:bg-white/10"
                    >
                      <item.icon className="w-4 h-4" />
                      {item.name}
                    </NavLink>
                  ))}
                </div>
              )}

              <div className="border-t border-white/10 pt-3 flex items-center justify-between px-3">
                <div className="text-sm font-semibold">{farmer?.name || 'Farmer'}</div>
                <button
                  onClick={handleLogout}
                  className="text-xs text-rose-400 font-bold flex items-center gap-1"
                >
                  <LogOut className="w-3.5 h-3.5" /> Logout
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-primary-950 text-primary-300 py-6 mt-auto border-t border-primary-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-xs space-y-1">
          <p className="font-bold text-primary-200">
            AnnSetu (अन्न सेतु) — Smart Farmer Procurement & Queue Platform
          </p>
          <p className="text-primary-400">
            Unified Queue Infrastructure for State Procurement Boards & AgriStack Farmer Registry
          </p>
        </div>
      </footer>
    </div>
  );
}