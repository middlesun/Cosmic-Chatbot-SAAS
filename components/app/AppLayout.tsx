import React from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LogOut, Coins, ShieldCheck } from 'lucide-react';
import { useAuth } from './AuthContext';
import SetPasswordModal from './SetPasswordModal';

const AppLayout: React.FC = () => {
  const { appUser, isPasswordRecovery, isPreviewMode, exitPreviewMode, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    if (isPreviewMode) {
      exitPreviewMode();
    } else {
      await signOut();
    }
    navigate('/app/login');
  };

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `text-sm font-medium transition-colors whitespace-nowrap shrink-0 py-1 border-b ${
      isActive
        ? 'text-[#3D3830] border-[#3D3830]'
        : 'text-[#8B8275] border-transparent hover:text-[#3D3830]'
    }`;

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#3D3830] font-['Plus_Jakarta_Sans',sans-serif] flex flex-col">
      {/* Three-Zone Frosted Top Bar Contract */}
      <header className="sticky top-0 z-30 w-full px-4 md:px-8 pt-4">
        <div className="mx-auto max-w-7xl flex items-center justify-between gap-8 rounded-2xl bg-[#EAE3D7]/75 backdrop-blur-md px-5 py-3.5 border border-[#3D3830]/10">
          {/* Zone 1: Brand Title */}
          <Link
            to="/app/dashboard"
            className="font-serif text-xl font-medium tracking-tight text-[#3D3830] whitespace-nowrap shrink-0"
          >
            Cosmic Council
          </Link>

          {/* Zone 2: Clean Single-Line Nav Links */}
          <nav className="hidden md:flex items-center gap-6 overflow-x-auto no-scrollbar">
            <NavLink to="/app/dashboard" className={navLinkClass}>
              Overview
            </NavLink>
            <NavLink to="/app/chat" className={navLinkClass}>
              Chat Studio
            </NavLink>
            <NavLink to="/app/profiles" className={navLinkClass}>
              Profiles
            </NavLink>
            <NavLink to="/app/reports" className={navLinkClass}>
              Reports
            </NavLink>
            <NavLink to="/app/billing" className={navLinkClass}>
              Credits
            </NavLink>
            {appUser?.is_admin && (
              <NavLink to="/app/admin" className={navLinkClass}>
                Admin
              </NavLink>
            )}
          </nav>

          {/* Zone 3: Credits & Account Action */}
          <div className="flex items-center gap-4 shrink-0">
            <Link
              to="/app/billing"
              className="flex items-center gap-2 text-xs font-medium text-[#5C5449] hover:text-[#3D3830] whitespace-nowrap shrink-0"
            >
              <Coins className="h-3.5 w-3.5 text-[#8B8275]" />
              <span className="font-['JetBrains_Mono',monospace] tabular-nums text-[#3D3830]">
                {appUser ? appUser.credits_balance.toLocaleString() : '0'}
              </span>
              <span className="hidden sm:inline text-[#8B8275]">credits</span>
            </Link>

            <NavLink
              to="/app/settings"
              className="text-xs font-medium text-[#5C5449] hover:text-[#3D3830] whitespace-nowrap shrink-0"
            >
              Settings
            </NavLink>

            <button
              type="button"
              onClick={handleSignOut}
              title={isPreviewMode ? 'Exit Preview' : 'Sign Out'}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#4A453D] px-4 py-2 text-xs font-medium text-[#FAF7F2] transition-colors hover:bg-[#38342E] whitespace-nowrap shrink-0"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>{isPreviewMode ? 'Exit Preview' : 'Sign Out'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Navigation Strip */}
      <nav className="md:hidden mx-auto w-full max-w-7xl px-4 pt-3 flex items-center gap-5 overflow-x-auto no-scrollbar border-b border-[#3D3830]/10 pb-2.5">
        <NavLink to="/app/dashboard" className={navLinkClass}>
          Overview
        </NavLink>
        <NavLink to="/app/chat" className={navLinkClass}>
          Chat Studio
        </NavLink>
        <NavLink to="/app/profiles" className={navLinkClass}>
          Profiles
        </NavLink>
        <NavLink to="/app/reports" className={navLinkClass}>
          Reports
        </NavLink>
        <NavLink to="/app/billing" className={navLinkClass}>
          Credits
        </NavLink>
        {appUser?.is_admin && (
          <NavLink to="/app/admin" className={navLinkClass}>
            <span className="inline-flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5" /> Admin
            </span>
          </NavLink>
        )}
      </nav>

      {isPreviewMode && (
        <div className="mx-auto w-full max-w-7xl px-4 md:px-8 pt-4">
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

      {/* Main Content */}
      <main className="flex-1 mx-auto w-full max-w-7xl px-4 md:px-8 py-8">
        <Outlet />
      </main>

      {/* Forced Password Setup / Recovery Modal */}
      {(appUser?.must_change_password || isPasswordRecovery) && (
        <SetPasswordModal mode={isPasswordRecovery ? 'recovery' : 'onboarding'} />
      )}
    </div>
  );
};

export default AppLayout;
