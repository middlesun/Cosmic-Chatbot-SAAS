import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Database,
  RefreshCw,
  Server,
  Trash2,
} from 'lucide-react';

interface PlatformHealthResponse {
  integrations: {
    supabaseServer: boolean;
    supabaseClient: boolean;
    openrouter: boolean;
    openrouterSource: 'database' | 'env' | 'none';
    openrouterMaskedKey: string | null;
    consultationModel: string;
    utilityModel: string;
    freeAstrologyApi: boolean;
    dodoPayments: boolean;
    resend: boolean;
    sanityBlog: boolean;
  };
  tables: {
    users: boolean;
    profiles: boolean;
    system_prompts: boolean;
    platform_settings: boolean;
    prompt_recipes: boolean;
    support_tickets: boolean;
  };
  migration004Ready: boolean;
  timestamp: string;
}

interface AdminPlatformHealthProps {
  getAccessToken: () => Promise<string | null>;
}

const AdminPlatformHealth: React.FC<AdminPlatformHealthProps> = ({ getAccessToken }) => {
  const [health, setHealth] = useState<PlatformHealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [flushing, setFlushing] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadHealth = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getAccessToken();
      const res = await fetch('/api/admin/platform/health', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to check platform health');
      setHealth(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Health check failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadHealth();
  }, []);

  const handleFlushCaches = async () => {
    setFlushing(true);
    setFeedback(null);
    setError(null);
    try {
      const token = await getAccessToken();
      const res = await fetch('/api/admin/platform/cache-flush', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Cache flush failed');
      setFeedback('All in-memory Prompt, Recipe, AI Settings, Chatbot, and Pricing caches have been cleared.');
      await loadHealth();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cache flush failed');
    } finally {
      setFlushing(false);
    }
  };

  if (loading && !health) {
    return (
      <div className="rounded-3xl bg-[#FDFBF7] border border-[#3D3830]/10 p-10 text-center text-sm text-[#8B8275]">
        Inspecting Supabase, OpenRouter, and platform integrations...
      </div>
    );
  }

  const integrationRows = health
    ? [
        {
          label: 'Supabase Admin (Service Role)',
          ok: health.integrations.supabaseServer,
          detail: health.integrations.supabaseServer ? 'Connected' : 'Missing service key',
        },
        {
          label: 'Supabase Client Auth',
          ok: health.integrations.supabaseClient,
          detail: health.integrations.supabaseClient ? 'Configured' : 'Missing URL / Anon key',
        },
        {
          label: 'OpenRouter AI Gateway',
          ok: health.integrations.openrouter,
          detail: health.integrations.openrouter
            ? `${health.integrations.openrouterSource === 'database' ? 'DB override' : 'Env key'} · ${health.integrations.consultationModel}`
            : 'No API key configured',
        },
        {
          label: 'FreeAstrologyAPI Ephemeris',
          ok: health.integrations.freeAstrologyApi,
          detail: health.integrations.freeAstrologyApi ? 'Configured' : 'Missing API key',
        },
        {
          label: 'Dodo Payments Checkout',
          ok: health.integrations.dodoPayments,
          detail: health.integrations.dodoPayments ? 'Configured' : 'Missing DODO_API_KEY',
        },
        {
          label: 'Resend Transactional Email',
          ok: health.integrations.resend,
          detail: health.integrations.resend ? 'Configured' : 'Missing RESEND_API_KEY',
        },
        {
          label: 'Sanity Blog CMS',
          ok: health.integrations.sanityBlog,
          detail: health.integrations.sanityBlog ? 'Configured' : 'Optional / Not set',
        },
      ]
    : [];

  const tableRows = health
    ? [
        { name: 'public.users', ok: health.tables.users, group: 'Core (001)' },
        { name: 'public.profiles', ok: health.tables.profiles, group: 'Core (001)' },
        { name: 'public.system_prompts', ok: health.tables.system_prompts, group: 'Core (001)' },
        { name: 'public.platform_settings', ok: health.tables.platform_settings, group: 'Admin v2 (004)' },
        { name: 'public.prompt_recipes', ok: health.tables.prompt_recipes, group: 'Admin v2 (004)' },
        { name: 'public.support_tickets', ok: health.tables.support_tickets, group: 'Admin v2 (004)' },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-serif text-2xl font-medium text-[#3D3830]">Platform</h2>
          <p className="mt-1 text-xs text-[#5C5449]">
            Live infrastructure readiness, Supabase migration verification, and server cache controls.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void loadHealth()}
            className="inline-flex items-center gap-1.5 rounded-full border border-[#3D3830]/15 bg-[#FDFBF7] px-3.5 py-2 text-xs font-medium text-[#3D3830] hover:bg-[#F1ECE3] transition-colors cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Re-check Health
          </button>
          <button
            type="button"
            disabled={flushing}
            onClick={handleFlushCaches}
            className="inline-flex items-center gap-1.5 rounded-full bg-[#4A453D] px-4 py-2 text-xs font-medium text-[#FAF7F2] hover:bg-[#38342E] disabled:opacity-50 transition-colors cursor-pointer"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {flushing ? 'Flushing...' : 'Flush Server Caches'}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-[#7A3E36]/25 bg-[#7A3E36]/8 px-4 py-3 text-xs text-[#7A3E36]">
          {error}
        </div>
      )}
      {feedback && (
        <div className="rounded-2xl border border-[#2D6A4F]/25 bg-[#2D6A4F]/8 px-4 py-3 text-xs text-[#2D6A4F] flex items-center gap-2">
          <Check className="h-4 w-4 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {health && !health.migration004Ready && (
        <div className="rounded-2xl border border-[#B8965A]/45 bg-[#B8965A]/12 p-4 text-xs text-[#3D3830] flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 text-[#8B7355] shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold">Migration 004 Required for Full Persistence</p>
            <p className="text-[#5C5449]">
              Run{' '}
              <code className="font-mono text-[11px] bg-[#FAF7F2] px-1.5 py-0.5 rounded">
                supabase/migrations/004_admin_console_and_recipes.sql
              </code>{' '}
              in your Supabase SQL Editor to enable saving encrypted AI Settings, Chatbot Config, Pricing & Plans, Prompt Recipes, and Support Tickets.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Integration Checks */}
        <section className="rounded-3xl bg-[#FDFBF7] border border-[#3D3830]/12 p-5 sm:p-6 space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-2xl bg-[#EAE3D7]/80 flex items-center justify-center text-[#3D3830]">
              <Server className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#3D3830]">External Services & Keys</h3>
              <p className="text-xs text-[#8B8275]">Live runtime environment check</p>
            </div>
          </div>

          <div className="divide-y divide-[#3D3830]/8">
            {integrationRows.map((item) => (
              <div key={item.label} className="py-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-[#3D3830]">{item.label}</p>
                  <p className="text-[11px] text-[#8B8275] font-mono">{item.detail}</p>
                </div>
                {item.ok ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-[#2D6A4F]">
                    <CheckCircle2 className="h-4 w-4" />
                    Ready
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-[#7A3E36]">
                    <AlertTriangle className="h-4 w-4" />
                    Missing
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Supabase Schema Tables */}
        <section className="rounded-3xl bg-[#FDFBF7] border border-[#3D3830]/12 p-5 sm:p-6 space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-2xl bg-[#EAE3D7]/80 flex items-center justify-center text-[#3D3830]">
              <Database className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#3D3830]">Supabase Tables & Migrations</h3>
              <p className="text-xs text-[#8B8275]">
                Verified at {health ? new Date(health.timestamp).toLocaleTimeString() : '—'}
              </p>
            </div>
          </div>

          <div className="divide-y divide-[#3D3830]/8">
            {tableRows.map((tbl) => (
              <div key={tbl.name} className="py-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-mono font-medium text-[#3D3830]">{tbl.name}</p>
                  <p className="text-[11px] text-[#8B8275]">{tbl.group}</p>
                </div>
                {tbl.ok ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-[#2D6A4F]">
                    <CheckCircle2 className="h-4 w-4" />
                    Exists
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-[#7A3E36]">
                    <AlertTriangle className="h-4 w-4" />
                    Not Migrated
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default AdminPlatformHealth;
