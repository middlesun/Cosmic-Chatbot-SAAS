import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Coins,
  Database,
  HeartHandshake,
  Home,
  LayoutGrid,
  LifeBuoy,
  Lock,
  LogOut,
  Menu,
  MessageSquare,
  NotebookPen,
  PanelLeftClose,
  ScrollText,
  Settings,
  ShieldCheck,
  Star,
  Unlock,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from './AuthContext';
import SetPasswordModal from './SetPasswordModal';
import SupportModal from './SupportModal';
import BackupModal from './BackupModal';
import AccountSettingsModal from './AccountSettingsModal';
import FloatingScrollControls from '../FloatingScrollControls';
import Tooltip from './Tooltip';
import UserAvatar from './UserAvatar';
import PendingOnboardingHydrator from './PendingOnboardingHydrator';
import { getUserProfileDisplayLabel } from './chatUtilities';
import { COMPANION_LABEL_PLURAL } from './chatTypes';

const APP_SIDEBAR_LOCK_KEY = 'cc_app_sidebar_locked';
const APP_SIDEBAR_OPEN_KEY = 'cc_app_sidebar_open';

interface AppShellContextValue {
  openSupport: () => void;
  openBackup: () => void;
  openAccountSettings: () => void;
}

const AppShellContext = createContext<AppShellContextValue>({
  openSupport: () => {},
  openBackup: () => {},
  openAccountSettings: () => {},
});

export const useAppShell = () => useContext(AppShellContext);

