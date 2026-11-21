import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Activity,
  ArrowLeft,
  ArrowUpRight,
  Coins,
  Cpu,
  LayoutDashboard,
  LayoutGrid,
  Layers,
  LifeBuoy,
  Menu,
  MessageSquare,
  RefreshCw,
  ScrollText,
  Server,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../app/AuthContext';
import FloatingScrollControls from '../FloatingScrollControls';
import UserAnalytics, { type AdminUserRow } from './UserAnalytics';
import ClientBulkImport from './ClientBulkImport';
import PromptLibraryManager, {
  type ModelChoiceOption,
  type SystemPromptRecord,
} from './PromptLibraryManager';
import AdminChatbotControl from './AdminChatbotControl';
import AdminChatbotLogs from './AdminChatbotLogs';
import AdminReportsManager, { type AdminReportRecord } from './AdminReportsManager';
import AdminAiSettings, { type AiSettingsResponse } from './AdminAiSettings';
import AdminPricingPlans from './AdminPricingPlans';
import AdminSupportDesk from './AdminSupportDesk';
import AdminPlatformHealth from './AdminPlatformHealth';
import AdminAppsAnalytics from './AdminAppsAnalytics';

type AdminSectionKey =
  | 'dash'
  | 'users'
  | 'prompts'
  | 'chatbot'
  | 'chatbot-logs'
  | 'reports'
  | 'apps'
  | 'ai-settings'
  | 'pricing'
  | 'support'
  | 'platform';

interface OverviewResponse {
  metrics: {
    totalUsers: number;
    totalProfiles: number;
    activatedProfiles: number;
    totalConversations: number;
    totalQuestionsAsked: number;
    totalReportOrders: number;
    totalCreditsCirculating: number;
    openSupportTickets: number;
    totalAppRuns?: number;
    appCacheHits?: number;
    appCacheHitRate?: number;
    tierBreakdown: Record<string, number>;
    revenueByCurrency: Record<string, number>;
  };
  aiRuntime?: {
    consultationModel: string;
    utilityModel: string;
    keySource: 'database' | 'env' | 'none';
    maskedKey: string | null;
  };
  integrations: {
    supabaseServer: boolean;
    supabaseClient: boolean;
    openrouter: boolean;
    freeAstrologyApi: boolean;
    dodoPayments: boolean;
    resend: boolean;
    sanityBlog: boolean;
  };
}

