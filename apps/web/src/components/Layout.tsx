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
import { SUPPORTED_LANGUAGES, languageByCode, speakText } from '../utils/i18n';
import toast from 'react-hot-toast';
import { useTranslation } from '../context/TranslationContext';

const farmerNav = [
  { name: 'Dashboard', href: '/dashboard', icon: Home },
  { name: 'Book Slot', href: '/booking', icon: Calendar },
  { name: 'Live Queue', href: '/queue', icon: Truck },
  { name: 'Payment Status', href: '/payment', icon: CreditCard },
  { name: 'My Profile', href: '/profile', icon: User },
];

export default function Layout() {
  const { farmer, logout } = useAuth();
  const { language, setLanguage, translating } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleLangChange = (code: string) => {
    setLanguage(code);
    const selected = languageByCode(code);
    toast.success(`Language set to ${selected?.nativeName || code}`);
    speakText(`AnnSetu platform language set to ${selected?.name || code}`, selected.speechCode);
  };

  const isCenterRoute = location.pathname.startsWith('/center');
  const isAdminRoute = location.pathname.startsWith('/admin');

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Top Banner / Role Switcher Header */}
      <header className="gov-header sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3 min-h-16 py-3">
            {/* Logo & Brand */}
            <div className="flex items-center gap-3">
              <div className="gov-emblem shrink-0">
                <span className="text-2xl font-bold text-primary-950">अ</span>
              </div>
              <div>
                <span className="text-xl font-bold tracking-tight flex items-center gap-1.5">
                  AnnSetu <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-blue-100 font-bold border border-emerald-500/30 hidden sm:inline">2026</span>
                </span>
                <span className="text-xs text-blue-100 block -mt-1 font-medium hidden sm:block">
                  Smart Farmer Procurement & Queue Platform
                </span>
              </div>
            </div>

            {/* Role Switcher Pill (Desktop) */}
            <div className="hidden lg:flex items-center bg-black/30 p-1 rounded-lg border border-white/10 shadow-inner">
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
                <Globe className="w-4 h-4 text-blue-100" />
                <select
                  value={language}
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
                {translating && <span className="text-xs text-blue-100">Translating...</span>}
              </div>

              {/* User Profile */}
              <NavLink
                to="/farmer/profile"
                className="flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/15 rounded-lg border border-white/10 transition-colors"
              >
                <User className="w-4 h-4 text-blue-100" />
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
              aria-expanded={mobileMenuOpen}
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
                <div className="text-xs font-bold uppercase tracking-wider text-blue-100 px-3">Switch Role</div>
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
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold text-blue-100 hover:bg-white/10"
                >
                  <Building2 className="w-4 h-4" /> Center Operator Dashboard
                </NavLink>
                <NavLink
                  to="/admin"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold text-blue-100 hover:bg-white/10"
                >
                  <BarChart3 className="w-4 h-4" /> Admin Command Center
                </NavLink>
              </div>

              {!isCenterRoute && !isAdminRoute && (
                <div className="border-t border-white/10 pt-2 space-y-1">
                  <div className="text-xs font-bold uppercase tracking-wider text-gray-400 px-3">Farmer Menu</div>
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
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <main id="main-content" tabIndex={-1} className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
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
