import React, { useMemo } from 'react';
import { Search, X } from 'lucide-react';
import {
  COMPANION_DISCOVERY_TABS,
  COMPANION_SITUATION_CHIPS,
  matchesCompanionDiscoveryFilter,
  resolveCompanionGroup,
  type CompanionDiscoveryFilterableCard,
  type CompanionDiscoveryTabId,
} from './chatTypes';

interface CompanionDiscoveryControlsProps {
  cards: CompanionDiscoveryFilterableCard[];
  activeGroup: CompanionDiscoveryTabId;
  onChangeGroup: (group: CompanionDiscoveryTabId) => void;
  activeSituationChip: string | null;
  onChangeSituationChip: (chipId: string | null) => void;
  searchQuery: string;
  onChangeSearchQuery: (query: string) => void;
  tabSurface?: 'cream' | 'white';
  showCounts?: boolean;
}

const CompanionDiscoveryControls: React.FC<CompanionDiscoveryControlsProps> = ({
  cards,
  activeGroup,
  onChangeGroup,
  activeSituationChip,
  onChangeSituationChip,
  searchQuery,
  onChangeSearchQuery,
  tabSurface = 'cream',
  showCounts = false,
}) => {
  const availableTabs = useMemo(() => {
    return COMPANION_DISCOVERY_TABS.filter((tab) => {
      if (tab.id === 'all') return true;
      return cards.some((card) => resolveCompanionGroup(card) === tab.id);
    });
  }, [cards]);

  const groupCounts = useMemo(() => {
    const counts: Record<CompanionDiscoveryTabId, number> = {
      all: cards.length,
      spiritual_guides: 0,
      everyday_companions: 0,
      life_companions: 0,
    };
    for (const c of cards) {
      counts[resolveCompanionGroup(c)] += 1;
    }
    return counts;
  }, [cards]);

  const availableChips = useMemo(() => {
    return COMPANION_SITUATION_CHIPS.filter((chip) =>
      cards.some((card) =>
        matchesCompanionDiscoveryFilter(card, {
          groupTab: activeGroup,
          situationChipId: chip.id,
          searchQuery: '',
        })
      )
    );
  }, [cards, activeGroup]);

  const inactiveTabBg = tabSurface === 'cream' ? 'bg-[#FAF7F2]' : 'bg-[#FDFBF7]';
  const hasActiveFilters =
    activeGroup !== 'all' || Boolean(activeSituationChip) || Boolean(searchQuery.trim());

  return (
    <div className="space-y-3">
      {/* Row 1: Pillar Tabs + Situation Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        {availableTabs.length > 1 && (
          <div
            className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar"
            role="tablist"
            aria-label="Filter companions by pillar"
          >
            {availableTabs.map((tab) => {
              const isActive = activeGroup === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => onChangeGroup(tab.id)}
                  className={`min-h-[38px] shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                    isActive
                      ? 'bg-[#4A453D] text-[#FAF7F2]'
                      : `border border-[#3D3830]/12 ${inactiveTabBg} text-[#5C5449] hover:bg-[#F1ECE3] hover:text-[#3D3830]`
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
        )}

        <div className="relative w-full md:w-64 lg:w-72 shrink-0">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#8B8275]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onChangeSearchQuery(e.target.value)}
            placeholder="Search situation, mood, or name..."
            aria-label="Search companions by situation, mood, or name"
            className={`w-full min-h-[38px] rounded-xl border border-[#3D3830]/12 ${inactiveTabBg} pl-9 pr-8 py-1.5 text-xs text-[#3D3830] placeholder:text-[#8B8275] focus:outline-none focus:border-[#4A453D]/40 transition-colors`}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onChangeSearchQuery('')}
              aria-label="Clear companion search"
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full text-[#8B8275] hover:text-[#3D3830] hover:bg-[#EAE3D7]/60 cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Row 2: Quick Situation Chips */}
      {availableChips.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar sm:flex-wrap">
          <span className="text-[11px] font-medium text-[#8B8275] shrink-0 mr-1">
            By moment:
          </span>
          {availableChips.map((chip) => {
            const isChipActive = activeSituationChip === chip.id;
            return (
              <button
                key={chip.id}
                type="button"
                aria-pressed={isChipActive}
                onClick={() =>
                  onChangeSituationChip(isChipActive ? null : chip.id)
                }
                className={`min-h-[30px] shrink-0 rounded-xl px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  isChipActive
                    ? 'bg-[#B8965A]/18 border border-[#B8965A]/55 text-[#3D3830]'
                    : `border border-[#3D3830]/10 ${inactiveTabBg} text-[#5C5449] hover:border-[#3D3830]/25 hover:text-[#3D3830]`
                }`}
              >
                {chip.label}
              </button>
            );
          })}

          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => {
                onChangeGroup('all');
                onChangeSituationChip(null);
                onChangeSearchQuery('');
              }}
              className="min-h-[30px] shrink-0 rounded-xl px-2.5 py-1 text-[11px] font-medium text-[#7A3E36] hover:bg-[#7A3E36]/8 transition-colors cursor-pointer whitespace-nowrap"
            >
              Reset
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default CompanionDiscoveryControls;
