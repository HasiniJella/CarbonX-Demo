import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Home, Compass, ShoppingCart, Wallet, Menu, Bell, Globe, X, LogOut,
  ShieldCheck, ClipboardList, BarChart3, Sprout, Building2, ChevronLeft,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import OfflineBanner from './OfflineBanner';
import FarmerVoiceAssistant from '../features/voice-agent/FarmerVoiceAssistant';

const ROLE_NAV = {
  farmer: [
    { label: 'navHome', path: '/', icon: Sprout },
    { label: 'navDashboard', path: '/farmer/dashboard', icon: Home },
    { label: 'navLandVerification', path: '/farmer/land-verification', icon: ShieldCheck },
    { label: 'navCarbonPassport', path: '/farmer/passport/TEL-124A', icon: Compass },
    { label: 'navMarketplace', path: '/marketplace', icon: ShoppingCart },
    { label: 'navWalletLedger', path: '/farmer/wallet', icon: Wallet },
    { label: 'navSupport', path: '/support', icon: ClipboardList },
  ],
  fpo: [
    { label: 'navHome', path: '/', icon: Sprout },
    { label: 'navFpoDashboard', path: '/fpo/dashboard', icon: Building2 },
    { label: 'navCreditPooling', path: '/fpo/credit-pooling', icon: ShieldCheck },
    { label: 'navMarketplace', path: '/marketplace', icon: ShoppingCart },
    { label: 'navSupport', path: '/support', icon: ClipboardList },
  ],
  buyer: [
    { label: 'navHome', path: '/', icon: Sprout },
    { label: 'navEsgDashboard', path: '/corporate/dashboard', icon: Home },
    { label: 'navMarketplace', path: '/marketplace', icon: ShoppingCart },
    { label: 'navBulkAutoMatch', path: '/marketplace/checkout', icon: BarChart3 },
    { label: 'navCertificates', path: '/buyer/certificates/CX-2026-CERT-00123', icon: ShieldCheck },
    { label: 'navSupport', path: '/support', icon: ClipboardList },
  ],
  verifier: [
    { label: 'navHome', path: '/', icon: Sprout },
    { label: 'navFpoAuditDesk', path: '/fpo/dashboard', icon: Home },
    { label: 'navAdminCompliance', path: '/admin/dashboard', icon: ShieldCheck },
    { label: 'navMarketplace', path: '/marketplace', icon: ShoppingCart },
    { label: 'navSupport', path: '/support', icon: ClipboardList },
  ],
  admin: [
    { label: 'navHome', path: '/', icon: Sprout },
    { label: 'navAdminDashboard', path: '/admin/dashboard', icon: Home },
    { label: 'navFpoDesk', path: '/fpo/dashboard', icon: Building2 },
    { label: 'navMarketplace', path: '/marketplace', icon: ShoppingCart },
    { label: 'navSupport', path: '/support', icon: ClipboardList },
  ],
};

const ROLE_META = {
  farmer:   { label: 'roleFarmer',   classes: 'bg-emerald-50 text-emerald-800 border border-emerald-200' },
  fpo:      { label: 'roleFpo',      classes: 'bg-amber-50 text-amber-800 border border-amber-200' },
  buyer:    { label: 'roleBuyer',    classes: 'bg-sky-50 text-sky-800 border border-sky-200' },
  verifier: { label: 'roleVerifier', classes: 'bg-amber-50 text-amber-800 border border-amber-200' },
  admin:    { label: 'roleAdmin',    classes: 'bg-rose-50 text-rose-800 border border-rose-200' },
};

