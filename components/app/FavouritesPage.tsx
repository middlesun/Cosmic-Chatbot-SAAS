import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowUpRight,
  FileText,
  HeartHandshake,
  LayoutGrid,
  Loader2,
  MessageSquare,
  Search,
  Sparkles,
  Star,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from './AuthContext';
import { CLIENT_MINI_APPS } from './miniAppsClientData';
import {
  PREVIEW_CONVERSATIONS,
  PREVIEW_FAVORITES,
  PREVIEW_PROFILES,
} from './previewFixtures';
import {
  COMPANION_LABEL_PLURAL,
  COMPANION_LABEL_SINGULAR,
} from './chatTypes';

interface FavouriteAppItem {
  slug: string;
  title: string;
  subtitle: string;
  category: string;
  supportsModes: boolean;
  starredAt: string;
}

interface FavouriteReportItem {
  id: string;
  slug: string;
  name: string;
  category: string;
  short_description: string;
  price_credits: number;
  starredAt: string;
}

interface FavouriteConversationItem {
  id: string;
  title: string;
  kind: 'companion' | 'council';
  companionName: string | null;
  companionRole: string | null;
  profile_id: string | null;
  profile_label: string | null;
  mode_type: string;
  updated_at: string;
}

interface FavouriteMessageItem {
  id: string;
  conversation_id: string;
  conversation_title: string;
  kind: 'council' | 'companion';
  profile_id: string | null;
  profile_label: string | null;
  expert_used: string | null;
  snippet: string;
  created_at: string;
}

interface FavouriteProfileItem {
  id: string;
  name: string;
  short_name: string | null;
  display_label: string;
  is_default: boolean;
  birth_date: string;
  birth_city: string;
  birth_country: string;
  tags: string[];
  is_activated: boolean;
}

interface FavouritesPayload {
  apps: FavouriteAppItem[];
  reports: FavouriteReportItem[];
  conversations: FavouriteConversationItem[];
  starredMessages: FavouriteMessageItem[];
  profiles: FavouriteProfileItem[];
}

type CategoryTab = 'all' | 'apps' | 'reports' | 'chats' | 'insights' | 'profiles';

const formatDateShort = (iso?: string | null): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