interface SidebarNavItem {
  key: AdminSectionKey;
  label: string;
  path: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const PRIMARY_ADMIN_NAV: SidebarNavItem[] = [
  {
    key: 'dash',
    label: 'Admin dash',
    path: '/app/admin',
    description: 'Platform metrics, credits, revenue, and live AI runtime overview.',
    icon: LayoutDashboard,
  },
  {
    key: 'users',
    label: 'User management',
    path: '/app/admin/users',
    description: 'Member directory, tiers, credit grants, and legacy CSV client imports.',
    icon: Users,
  },
  {
    key: 'prompts',
    label: 'Prompt Library',
    path: '/app/admin/prompts',
    description: 'Modular prompts, composable mode/report recipes, and live sandbox.',
    icon: Layers,
  },
  {
    key: 'chatbot',
    label: 'Chatbot',
    path: '/app/admin/chatbot',
    description: 'Welcome copy, features, ordering, conversational rules, and live test chat.',
    icon: MessageSquare,
  },
  {
    key: 'chatbot-logs',
    label: 'Chatbot Logs',
    path: '/app/admin/chatbot-logs',
    description: 'Stage 1–4 pipeline execution diagnostics, latency, and error traces.',
    icon: Activity,
  },
  {
    key: 'reports',
    label: 'Reports manager',
    path: '/app/admin/reports',
    description: 'Report catalog, credit pricing, and multi-pass prompt/recipe chains.',
    icon: ScrollText,
  },
  {
    key: 'apps',
    label: 'Apps & Usage',
    path: '/app/admin/apps',
    description: 'Mini-Apps usage telemetry, cache efficiency, token cost economics, and governance.',
    icon: LayoutGrid,
  },
  {
    key: 'ai-settings',
    label: 'AI settings',
    path: '/app/admin/ai-settings',
    description: 'OpenRouter API key, default models, custom models, and token limits.',
    icon: Cpu,
  },
  {
    key: 'pricing',
    label: 'Pricing & Plans',
    path: '/app/admin/pricing',
    description: 'Credit packs, membership tiers, welcome/referral bonuses, and chat metering.',
    icon: Coins,
  },
  {
    key: 'support',
    label: 'Support',
    path: '/app/admin/support',
    description: 'Member support tickets inbox, internal notes, and direct email replies.',
    icon: LifeBuoy,
  },
];

const LOWER_ADMIN_NAV: SidebarNavItem[] = [
  {
    key: 'platform',
    label: 'Platform',
    path: '/app/admin/platform',
    description: 'Supabase tables, external integrations, and server cache controls.',
    icon: Server,
  },
];

const ALL_NAV_ITEMS: SidebarNavItem[] = [...PRIMARY_ADMIN_NAV, ...LOWER_ADMIN_NAV];

function resolveSectionFromPath(pathname: string): AdminSectionKey {
  const cleaned = pathname.replace(/\/+$/, '');
  const sub = cleaned.replace(/^\/app\/admin\/?/, '');
  switch (sub) {
    case 'users':
      return 'users';
    case 'prompts':
      return 'prompts';
    case 'chatbot':
      return 'chatbot';
    case 'chatbot-logs':
      return 'chatbot-logs';
    case 'reports':
      return 'reports';
    case 'apps':
      return 'apps';
    case 'ai-settings':
      return 'ai-settings';
    case 'pricing':
      return 'pricing';
    case 'support':
      return 'support';
    case 'platform':
      return 'platform';
    default:
      return 'dash';
  }
}

const DEFAULT_FALLBACK_MODELS: ModelChoiceOption[] = [
  { value: '', label: 'Platform Default (from AI Settings)' },
  { value: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash', description: 'google/gemini-2.5-flash' },
  { value: 'google/gemini-2.5-pro', label: 'Gemini 2.5 Pro', description: 'google/gemini-2.5-pro' },
  { value: 'anthropic/claude-sonnet-4', label: 'Claude Sonnet 4', description: 'anthropic/claude-sonnet-4' },
  { value: 'openai/gpt-4.1', label: 'GPT-4.1', description: 'openai/gpt-4.1' },
];

function buildModelOptionsFromAiSettings(settings: AiSettingsResponse | null): ModelChoiceOption[] {
  if (!settings) return DEFAULT_FALLBACK_MODELS;
  const seen = new Set<string>();
  const options: ModelChoiceOption[] = [
    {
      value: '',
      label: `Platform Default (${settings.consultation_model})`,
    },
  ];

  const allEntries = [...(settings.builtin_models || []), ...(settings.custom_models || [])];
  for (const entry of allEntries) {
    if (!entry.id || seen.has(entry.id)) continue;
    seen.add(entry.id);
    options.push({
      value: entry.id,
      label: entry.provider ? `${entry.label} (${entry.provider})` : entry.label,
      description: entry.id,
    });
  }
  return options;
}

const AdminPanel: React.FC = () => {
  const { appUser, getAccessToken } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const activeSection = useMemo(
    () => resolveSectionFromPath(location.pathname),
    [location.pathname]
  );
  const activeNavMeta = useMemo(
    () => ALL_NAV_ITEMS.find((item) => item.key === activeSection) || ALL_NAV_ITEMS[0],
    [activeSection]
  );

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userSubTab, setUserSubTab] = useState<'directory' | 'import'>('directory');

  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [prompts, setPrompts] = useState<SystemPromptRecord[]>([]);
  const [reports, setReports] = useState<AdminReportRecord[]>([]);
  const [aiSettings, setAiSettings] = useState<AiSettingsResponse | null>(null);

  const [loadingCore, setLoadingCore] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const workbenchScrollRef = useRef<HTMLDivElement | null>(null);

  const modelOptions = useMemo(
    () => buildModelOptionsFromAiSettings(aiSettings),
    [aiSettings]
  );

  const loadCoreAdminData = useCallback(
    async (silent = false) => {
      if (silent) {
        setRefreshing(true);
      } else {
        setLoadingCore(true);
      }
      setError(null);
      try {
        const token = await getAccessToken();
        if (!token) throw new Error('Not signed in');
        const headers = { Authorization: `Bearer ${token}` };

        const [ovRes, usersRes, promptsRes, reportsRes, aiRes] = await Promise.all([
          fetch('/api/admin/overview', { headers }),
          fetch('/api/admin/users', { headers }),
          fetch('/api/admin/prompts', { headers }),
          fetch('/api/admin/reports', { headers }),
          fetch('/api/admin/settings/ai', { headers }),
        ]);

        if (!ovRes.ok) {
          const d = await ovRes.json().catch(() => ({}));
          throw new Error(d.error || 'Failed to load admin dashboard');
        }

        const [ovData, usersData, promptsData, reportsData, aiData] = await Promise.all([
          ovRes.json(),
          usersRes.ok ? usersRes.json() : Promise.resolve({ users: [] }),
          promptsRes.ok ? promptsRes.json() : Promise.resolve({ prompts: [] }),
          reportsRes.ok ? reportsRes.json() : Promise.resolve({ reports: [] }),
          aiRes.ok ? aiRes.json() : Promise.resolve(null),
        ]);

        setOverview(ovData);
        setUsers(usersData.users || []);
        setPrompts(promptsData.prompts || []);
        setReports(reportsData.reports || []);
        if (aiData && !aiData.error) {
          setAiSettings(aiData);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load admin console');
      } finally {
        setLoadingCore(false);
        setRefreshing(false);
      }
    },
    [getAccessToken]
  );

  useEffect(() => {
    void loadCoreAdminData();
  }, [loadCoreAdminData]);

  // Reset right workbench scroll position when switching admin sections
  useEffect(() => {
    setMobileMenuOpen(false);
    if (workbenchScrollRef.current) {
      workbenchScrollRef.current.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, [activeSection]);

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.email.toLowerCase().includes(q) ||
        (u.full_name || '').toLowerCase().includes(q) ||
        (u.location_country || '').toLowerCase().includes(q)
    );
  }, [users, userSearch]);

  const handleSelectSection = (item: SidebarNavItem) => {
    setMobileMenuOpen(false);
    navigate(item.path);
  };

  const openTicketCount = overview?.metrics?.openSupportTickets || 0;

  const renderSidebarNavContent = () => (
    <div className="flex flex-col h-full">
      {/* Top Title + Back to Chat */}
      <div className="px-4 pt-5 pb-4 border-b border-[#3D3830]/10 space-y-3 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <h1 className="font-['Cormorant_Garamond',serif] text-2xl font-medium text-[#3D3830] tracking-tight">
            Admin panel
          </h1>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close admin menu"
            className="md:hidden p-1.5 rounded-lg text-[#5C5449] hover:bg-[#EAE3D7] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <Link
          to="/app/chat"
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-[#3D3830]/15 bg-[#FDFBF7] px-3 py-2 text-xs font-medium text-[#3D3830] hover:bg-[#FAF7F2] hover:border-[#3D3830]/28 transition-colors whitespace-nowrap"
        >
          <ArrowLeft className="h-3.5 w-3.5 text-[#8B7355]" />
          <span>Back to Chat</span>
        </Link>
      </div>

      {/* Main Sidebar Items */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
        {PRIMARY_ADMIN_NAV.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => handleSelectSection(item)}
              className={`w-full flex items-center justify-between gap-2.5 rounded-xl px-3 py-2.5 text-sm transition-colors text-left cursor-pointer ${
                isActive
                  ? 'bg-[#4A453D] text-[#FAF7F2] font-medium'
                  : 'text-[#5C5449] hover:bg-[#EAE3D7]/80 hover:text-[#3D3830]'
              }`}
            >
              <span className="inline-flex items-center gap-2.5 min-w-0">
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate whitespace-nowrap">{item.label}</span>
              </span>
              {item.key === 'support' && openTicketCount > 0 && (
                <span
                  className={`font-['DM_Sans',sans-serif] text-xs tabular-nums shrink-0 ${
                    isActive ? 'text-[#FAF7F2]/85' : 'text-[#7A3E36] font-medium'
                  }`}
                >
                  {openTicketCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Lower-End Anchored Platform Section */}
      <div className="px-3 py-3 border-t border-[#3D3830]/10 space-y-2 shrink-0">
        {LOWER_ADMIN_NAV.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => handleSelectSection(item)}
              className={`w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition-colors text-left cursor-pointer ${
                isActive
                  ? 'bg-[#4A453D] text-[#FAF7F2] font-medium'
                  : 'text-[#5C5449] hover:bg-[#EAE3D7]/80 hover:text-[#3D3830]'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate whitespace-nowrap">{item.label}</span>
            </button>
          );
        })}

        <div className="px-3 pt-1 text-[11px] text-[#8B8275] truncate">
          {appUser?.email || 'Administrator'}
        </div>
      </div>
    </div>
  );

  return (
    <div className="h-[100dvh] w-full overflow-hidden flex flex-col md:flex-row bg-[#FAF7F2] text-[#3D3830] font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Mobile Compact Header */}
      <header className="md:hidden h-14 shrink-0 flex items-center justify-between gap-3 border-b border-[#3D3830]/12 bg-[#F1ECE3]/90 backdrop-blur-md px-4 z-30">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Open admin navigation"
            className="p-2 rounded-xl border border-[#3D3830]/15 bg-[#FDFBF7] text-[#3D3830] cursor-pointer"
          >
            <Menu className="h-4 w-4" />
          </button>
          <span className="font-['Cormorant_Garamond',serif] text-xl font-medium text-[#3D3830] truncate">
            Admin panel
          </span>
        </div>

        <Link
          to="/app/chat"
          className="inline-flex items-center gap-1.5 rounded-full border border-[#3D3830]/15 bg-[#FDFBF7] px-3 py-1.5 text-xs font-medium text-[#3D3830] whitespace-nowrap shrink-0"
        >
          <ArrowLeft className="h-3.5 w-3.5 text-[#8B7355]" />
          <span>Back to Chat</span>
        </Link>
      </header>

      {/* Mobile Slide-Over Admin Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <button
            type="button"
            aria-label="Dismiss admin menu"
            onClick={() => setMobileMenuOpen(false)}
            className="fixed inset-0 bg-[#1F2229]/40 backdrop-blur-xs"
          />
          <aside className="relative z-10 w-72 max-w-[85vw] h-full bg-[#F1ECE3] border-r border-[#3D3830]/15 shadow-2xl">
            {renderSidebarNavContent()}
          </aside>
        </div>
      )}

      {/* Desktop Fixed Dedicated Admin Sidebar (Never Scrolls with Main Content) */}
      <aside className="hidden md:flex md:flex-col w-64 shrink-0 h-full bg-[#F1ECE3] border-r border-[#3D3830]/12">
        {renderSidebarNavContent()}
      </aside>

      {/* Independently Scrollable Right Workbench Pane */}
      <div
        ref={workbenchScrollRef}
        className="flex-1 min-w-0 h-full overflow-y-auto bg-[#FAF7F2]"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8 space-y-6">
          {/* Contextual Workbench Top Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#3D3830]/10 pb-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs text-[#8B8275]">
                <span>Admin panel</span>
                <span aria-hidden="true">/</span>
                <span className="text-[#3D3830] font-medium">{activeNavMeta.label}</span>
              </div>
              <p className="text-xs text-[#5C5449] mt-1">{activeNavMeta.description}</p>
            </div>

            <button
              type="button"
              disabled={refreshing}
              onClick={() => void loadCoreAdminData(true)}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#3D3830]/15 bg-[#FDFBF7] px-3.5 py-1.5 text-xs font-medium text-[#5C5449] hover:text-[#3D3830] hover:bg-[#F1ECE3] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>{refreshing ? 'Refreshing...' : 'Refresh Data'}</span>
            </button>
          </div>

          {error && (
            <div className="rounded-2xl border border-[#7A3E36]/25 bg-[#7A3E36]/8 px-4 py-3 text-xs text-[#7A3E36]">
              {error}
            </div>
          )}

          {/* SECTION 1: Admin dash */}
          {activeSection === 'dash' && (
            <div className="space-y-6">
              {loadingCore || !overview ? (
                <div className="rounded-3xl border border-[#3D3830]/12 bg-[#FDFBF7] p-8 text-center text-sm text-[#8B8275]">
                  Loading platform telemetry...
                </div>
              ) : (
                <>
                  {/* Dark Observatory KPI Strip */}
                  <div className="rounded-3xl bg-gradient-to-br from-[#1F2229] to-[#292D36] p-6 sm:p-7 text-[#F4EFE6]">
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-5">
                      <div>
                        <p className="text-xs text-[#F4EFE6]/65">Members</p>
                        <p className="font-['DM_Sans',sans-serif] text-2xl font-medium tabular-nums mt-1 text-[#F4EFE6]">
                          {overview.metrics.totalUsers.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-[#F4EFE6]/65">Birth Charts</p>
                        <p className="font-['DM_Sans',sans-serif] text-2xl font-medium tabular-nums mt-1 text-[#F4EFE6]">
                          {overview.metrics.totalProfiles.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-[#F4EFE6]/65">Consultations</p>
                        <p className="font-['DM_Sans',sans-serif] text-2xl font-medium tabular-nums mt-1 text-[#F4EFE6]">
                          {overview.metrics.totalConversations.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-[#F4EFE6]/65">Questions</p>
                        <p className="font-['DM_Sans',sans-serif] text-2xl font-medium tabular-nums mt-1 text-[#F4EFE6]">
                          {overview.metrics.totalQuestionsAsked.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-[#F4EFE6]/65">Report Orders</p>
                        <p className="font-['DM_Sans',sans-serif] text-2xl font-medium tabular-nums mt-1 text-[#F4EFE6]">
                          {overview.metrics.totalReportOrders.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-[#F4EFE6]/65">Credits Active</p>
                        <p className="font-['DM_Sans',sans-serif] text-2xl font-medium tabular-nums mt-1 text-[#B8965A]">
                          {overview.metrics.totalCreditsCirculating.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Operational Summary Row */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                    {/* Revenue & Tiers */}
                    <section className="rounded-3xl border border-[#3D3830]/12 bg-[#FDFBF7] p-5 space-y-4">
                      <div className="flex items-center justify-between">
                        <h2 className="font-['Cormorant_Garamond',serif] text-xl font-medium text-[#3D3830]">
                          Revenue &amp; Tiers
                        </h2>
                        <button
                          type="button"
                          onClick={() => navigate('/app/admin/pricing')}
                          className="inline-flex items-center gap-1 text-xs font-medium text-[#5C5449] hover:text-[#3D3830] cursor-pointer"
                        >
                          <span>Pricing</span>
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <div className="space-y-2 border-t border-[#3D3830]/10 pt-3 text-xs">
                        {Object.keys(overview.metrics.revenueByCurrency).length === 0 ? (
                          <p className="text-[#8B8275]">No completed payments recorded yet.</p>
                        ) : (
                          Object.entries(overview.metrics.revenueByCurrency).map(
                            ([currency, total]) => (
                              <div
                                key={currency}
                                className="flex items-center justify-between text-[#3D3830]"
                              >
                                <span className="text-[#5C5449]">{currency}</span>
                                <span className="font-['DM_Sans',sans-serif] font-medium tabular-nums">
                                  {Number(total).toLocaleString()}
                                </span>
                              </div>
                            )
                          )
                        )}
                      </div>

                      <div className="space-y-1.5 border-t border-[#3D3830]/10 pt-3 text-xs">
                        {(['personal', 'pro', 'guru'] as const).map((tier) => (
                          <div key={tier} className="flex items-center justify-between">
                            <span className="capitalize text-[#5C5449]">{tier} tier</span>
                            <span className="font-['DM_Sans',sans-serif] tabular-nums text-[#3D3830]">
                              {(overview.metrics.tierBreakdown[tier] || 0).toLocaleString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    </section>

                    {/* Active AI Runtime */}
                    <section className="rounded-3xl border border-[#3D3830]/12 bg-[#FDFBF7] p-5 space-y-4">
                      <div className="flex items-center justify-between">
                        <h2 className="font-['Cormorant_Garamond',serif] text-xl font-medium text-[#3D3830]">
                          Active AI Runtime
                        </h2>
                        <button
                          type="button"
                          onClick={() => navigate('/app/admin/ai-settings')}
                          className="inline-flex items-center gap-1 text-xs font-medium text-[#5C5449] hover:text-[#3D3830] cursor-pointer"
                        >
                          <span>Configure</span>
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <div className="space-y-2.5 border-t border-[#3D3830]/10 pt-3 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[#5C5449]">OpenRouter key</span>
                          <span
                            className={`font-mono ${
                              overview.integrations.openrouter
                                ? 'text-[#2D6A4F]'
                                : 'text-[#7A3E36]'
                            }`}
                          >
                            {overview.aiRuntime?.maskedKey || 'Not configured'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[#5C5449]">Key source</span>
                          <span className="text-[#3D3830] capitalize">
                            {overview.aiRuntime?.keySource || 'none'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[#5C5449]">Consultation model</span>
                          <span className="font-mono text-[#3D3830] truncate max-w-[190px]">
                            {overview.aiRuntime?.consultationModel || 'google/gemini-2.5-flash'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[#5C5449]">Utility model</span>
                          <span className="font-mono text-[#3D3830] truncate max-w-[190px]">
                            {overview.aiRuntime?.utilityModel || 'google/gemini-2.5-flash'}
                          </span>
                        </div>
                      </div>
                    </section>

                    {/* Content & Support Queue */}
                    <section className="rounded-3xl border border-[#3D3830]/12 bg-[#FDFBF7] p-5 space-y-4">
                      <div className="flex items-center justify-between">
                        <h2 className="font-['Cormorant_Garamond',serif] text-xl font-medium text-[#3D3830]">
                          Library &amp; Support
                        </h2>
                        <button
                          type="button"
                          onClick={() => navigate('/app/admin/support')}
                          className="inline-flex items-center gap-1 text-xs font-medium text-[#5C5449] hover:text-[#3D3830] cursor-pointer"
                        >
                          <span>Support Desk</span>
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <div className="space-y-2.5 border-t border-[#3D3830]/10 pt-3 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-[#5C5449]">Open support tickets</span>
                          <span
                            className={`font-['DM_Sans',sans-serif] font-medium tabular-nums ${
                              openTicketCount > 0 ? 'text-[#7A3E36]' : 'text-[#2D6A4F]'
                            }`}
                          >
                            {openTicketCount}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[#5C5449]">Prompts in library</span>
                          <span className="font-['DM_Sans',sans-serif] tabular-nums text-[#3D3830]">
                            {prompts.length}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[#5C5449]">Active report products</span>
                          <span className="font-['DM_Sans',sans-serif] tabular-nums text-[#3D3830]">
                            {reports.filter((r) => r.is_active).length} / {reports.length}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => navigate('/app/admin/apps')}
                            className="text-[#5C5449] hover:text-[#3D3830] underline underline-offset-4 decoration-[#3D3830]/20 cursor-pointer"
                          >
                            Mini-App runs
                          </button>
                          <span className="font-['DM_Sans',sans-serif] tabular-nums text-[#3D3830]">
                            {(overview.metrics.totalAppRuns ?? 0).toLocaleString()}
                            {(overview.metrics.totalAppRuns ?? 0) > 0 && (
                              <span className="text-[#2D6A4F] ml-1.5">
                                ({overview.metrics.appCacheHitRate ?? 0}% cached)
                              </span>
                            )}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[#5C5449]">Integrations ready</span>
                          <span className="font-['DM_Sans',sans-serif] tabular-nums text-[#3D3830]">
                            {Object.values(overview.integrations).filter(Boolean).length} /{' '}
                            {Object.values(overview.integrations).length}
                          </span>
                        </div>
                      </div>
                    </section>
                  </div>

                  {/* Clean Quick Navigation Directory */}
                  <section className="rounded-3xl border border-[#3D3830]/12 bg-[#FDFBF7] p-5 sm:p-6 space-y-4">
                    <h2 className="font-['Cormorant_Garamond',serif] text-xl font-medium text-[#3D3830]">
                      Workspace Sections
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      {ALL_NAV_ITEMS.filter((item) => item.key !== 'dash').map((item) => {
                        const Icon = item.icon;
                        return (
                          <button
                            key={item.key}
                            type="button"
                            onClick={() => handleSelectSection(item)}
                            className="group rounded-2xl border border-[#3D3830]/12 bg-[#FAF7F2] p-4 text-left hover:border-[#3D3830]/28 hover:bg-[#F1ECE3]/70 transition-colors cursor-pointer space-y-1.5"
                          >
                            <div className="flex items-center justify-between text-[#3D3830]">
                              <span className="inline-flex items-center gap-2 text-sm font-medium">
                                <Icon className="h-4 w-4 text-[#8B7355]" />
                                <span>{item.label}</span>
                              </span>
                              <ArrowUpRight className="h-3.5 w-3.5 text-[#8B8275] group-hover:text-[#3D3830] transition-colors" />
                            </div>
                            <p className="text-xs text-[#8B8275] leading-relaxed">
                              {item.description}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                </>
              )}
            </div>
          )}

          {/* SECTION 2: User management */}
          {activeSection === 'users' && (
            <div className="space-y-5">
              <div className="flex items-center gap-1.5 rounded-2xl bg-[#F1ECE3] p-1.5 w-fit">
                <button
                  type="button"
                  onClick={() => setUserSubTab('directory')}
                  className={`rounded-xl px-4 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    userSubTab === 'directory'
                      ? 'bg-[#FDFBF7] text-[#3D3830] shadow-xs'
                      : 'text-[#5C5449] hover:text-[#3D3830]'
                  }`}
                >
                  Members Directory ({users.length})
                </button>
                <button
                  type="button"
                  onClick={() => setUserSubTab('import')}
                  className={`rounded-xl px-4 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    userSubTab === 'import'
                      ? 'bg-[#FDFBF7] text-[#3D3830] shadow-xs'
                      : 'text-[#5C5449] hover:text-[#3D3830]'
                  }`}
                >
                  Legacy Client CSV Import
                </button>
              </div>

              {userSubTab === 'directory' ? (
                <UserAnalytics
                  users={filteredUsers}
                  searchQuery={userSearch}
                  onSearchChange={setUserSearch}
                  getAccessToken={getAccessToken}
                  onUserUpdated={(updated) => {
                    setUsers((prev) =>
                      prev.map((u) => (u.id === updated.id ? updated : u))
                    );
                  }}
                />
              ) : (
                <ClientBulkImport
                  getAccessToken={getAccessToken}
                  onCompleted={() => void loadCoreAdminData(true)}
                />
              )}
            </div>
          )}

          {/* SECTION 3: Prompt Library */}
          {activeSection === 'prompts' && (
            <PromptLibraryManager
              prompts={prompts}
              modelOptions={modelOptions}
              getAccessToken={getAccessToken}
              onPromptSaved={(saved, isNew) => {
                setPrompts((prev) =>
                  isNew
                    ? [saved, ...prev]
                    : prev.map((p) => (p.id === saved.id ? saved : p))
                );
              }}
              onPromptDeleted={(deletedId) => {
                setPrompts((prev) => prev.filter((p) => p.id !== deletedId));
              }}
            />
          )}

          {/* SECTION 4: Chatbot */}
          {activeSection === 'chatbot' && (
            <AdminChatbotControl
              getAccessToken={getAccessToken}
              onPromptsChanged={() => void loadCoreAdminData(true)}
            />
          )}

          {/* SECTION 4B: Chatbot Pipeline Logs */}
          {activeSection === 'chatbot-logs' && (
            <AdminChatbotLogs getAccessToken={getAccessToken} />
          )}

          {/* SECTION 5: Reports manager */}
          {activeSection === 'reports' && (
            <AdminReportsManager
              reports={reports}
              prompts={prompts}
              modelOptions={modelOptions}
              getAccessToken={getAccessToken}
              onReportSaved={(saved, isNew) => {
                setReports((prev) =>
                  isNew
                    ? [...prev, saved]
                    : prev.map((r) => (r.id === saved.id ? saved : r))
                );
              }}
              onReportDeleted={(deletedId) => {
                setReports((prev) => prev.filter((r) => r.id !== deletedId));
              }}
            />
          )}

          {/* SECTION 5B: Apps & Usage Economics */}
          {activeSection === 'apps' && (
            <AdminAppsAnalytics
              modelOptions={modelOptions}
              getAccessToken={getAccessToken}
            />
          )}

          {/* SECTION 6: AI settings */}
          {activeSection === 'ai-settings' && (
            <AdminAiSettings
              getAccessToken={getAccessToken}
              onSettingsUpdated={(updated) => {
                setAiSettings(updated);
                setOverview((prev) =>
                  prev
                    ? {
                        ...prev,
                        aiRuntime: {
                          consultationModel: updated.consultation_model,
                          utilityModel: updated.utility_model,
                          keySource: updated.keySource,
                          maskedKey: updated.maskedKey,
                        },
                        integrations: {
                          ...prev.integrations,
                          openrouter: updated.keySource !== 'none',
                        },
                      }
                    : prev
                );
              }}
            />
          )}

          {/* SECTION 7: Pricing & Plans */}
          {activeSection === 'pricing' && (
            <AdminPricingPlans getAccessToken={getAccessToken} />
          )}

          {/* SECTION 8: Support */}
          {activeSection === 'support' && (
            <AdminSupportDesk getAccessToken={getAccessToken} />
          )}

          {/* SECTION 9: Platform (Lower End) */}
          {activeSection === 'platform' && (
            <AdminPlatformHealth getAccessToken={getAccessToken} />
          )}
        </div>

        <FloatingScrollControls scrollContainerRef={workbenchScrollRef} />
      </div>
    </div>
  );
};

export default AdminPanel;
