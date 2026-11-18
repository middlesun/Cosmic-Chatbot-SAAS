import React, { useState, useMemo } from 'react';
import { Compass, Layers, Clock, Sparkles, BarChart3, ChevronDown, ChevronRight } from 'lucide-react';

export interface PlanetPosition {
  name: string;
  longitude: number;
  signIndex: number;
  sign: string;
  degreeInSign: number;
  dms: string;
  nakshatra: string;
  nakshatraLord: string;
  pada: number;
  subLord: string;
  subSubLord: string;
  isRetrograde: boolean;
  house: number;
  dignity: string;
}

export interface CompiledChartJson {
  meta: {
    name: string;
    birthDate: string;
    birthTime: string;
    location: {
      latitude: number;
      longitude: number;
      timezoneOffset: number;
      locationLabel: string;
    };
    ayanamsha: string;
  };
  planets: PlanetPosition[];
  vargas: Record<
    string,
    {
      ascendantSignIndex: number;
      placements: Array<{ name: string; signIndex: number; sign: string; house: number }>;
    }
  >;
  kp: {
    cusps: Array<{
      house: number;
      sign: string;
      dms: string;
      signLord: string;
      nakshatra: string;
      starLord: string;
      subLord: string;
    }>;
    significators: Array<{
      planet: string;
      occupiesHouse: number;
      ownsHouses: number[];
      starLord: string;
      subLord: string;
      signifiesHouses: number[];
    }>;
  };
  jaimini: {
    karakas: Array<{
      code: string;
      title: string;
      planet: string;
      dms: string;
      sign: string;
    }>;
    karakamshaSign: string;
  };
  ashtakavarga: {
    bhinna: Record<string, number[]>;
    sarva: number[];
    totalBindus: number;
  };
  vimshottari: {
    timeline: Array<{
      lord: string;
      startDate: string;
      endDate: string;
      children?: Array<{
        lord: string;
        startDate: string;
        endDate: string;
        children?: Array<{
          lord: string;
          startDate: string;
          endDate: string;
        }>;
      }>;
    }>;
    currentStack: {
      mahadasha: string;
      antardasha: string;
      pratyantardasha: string;
      mdEnd: string;
      adEnd: string;
      pdEnd: string;
    } | null;
  };
  shadBalaSummary?: unknown;
}

const PLANET_CODE: Record<string, string> = {
  Ascendant: 'As',
  Sun: 'Su',
  Moon: 'Mo',
  Mars: 'Ma',
  Mercury: 'Me',
  Jupiter: 'Ju',
  Venus: 'Ve',
  Saturn: 'Sa',
  Rahu: 'Ra',
  Ketu: 'Ke',
};

const SIGN_NAMES_SHORT = ['Ari', 'Tau', 'Gem', 'Can', 'Leo', 'Vir', 'Lib', 'Sco', 'Sag', 'Cap', 'Aqu', 'Pis'];

// Center coordinates for houses 1..12 in North Indian 400x400 diamond chart
const NORTH_HOUSE_POSITIONS: Record<number, { x: number; y: number; signX: number; signY: number }> = {
  1: { x: 200, y: 112, signX: 200, signY: 165 },
  2: { x: 100, y: 52, signX: 100, signY: 82 },
  3: { x: 48, y: 102, signX: 80, signY: 102 },
  4: { x: 108, y: 200, signX: 168, signY: 200 },
  5: { x: 48, y: 298, signX: 80, signY: 298 },
  6: { x: 100, y: 348, signX: 100, signY: 320 },
  7: { x: 200, y: 292, signX: 200, signY: 238 },
  8: { x: 300, y: 348, signX: 300, signY: 320 },
  9: { x: 352, y: 298, signX: 320, signY: 298 },
  10: { x: 292, y: 200, signX: 232, signY: 200 },
  11: { x: 352, y: 102, signX: 320, signY: 102 },
  12: { x: 300, y: 52, signX: 300, signY: 82 },
};

