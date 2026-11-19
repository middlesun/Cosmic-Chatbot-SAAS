import React, { useCallback, useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { useAuth } from '../app/AuthContext';
import UserAnalytics, { type AdminUserRow } from './UserAnalytics';
import PromptChainEditor, {
  type ReportCatalogAdminRow,
  type SystemPromptRow,
} from './PromptChainEditor';
import ClientBulkImport from './ClientBulkImport';

interface OverviewMetrics {
  totalUsers: number;
  totalProfiles: number;
  activatedProfiles: number;
  totalConversations: number;
  totalQuestionsAsked: number;
  totalReportOrders: number;
  totalCreditsCirculating: number;
}

interface IntegrationReadiness {
  supabaseServer: boolean;
  supabaseClient: boolean;
  openrouter: boolean;
  freeAstrologyApi: boolean;
  dodoPayments: boolean;
  resend: boolean;
  sanityBlog: boolean;
}

type AdminTab = 'users' | 'prompts' | 'reports' | 'import';

const INTEGRATION_LABELS: Array<{ key: keyof IntegrationReadiness; label: string }> = [
  { key: 'supabaseServer', label: 'Supabase Admin' },
  { key: 'supabaseClient', label: 'Supabase Client Auth' },
  { key: 'openrouter', label: 'OpenRouter AI' },
  { key: 'freeAstrologyApi', label: 'FreeAstrologyAPI' },
  { key: 'dodoPayments', label: 'Dodo Payments' },
  { key: 'resend', label: 'Resend Email' },
  { key: 'sanityBlog', label: 'Sanity Blog CMS' },
];

const AdminPanel: React.FC = () => {
  const { getAccessToken } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>('users');
  const [metrics, setMetrics] = useState<OverviewMetrics | null>(null);
  const [integrations, setIntegrations] = useState<IntegrationReadiness | null>(null);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [prompts, setPrompts] = useState<SystemPromptRow[]>([]);
  const [reports, setReports] = useState<ReportCatalogAdminRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const loadAllAdminData = useCallback(async () => {
    setIsLoading(true);
    setErrorBanner(null);
    try {
      const token = await getAccessToken();
      if (!token) return;
      const headers = { Authorization: `Bearer ${token}` };

      const [ovRes, usrRes, prRes, repRes] = await Promise.all([
        fetch('/api/admin/overview', { headers }),
        fetch(`/api/admin/users?q=${encodeURIComponent(userSearch)}`, { headers }),
        fetch('/api/admin/prompts', { headers }),
        fetch('/api/admin/reports', { headers }),
      ]);

      if (!ovRes.ok) {
        const body = await ovRes.json().catch(() => ({}));
        throw new Error(body.error || 'Admin access required');
      }

      const [ov, usr, pr, rep] = await Promise.all([
        ovRes.json(),
        usrRes.json(),
        prRes.json(),
        repRes.json(),
      ]);

      setMetrics(ov.metrics || null);
      setIntegrations(ov.integrations || null);
      setUsers(usr.users || []);
      setPrompts(pr.prompts || []);
      setReports(rep.reports || []);
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'Unable to load Admin Console');
    } finally {
      setIsLoading(false);
    }
  }, [getAccessToken, userSearch]);

  useEffect(() => {
    void loadAllAdminData();
  }, [loadAllAdminData]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#3D3830]/10 pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs text-[#8B8275] mb-1.5">
            <ShieldCheck className="h-4 w-4 text-[#8B7355]" />
            <span>Administrator Observatory Console</span>
          </div>
          <h1 className="font-serif text-4xl font-medium text-[#3D3830] tracking-tight">
            Platform Governance & Prompt IP
          </h1>
        </div>
      </section>

      {/* Observatory KPI Snapshot */}
      {metrics && (
        <section className="rounded-3xl bg-gradient-to-br from-[#1F2229] to-[#292D36] p-6 md:p-8 text-[#F4EFE6]">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-6">
            <div>
              <p className="text-[11px] text-[#F4EFE6]/60">Members</p>
              <p className="mt-1 font-['DM_Sans',sans-serif] tabular-nums text-2xl font-medium">
                {metrics.totalUsers.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-[#F4EFE6]/60">Activated Charts</p>
              <p className="mt-1 font-['DM_Sans',sans-serif] tabular-nums text-2xl font-medium">
                {metrics.activatedProfiles}/{metrics.totalProfiles}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-[#F4EFE6]/60">Consultations</p>
              <p className="mt-1 font-['DM_Sans',sans-serif] tabular-nums text-2xl font-medium">
                {metrics.totalConversations.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-[#F4EFE6]/60">User Questions</p>
              <p className="mt-1 font-['DM_Sans',sans-serif] tabular-nums text-2xl font-medium">
                {metrics.totalQuestionsAsked.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-[#F4EFE6]/60">Report Orders</p>
              <p className="mt-1 font-['DM_Sans',sans-serif] tabular-nums text-2xl font-medium">
                {metrics.totalReportOrders.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-[#F4EFE6]/60">Credits Active</p>
              <p className="mt-1 font-['DM_Sans',sans-serif] tabular-nums text-2xl font-medium">
                {metrics.totalCreditsCirculating.toLocaleString()}
              </p>
            </div>
          </div>
        </section>
      )}

      {integrations && (
        <section className="rounded-3xl bg-[#FDFBF7] border border-[#3D3830]/10 p-5 md:p-6 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xs font-medium uppercase tracking-wider text-[#5C5449]">
              Platform Environment Readiness
            </h2>
            <span className="text-[11px] text-[#8B8275]">Admin-only integration check</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            {INTEGRATION_LABELS.map((item) => {
              const ready = Boolean(integrations[item.key]);
              return (
                <div
                  key={item.key}
                  className="rounded-2xl border border-[#3D3830]/10 bg-[#FAF7F2] px-3.5 py-2.5 flex flex-col justify-between gap-1"
                >
                  <span className="text-[11px] font-medium text-[#3D3830] truncate">
                    {item.label}
                  </span>
                  <span
                    className={`text-[11px] font-['DM_Sans',sans-serif] ${
                      ready ? 'text-[#2D6A4F]' : 'text-[#7A3E36]'
                    }`}
                  >
                    {ready ? 'Configured' : 'Missing'}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {errorBanner && (
        <div className="rounded-2xl bg-[#7A3E36]/10 border border-[#7A3E36]/20 px-5 py-3.5 text-xs text-[#7A3E36]">
          {errorBanner}
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-6 border-b border-[#3D3830]/10 pb-3 text-xs">
        {[
          { id: 'users', label: 'Users, Tiers & Credits' },
          { id: 'prompts', label: 'Modular Prompts & Sandbox' },
          { id: 'reports', label: 'Report Catalog & Chains' },
          { id: 'import', label: 'Legacy Client CSV Import' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as AdminTab)}
            className={`pb-1 border-b transition-colors ${
              activeTab === tab.id
                ? 'border-[#3D3830] text-[#3D3830] font-medium'
                : 'border-transparent text-[#8B8275] hover:text-[#3D3830]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-sm text-[#8B8275]">Loading Admin Observatory...</p>
      ) : (
        <>
          {activeTab === 'users' && (
            <UserAnalytics
              users={users}
              searchQuery={userSearch}
              onSearchChange={setUserSearch}
              getAccessToken={getAccessToken}
              onUserUpdated={(updated) =>
                setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)))
              }
            />
          )}

          {(activeTab === 'prompts' || activeTab === 'reports') && (
            <PromptChainEditor
              mode={activeTab}
              prompts={prompts}
              reports={reports}
              getAccessToken={getAccessToken}
              onPromptSaved={(saved) =>
                setPrompts((prev) => {
                  const exists = prev.some((p) => p.id === saved.id);
                  return exists
                    ? prev.map((p) => (p.id === saved.id ? saved : p))
                    : [saved, ...prev];
                })
              }
              onReportSaved={(saved) =>
                setReports((prev) => {
                  const exists = prev.some((r) => r.id === saved.id);
                  const next = exists
                    ? prev.map((r) => (r.id === saved.id ? saved : r))
                    : [...prev, saved];
                  return [...next].sort(
                    (a, b) => (a.sort_order ?? 99) - (b.sort_order ?? 99)
                  );
                })
              }
            />
          )}

          {activeTab === 'import' && (
            <ClientBulkImport
              getAccessToken={getAccessToken}
              onCompleted={() => void loadAllAdminData()}
            />
          )}
        </>
      )}
    </div>
  );
};

export default AdminPanel;
