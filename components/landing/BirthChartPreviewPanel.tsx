import React, { useMemo, useState } from 'react';
import { PREVIEW_CHART_JSON } from '../app/previewFixtures';
import { EditorialImage, ParallaxFrame } from './EditorialPrimitives';
import { BIRTHCHART_CONTENT } from './landingData';

type ChartShowcaseTab = 'chart' | 'telemetry';

export const BirthChartPreviewPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ChartShowcaseTab>('chart');

  const summaryRows = useMemo(() => {
    const keyPlanets = ['Sun', 'Moon', 'Ascendant', 'Mercury', 'Jupiter', 'Saturn'];
    return PREVIEW_CHART_JSON.planets
      .filter((p) => keyPlanets.includes(p.name))
      .slice(0, 6);
  }, []);

  const topShadbala = useMemo(() => {
    return [...(PREVIEW_CHART_JSON.shadbala?.planets || [])]
      .sort((a, b) => a.strengthRank - b.strengthRank)
      .slice(0, 5);
  }, []);

  const activeStack = PREVIEW_CHART_JSON.vimshottari.currentStack;

  return (
    <div className="space-y-5">
      {/* Segmented switcher: Illuminated Chart vs. Live Chart Indicators */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="Birth chart presentation mode"
          className="inline-flex items-center gap-1 rounded-xl bg-[#EAE2D4] p-1 border border-[#3D3830]/10"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'chart'}
            onClick={() => setActiveTab('chart')}
            className={`px-3.5 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'chart'
                ? 'bg-[#FDFBF7] text-[#3D3830] shadow-sm'
                : 'text-[#6B6256] hover:text-[#3D3830]'
            }`}
          >
            Illuminated Birth Chart
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'telemetry'}
            onClick={() => setActiveTab('telemetry')}
            className={`px-3.5 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'telemetry'
                ? 'bg-[#FDFBF7] text-[#3D3830] shadow-sm'
                : 'text-[#6B6256] hover:text-[#3D3830]'
            }`}
          >
            Multi-Layer Indicators
          </button>
        </div>

        <p className="font-['JetBrains_Mono',monospace] tabular-nums text-xs text-[#6B6256]">
          600+ natal, divisional &amp; timing points
        </p>
      </div>

      {/* Luminous Showcase Viewport */}
      {activeTab === 'chart' ? (
        <ParallaxFrame
          strength={14}
          className="rounded-3xl border border-[#3D3830]/12 bg-[#EFE7D8] aspect-[16/10] sm:aspect-[16/9]"
        >
          <EditorialImage
            src={BIRTHCHART_CONTENT.chartImageUrl}
            alt={BIRTHCHART_CONTENT.chartImageAlt}
            className="h-full w-full"
            warmGrade={false}
          />
        </ParallaxFrame>
      ) : (
        <div className="rounded-3xl border border-[#3D3830]/12 bg-[#FDFBF7] p-5 sm:p-8 space-y-6 animate-cc-tab-panel">
          <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 pb-4 border-b border-[#3D3830]/10">
            <div>
              <p className="text-xs text-[#8B8275]">Sample Natal Calculation</p>
              <h3 className="font-['Cormorant_Garamond',serif] text-2xl font-medium text-[#3D3830]">
                Parashari · KP Sub-Lords · Shadbala · Vimshottari
              </h3>
            </div>
            <p className="font-['JetBrains_Mono',monospace] tabular-nums text-xs text-[#6B6256]">
              {PREVIEW_CHART_JSON.meta.ayanamsha} Ayanamsha · {PREVIEW_CHART_JSON.meta.birthDate}
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Planetary & Nakshatra table */}
            <div className="lg:col-span-7 space-y-3">
              <p className="text-xs font-medium text-[#6B6256]">
                Planetary Degrees &amp; KP Sub-Lords
              </p>
              <div className="divide-y divide-[#3D3830]/8 border-t border-b border-[#3D3830]/10">
                {summaryRows.map((row) => (
                  <div
                    key={row.name}
                    className="grid grid-cols-12 items-center py-2.5 text-xs sm:text-sm gap-2"
                  >
                    <span className="col-span-3 font-medium text-[#3D3830] truncate">
                      {row.name}
                    </span>
                    <span className="col-span-4 font-['JetBrains_Mono',monospace] tabular-nums text-xs text-[#5C5449] truncate">
                      {row.sign} {row.dms}
                    </span>
                    <span className="col-span-3 text-xs text-[#6B6256] truncate">
                      {row.nakshatra} · P{row.pada}
                    </span>
                    <span className="col-span-2 text-right font-['JetBrains_Mono',monospace] tabular-nums text-xs text-[#8B7355]">
                      Sub {row.subLord.slice(0, 3)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Shadbala + Dasha summary */}
            <div className="lg:col-span-5 space-y-5">
              <div className="space-y-3">
                <p className="text-xs font-medium text-[#6B6256]">
                  Shadbala Planetary Strength
                </p>
                <div className="space-y-2.5">
                  {topShadbala.map((planet) => {
                    const pct = Math.min(100, Math.round(planet.ratio * 65));
                    return (
                      <div key={planet.planet} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-[#3D3830]">
                            {planet.planet}
                          </span>
                          <span className="font-['JetBrains_Mono',monospace] tabular-nums text-[#6B6256]">
                            {planet.totalRupas.toFixed(2)} Rupas
                          </span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-[#EFE8DB] overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[#8B7355]"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="pt-4 border-t border-[#3D3830]/10 space-y-1.5">
                <p className="text-xs font-medium text-[#6B6256]">Active Planetary Cycle</p>
                <p className="font-['Cormorant_Garamond',serif] text-xl font-medium text-[#3D3830]">
                  {activeStack.mahadasha} Mahadasha · {activeStack.antardasha} Antardasha
                </p>
                <p className="font-['JetBrains_Mono',monospace] tabular-nums text-xs text-[#6B6256]">
                  Pratyantardasha: {activeStack.pratyantardasha} · Cross-verified across D1 &amp; D10
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