// South Indian 4x4 grid cell coordinates indexed by signIndex (0=Aries..11=Pisces)
const SOUTH_SIGN_CELLS: Record<number, { col: number; row: number }> = {
  11: { col: 0, row: 0 }, // Pisces
  0: { col: 1, row: 0 }, // Aries
  1: { col: 2, row: 0 }, // Taurus
  2: { col: 3, row: 0 }, // Gemini
  3: { col: 3, row: 1 }, // Cancer
  4: { col: 3, row: 2 }, // Leo
  5: { col: 3, row: 3 }, // Virgo
  6: { col: 2, row: 3 }, // Libra
  7: { col: 1, row: 3 }, // Scorpio
  8: { col: 0, row: 3 }, // Sagittarius
  9: { col: 0, row: 2 }, // Capricorn
  10: { col: 0, row: 1 }, // Aquarius
};

interface ChartViewerProps {
  chart: CompiledChartJson;
}

const DIVISIONS = ['D1', 'D9', 'D10', 'D7', 'D12', 'D2', 'D3', 'D4', 'D16', 'D20', 'D24', 'D30', 'D60'];

const ChartViewer: React.FC<ChartViewerProps> = ({ chart }) => {
  const [chartStyle, setChartStyle] = useState<'north' | 'south'>('north');
  const [selectedVarga, setSelectedVarga] = useState<string>('D1');
  const [activeTab, setActiveTab] = useState<'planets' | 'kp' | 'dasha' | 'jaimini' | 'shadbala'>('planets');
  const [expandedMD, setExpandedMD] = useState<string | null>(
    chart.vimshottari.currentStack?.mahadasha || null
  );
  const [expandedAD, setExpandedAD] = useState<string | null>(
    chart.vimshottari.currentStack
      ? `${chart.vimshottari.currentStack.mahadasha}-${chart.vimshottari.currentStack.antardasha}`
      : null
  );

  const activeVarga = useMemo(() => {
    return chart.vargas[selectedVarga] || chart.vargas.D1;
  }, [chart.vargas, selectedVarga]);

  const planetsByHouse = useMemo(() => {
    const map: Record<number, string[]> = {};
    for (let h = 1; h <= 12; h++) map[h] = [];
    for (const pl of activeVarga.placements) {
      if (pl.name === 'Ascendant') continue;
      const d1Match = chart.planets.find((p) => p.name === pl.name);
      const code = `${PLANET_CODE[pl.name] || pl.name.slice(0, 2)}${d1Match?.isRetrograde ? '*' : ''}`;
      map[pl.house].push(code);
    }
    return map;
  }, [activeVarga, chart.planets]);

  const planetsBySign = useMemo(() => {
    const map: Record<number, string[]> = {};
    for (let s = 0; s < 12; s++) map[s] = [];
    for (const pl of activeVarga.placements) {
      const d1Match = chart.planets.find((p) => p.name === pl.name);
      const code =
        pl.name === 'Ascendant'
          ? 'Asc'
          : `${PLANET_CODE[pl.name] || pl.name.slice(0, 2)}${d1Match?.isRetrograde ? '*' : ''}`;
      map[pl.signIndex].push(code);
    }
    return map;
  }, [activeVarga, chart.planets]);

  const todayISO = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      {/* Observatory Night Hero Chart Section */}
      <div className="rounded-3xl bg-gradient-to-br from-[#1F2229] to-[#292D36] p-6 md:p-8 text-[#F4EFE6]">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/10 pb-5 mb-6">
          <div>
            <p className="text-xs text-[#F4EFE6]/60 mb-1">
              {chart.meta.ayanamsha} · {chart.meta.location.locationLabel}
            </p>
            <h2 className="font-serif text-2xl md:text-3xl font-medium text-[#F4EFE6]">
              {chart.meta.name} — {selectedVarga} Chart
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Style Switcher */}
            <div className="flex items-center rounded-xl bg-white/10 p-1 text-xs">
              <button
                type="button"
                onClick={() => setChartStyle('north')}
                className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
                  chartStyle === 'north'
                    ? 'bg-[#F4EFE6] text-[#1F2229] font-medium'
                    : 'text-[#F4EFE6]/70 hover:text-[#F4EFE6]'
                }`}
              >
                North Indian
              </button>
              <button
                type="button"
                onClick={() => setChartStyle('south')}
                className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
                  chartStyle === 'south'
                    ? 'bg-[#F4EFE6] text-[#1F2229] font-medium'
                    : 'text-[#F4EFE6]/70 hover:text-[#F4EFE6]'
                }`}
              >
                South Indian
              </button>
            </div>

            {/* Varga Selector */}
            <select
              aria-label="Select Divisional Chart"
              value={selectedVarga}
              onChange={(e) => setSelectedVarga(e.target.value)}
              className="rounded-xl bg-white/10 border border-white/15 px-3 py-2 text-xs font-['JetBrains_Mono',monospace] text-[#F4EFE6] focus:outline-none"
            >
              {DIVISIONS.filter((d) => chart.vargas[d]).map((d) => (
                <option key={d} value={d} className="bg-[#1F2229] text-[#F4EFE6]">
                  {d} {d === 'D1' ? '(Rasi)' : d === 'D9' ? '(Navamsha)' : d === 'D10' ? '(Dasamsa)' : d === 'D7' ? '(Saptamsa)' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Interactive SVG Chart */}
          <div className="lg:col-span-6 flex justify-center">
            {chartStyle === 'north' ? (
              <svg
                viewBox="0 0 400 400"
                className="w-full max-w-[360px] h-auto select-none"
                role="img"
                aria-label={`North Indian ${selectedVarga} chart`}
              >
                <rect x="8" y="8" width="384" height="384" rx="16" fill="rgba(255,255,255,0.03)" stroke="rgba(244,239,230,0.28)" strokeWidth="1.2" />
                <line x1="8" y1="8" x2="392" y2="392" stroke="rgba(244,239,230,0.22)" strokeWidth="1" />
                <line x1="392" y1="8" x2="8" y2="392" stroke="rgba(244,239,230,0.22)" strokeWidth="1" />
                <polygon points="200,8 392,200 200,392 8,200" fill="none" stroke="rgba(244,239,230,0.28)" strokeWidth="1.2" />

                {Array.from({ length: 12 }, (_, idx) => {
                  const house = idx + 1;
                  const signNum = ((activeVarga.ascendantSignIndex + idx) % 12) + 1;
                  const pos = NORTH_HOUSE_POSITIONS[house];
                  const items = planetsByHouse[house] || [];
                  return (
                    <g key={house}>
                      <text
                        x={pos.signX}
                        y={pos.signY}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill="rgba(184,150,90,0.85)"
                        fontSize="11"
                        fontFamily="JetBrains Mono, monospace"
                      >
                        {signNum}
                      </text>
                      <text
                        x={pos.x}
                        y={pos.y}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill="#F4EFE6"
                        fontSize="12.5"
                        fontWeight="500"
                        fontFamily="Plus Jakarta Sans, sans-serif"
                      >
                        {items.join(' ')}
                      </text>
                    </g>
                  );
                })}
              </svg>
            ) : (
              <svg
                viewBox="0 0 400 400"
                className="w-full max-w-[360px] h-auto select-none"
                role="img"
                aria-label={`South Indian ${selectedVarga} chart`}
              >
                <rect x="8" y="8" width="384" height="384" rx="16" fill="rgba(255,255,255,0.03)" stroke="rgba(244,239,230,0.28)" strokeWidth="1.2" />
                {[1, 2, 3].map((i) => (
                  <React.Fragment key={i}>
                    <line x1={8 + i * 96} y1={i === 2 ? 8 : 8} x2={8 + i * 96} y2={i === 2 ? 104 : 392} stroke="rgba(244,239,230,0.22)" strokeWidth="1" />
                    <line x1={8} y1={8 + i * 96} x2={i === 2 ? 104 : 392} y2={8 + i * 96} stroke="rgba(244,239,230,0.22)" strokeWidth="1" />
                  </React.Fragment>
                ))}
                {/* Complete inner 2x2 center cutout lines */}
                <line x1="200" y1="304" x2="200" y2="392" stroke="rgba(244,239,230,0.22)" strokeWidth="1" />
                <line x1="296" y1="200" x2="392" y2="200" stroke="rgba(244,239,230,0.22)" strokeWidth="1" />
                <rect x="104" y="104" width="192" height="192" fill="rgba(31,34,41,0.7)" stroke="rgba(244,239,230,0.25)" strokeWidth="1" />
                <text x="200" y="192" textAnchor="middle" fill="#F4EFE6" fontSize="16" fontFamily="Cormorant Garamond, serif">
                  {selectedVarga}
                </text>
                <text x="200" y="214" textAnchor="middle" fill="rgba(244,239,230,0.55)" fontSize="11" fontFamily="Plus Jakarta Sans, sans-serif">
                  {SIGN_NAMES_SHORT[activeVarga.ascendantSignIndex]} Lagna
                </text>

                {Object.entries(SOUTH_SIGN_CELLS).map(([sIdxStr, cell]) => {
                  const sIdx = Number(sIdxStr);
                  const x = 8 + cell.col * 96;
                  const y = 8 + cell.row * 96;
                  const items = planetsBySign[sIdx] || [];
                  const isAsc = sIdx === activeVarga.ascendantSignIndex;
                  return (
                    <g key={sIdx}>
                      {isAsc && (
                        <line x1={x} y1={y + 18} x2={x + 18} y2={y} stroke="rgba(184,150,90,0.8)" strokeWidth="1.2" />
                      )}
                      <text x={x + 8} y={y + 18} fill="rgba(184,150,90,0.7)" fontSize="9.5" fontFamily="JetBrains Mono, monospace">
                        {SIGN_NAMES_SHORT[sIdx]}
                      </text>
                      <text x={x + 48} y={y + 54} textAnchor="middle" fill="#F4EFE6" fontSize="12" fontWeight="500">
                        {items.slice(0, 3).join(' ')}
                      </text>
                      {items.length > 3 && (
                        <text x={x + 48} y={y + 72} textAnchor="middle" fill="#F4EFE6" fontSize="12" fontWeight="500">
                          {items.slice(3).join(' ')}
                        </text>
                      )}
                    </g>
                  );
                })}
              </svg>
            )}
          </div>

          {/* Right Summary Telemetry */}
          <div className="lg:col-span-6 space-y-5">
            {chart.vimshottari.currentStack && (
              <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
                <p className="text-xs text-[#F4EFE6]/60 mb-2">Active Vimshottari Phase</p>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-[#F4EFE6]/55">Mahadasha</p>
                    <p className="font-serif text-xl text-[#F4EFE6]">{chart.vimshottari.currentStack.mahadasha}</p>
                    <p className="text-[11px] font-['JetBrains_Mono',monospace] tabular-nums text-[#B8965A]">
                      → {chart.vimshottari.currentStack.mdEnd}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-[#F4EFE6]/55">Antardasha</p>
                    <p className="font-serif text-xl text-[#F4EFE6]">{chart.vimshottari.currentStack.antardasha}</p>
                    <p className="text-[11px] font-['JetBrains_Mono',monospace] tabular-nums text-[#B8965A]">
                      → {chart.vimshottari.currentStack.adEnd}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-[#F4EFE6]/55">Pratyantar</p>
                    <p className="font-serif text-xl text-[#F4EFE6]">{chart.vimshottari.currentStack.pratyantardasha}</p>
                    <p className="text-[11px] font-['JetBrains_Mono',monospace] tabular-nums text-[#B8965A]">
                      → {chart.vimshottari.currentStack.pdEnd}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
                <p className="text-[#F4EFE6]/60 mb-1">D1 Ascendant</p>
                <p className="font-serif text-lg text-[#F4EFE6]">
                  {chart.planets.find((p) => p.name === 'Ascendant')?.sign || '—'}
                </p>
                <p className="font-['JetBrains_Mono',monospace] tabular-nums text-[#F4EFE6]/70 mt-0.5">
                  {chart.planets.find((p) => p.name === 'Ascendant')?.dms || ''}
                </p>
              </div>
              <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
                <p className="text-[#F4EFE6]/60 mb-1">Moon Nakshatra</p>
                <p className="font-serif text-lg text-[#F4EFE6]">
                  {chart.planets.find((p) => p.name === 'Moon')?.nakshatra || '—'}
                </p>
                <p className="font-['JetBrains_Mono',monospace] tabular-nums text-[#F4EFE6]/70 mt-0.5">
                  Pada {chart.planets.find((p) => p.name === 'Moon')?.pada || '—'} · Karakamsha {chart.jaimini.karakamshaSign}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Filter Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 rounded-2xl bg-[#F1ECE3] p-1.5 w-fit">
        {[
          { id: 'planets', label: 'Planetary Positions', icon: Compass },
          { id: 'kp', label: 'KP Cusps & Sub-Lords', icon: Layers },
          { id: 'dasha', label: 'Vimshottari Dasha', icon: Clock },
          { id: 'jaimini', label: 'Jaimini & Ashtakavarga', icon: Sparkles },
          { id: 'shadbala', label: 'Shad Bala', icon: BarChart3 },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
                active
                  ? 'bg-[#FDFBF7] text-[#3D3830] shadow-sm'
                  : 'text-[#5C5449] hover:text-[#3D3830]'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === 'planets' && (
        <div className="overflow-x-auto rounded-3xl bg-[#FDFBF7] border border-[#3D3830]/10">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#3D3830]/10 text-[#8B8275]">
                <th className="py-3.5 px-5 font-medium">Body</th>
                <th className="py-3.5 px-4 font-medium">House</th>
                <th className="py-3.5 px-4 font-medium">Sign</th>
                <th className="py-3.5 px-4 font-medium">Degree</th>
                <th className="py-3.5 px-4 font-medium">Nakshatra · Pada</th>
                <th className="py-3.5 px-4 font-medium">Sub-Lord</th>
                <th className="py-3.5 px-5 font-medium">Dignity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#3D3830]/10">
              {chart.planets.map((p) => (
                <tr key={p.name} className="hover:bg-[#F1ECE3]/50">
                  <td className="py-3 px-5 font-medium text-[#3D3830]">
                    {p.name} {p.isRetrograde ? '(R)' : ''}
                  </td>
                  <td className="py-3 px-4 font-['JetBrains_Mono',monospace] tabular-nums text-[#5C5449]">
                    H{p.house}
                  </td>
                  <td className="py-3 px-4 text-[#3D3830]">{p.sign}</td>
                  <td className="py-3 px-4 font-['JetBrains_Mono',monospace] tabular-nums text-[#5C5449]">
                    {p.dms}
                  </td>
                  <td className="py-3 px-4 text-[#5C5449]">
                    {p.nakshatra} · P{p.pada}
                  </td>
                  <td className="py-3 px-4 text-[#5C5449]">{p.subLord}</td>
                  <td className="py-3 px-5 text-[#5C5449]">{p.dignity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'kp' && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="overflow-x-auto rounded-3xl bg-[#FDFBF7] border border-[#3D3830]/10">
            <div className="px-5 py-4 border-b border-[#3D3830]/10">
              <h3 className="font-serif text-xl font-medium text-[#3D3830]">Placidus House Cusps</h3>
            </div>
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#3D3830]/10 text-[#8B8275]">
                  <th className="py-3 px-4 font-medium">Cusp</th>
                  <th className="py-3 px-4 font-medium">Sign · Degree</th>
                  <th className="py-3 px-4 font-medium">Sign / Star</th>
                  <th className="py-3 px-4 font-medium">Sub-Lord</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#3D3830]/10">
                {chart.kp.cusps.map((c) => (
                  <tr key={c.house} className="hover:bg-[#F1ECE3]/50">
                    <td className="py-2.5 px-4 font-['JetBrains_Mono',monospace] tabular-nums font-medium">
                      H{c.house}
                    </td>
                    <td className="py-2.5 px-4 font-['JetBrains_Mono',monospace] tabular-nums text-[#5C5449]">
                      {c.sign.slice(0, 3)} {c.dms}
                    </td>
                    <td className="py-2.5 px-4 text-[#5C5449]">
                      {c.signLord} / {c.starLord}
                    </td>
                    <td className="py-2.5 px-4 font-medium text-[#3D3830]">{c.subLord}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="overflow-x-auto rounded-3xl bg-[#FDFBF7] border border-[#3D3830]/10">
            <div className="px-5 py-4 border-b border-[#3D3830]/10">
              <h3 className="font-serif text-xl font-medium text-[#3D3830]">KP Planetary Significators</h3>
            </div>
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#3D3830]/10 text-[#8B8275]">
                  <th className="py-3 px-4 font-medium">Planet</th>
                  <th className="py-3 px-4 font-medium">Star / Sub</th>
                  <th className="py-3 px-4 font-medium">Signified Houses</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#3D3830]/10">
                {chart.kp.significators.map((s) => (
                  <tr key={s.planet} className="hover:bg-[#F1ECE3]/50">
                    <td className="py-2.5 px-4 font-medium text-[#3D3830]">{s.planet}</td>
                    <td className="py-2.5 px-4 text-[#5C5449]">
                      {s.starLord} · {s.subLord}
                    </td>
                    <td className="py-2.5 px-4 font-['JetBrains_Mono',monospace] tabular-nums text-[#3D3830]">
                      {s.signifiesHouses.join(', ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'dasha' && (
        <div className="rounded-3xl bg-[#FDFBF7] border border-[#3D3830]/10 divide-y divide-[#3D3830]/10">
          {chart.vimshottari.timeline.map((md) => {
            const isCurrentMD = todayISO >= md.startDate && todayISO <= md.endDate;
            const openMD = expandedMD === md.lord;
            return (
              <div key={md.lord}>
                <button
                  type="button"
                  onClick={() => setExpandedMD(openMD ? null : md.lord)}
                  className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-[#F1ECE3]/60 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {openMD ? <ChevronDown className="h-4 w-4 text-[#8B8275]" /> : <ChevronRight className="h-4 w-4 text-[#8B8275]" />}
                    <span className="font-serif text-lg font-medium text-[#3D3830]">
                      {md.lord} Mahadasha
                    </span>
                    {isCurrentMD && (
                      <span className="text-xs font-medium text-[#B8965A]">Current Phase</span>
                    )}
                  </div>
                  <span className="font-['JetBrains_Mono',monospace] tabular-nums text-xs text-[#5C5449]">
                    {md.startDate} → {md.endDate}
                  </span>
                </button>

                {openMD && (
                  <div className="bg-[#FAF7F2] px-6 py-3 space-y-1 border-t border-[#3D3830]/10">
                    {(md.children || []).map((ad) => {
                      const adKey = `${md.lord}-${ad.lord}`;
                      const openAD = expandedAD === adKey;
                      const isCurrentAD = todayISO >= ad.startDate && todayISO <= ad.endDate;
                      return (
                        <div key={adKey} className="rounded-xl">
                          <button
                            type="button"
                            onClick={() => setExpandedAD(openAD ? null : adKey)}
                            className="w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-[#F1ECE3] rounded-xl"
                          >
                            <span className="font-medium text-[#3D3830]">
                              {md.lord} / {ad.lord} {isCurrentAD ? '· Active' : ''}
                            </span>
                            <span className="font-['JetBrains_Mono',monospace] tabular-nums text-[#5C5449]">
                              {ad.startDate} → {ad.endDate}
                            </span>
                          </button>

                          {openAD && (
                            <div className="pl-6 pr-3 py-2 grid grid-cols-1 sm:grid-cols-3 gap-2">
                              {(ad.children || []).map((pd) => {
                                const isCurrentPD = todayISO >= pd.startDate && todayISO <= pd.endDate;
                                return (
                                  <div
                                    key={`${adKey}-${pd.lord}`}
                                    className={`rounded-xl px-3 py-2 text-[11px] border ${
                                      isCurrentPD
                                        ? 'border-[#B8965A] bg-[#F1ECE3] text-[#3D3830]'
                                        : 'border-[#3D3830]/10 bg-[#FDFBF7] text-[#5C5449]'
                                    }`}
                                  >
                                    <div className="font-medium text-[#3D3830]">{pd.lord} PD</div>
                                    <div className="font-['JetBrains_Mono',monospace] tabular-nums text-[10px] mt-0.5">
                                      {pd.startDate} → {pd.endDate}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {activeTab === 'jaimini' && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="overflow-x-auto rounded-3xl bg-[#FDFBF7] border border-[#3D3830]/10">
            <div className="px-5 py-4 border-b border-[#3D3830]/10 flex items-center justify-between">
              <h3 className="font-serif text-xl font-medium text-[#3D3830]">Jaimini Chara Karakas</h3>
              <span className="text-xs text-[#8B8275]">Karakamsha: {chart.jaimini.karakamshaSign}</span>
            </div>
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#3D3830]/10 text-[#8B8275]">
                  <th className="py-3 px-4 font-medium">Karaka</th>
                  <th className="py-3 px-4 font-medium">Planet</th>
                  <th className="py-3 px-4 font-medium">Sign · Degree</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#3D3830]/10">
                {chart.jaimini.karakas.map((k) => (
                  <tr key={k.code}>
                    <td className="py-2.5 px-4 font-medium text-[#3D3830]">
                      {k.code} · {k.title}
                    </td>
                    <td className="py-2.5 px-4 text-[#3D3830]">{k.planet}</td>
                    <td className="py-2.5 px-4 font-['JetBrains_Mono',monospace] tabular-nums text-[#5C5449]">
                      {k.sign} {k.dms}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-3xl bg-[#FDFBF7] border border-[#3D3830]/10 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-serif text-xl font-medium text-[#3D3830]">Sarvashtakavarga</h3>
              <span className="font-['JetBrains_Mono',monospace] tabular-nums text-xs text-[#8B8275]">
                Total {chart.ashtakavarga.totalBindus} bindus
              </span>
            </div>
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
              {chart.ashtakavarga.sarva.map((bindus, idx) => (
                <div
                  key={SIGN_NAMES_SHORT[idx]}
                  className="rounded-2xl bg-[#FAF7F2] border border-[#3D3830]/10 p-3 text-center"
                >
                  <p className="text-[11px] text-[#8B8275]">{SIGN_NAMES_SHORT[idx]}</p>
                  <p className="font-['JetBrains_Mono',monospace] tabular-nums text-lg font-medium text-[#3D3830] mt-0.5">
                    {bindus}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'shadbala' && (
        <div className="rounded-3xl bg-[#FDFBF7] border border-[#3D3830]/10 p-6">
          <h3 className="font-serif text-xl font-medium text-[#3D3830] mb-3">Shad Bala Summary</h3>
          {chart.shadBalaSummary ? (
            <pre className="overflow-x-auto rounded-2xl bg-[#FAF7F2] p-4 text-xs font-['JetBrains_Mono',monospace] text-[#5C5449]">
              {JSON.stringify(chart.shadBalaSummary, null, 2)}
            </pre>
          ) : (
            <p className="text-sm text-[#5C5449]">
              Shad Bala breakdown was not returned by the API endpoint for this request, though all D1–D60 Vargas, KP, Jaimini, and Ashtakavarga tables are complete.
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default ChartViewer;
