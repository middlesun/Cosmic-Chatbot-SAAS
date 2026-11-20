import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  FileText,
  Sparkles,
  Star,
  X,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from './AuthContext';
import AstrologyModeToggle from './AstrologyModeToggle';
import CustomSelect from './CustomSelect';

interface ReportCatalogItem {
  id: string;
  slug: string;
  name: string;
  category: string;
  short_description: string;
  long_description: string | null;
  price_credits: number;
  pass_count: number;
  pass_titles: string[];
}

interface ProfileSummary {
  id: string;
  name: string;
  short_name?: string | null;
  is_default?: boolean;
  birth_date: string;
  birth_city: string;
  birth_country: string;
  is_activated: boolean;
}

interface ReportOrderSummary {
  id: string;
  profile_id: string;
  report_catalog_id: string;
  astrology_mode?: 'vedic' | 'western';
  user_questions: string | null;
  credits_charged: number;
  status: 'queued' | 'processing' | 'generating_pdf' | 'completed' | 'failed';
  progress_step: string | null;
  pdf_url: string | null;
  linked_conversation_id: string | null;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

type ReportsSortOption = 'newest' | 'oldest' | 'profile_name';

const ReportsStore: React.FC = () => {
  const { appUser, getAccessToken, refreshUser, astrologyMode, setAstrologyMode } = useAuth();
  const navigate = useNavigate();

  const [catalog, setCatalog] = useState<ReportCatalogItem[]>([]);
  const [profiles, setProfiles] = useState<ProfileSummary[]>([]);
  const [orders, setOrders] = useState<ReportOrderSummary[]>([]);
  const [favoriteReportIds, setFavoriteReportIds] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [ordersSortBy, setOrdersSortBy] = useState<ReportsSortOption>('newest');
  const [isLoading, setIsLoading] = useState(true);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // Order Modal state
  const [selectedReport, setSelectedReport] = useState<ReportCatalogItem | null>(null);
  const [selectedProfileId, setSelectedProfileId] = useState<string>('');
  const [modalMode, setModalMode] = useState<'vedic' | 'western'>(astrologyMode);
  const [userQuestions, setUserQuestions] = useState<string>('');
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const token = await getAccessToken();
      if (!token) return;
      const res = await fetch('/api/reports/catalog', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setCatalog(data.catalog || []);
        const loadedProfiles: ProfileSummary[] = data.profiles || [];
        setProfiles(loadedProfiles);
        setOrders(data.orders || []);
        setFavoriteReportIds(Array.isArray(data.favoriteReportIds) ? data.favoriteReportIds : []);
        if (loadedProfiles.length > 0) {
          const preferred =
            loadedProfiles.find((p) => p.is_default) ||
            loadedProfiles.find((p) => p.is_activated) ||
            loadedProfiles[0];
          setSelectedProfileId(preferred.id);
        }
      }
    } catch {
      setErrorBanner('Unable to load Reports.');
    } finally {
      setIsLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleToggleFavoriteReport = async (
    e: React.MouseEvent,
    reportCatalogId: string
  ) => {
    e.preventDefault();
    e.stopPropagation();

    const currentlyFav = favoriteReportIds.includes(reportCatalogId);
    const nextFavs = currentlyFav
      ? favoriteReportIds.filter((id) => id !== reportCatalogId)
      : [...favoriteReportIds, reportCatalogId];
    setFavoriteReportIds(nextFavs);

    const token = await getAccessToken();
    if (!token) return;

    await fetch('/api/reports/favorites/toggle', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ reportCatalogId, desired: !currentlyFav }),
    }).catch(() => {});
  };

  const categories = useMemo(() => {
    const unique = Array.from(new Set(catalog.map((c) => c.category)));
    return ['All', ...unique];
  }, [catalog]);

  const filteredCatalog = useMemo(() => {
    if (selectedCategory === 'All') return catalog;
    return catalog.filter((c) => c.category === selectedCategory);
  }, [catalog, selectedCategory]);

  const catalogById = useMemo(() => {
    const map = new Map<string, ReportCatalogItem>();
    for (const c of catalog) map.set(c.id, c);
    return map;
  }, [catalog]);

  const profileById = useMemo(() => {
    const map = new Map<string, ProfileSummary>();
    for (const p of profiles) map.set(p.id, p);
    return map;
  }, [profiles]);

  const sortedOrders = useMemo(() => {
    const list = [...orders];
    if (ordersSortBy === 'oldest') {
      return list.sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
    }
    if (ordersSortBy === 'profile_name') {
      return list.sort((a, b) => {
        const pA = profileById.get(a.profile_id);
        const pB = profileById.get(b.profile_id);
        const nameA = (pA?.short_name || pA?.name || '').toLowerCase();
        const nameB = (pB?.short_name || pB?.name || '').toLowerCase();
        const cmp = nameA.localeCompare(nameB);
        if (cmp !== 0) return cmp;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    }
    return list.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [orders, ordersSortBy, profileById]);

  const openOrderModal = (report: ReportCatalogItem) => {
    setSelectedReport(report);
    setOrderError(null);
    setUserQuestions('');
    setModalMode(astrologyMode);
    if (!selectedProfileId && profiles.length > 0) {
      setSelectedProfileId(profiles[0].id);
    }
  };

  const handleCommissionOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReport) return;

    setOrderError(null);
    if (!selectedProfileId) {
      setOrderError('Please select a birth profile first.');
      return;
    }

    setIsSubmittingOrder(true);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Authentication required');

      const res = await fetch('/api/reports/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          reportCatalogId: selectedReport.id,
          profileId: selectedProfileId,
          astrologyMode: modalMode,
          userQuestions: userQuestions.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.order) {
        throw new Error(data.error || 'Could not commission report order');
      }

      await refreshUser();
      setSelectedReport(null);
      navigate(`/app/reports/${data.order.id}`);
    } catch (err) {
      setOrderError(err instanceof Error ? err.message : 'Order failed');
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  const formatProfileLabel = (p?: ProfileSummary) => {
    if (!p) return 'Birth Profile';
    if (p.is_default) return p.short_name ? `You (${p.short_name})` : 'You';
    return p.short_name?.trim() || p.name;
  };

  return (
    <div className="space-y-10">
      {/* Editorial Header */}
      <section className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 border-b border-[#3D3830]/10 pb-8">
        <div>
          <h1 className="font-serif text-4xl font-medium text-[#3D3830] tracking-tight">
            Reports
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-[#5C5449] leading-relaxed">
            Deeply synthesised reports on key areas of life
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <AstrologyModeToggle
            value={astrologyMode}
            onChange={(next) => void setAstrologyMode(next)}
            size="sm"
          />
          <Link
            to="/app/profiles"
            className="inline-flex items-center gap-2 rounded-full border border-[#3D3830]/20 bg-[#FDFBF7] px-5 py-2.5 text-xs font-medium text-[#3D3830] hover:bg-[#F1ECE3] whitespace-nowrap shrink-0"
          >
            <span>
              {profiles.length === 0
                ? 'Add Birth Details'
                : `Manage Birth Profiles (${profiles.length})`}
            </span>
          </Link>
        </div>
      </section>

      {errorBanner && (
        <div className="rounded-2xl bg-[#7A3E36]/10 border border-[#7A3E36]/20 px-5 py-3.5 text-xs text-[#7A3E36]">
          {errorBanner}
        </div>
      )}

      {/* My Reports (Ordered Dossiers History) */}
      {orders.length > 0 && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-serif text-2xl font-medium text-[#3D3830]">
              My Reports
            </h2>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#8B8275]">Sort by</span>
              <div className="w-40">
                <CustomSelect
                  value={ordersSortBy}
                  onChange={(val) => setOrdersSortBy(val as ReportsSortOption)}
                  ariaLabel="Sort My Reports"
                  size="sm"
                  surface="elevated"
                  options={[
                    { value: 'newest', label: 'Newest' },
                    { value: 'oldest', label: 'Oldest' },
                    { value: 'profile_name', label: 'Profile name' },
                  ]}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sortedOrders.map((ord) => {
              const cat = catalogById.get(ord.report_catalog_id);
              const prof = profileById.get(ord.profile_id);
              const modeTag = ord.astrology_mode === 'western' ? 'Western' : 'Vedic';
              return (
                <Link
                  key={ord.id}
                  to={`/app/reports/${ord.id}`}
                  className="rounded-3xl bg-[#FDFBF7] border border-[#3D3830]/12 p-5 hover:bg-[#F1ECE3]/70 transition-colors flex flex-col justify-between gap-4"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-[11px] text-[#8B8275]">
                      <span>
                        {formatProfileLabel(prof)} · ({modeTag})
                      </span>
                      <span className="font-['DM_Sans',sans-serif] tabular-nums">
                        {new Date(ord.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <h3 className="font-serif text-xl font-medium text-[#3D3830]">
                      {cat?.name || 'Research Dossier'}
                    </h3>
                    <p className="text-xs text-[#5C5449]">
                      {ord.progress_step || ord.status}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-[#3D3830]/8 text-xs">
                    <span className="inline-flex items-center gap-1.5 text-[#3D3830] font-medium capitalize">
                      {ord.status === 'completed' ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-[#2D6A4F]" />
                      ) : ord.status === 'failed' ? (
                        <AlertCircle className="h-3.5 w-3.5 text-[#7A3E36]" />
                      ) : (
                        <Clock className="h-3.5 w-3.5 text-[#8B7355]" />
                      )}
                      <span>{ord.status.replace(/_/g, ' ')}</span>
                    </span>

                    <span className="inline-flex items-center gap-1 text-[#5C5449]">
                      <span>Open Dossier</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Category Filter */}
      <section className="space-y-6">
        <div className="flex flex-wrap items-center gap-4 border-b border-[#3D3830]/10 pb-3 text-xs">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`pb-1 border-b transition-colors cursor-pointer ${
                selectedCategory === cat
                  ? 'border-[#3D3830] text-[#3D3830] font-medium'
                  : 'border-transparent text-[#8B8275] hover:text-[#3D3830]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Catalog Grid */}
        {isLoading ? (
          <p className="text-sm text-[#8B8275]">Loading Reports catalog...</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCatalog.map((item) => {
              const isStarred = favoriteReportIds.includes(item.id);
              return (
                <div
                  key={item.id}
                  className="rounded-3xl bg-[#FDFBF7] border border-[#3D3830]/12 p-6 flex flex-col justify-between space-y-6"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-[11px] text-[#8B8275]">
                      <span>{item.category}</span>
                      <button
                        type="button"
                        onClick={(e) => void handleToggleFavoriteReport(e, item.id)}
                        aria-label={
                          isStarred
                            ? `Remove ${item.name} from Favourites`
                            : `Star ${item.name} to Favourites`
                        }
                        className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                          isStarred
                            ? 'text-[#B8965A] bg-[#B8965A]/12'
                            : 'text-[#8B8275] hover:text-[#3D3830] hover:bg-[#EAE3D7]/60'
                        }`}
                      >
                        <Star className={`h-4 w-4 ${isStarred ? 'fill-current' : ''}`} />
                      </button>
                    </div>

                    <h3 className="font-serif text-2xl font-medium text-[#3D3830] leading-snug">
                      {item.name}
                    </h3>

                    <p className="text-xs text-[#5C5449] leading-relaxed">
                      {item.short_description}
                    </p>
                  </div>

                  <div className="pt-4 border-t border-[#3D3830]/10 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-[10px] text-[#8B8275]">Price</p>
                      <p className="font-['DM_Sans',sans-serif] tabular-nums text-base font-medium text-[#3D3830]">
                        {item.price_credits.toLocaleString()} Credits
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => openOrderModal(item)}
                      className="inline-flex items-center gap-1.5 rounded-full bg-[#4A453D] px-4 py-2.5 text-xs font-medium text-[#FAF7F2] hover:bg-[#38342E] transition-colors cursor-pointer"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      <span>Commission</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Commission Report Modal */}
      {selectedReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1F2229]/55 backdrop-blur-xs p-4">
          <div className="w-full max-w-xl rounded-3xl bg-[#FAF7F2] border border-[#3D3830]/15 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 bg-[#F1ECE3] border-b border-[#3D3830]/10">
              <div>
                <p className="text-[11px] text-[#8B8275]">{selectedReport.category}</p>
                <h3 className="font-serif text-2xl font-medium text-[#3D3830]">
                  {selectedReport.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedReport(null)}
                className="p-2 rounded-full text-[#8B8275] hover:text-[#3D3830] cursor-pointer"
                aria-label="Close modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form
              onSubmit={handleCommissionOrder}
              className="p-6 space-y-5 max-h-[82vh] overflow-y-auto"
            >
              {selectedReport.long_description && (
                <div className="text-xs text-[#5C5449] leading-relaxed space-y-2.5 [&_h1]:font-serif [&_h1]:text-xl [&_h1]:text-[#3D3830] [&_h2]:font-serif [&_h2]:text-lg [&_h2]:text-[#3D3830] [&_h2]:mt-2 [&_h3]:font-medium [&_h3]:text-[#3D3830] [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_blockquote]:border-l-2 [&_blockquote]:border-[#B8965A] [&_blockquote]:pl-3 [&_blockquote]:italic [&_strong]:text-[#3D3830]">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {selectedReport.long_description}
                  </ReactMarkdown>
                </div>
              )}

              {selectedReport.pass_titles.length > 0 && (
                <div className="rounded-2xl bg-[#F1ECE3]/70 border border-[#3D3830]/10 p-4 space-y-1.5">
                  <p className="text-[11px] font-medium text-[#3D3830]">
                    Sequential Research Pipeline ({selectedReport.pass_count} Passes)
                  </p>
                  {selectedReport.pass_titles.map((title, idx) => (
                    <p key={idx} className="text-[11px] text-[#5C5449]">
                      {title}
                    </p>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#FDFBF7] border border-[#3D3830]/10 px-4 py-3">
                <div>
                  <p className="text-xs font-medium text-[#3D3830]">Astrology System</p>
                  <p className="text-[11px] text-[#8B8275]">
                    {modalMode === 'western'
                      ? 'Western Tropical Zodiac & Placidus Houses'
                      : 'Vedic Sidereal Zodiac, KP, Jaimini & Dasha'}
                  </p>
                </div>
                <AstrologyModeToggle
                  value={modalMode}
                  onChange={setModalMode}
                  size="sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#5C5449] mb-1.5">
                  Select Birth Profile
                </label>
                {profiles.length === 0 ? (
                  <div className="rounded-2xl bg-[#F1ECE3] p-4 text-xs text-[#5C5449] space-y-3">
                    <p>
                      Reports use a saved birth chart with verified coordinates and planetary placements.
                    </p>
                    <Link
                      to="/app/profiles"
                      className="min-h-[40px] inline-flex items-center gap-1.5 rounded-full bg-[#4A453D] px-4 py-2 text-xs font-medium text-[#FAF7F2] hover:bg-[#38342E] transition-colors"
                    >
                      <span>Add Birth Details</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                ) : (
                  <CustomSelect
                    value={selectedProfileId}
                    onChange={setSelectedProfileId}
                    ariaLabel="Select Birth Profile"
                    size="md"
                    surface="elevated"
                    className="w-full"
                    options={profiles.map((p) => ({
                      value: p.id,
                      label: formatProfileLabel(p),
                      hint: `${p.birth_date} · ${p.birth_city}`,
                    }))}
                  />
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-[#5C5449] mb-1.5">
                  Specific Questions or Life Context (Optional)
                </label>
                <textarea
                  rows={3}
                  value={userQuestions}
                  onChange={(e) => setUserQuestions(e.target.value)}
                  placeholder="Share specific milestones, decisions, or timeframes you want the dossier to resolve directly..."
                  className="w-full rounded-2xl border border-[#3D3830]/15 bg-[#FDFBF7] p-3.5 text-xs text-[#3D3830] placeholder:text-[#8B8275] focus:outline-none focus:border-[#3D3830]/35"
                />
              </div>

              {orderError && (
                <p className="rounded-2xl bg-[#7A3E36]/10 px-4 py-3 text-xs text-[#7A3E36]">
                  {orderError}
                </p>
              )}

              <div className="pt-3 border-t border-[#3D3830]/10 flex items-center justify-between gap-4">
                <div className="text-xs">
                  <span className="text-[#8B8275]">Balance after order: </span>
                  <span className="font-['DM_Sans',sans-serif] tabular-nums text-[#3D3830]">
                    {(
                      (appUser?.credits_balance ?? 0) - selectedReport.price_credits
                    ).toLocaleString()}{' '}
                    Credits
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={
                    isSubmittingOrder ||
                    profiles.length === 0 ||
                    (appUser?.credits_balance ?? 0) < selectedReport.price_credits
                  }
                  className="inline-flex items-center gap-2 rounded-full bg-[#4A453D] px-5 py-2.5 text-xs font-medium text-[#FAF7F2] hover:bg-[#38342E] disabled:opacity-45 cursor-pointer"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>
                    {isSubmittingOrder
                      ? 'Commissioning...'
                      : `Order for ${selectedReport.price_credits.toLocaleString()} Credits`}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportsStore;