const AppLayout: React.FC = () => {
  const { appUser, isPasswordRecovery, isPreviewMode, exitPreviewMode, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isChatRoute = location.pathname.startsWith('/app/chat');

  const [isSidebarLocked, setIsSidebarLocked] = useState<boolean>(() => {
    return localStorage.getItem(APP_SIDEBAR_LOCK_KEY) === 'true';
  });
  const [isDesktopSidebarOpen, setIsDesktopSidebarOpen] = useState<boolean>(() => {
    if (localStorage.getItem(APP_SIDEBAR_LOCK_KEY) === 'true') {
      const savedOpen = localStorage.getItem(APP_SIDEBAR_OPEN_KEY);
      if (savedOpen === 'true' || savedOpen === 'false') {
        return savedOpen === 'true';
      }
    }
    return !isChatRoute;
  });
  const [showMobileNavDrawer, setShowMobileNavDrawer] = useState(false);

  const [showSupportModal, setShowSupportModal] = useState(false);
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [showAccountSettingsModal, setShowAccountSettingsModal] = useState(false);
  const mainScrollRef = useRef<HTMLDivElement | null>(null);

  // Auto-collapse left app rail on Chat (Home) unless user locked their sidebar preference
  useEffect(() => {
    if (!isSidebarLocked) {
      setIsDesktopSidebarOpen(!isChatRoute);
    }
    setShowMobileNavDrawer(false);
  }, [isChatRoute, isSidebarLocked]);

  // Reset right-pane scroll cleanly when switching non-chat pages
  useEffect(() => {
    if (!isChatRoute && mainScrollRef.current) {
      mainScrollRef.current.scrollTop = 0;
    }
  }, [location.pathname, isChatRoute]);

  const handleToggleDesktopSidebar = () => {
    setIsDesktopSidebarOpen((prev) => {
      const next = !prev;
      localStorage.setItem(APP_SIDEBAR_OPEN_KEY, String(next));
      return next;
    });
  };

  const handleToggleSidebarLock = () => {
    setIsSidebarLocked((prev) => {
      const next = !prev;
      localStorage.setItem(APP_SIDEBAR_LOCK_KEY, String(next));
      localStorage.setItem(APP_SIDEBAR_OPEN_KEY, String(isDesktopSidebarOpen));
      return next;
    });
  };

  const handleSignOut = async () => {
    if (isPreviewMode) {
      exitPreviewMode();
    } else {
      await signOut();
    }
    navigate('/app/login');
  };

  const lowCreditsThreshold =
    appUser?.tier === 'guru' ? 8000 : appUser?.tier === 'pro' ? 2500 : 500;
  const isLowCredits =
    typeof appUser?.credits_balance === 'number' &&
    appUser.credits_balance < lowCreditsThreshold;

  const desktopNavLinkClass = ({ isActive }: { isActive: boolean }) =>
    `group w-full flex items-center ${
      isDesktopSidebarOpen ? 'gap-3 px-3' : 'justify-center px-0'
    } rounded-xl py-2.5 text-[13px] font-medium transition-colors whitespace-nowrap ${
      isActive
        ? 'bg-[#FAF7F2] text-[#3D3830] shadow-xs border border-[#3D3830]/12'
        : 'text-[#5C5449] hover:bg-[#FAF7F2]/65 hover:text-[#3D3830] border border-transparent'
    }`;

  const mobileNavLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors ${
      isActive
        ? 'bg-[#FAF7F2] text-[#3D3830] shadow-xs border border-[#3D3830]/12'
        : 'text-[#5C5449] hover:bg-[#FAF7F2]/70 hover:text-[#3D3830]'
    }`;

  const desktopActionBtnClass = `group w-full flex items-center ${
    isDesktopSidebarOpen ? 'gap-3 px-3' : 'justify-center px-0'
  } rounded-xl py-2.5 text-[13px] font-medium text-[#5C5449] hover:bg-[#FAF7F2]/65 hover:text-[#3D3830] transition-colors whitespace-nowrap cursor-pointer`;

  return (
    <AppShellContext.Provider
      value={{
        openSupport: () => setShowSupportModal(true),
        openBackup: () => setShowBackupModal(true),
        openAccountSettings: () => setShowAccountSettingsModal(true),
      }}
    >
      <div
        className={`bg-[#FAF7F2] text-[#3D3830] font-['Plus_Jakarta_Sans',sans-serif] flex overflow-x-hidden ${
          isChatRoute ? 'h-[100dvh] overflow-hidden' : 'min-h-screen md:h-[100dvh] md:overflow-hidden'
        }`}
      >
        {/* DESKTOP LEFT HAMBURGER SIDEBAR NAVIGATION (Always fixed full-height on desktop) */}
        <aside
          aria-label="Workspace navigation"
          className={`hidden md:flex flex-col shrink-0 h-full bg-[#EAE3D7]/65 border-r border-[#3D3830]/12 transition-all duration-200 ${
            isDesktopSidebarOpen ? 'w-60' : 'w-[60px]'
          }`}
        >
          {/* Sidebar Top Row: Brand + Lock Pin + Hamburger Toggle */}
          <div
            className={`flex ${
              isDesktopSidebarOpen
                ? 'items-center justify-between px-3.5 py-3.5'
                : 'flex-col items-center gap-1.5 px-2 py-2.5'
            } border-b border-[#3D3830]/10`}
          >
            {isDesktopSidebarOpen && (
              <Link
                to="/app/home"
                className="font-serif text-xl font-medium tracking-tight text-[#3D3830] truncate"
              >
                Cosmic Council
              </Link>
            )}

            <div
              className={`flex items-center ${
                isDesktopSidebarOpen ? 'gap-1.5' : 'flex-col gap-1.5'
              } shrink-0`}
            >
              <button
                type="button"
                onClick={handleToggleDesktopSidebar}
                aria-label={isDesktopSidebarOpen ? 'Collapse navigation menu' : 'Expand navigation menu'}
                className="p-2 rounded-xl border border-[#3D3830]/12 bg-[#FAF7F2]/80 text-[#3D3830] hover:bg-[#FDFBF7] transition-colors cursor-pointer shrink-0"
              >
                {isDesktopSidebarOpen ? (
                  <PanelLeftClose className="h-4 w-4" />
                ) : (
                  <Menu className="h-4 w-4" />
                )}
              </button>

              <button
                type="button"
                onClick={handleToggleSidebarLock}
                aria-pressed={isSidebarLocked}
                aria-label={isSidebarLocked ? 'Unlock sidebar state' : 'Lock sidebar state across pages'}
                className={`p-2 rounded-xl border transition-colors cursor-pointer shrink-0 ${
                  isSidebarLocked
                    ? 'border-[#8B7355]/40 bg-[#DFD5C5] text-[#3D3830] shadow-xs hover:bg-[#D7CCB9]'
                    : 'border-[#3D3830]/12 bg-[#FAF7F2]/60 text-[#8B8275] hover:text-[#3D3830] hover:bg-[#FDFBF7]'
                }`}
              >
                {isSidebarLocked ? (
                  <Lock className="h-3.5 w-3.5" />
                ) : (
                  <Unlock className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          </div>

          {/* Primary Menu Links */}
          <nav className="flex-1 overflow-y-auto px-2.5 py-3 space-y-1">
            <NavLink to="/app/home" aria-label="Home" className={desktopNavLinkClass}>
              <Home className="h-4 w-4 shrink-0 text-[#8B7355]" />
              {isDesktopSidebarOpen && <span>Home</span>}
            </NavLink>

            <NavLink to="/app/chat" aria-label="Chat" className={desktopNavLinkClass}>
              <MessageSquare className="h-4 w-4 shrink-0 text-[#8B7355]" />
              {isDesktopSidebarOpen && <span>Chat</span>}
            </NavLink>

            <NavLink to="/app/companions" aria-label={COMPANION_LABEL_PLURAL} className={desktopNavLinkClass}>
              <HeartHandshake className="h-4 w-4 shrink-0 text-[#8B7355]" />
              {isDesktopSidebarOpen && <span>{COMPANION_LABEL_PLURAL}</span>}
            </NavLink>

            <NavLink to="/app/notes" aria-label="Notes" className={desktopNavLinkClass}>
              <NotebookPen className="h-4 w-4 shrink-0 text-[#8B7355]" />
              {isDesktopSidebarOpen && <span>Notes</span>}
            </NavLink>

            <NavLink to="/app/favourites" aria-label="Favourites" className={desktopNavLinkClass}>
              <Star className="h-4 w-4 shrink-0 text-[#8B7355]" />
              {isDesktopSidebarOpen && <span>Favourites</span>}
            </NavLink>

            <NavLink to="/app/profiles" aria-label="Profiles" className={desktopNavLinkClass}>
              <Users className="h-4 w-4 shrink-0 text-[#8B7355]" />
              {isDesktopSidebarOpen && <span>Profiles</span>}
            </NavLink>

            <NavLink to="/app/apps" aria-label="Apps" className={desktopNavLinkClass}>
              <LayoutGrid className="h-4 w-4 shrink-0 text-[#8B7355]" />
              {isDesktopSidebarOpen && <span>Apps</span>}
            </NavLink>

            <NavLink to="/app/reports" aria-label="Reports" className={desktopNavLinkClass}>
              <ScrollText className="h-4 w-4 shrink-0 text-[#8B7355]" />
              {isDesktopSidebarOpen && <span>Reports</span>}
            </NavLink>

            <NavLink
              to="/app/billing"
              aria-label={isLowCredits ? 'Credits (Low balance)' : 'Credits'}
              className={desktopNavLinkClass}
            >
              <Coins
                className={`h-4 w-4 shrink-0 ${
                  isLowCredits ? 'text-[#7A3E36]' : 'text-[#8B7355]'
                }`}
              />
              {isDesktopSidebarOpen && (
                <div className="flex flex-1 items-center justify-between gap-2 min-w-0">
                  <span>Credits</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-['DM_Sans',sans-serif] tabular-nums whitespace-nowrap ${
                      isLowCredits
                        ? 'bg-[#7A3E36]/12 text-[#7A3E36] font-medium'
                        : 'bg-[#EAE3D7] text-[#3D3830]'
                    }`}
                  >
                    {isLowCredits ? 'Low · ' : ''}
                    {appUser ? appUser.credits_balance.toLocaleString() : '0'}
                  </span>
                </div>
              )}
            </NavLink>

            {appUser?.is_admin && !isPreviewMode && (
              <div className="pt-2 mt-2 border-t border-[#3D3830]/10">
                <Tooltip
                  content={!isDesktopSidebarOpen ? 'Admin panel' : undefined}
                  placement="right"
                  className="w-full"
                >
                  <NavLink to="/app/admin" aria-label="Admin" className={desktopNavLinkClass}>
                    <ShieldCheck className="h-4 w-4 shrink-0 text-[#8B7355]" />
                    {isDesktopSidebarOpen && <span>Admin</span>}
                  </NavLink>
                </Tooltip>
              </div>
            )}
          </nav>

          {/* Bottom Anchored Utility Controls: Profile ID, Settings, Backup, Support, Sign Out */}
          <div className="mt-auto border-t border-[#3D3830]/10 px-2.5 py-3 space-y-1">
            {isPreviewMode ? (
              isDesktopSidebarOpen && (
                <div className="mb-2 rounded-xl bg-[#FDFBF7] border border-[#3D3830]/12 px-3 py-2 text-[11px] text-[#5C5449]">
                  <p className="font-medium text-[#3D3830]">Design Preview Mode</p>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="mt-1 font-medium text-[#3D3830] underline underline-offset-4"
                  >
                    Go to Sign In
                  </button>
                </div>
              )
            ) : (
              <Tooltip
                content={
                  !isDesktopSidebarOpen && appUser?.email
                    ? `Signed in as ${appUser.email}`
                    : undefined
                }
                placement="right"
                className="w-full"
              >
                <button
                  type="button"
                  onClick={() => setShowAccountSettingsModal(true)}
                  aria-label={
                    appUser?.email ? `Account: ${appUser.email}` : 'Account settings'
                  }
                  className={`w-full flex items-center ${
                    isDesktopSidebarOpen ? 'gap-2.5 px-2.5 py-2' : 'justify-center px-0 py-1.5'
                  } rounded-xl text-left hover:bg-[#FAF7F2]/65 transition-colors cursor-pointer`}
                >
                  <UserAvatar size="sm" />
                  {isDesktopSidebarOpen && (
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-[#3D3830]">
                        {getUserProfileDisplayLabel(appUser, 'Signed In')}
                      </p>
                    </div>
                  )}
                </button>
              </Tooltip>
            )}

            <button
              type="button"
              onClick={() => setShowAccountSettingsModal(true)}
              aria-label="Settings"
              className={desktopActionBtnClass}
            >
              <Settings className="h-4 w-4 shrink-0 text-[#8B7355]" />
              {isDesktopSidebarOpen && <span>Settings</span>}
            </button>

            <button
              type="button"
              onClick={() => setShowBackupModal(true)}
              aria-label="Backup"
              className={desktopActionBtnClass}
            >
              <Database className="h-4 w-4 shrink-0 text-[#8B7355]" />
              {isDesktopSidebarOpen && <span>Backup</span>}
            </button>

            <button
              type="button"
              onClick={() => setShowSupportModal(true)}
              aria-label="Support"
              className={desktopActionBtnClass}
            >
              <LifeBuoy className="h-4 w-4 shrink-0 text-[#8B7355]" />
              {isDesktopSidebarOpen && <span>Support</span>}
            </button>

            <button
              type="button"
              onClick={handleSignOut}
              aria-label={isPreviewMode ? 'Exit Preview' : 'Sign Out'}
              className={`w-full flex items-center ${
                isDesktopSidebarOpen ? 'gap-3 px-3' : 'justify-center px-0'
              } rounded-xl py-2.5 text-[13px] font-medium text-[#7A3E36] hover:bg-[#FAF7F2]/65 transition-colors whitespace-nowrap cursor-pointer`}
            >
              <LogOut className="h-4 w-4 shrink-0" />
              {isDesktopSidebarOpen && (
                <span>{isPreviewMode ? 'Exit Preview' : 'Sign Out'}</span>
              )}
            </button>
          </div>
        </aside>

        {/* MAIN VIEWPORT AREA */}
        <div
          className={`flex-1 min-w-0 flex flex-col ${
            isChatRoute ? 'h-full overflow-hidden' : 'md:h-full md:overflow-hidden'
          }`}
        >
          {/* Mobile Compact Top Header (hidden on /app/chat where ChatSidebar hosts navigation) */}
          {!isChatRoute && (
            <header className="md:hidden sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-[#3D3830]/10 bg-[#EAE3D7]/80 backdrop-blur-md px-4 py-3">
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowMobileNavDrawer(true)}
                  aria-label="Open menu"
                  className="p-2 rounded-xl border border-[#3D3830]/12 bg-[#FAF7F2] text-[#3D3830]"
                >
                  <Menu className="h-4 w-4" />
                </button>
                <Link
                  to="/app/home"
                  className="font-serif text-lg font-medium text-[#3D3830]"
                >
                  Cosmic Council
                </Link>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Link
                  to="/app/billing"
                  aria-label={isLowCredits ? 'Credits balance low' : 'Credits balance'}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-['DM_Sans',sans-serif] tabular-nums ${
                    isLowCredits
                      ? 'bg-[#7A3E36]/10 border-[#7A3E36]/25 text-[#7A3E36] font-medium'
                      : 'bg-[#FAF7F2] border-[#3D3830]/10 text-[#3D3830]'
                  }`}
                >
                  <Coins
                    className={`h-3.5 w-3.5 ${
                      isLowCredits ? 'text-[#7A3E36]' : 'text-[#8B7355]'
                    }`}
                  />
                  <span>
                    {isLowCredits ? 'Low · ' : ''}
                    {appUser ? appUser.credits_balance.toLocaleString() : '0'}
                  </span>
                </Link>

                <button
                  type="button"
                  onClick={() => setShowAccountSettingsModal(true)}
                  aria-label="Open account settings"
                  className="inline-flex items-center justify-center rounded-full border border-[#3D3830]/12 bg-[#FAF7F2] p-0.5 active:scale-[0.97] transition-all cursor-pointer"
                >
                  <UserAvatar size="sm" />
                </button>
              </div>
            </header>
          )}

          {/* Mobile Slide-Over Navigation Drawer for Non-Chat Routes */}
          {showMobileNavDrawer && !isChatRoute && (
            <div className="fixed inset-0 z-50 flex md:hidden">
              <div
                className="fixed inset-0 bg-[#1F2229]/45 backdrop-blur-xs"
                onClick={() => setShowMobileNavDrawer(false)}
              />
              <aside className="relative z-10 flex w-72 max-w-[85vw] h-full flex-col bg-[#F1ECE3] border-r border-[#3D3830]/12 shadow-2xl">
                <div className="flex items-center justify-between px-5 py-4 border-b border-[#3D3830]/10">
                  <span className="font-serif text-xl font-medium text-[#3D3830]">
                    Cosmic Council
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowMobileNavDrawer(false)}
                    aria-label="Close navigation menu"
                    className="p-1.5 rounded-full text-[#8B8275] hover:text-[#3D3830]"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <nav className="flex-1 overflow-y-auto p-3 space-y-1">
                  <NavLink
                    to="/app/home"
                    onClick={() => setShowMobileNavDrawer(false)}
                    className={mobileNavLinkClass}
                  >
                    <Home className="h-4 w-4 text-[#8B7355]" />
                    <span>Home</span>
                  </NavLink>
                  <NavLink
                    to="/app/chat"
                    onClick={() => setShowMobileNavDrawer(false)}
                    className={mobileNavLinkClass}
                  >
                    <MessageSquare className="h-4 w-4 text-[#8B7355]" />
                    <span>Chat</span>
                  </NavLink>
                  <NavLink
                    to="/app/companions"
                    onClick={() => setShowMobileNavDrawer(false)}
                    className={mobileNavLinkClass}
                  >
                    <HeartHandshake className="h-4 w-4 text-[#8B7355]" />
                    <span>{COMPANION_LABEL_PLURAL}</span>
                  </NavLink>
                  <NavLink
                    to="/app/notes"
                    onClick={() => setShowMobileNavDrawer(false)}
                    className={mobileNavLinkClass}
                  >
                    <NotebookPen className="h-4 w-4 text-[#8B7355]" />
                    <span>Notes</span>
                  </NavLink>
                  <NavLink
                    to="/app/favourites"
                    onClick={() => setShowMobileNavDrawer(false)}
                    className={mobileNavLinkClass}
                  >
                    <Star className="h-4 w-4 text-[#8B7355]" />
                    <span>Favourites</span>
                  </NavLink>
                  <NavLink
                    to="/app/profiles"
                    onClick={() => setShowMobileNavDrawer(false)}
                    className={mobileNavLinkClass}
                  >
                    <Users className="h-4 w-4 text-[#8B7355]" />
                    <span>Profiles</span>
                  </NavLink>
                  <NavLink
                    to="/app/apps"
                    onClick={() => setShowMobileNavDrawer(false)}
                    className={mobileNavLinkClass}
                  >
                    <LayoutGrid className="h-4 w-4 text-[#8B7355]" />
                    <span>Apps</span>
                  </NavLink>
                  <NavLink
                    to="/app/reports"
                    onClick={() => setShowMobileNavDrawer(false)}
                    className={mobileNavLinkClass}
                  >
                    <ScrollText className="h-4 w-4 text-[#8B7355]" />
                    <span>Reports</span>
                  </NavLink>
                  <NavLink
                    to="/app/billing"
                    onClick={() => setShowMobileNavDrawer(false)}
                    className={mobileNavLinkClass}
                  >
                    <Coins
                      className={`h-4 w-4 ${isLowCredits ? 'text-[#7A3E36]' : 'text-[#8B7355]'}`}
                    />
                    <span className="flex-1">Credits</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-['DM_Sans',sans-serif] tabular-nums ${
                        isLowCredits
                          ? 'bg-[#7A3E36]/12 text-[#7A3E36] font-medium'
                          : 'bg-[#EAE3D7] text-[#3D3830]'
                      }`}
                    >
                      {isLowCredits ? 'Low · ' : ''}
                      {appUser ? appUser.credits_balance.toLocaleString() : '0'}
                    </span>
                  </NavLink>
                  {appUser?.is_admin && !isPreviewMode && (
                    <div className="pt-2 mt-2 border-t border-[#3D3830]/10">
                      <NavLink
                        to="/app/admin"
                        onClick={() => setShowMobileNavDrawer(false)}
                        className={mobileNavLinkClass}
                      >
                        <ShieldCheck className="h-4 w-4 text-[#8B7355]" />
                        <span>Admin</span>
                      </NavLink>
                    </div>
                  )}
                </nav>

                <div className="mt-auto border-t border-[#3D3830]/10 p-3 space-y-1">
                  {!isPreviewMode && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowMobileNavDrawer(false);
                        setShowAccountSettingsModal(true);
                      }}
                      className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-left hover:bg-[#FAF7F2]/70 transition-colors"
                    >
                      <UserAvatar size="sm" />
                      <span className="truncate text-xs font-medium text-[#3D3830]">
                        {getUserProfileDisplayLabel(appUser, 'Signed In')}
                      </span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setShowMobileNavDrawer(false);
                      setShowAccountSettingsModal(true);
                    }}
                    className="w-full flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-[#5C5449] hover:bg-[#FAF7F2]/70 hover:text-[#3D3830]"
                  >
                    <Settings className="h-4 w-4 text-[#8B7355]" />
                    <span>Settings</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowMobileNavDrawer(false);
                      setShowBackupModal(true);
                    }}
                    className="w-full flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-[#5C5449] hover:bg-[#FAF7F2]/70 hover:text-[#3D3830]"
                  >
                    <Database className="h-4 w-4 text-[#8B7355]" />
                    <span>Backup</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowMobileNavDrawer(false);
                      setShowSupportModal(true);
                    }}
                    className="w-full flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-[#5C5449] hover:bg-[#FAF7F2]/70 hover:text-[#3D3830]"
                  >
                    <LifeBuoy className="h-4 w-4 text-[#8B7355]" />
                    <span>Support</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowMobileNavDrawer(false);
                      void handleSignOut();
                    }}
                    className="w-full flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-[#7A3E36] hover:bg-[#FAF7F2]/70"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>{isPreviewMode ? 'Exit Preview' : 'Sign Out'}</span>
                  </button>
                </div>
              </aside>
            </div>
          )}

          {isChatRoute ? (
            <main className="flex-1 min-h-0 w-full flex flex-col">
              <Outlet />
            </main>
          ) : (
            <div ref={mainScrollRef} className="flex-1 min-h-0 md:overflow-y-auto">
              {isPreviewMode && (
                <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 md:px-10 pt-5">
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#EAE3D7]/80 border border-[#3D3830]/15 px-4 py-2.5 text-xs text-[#5C5449]">
                    <span>
                      <strong className="font-medium text-[#3D3830]">Design Preview Mode:</strong> Interactive sample workspace. Connect Supabase and sign in to run live AI consultations and save charts.
                    </span>
                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="font-medium text-[#3D3830] underline underline-offset-4 whitespace-nowrap"
                    >
                      Go to Sign In
                    </button>
                  </div>
                </div>
              )}

              <main className="mx-auto w-full max-w-6xl px-4 sm:px-6 md:px-10 py-6 md:py-8">
                <Outlet />
              </main>
            </div>
          )}
        </div>

        {/* Workspace Sidebar Modules */}
        <SupportModal
          isOpen={showSupportModal}
          onClose={() => setShowSupportModal(false)}
        />
        <BackupModal
          isOpen={showBackupModal}
          onClose={() => setShowBackupModal(false)}
        />
        <AccountSettingsModal
          isOpen={showAccountSettingsModal}
          onClose={() => setShowAccountSettingsModal(false)}
        />

        {/* Forced Password Setup / Recovery Modal */}
        {(appUser?.must_change_password || isPasswordRecovery) && (
          <SetPasswordModal mode={isPasswordRecovery ? 'recovery' : 'onboarding'} />
        )}

        {!isChatRoute && <FloatingScrollControls scrollContainerRef={mainScrollRef} />}
        <PendingOnboardingHydrator />
      </div>
    </AppShellContext.Provider>
  );
};

export default AppLayout;