export default function Layout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { t, changeLanguage, currentLang } = useLanguage();
  const { user, logout, role, isAuthenticated } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);

  const navItems = ROLE_NAV[role] || ROLE_NAV.farmer;
  const roleMeta = ROLE_META[role] || ROLE_META.farmer;

  const displayName = user?.name || 'User';
  const displayLocation = [user?.village, user?.district].filter(Boolean).join(', ');
  const initials = displayName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'U';

  const isPublicPage =
    location.pathname === '/' ||
    location.pathname === '/role-selection' ||
    location.pathname === '/farmer-register' ||
    location.pathname === '/farmer-login' ||
    location.pathname === '/fpo/login' ||
    location.pathname === '/fpo-login' ||
    location.pathname === '/corporate/login' ||
    location.pathname === '/corporate-login';

  const isActive = (path) => {
    if (location.pathname === path) return true;
    if (path === '/dashboard' && location.pathname.startsWith('/dashboard')) return true;
    if (path === '/farm-analytics' && ['/farm-analytics', '/farm-map', '/farm-details', '/satellite-preview', '/submission-success'].includes(location.pathname)) return true;
    return false;
  };

  useEffect(() => { setSidebarOpen(false); }, [location.pathname]);
  useEffect(() => { setShowAccountMenu(false); setShowNotifications(false); }, [location.pathname]);

  useEffect(() => {
    if (!showAccountMenu) return undefined;
    const close = (e) => {
      if (e.key === 'Escape') setShowAccountMenu(false);
      else if (e.type === 'mousedown' && !e.target.closest?.('[data-account-menu]')) setShowAccountMenu(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [showAccountMenu]);

  const goTo = (path) => { navigate(path); setSidebarOpen(false); };
  // Logged-out users land back on the main dashboard (landing page).
  const handleLogout = () => { logout(); setShowAccountMenu(false); navigate('/'); };

  const dashboardPath = '/dashboard';
  const walletPath = role === 'buyer' ? '/corporate/dashboard' : '/farmer/wallet';

  const renderNavItems = () => navItems.map((item) => {
    const active = isActive(item.path);
    const Icon = item.icon;
    return (
      <button
        key={item.path}
        onClick={() => goTo(item.path)}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
          active
            ? 'bg-forest-100 text-forest-900 shadow-sm'
            : 'text-carbon-500 hover:bg-forest-50 hover:text-forest-800'
        }`}
      >
        <Icon size={18} className={active ? 'text-forest-700' : 'text-carbon-400'} />
        <span>{t(item.label)}</span>
      </button>
    );
  });

  const renderUserBlock = () => (
    <div className="pt-3 border-t border-forest-100">
      <button onClick={() => goTo(dashboardPath)} title={t('openDashboard')}
        className="w-full flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-forest-50 transition-colors text-left">
        <div className="w-9 h-9 bg-forest-100 flex items-center justify-center text-xs font-bold text-forest-800 rounded-full shrink-0">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-carbon-800 truncate">{displayName}</p>
          {displayLocation && <p className="text-[10px] text-carbon-400 truncate">{displayLocation}</p>}
        </div>
      </button>
    </div>
  );

  if (isPublicPage) {
    return <div className="min-h-screen bg-warm-white">{children}</div>;
  }

  return (
    <div className="min-h-screen bg-warm-white flex flex-col">
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-forest-100/60 flex justify-between items-center gap-2 px-3 py-2 sm:px-4 sm:py-3 pt-safe shadow-sm">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-forest-50 rounded-xl text-carbon-700 transition-colors md:hidden"
          >
            <Menu size={20} />
          </button>
          <span
            className="font-manrope font-extrabold text-base sm:text-lg text-forest-800 tracking-tight cursor-pointer shrink-0"
            onClick={() => navigate('/')}
            title={t('navHome')}
          >
            CarbonX
          </span>
          {isAuthenticated && (
            <span className={`hidden sm:inline-block text-[10px] font-bold px-2 py-0.5 rounded-lg uppercase tracking-wide truncate ${roleMeta.classes}`}>
              {t(roleMeta.label)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          <div className="flex items-center gap-1 bg-forest-50/80 border border-forest-100 rounded-xl px-1.5 sm:px-2.5 py-1 text-xs text-forest-900 font-semibold">
            <Globe size={13} className="text-forest-700" />
            <select
              value={currentLang}
              onChange={e => changeLanguage(e.target.value)}
              className="bg-transparent border-none outline-none text-xs font-bold text-forest-900 focus:ring-0 cursor-pointer"
            >
              <option value="en">English</option>
              <option value="hi">हिन्दी</option>
              <option value="te">తెలుగు</option>
            </select>
          </div>

          {isAuthenticated && (
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-2 hover:bg-forest-50 rounded-xl text-carbon-700 transition-colors relative"
            >
              <Bell size={18} />
            </button>
          )}

          {isAuthenticated ? (
            <div className="relative" data-account-menu>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setShowAccountMenu(!showAccountMenu); setShowNotifications(false); }}
                  title="Account"
                  className={`w-8 h-8 flex items-center justify-center text-xs font-bold rounded-full transition-colors ${showAccountMenu ? 'bg-forest-800 text-white' : 'bg-forest-100 text-forest-800 hover:bg-forest-200'}`}
                >
                  {initials}
                </button>
                <button
                  onClick={handleLogout}
                  className="hidden sm:block p-2 hover:bg-rose-50 rounded-xl text-carbon-600 hover:text-rose-600 transition-colors"
                  title={t('logoutMenu')}
                >
                  <LogOut size={18} />
                </button>
              </div>
              {showAccountMenu && (
                <div className="absolute right-0 top-10 z-50 w-60 bg-white border border-forest-100 rounded-2xl shadow-xl p-2">
                  <div className="px-3 py-2.5 border-b border-forest-50 mb-1">
                    <p className="text-xs font-bold text-carbon-800 truncate">{displayName}</p>
                    {displayLocation && <p className="text-[10px] text-carbon-400 truncate">{displayLocation}</p>}
                    <span className={`inline-block mt-1.5 text-[10px] font-bold px-2 py-0.5 rounded-lg uppercase tracking-wide ${roleMeta.classes}`}>
                      {t(roleMeta.label)}
                    </span>
                  </div>
                  <button onClick={() => goTo(dashboardPath)}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold text-carbon-700 hover:bg-forest-50 transition-colors">
                    <Home size={16} className="text-carbon-400" /><span>{t('myDashboard')}</span>
                  </button>
                  <button onClick={() => goTo(walletPath)}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold text-carbon-700 hover:bg-forest-50 transition-colors">
                    <Wallet size={16} className="text-carbon-400" /><span>{t('walletMenu')}</span>
                  </button>
                  <button onClick={() => goTo('/support')}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold text-carbon-700 hover:bg-forest-50 transition-colors">
                    <ClipboardList size={16} className="text-carbon-400" /><span>{t('supportMenu')}</span>
                  </button>
                  <div className="border-t border-forest-50 mt-1 pt-1">
                    <button onClick={handleLogout}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors">
                      <LogOut size={16} /><span>{t('logoutMenu')}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => navigate('/farmer-login')}
              className="text-xs font-bold text-forest-800 hover:text-forest-900 px-3 py-1.5 rounded-xl hover:bg-forest-50 transition-colors"
            >
              {t('loginMenu')}
            </button>
          )}
        </div>
      </header>

      <OfflineBanner />

      {showNotifications && isAuthenticated && (
        <div className="fixed top-14 right-4 z-40 bg-white border border-forest-100 rounded-2xl shadow-xl p-4 w-80 max-w-[calc(100vw-2rem)] max-h-96 overflow-y-auto">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-xs font-bold text-carbon-800">{t('notifTitle')}</h3>
            <button onClick={() => setShowNotifications(false)} className="p-1 hover:bg-forest-50 rounded-lg">
              <X size={14} />
            </button>
          </div>
          <p className="text-xs text-carbon-400 text-center py-4">{t('notifEmpty')}</p>
        </div>
      )}

      <div className="flex flex-1">
        <aside className="hidden md:flex flex-col w-56 bg-white border-r border-forest-100/60 p-4 sticky top-[57px] h-[calc(100vh-57px)]">
          <nav className="flex-1 space-y-1">{renderNavItems()}</nav>
          {isAuthenticated && renderUserBlock()}
        </aside>

        {sidebarOpen && (
          <>
            <div className="fixed inset-0 z-40 bg-black/30 md:hidden" onClick={() => setSidebarOpen(false)} />
            <aside className="fixed left-0 top-0 bottom-0 z-50 w-64 bg-white border-r border-forest-100 p-4 md:hidden flex flex-col">
              <div className="flex justify-between items-center mb-4">
                <span className="font-manrope font-extrabold text-lg text-forest-800 cursor-pointer" onClick={() => goTo('/')}>CarbonX</span>
                <button onClick={() => setSidebarOpen(false)} className="p-2 hover:bg-forest-50 rounded-xl">
                  <X size={18} />
                </button>
              </div>
              <nav className="flex-1 space-y-1">{renderNavItems()}</nav>
              {isAuthenticated && (
                <div className="pt-3 border-t border-forest-100">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors"
                  >
                    <LogOut size={16} />
                    <span>{t('logoutMenu')}</span>
                  </button>
                </div>
              )}
            </aside>
          </>
        )}

        <main className="flex-1 overflow-x-hidden pb-20 md:pb-0">
          {children}
        </main>
      </div>

      {isAuthenticated && role === 'farmer' && <FarmerVoiceAssistant />}

      <nav className="fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-xl border-t border-forest-100/50 py-2.5 px-4 pb-safe flex justify-around items-center md:hidden shadow-lg">
        {navItems.slice(0, 5).map((item) => {
          const active = isActive(item.path);
          const Icon = item.icon;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className="flex flex-col items-center justify-center gap-1 transition-all duration-200 flex-1"
            >
              <div className={active ? 'px-4 py-1.5 bg-forest-100 rounded-full flex items-center justify-center shadow-sm' : 'px-4 py-1.5 text-carbon-400'}>
                <Icon size={20} className={active ? 'text-forest-800' : 'text-carbon-400'} />
              </div>
              <span className={`text-[10px] font-bold mt-0.5 ${active ? 'text-carbon-800' : 'text-carbon-400'}`}>
                {t(item.label)}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