function buildPreviewFavourites(): FavouritesPayload {
  const previewApps = CLIENT_MINI_APPS.filter((a) =>
    ['daily-horoscope', 'dasha-analysis', 'career-guidance'].includes(a.slug)
  ).map((a) => ({
    slug: a.slug,
    title: a.title,
    subtitle: a.tagline,
    category: a.categoryLabel,
    supportsModes: true,
    starredAt: '2026-11-17T10:00:00.000Z',
  }));

  const convs: FavouriteConversationItem[] = PREVIEW_CONVERSATIONS.filter(
    (c) => c.is_bookmarked
  ).map((c) => ({
    id: c.id,
    title: c.title,
    kind: c.pillar === 'companion' ? 'companion' : 'council',
    companionName: c.companion_persona_json?.name || null,
    companionRole: c.companion_persona_json?.role_label || null,
    profile_id: c.profile_id || null,
    profile_label: c.profile_id ? 'You (Aarav)' : null,
    mode_type: c.mode_type,
    updated_at: c.updated_at,
  }));

  const msgs: FavouriteMessageItem[] = PREVIEW_FAVORITES.map((m) => ({
    id: m.id,
    conversation_id: m.conversation_id,
    conversation_title: m.conversation_title,
    kind: 'council',
    profile_id: m.profile_id || null,
    profile_label: m.profile_id ? 'You (Aarav)' : null,
    expert_used: m.expert_used || null,
    snippet: m.content.replace(/^#+\s*/gm, '').replace(/\*\*([^*]+)\*\*/g, '$1').slice(0, 220),
    created_at: m.created_at,
  }));

  const profs: FavouriteProfileItem[] = PREVIEW_PROFILES.slice(0, 1).map((p) => ({
    id: p.id,
    name: p.name,
    short_name: p.short_name || null,
    display_label: p.is_default ? `You (${p.short_name || p.name})` : p.name,
    is_default: Boolean(p.is_default),
    birth_date: p.birth_date,
    birth_city: p.birth_city,
    birth_country: p.birth_country,
    tags: [],
    is_activated: p.is_activated,
  }));

  return {
    apps: previewApps,
    reports: [],
    conversations: convs,
    starredMessages: msgs,
    profiles: profs,
  };
}

const FavouritesPage: React.FC = () => {
  const { getAccessToken, isPreviewMode } = useAuth();

  const [data, setData] = useState<FavouritesPayload>({
    apps: [],
    reports: [],
    conversations: [],
    starredMessages: [],
    profiles: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<CategoryTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [pendingUnstarKey, setPendingUnstarKey] = useState<string | null>(null);

  const loadFavourites = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);

    if (isPreviewMode) {
      setData(buildPreviewFavourites());
      setIsLoading(false);
      return;
    }

    const token = await getAccessToken();
    if (!token) {
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/favourites', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = (await res.json()) as Partial<FavouritesPayload>;
        setData({
          apps: json.apps || [],
          reports: json.reports || [],
          conversations: json.conversations || [],
          starredMessages: json.starredMessages || [],
          profiles: json.profiles || [],
        });
      } else {
        setErrorMsg('Could not load your favourites.');
      }
    } catch {
      setErrorMsg('Network error loading favourites.');
    } finally {
      setIsLoading(false);
    }
  }, [getAccessToken, isPreviewMode]);

  useEffect(() => {
    void loadFavourites();
  }, [loadFavourites]);

  const q = searchQuery.trim().toLowerCase();

  const filtered = useMemo(() => {
    const match = (text: string) => (!q ? true : text.toLowerCase().includes(q));
    return {
      apps: data.apps.filter((a) => match(`${a.title} ${a.subtitle} ${a.category}`)),
      reports: data.reports.filter((r) =>
        match(`${r.name} ${r.short_description} ${r.category}`)
      ),
      conversations: data.conversations.filter((c) =>
        match(`${c.title} ${c.companionName || ''} ${c.profile_label || ''}`)
      ),
      starredMessages: data.starredMessages.filter((m) =>
        match(`${m.conversation_title} ${m.snippet} ${m.profile_label || ''}`)
      ),
      profiles: data.profiles.filter((p) =>
        match(`${p.display_label} ${p.name} ${p.birth_city} ${p.tags.join(' ')}`)
      ),
    };
  }, [data, q]);

  const totalCount =
    data.apps.length +
    data.reports.length +
    data.conversations.length +
    data.starredMessages.length +
    data.profiles.length;

  const filteredTotal =
    filtered.apps.length +
    filtered.reports.length +
    filtered.conversations.length +
    filtered.starredMessages.length +
    filtered.profiles.length;

  const tabs: { id: CategoryTab; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: totalCount },
    { id: 'apps', label: 'Apps', count: data.apps.length },
    { id: 'reports', label: 'Reports', count: data.reports.length },
    { id: 'chats', label: `Chats & ${COMPANION_LABEL_PLURAL}`, count: data.conversations.length },
    { id: 'insights', label: 'Insights', count: data.starredMessages.length },
    { id: 'profiles', label: 'Profiles', count: data.profiles.length },
  ];

  const handleUnstar = async (
    kind: 'app' | 'report' | 'conversation' | 'message' | 'profile',
    id: string
  ) => {
    const key = `${kind}:${id}`;
    if (pendingUnstarKey === key) return;

    const prevSnapshot = data;
    setData((prev) => ({
      apps: kind === 'app' ? prev.apps.filter((a) => a.slug !== id) : prev.apps,
      reports: kind === 'report' ? prev.reports.filter((r) => r.id !== id) : prev.reports,
      conversations:
        kind === 'conversation'
          ? prev.conversations.filter((c) => c.id !== id)
          : prev.conversations,
      starredMessages:
        kind === 'message'
          ? prev.starredMessages.filter((m) => m.id !== id)
          : prev.starredMessages,
      profiles: kind === 'profile' ? prev.profiles.filter((p) => p.id !== id) : prev.profiles,
    }));

    if (isPreviewMode) return;

    const token = await getAccessToken();
    if (!token) return;

    setPendingUnstarKey(key);
    try {
      let res: Response;
      if (kind === 'app') {
        res = await fetch('/api/apps/favorites/toggle', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ appSlug: id }),
        });
      } else if (kind === 'report') {
        res = await fetch('/api/reports/favorites/toggle', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ reportCatalogId: id }),
        });
      } else if (kind === 'conversation') {
        res = await fetch(`/api/chat/conversations/${id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ is_bookmarked: false }),
        });
      } else if (kind === 'message') {
        res = await fetch(`/api/chat/messages/${id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ is_starred: false }),
        });
      } else {
        res = await fetch(`/api/profiles/${id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ is_starred: false }),
        });
      }

      if (!res.ok) {
        setData(prevSnapshot);
        setErrorMsg('Could not update favourite right now.');
      }
    } catch {
      setData(prevSnapshot);
      setErrorMsg('Network error updating favourite.');
    } finally {
      setPendingUnstarKey(null);
    }
  };

  const showSection = (section: Exclude<CategoryTab, 'all'>) =>
    activeTab === 'all' || activeTab === section;

  return (
    <div className="min-h-full bg-[#FAF7F2] px-4 sm:px-6 lg:px-10 py-6 sm:py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="font-serif text-3xl sm:text-4xl font-medium text-[#3D3830] tracking-tight">
              Favourites
            </h1>
            <p className="mt-1 text-sm text-[#5C5449]">
              Quick access to your starred Apps, Reports, Chats, {COMPANION_LABEL_PLURAL}, Insights, and Profiles.
            </p>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#8B8275]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search favourites..."
              className="w-full rounded-2xl border border-[#3D3830]/12 bg-[#FDFBF7] pl-9 pr-3 py-2 text-xs text-[#3D3830] placeholder:text-[#8B8275] focus:outline-none focus:border-[#8B7355]"
            />
          </div>
        </div>

        {errorMsg && (
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#7A3E36]/20 bg-[#7A3E36]/10 px-4 py-2.5 text-xs text-[#7A3E36]">
            <span>{errorMsg}</span>
            <button
              type="button"
              onClick={() => setErrorMsg(null)}
              aria-label="Dismiss error"
              className="cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Category Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-[#3D3830]/10 bg-[#FDFBF7] p-2">
          {tabs.map((t) => {
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#4A453D] text-[#FAF7F2]'
                    : 'text-[#5C5449] hover:text-[#3D3830] hover:bg-[#F1ECE3]'
                }`}
              >
                <span>{t.label}</span>
                <span
                  className={`font-['DM_Sans',sans-serif] text-[11px] tabular-nums ${
                    active ? 'text-[#FAF7F2]/80' : 'text-[#8B8275]'
                  }`}
                >
                  {t.count}
                </span>
              </button>
            );
          })}
        </div>

        {isLoading ? (
          <div className="rounded-3xl border border-[#3D3830]/10 bg-[#FDFBF7] py-20 flex flex-col items-center justify-center gap-2 text-[#8B8275]">
            <Loader2 className="h-5 w-5 animate-spin text-[#8B7355]" />
            <p className="text-xs">Loading your favourites...</p>
          </div>
        ) : filteredTotal === 0 ? (
          <div className="rounded-3xl border border-[#3D3830]/10 bg-[#FDFBF7] px-6 py-16 text-center space-y-3">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F1ECE3] text-[#B8965A]">
              <Star className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <h2 className="font-serif text-xl font-medium text-[#3D3830]">
                {totalCount === 0 ? 'No favourites yet' : 'No matching favourites'}
              </h2>
              <p className="text-xs text-[#8B8275] max-w-sm mx-auto leading-relaxed">
                {totalCount === 0
                  ? 'Tap the star icon on any App, Report, Chat thread, Message insight, or Profile to pin it here for instant access.'
                  : 'Try another category tab or clear your search filter.'}
              </p>
            </div>
            {totalCount === 0 && (
              <div className="pt-2 flex flex-wrap items-center justify-center gap-2">
                <Link
                  to="/app/apps"
                  className="rounded-xl bg-[#4A453D] hover:bg-[#38342E] text-[#FAF7F2] px-4 py-2 text-xs font-medium transition-colors"
                >
                  Browse Apps
                </Link>
                <Link
                  to="/app/reports"
                  className="rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] hover:bg-[#F1ECE3] text-[#3D3830] px-4 py-2 text-xs font-medium transition-colors"
                >
                  Explore Reports
                </Link>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-7">
            {/* Starred Apps */}
            {showSection('apps') && filtered.apps.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-[#8B8275]">
                  <LayoutGrid className="h-3.5 w-3.5 text-[#8B7355]" />
                  <span>Starred Apps</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {filtered.apps.map((app) => (
                    <div
                      key={app.slug}
                      className="rounded-2xl border border-[#3D3830]/12 bg-[#FDFBF7] p-4 flex flex-col justify-between gap-3 hover:border-[#8B7355]/40 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <span className="text-[11px] font-medium text-[#8B7355]">
                            {app.category}
                          </span>
                          <h3 className="mt-0.5 font-serif text-lg font-medium text-[#3D3830] truncate">
                            {app.title}
                          </h3>
                          <p className="mt-1 text-xs text-[#5C5449] line-clamp-2">
                            {app.subtitle}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleUnstar('app', app.slug)}
                          aria-label={`Remove ${app.title} from favourites`}
                          className="p-1.5 rounded-xl hover:bg-[#F1ECE3] text-[#B8965A] shrink-0 cursor-pointer"
                        >
                          <Star className="h-4 w-4 fill-[#B8965A]" />
                        </button>
                      </div>
                      <Link
                        to={`/app/apps/${app.slug}`}
                        className="inline-flex items-center gap-1 text-xs font-medium text-[#3D3830] hover:text-[#8B7355]"
                      >
                        <span>Open app</span>
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Starred Reports */}
            {showSection('reports') && filtered.reports.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-[#8B8275]">
                  <FileText className="h-3.5 w-3.5 text-[#8B7355]" />
                  <span>Starred Reports</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {filtered.reports.map((rep) => (
                    <div
                      key={rep.id}
                      className="rounded-2xl border border-[#3D3830]/12 bg-[#FDFBF7] p-4 flex flex-col justify-between gap-3 hover:border-[#8B7355]/40 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <span className="text-[11px] font-medium text-[#8B7355]">
                            {rep.category}
                          </span>
                          <h3 className="mt-0.5 font-serif text-lg font-medium text-[#3D3830] truncate">
                            {rep.name}
                          </h3>
                          <p className="mt-1 text-xs text-[#5C5449] line-clamp-2">
                            {rep.short_description}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleUnstar('report', rep.id)}
                          aria-label={`Remove ${rep.name} from favourites`}
                          className="p-1.5 rounded-xl hover:bg-[#F1ECE3] text-[#B8965A] shrink-0 cursor-pointer"
                        >
                          <Star className="h-4 w-4 fill-[#B8965A]" />
                        </button>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <Link
                          to="/app/reports"
                          className="inline-flex items-center gap-1 text-xs font-medium text-[#3D3830] hover:text-[#8B7355]"
                        >
                          <span>View in Reports</span>
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        </Link>
                        <span className="font-['DM_Sans',sans-serif] text-[11px] tabular-nums text-[#8B8275]">
                          {rep.price_credits.toLocaleString()} credits
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Starred Chats & Companions */}
            {showSection('chats') && filtered.conversations.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-[#8B8275]">
                  <MessageSquare className="h-3.5 w-3.5 text-[#8B7355]" />
                  <span>Starred Chats &amp; {COMPANION_LABEL_PLURAL}</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {filtered.conversations.map((conv) => (
                    <div
                      key={conv.id}
                      className="rounded-2xl border border-[#3D3830]/12 bg-[#FDFBF7] p-4 flex items-start justify-between gap-3 hover:border-[#8B7355]/40 transition-colors"
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-1.5 text-[11px] text-[#8B7355] font-medium">
                          {conv.kind === 'companion' ? (
                            <>
                              <HeartHandshake className="h-3.5 w-3.5" />
                              <span>{COMPANION_LABEL_SINGULAR}{conv.companionRole ? ` · ${conv.companionRole}` : ''}</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="h-3.5 w-3.5" />
                              <span>{conv.profile_label || 'Council Consultation'}</span>
                            </>
                          )}
                        </div>
                        <Link
                          to={`/app/chat/${conv.id}`}
                          className="block font-serif text-lg font-medium text-[#3D3830] hover:text-[#8B7355] truncate"
                        >
                          {conv.title}
                        </Link>
                        <p className="font-['DM_Sans',sans-serif] text-[11px] tabular-nums text-[#8B8275]">
                          Updated {formatDateShort(conv.updated_at)}
                        </p>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <Link
                          to={`/app/chat/${conv.id}`}
                          className="rounded-xl border border-[#3D3830]/12 bg-[#FAF7F2] px-2.5 py-1.5 text-xs font-medium text-[#3D3830] hover:bg-[#F1ECE3]"
                        >
                          Open
                        </Link>
                        <button
                          type="button"
                          onClick={() => void handleUnstar('conversation', conv.id)}
                          aria-label={`Remove ${conv.title} from favourites`}
                          className="p-1.5 rounded-xl hover:bg-[#F1ECE3] text-[#B8965A] cursor-pointer"
                        >
                          <Star className="h-4 w-4 fill-[#B8965A]" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Starred Message Insights */}
            {showSection('insights') && filtered.starredMessages.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-[#8B8275]">
                  <Sparkles className="h-3.5 w-3.5 text-[#8B7355]" />
                  <span>Starred Chat Insights</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {filtered.starredMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className="rounded-2xl border border-[#3D3830]/12 bg-[#FDFBF7] p-4 flex flex-col justify-between gap-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 space-y-1">
                          <div className="text-[11px] font-medium text-[#8B7355] truncate">
                            {msg.conversation_title}
                            {msg.profile_label ? ` · ${msg.profile_label}` : ''}
                          </div>
                          <p className="text-xs text-[#5C5449] leading-relaxed line-clamp-3">
                            {msg.snippet}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleUnstar('message', msg.id)}
                          aria-label="Remove insight from favourites"
                          className="p-1.5 rounded-xl hover:bg-[#F1ECE3] text-[#B8965A] shrink-0 cursor-pointer"
                        >
                          <Star className="h-4 w-4 fill-[#B8965A]" />
                        </button>
                      </div>
                      <div className="flex items-center justify-between gap-2 text-[11px] text-[#8B8275]">
                        <span className="font-['DM_Sans',sans-serif] tabular-nums">
                          {formatDateShort(msg.created_at)}
                        </span>
                        <Link
                          to={`/app/chat/${msg.conversation_id}`}
                          className="inline-flex items-center gap-1 font-medium text-[#3D3830] hover:text-[#8B7355]"
                        >
                          <span>Jump to chat</span>
                          <ArrowUpRight className="h-3 w-3" />
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Starred Profiles */}
            {showSection('profiles') && filtered.profiles.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-[#8B8275]">
                  <Users className="h-3.5 w-3.5 text-[#8B7355]" />
                  <span>Starred Profiles</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {filtered.profiles.map((prof) => (
                    <div
                      key={prof.id}
                      className="rounded-2xl border border-[#3D3830]/12 bg-[#FDFBF7] p-4 flex flex-col justify-between gap-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="font-serif text-lg font-medium text-[#3D3830] truncate">
                            {prof.display_label}
                          </h3>
                          <p className="mt-0.5 text-xs text-[#5C5449] truncate">
                            {prof.birth_city}, {prof.birth_country}
                          </p>
                          <p className="mt-0.5 font-['DM_Sans',sans-serif] text-[11px] tabular-nums text-[#8B8275]">
                            {prof.birth_date}
                          </p>
                          {prof.tags.length > 0 && (
                            <p className="mt-1.5 text-[11px] text-[#8B7355] truncate">
                              {prof.tags.join(' · ')}
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleUnstar('profile', prof.id)}
                          aria-label={`Remove ${prof.display_label} from favourites`}
                          className="p-1.5 rounded-xl hover:bg-[#F1ECE3] text-[#B8965A] shrink-0 cursor-pointer"
                        >
                          <Star className="h-4 w-4 fill-[#B8965A]" />
                        </button>
                      </div>
                      <div className="flex items-center justify-between gap-2 pt-1">
                        <Link
                          to={`/app/chat?profileId=${prof.id}&new=1`}
                          className="text-xs font-medium text-[#3D3830] hover:text-[#8B7355]"
                        >
                          Chat now
                        </Link>
                        <Link
                          to="/app/profiles"
                          className="inline-flex items-center gap-1 text-xs text-[#8B8275] hover:text-[#3D3830]"
                        >
                          <span>View chart</span>
                          <ArrowUpRight className="h-3 w-3" />
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default FavouritesPage;
