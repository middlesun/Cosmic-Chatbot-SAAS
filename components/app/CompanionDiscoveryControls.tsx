import React, { useMemo } from 'react';
import { Search, X } from 'lucide-react';
import {
  DEFAULT_COMPANION_SPECIALIZATIONS,
  type CompanionSpecializationTag,
} from '../../lib/companionV2Schema';
import {
  COMPANION_CATEGORY_TABS,
  COMPANION_SUBFILTER_HEADING_BY_GROUP,
  matchesCompanionDiscoveryFilter,
  resolveCompanionGroup,
  type CompanionDiscoveryFilterableCard,
  type CompanionDiscoveryTabId,
  type CompanionGroup,
} from './chatTypes';

interface CompanionDiscoveryControlsProps {
  cards: CompanionDiscoveryFilterableCard[];
  activeGroup: CompanionDiscoveryTabId;
  onChangeGroup: (group: CompanionDiscoveryTabId) => void;
  activeSituationChip?: string | null;
  onChangeSituationChip?: (chipId: string | null) => void;
  specializations?: CompanionSpecializationTag[];
  activeSpecialization?: string | null;
  onChangeSpecialization?: (slug: string | null) => void;
  searchQuery: string;
  onChangeSearchQuery: (query: string) => void;
  tabSurface?: 'cream' | 'white';
  showCounts?: boolean;
}

const CompanionDiscoveryControls: React.FC<CompanionDiscoveryControlsProps> = ({
  cards,
  activeGroup,
  onChangeGroup,
  onChangeSituationChip,
  specializations = DEFAULT_COMPANION_SPECIALIZATIONS,
  activeSpecialization = null,
  onChangeSpecialization,
  searchQuery,
  onChangeSearchQuery,
  tabSurface = 'cream',
  showCounts = false,
}) => {
  const resolvedGroup: CompanionGroup =
    activeGroup === 'all' ? 'spiritual_guides' : activeGroup;

  const groupCounts = useMemo(() => {
    const counts: Record<CompanionGroup, number> = {
      spiritual_guides: 0,
      everyday_companions: 0,
      life_companions: 0,
    };
    for (const c of cards) {
      counts[resolveCompanionGroup(c)] += 1;
    }
    return counts;
  }, [cards]);

  const activeCategorySubFilters = useMemo(() => {
    const source =
      Array.isArray(specializations) && specializations.length > 0
        ? specializations
        : DEFAULT_COMPANION_SPECIALIZATIONS;
    return source
      .filter((spec) => spec.is_active !== false && spec.group === resolvedGroup)
      .sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label));
  }, [specializations, resolvedGroup]);

  const subFilterHeading = COMPANION_SUBFILTER_HEADING_BY_GROUP[resolvedGroup];

  const activeCategoryMatchCount = useMemo(() => {
    if (!searchQuery.trim()) return cards.length;
    return cards.filter((card) =>
      matchesCompanionDiscoveryFilter(card, {
        groupTab: resolvedGroup,
        specializationSlug: activeSpecialization,
        searchQuery,
      })
    ).length;
  }, [cards, resolvedGroup, activeSpecialization, searchQuery]);

  const otherCategorySearchMatches = useMemo(() => {
    const q = searchQuery.trim();
    if (!q || activeCategoryMatchCount > 0) return [];
    return COMPANION_CATEGORY_TABS.filter((tab) => tab.id !== resolvedGroup)
      .map((tab) => ({
        ...tab,
        count: cards.filter((card) =>
          matchesCompanionDiscoveryFilter(card, {
            groupTab: tab.id,
            searchQuery: q,
          })
        ).length,
      }))
      .filter((tab) => tab.count > 0);
  }, [cards, resolvedGroup, searchQuery, activeCategoryMatchCount]);

  const inactivePillBg = tabSurface === 'cream' ? 'bg-[#FAF7F2]' : 'bg-[#FDFBF7]';
  const hasSecondaryFilter = Boolean(activeSpecialization) || Boolean(searchQuery.trim());

  const handleSelectCategory = (group: CompanionGroup) => {
    onChangeGroup(group);
    onChangeSpecialization?.(null);
    onChangeSituationChip?.(null);
  };

  const resetSubFilters = () => {
    onChangeSpecialization?.(null);
    onChangeSituationChip?.(null);
    onChangeSearchQuery('');
  };

  return (
    <div className="space-y-4">
      {/* Row 1: 3 Primary Category Tabs + Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div
          className="flex items-center gap-2 overflow-x-auto pb-0.5 no-scrollbar sm:flex-wrap"
          role="tablist"
          aria-label="Explore companions by category"
        >
          {COMPANION_CATEGORY_TABS.map((tab) => {
            const isActive = resolvedGroup === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => handleSelectCategory(tab.id)}
                className={`min-h-[40px] shrink-0 rounded-full px-4 py-2 text-xs sm:text-[13px] font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-[#4A453D] text-[#FAF7F2] hover:bg-[#38342E]'
                    : `border border-[#3D3830]/14 ${inactivePillBg} text-[#3D3830] hover:bg-[#F1ECE3] hover:border-[#3D3830]/25`
                }`}
              >
                <span>{tab.label}</span>
                {showCounts && cards.length > 0 && (
                  <span
                    className={`ml-1.5 font-['JetBrains_Mono',monospace] tabular-nums text-[10px] ${
                      isActive ? 'text-[#FAF7F2]/75' : 'text-[#8B8275]'
                    }`}
                  >
                    {groupCounts[tab.id]}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="relative w-full md:w-64 lg:w-72 shrink-0">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#8B8275]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onChangeSearchQuery(e.target.value)}
            placeholder="Search by name, topic, or style..."
            aria-label="Search companions by name, topic, or style"
            className={`w-full min-h-[40px] rounded-full border border-[#3D3830]/14 ${inactivePillBg} pl-9 pr-8 py-2 text-xs text-[#3D3830] placeholder:text-[#8B8275] focus:outline-none focus:border-[#4A453D]/45 transition-colors`}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onChangeSearchQuery('')}
              aria-label="Clear companion search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-full text-[#8B8275] hover:text-[#3D3830] hover:bg-[#EAE3D7]/60 cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Hairline Divider + Row 2: Context-Specific Sub-Filter Taxonomy */}
      {activeCategorySubFilters.length > 0 && (
        <div className="border-t border-[#3D3830]/10 pt-3.5 space-y-2.5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-medium text-[#5C5449]">
              {subFilterHeading}
            </p>
            {hasSecondaryFilter && (
              <button
                type="button"
                onClick={resetSubFilters}
                className="text-[11px] font-medium text-[#7A3E36] hover:underline transition-colors cursor-pointer shrink-0"
              >
                Reset filters
              </button>
            )}
          </div>

          <div
            className="flex flex-wrap items-center gap-2"
            role="group"
            aria-label={subFilterHeading}
          >
            <button
              type="button"
              aria-pressed={!activeSpecialization}
              onClick={() => onChangeSpecialization?.(null)}
              className={`min-h-[36px] rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                !activeSpecialization
                  ? 'bg-[#4A453D] text-[#FAF7F2] hover:bg-[#38342E]'
                  : `border border-[#3D3830]/14 ${inactivePillBg} text-[#3D3830] hover:bg-[#F1ECE3] hover:border-[#3D3830]/25`
              }`}
            >
              All
            </button>

            {activeCategorySubFilters.map((spec) => {
              const isSpecActive = activeSpecialization === spec.slug;
              return (
                <button
                  key={spec.slug}
                  type="button"
                  aria-pressed={isSpecActive}
                  title={spec.description || undefined}
                  onClick={() =>
                    onChangeSpecialization?.(isSpecActive ? null : spec.slug)
                  }
                  className={`min-h-[36px] rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                    isSpecActive
                      ? 'bg-[#4A453D] text-[#FAF7F2] hover:bg-[#38342E]'
                      : `border border-[#3D3830]/14 ${inactivePillBg} text-[#3D3830] hover:bg-[#F1ECE3] hover:border-[#3D3830]/25`
                  }`}
                >
                  {spec.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Helpful Cross-Category Search Hint when Search matches another category */}
      {otherCategorySearchMatches.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[#3D3830]/10 bg-[#F1ECE3]/65 px-3.5 py-2.5 text-xs text-[#5C5449]">
          <span>Matches for &ldquo;{searchQuery.trim()}&rdquo; found in:</span>
          {otherCategorySearchMatches.map((other) => (
            <button
              key={other.id}
              type="button"
              onClick={() => {
                onChangeGroup(other.id);
                onChangeSpecialization?.(null);
                onChangeSituationChip?.(null);
              }}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#3D3830]/15 bg-[#FDFBF7] px-3 py-1 text-[11px] font-medium text-[#3D3830] hover:bg-[#EAE3D7] transition-colors cursor-pointer"
            >
              <span>{other.label}</span>
              <span className="font-['JetBrains_Mono',monospace] tabular-nums text-[10px] text-[#8B8275]">
                {other.count}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default CompanionDiscoveryControls;
