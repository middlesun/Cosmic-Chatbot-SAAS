import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Compass,
  Layers,
  Clock,
  Sparkles,
  BarChart3,
  ChevronDown,
  ChevronRight,
  Sun,
  BookOpen,
  Flame,
  Orbit,
  RefreshCw,
  Grid3X3,
  Download,
  FileText,
  Loader2,
  ArrowRight,
} from 'lucide-react';
import AstrologyModeToggle from './AstrologyModeToggle';
import { useAuth, type AstrologyMode } from './AuthContext';
import {
  SHODASHVARGA_DEFS,
  VEDIC_SIGNS_SHORT,
  buildJaiminiChartPair,
  computeTraditionalBirthMeta,
  resolveCompleteVargas,
} from '../../lib/chartMetaAndVarga';
import {
  downloadChartJson,
  downloadChartPdf,
  downloadChartText,
} from '../../lib/chartExport';

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

export interface ShadbalaPlanetRow {
  planet: string;
  sthanaBala: number;
  digBala: number;
  kalaBala: number;
  chestaBala: number;
  naisargikaBala: number;
  drikBala: number;
  totalVirupas: number;
  totalRupas: number;
  requiredRupas: number;
  ratio: number;
  isStrong: boolean;
  ishtaPhala: number;
  kashtaPhala: number;
  strengthRank: number;
}

export interface WesternPlanetPosition {
  name: string;
  symbol: string;
  longitude: number;
  signIndex: number;
  sign: string;
  degreeInSign: number;
  dms: string;
  house: number;
  wholeSignHouse: number;
  isRetrograde: boolean;
  dignity: string;
  element: 'Fire' | 'Earth' | 'Air' | 'Water';
  modality: 'Cardinal' | 'Fixed' | 'Mutable';
}

export interface DailyTransitsPayload {
  transitDate: string;
  planets: PlanetPosition[];
  westernPlanets?: WesternPlanetPosition[];
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
    rulingPlanets?: {
      dayLord: string;
      lagnaSignLord: string;
      lagnaStarLord: string;
      lagnaSubLord: string;
      moonSignLord: string;
      moonStarLord: string;
      moonSubLord: string;
      uniqueRulingPlanets: string[];
    };
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
    arudhaPadas?: Array<{
      code: string;
      house: number;
      houseLord: string;
      lordSign: string;
      padaSignIndex: number;
      padaSign: string;
      padaHouseFromLagna: number;
    }>;
    charaDasha?: {
      periods: Array<{
        signIndex: number;
        sign: string;
        years: number;
        startDate: string;
        endDate: string;
      }>;
      currentPeriod: {
        signIndex: number;
        sign: string;
        years: number;
        startDate: string;
        endDate: string;
      } | null;
    };
    argala?: Array<{
      targetHouse: number;
      targetSign: string;
      supportingHouses: Array<{ house: number; label: string; planets: string[] }>;
      obstructingHouses: Array<{ house: number; label: string; planets: string[] }>;
      netSupport: 'Strong' | 'Balanced' | 'Obstructed';
    }>;
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
  shadbala?: {
    planets: ShadbalaPlanetRow[];
    strongestPlanet: string;
    weakestPlanet: string;
  };
  panchang?: {
    vara: string;
    tithi: { number: number; name: string; paksha: string };
    yoga: { number: number; name: string };
    karana: string;
    moonSign: string;
    sunSign: string;
    nakshatra: string;
    pada: number;
    avakhada: {
      varna: string;
      vashya: string;
      yoni: string;
      gana: string;
      nadi: string;
      tatva: string;
      paya: string;
      yunja: string;
      hansak: string;
      namakshar: string;
    };
  };
  conditions?: Array<{
    planet: string;
    sign: string;
    house: number;
    dignity: string;
    isRetrograde: boolean;
    isCombust: boolean;
    isVargottama: boolean;
    baladiAvastha: string;
    jagradadiAvastha: string;
    aspectsHouses: number[];
    conjunctWith: string[];
  }>;
  yogas?: Array<{
    name: string;
    category: string;
    planets: string[];
    summary: string;
  }>;
  lalKitab?: {
    planets: Array<{
      planet: string;
      house: number;
      sign: string;
      pakkaGhar: number[];
      karakaOf: string;
      exaltedHouses: number[];
      debilitatedHouses: number[];
      status: string;
      isSleeping: boolean;
      notes: string;
    }>;
    isAndhiKundli: boolean;
    isDharmiTewa: boolean;
    sleepingHouses: number[];
    karmicDebts: Array<{ name: string; indicator: string; active: boolean }>;
    varshaphal: {
      runningAge: number;
      cycleYear: number;
      placements: Array<{ natalHouse: number; annualHouse: number; planets: string[] }>;
    };
  };
  western?: {
    system: string;
    ayanamshaUsedForConversion: number;
    planets: WesternPlanetPosition[];
    cusps: Array<{
      house: number;
      label: string;
      longitude: number;
      signIndex: number;
      sign: string;
      degreeInSign: number;
      dms: string;
    }>;
    angles: {
      ascendant: { sign: string; dms: string; longitude: number };
      midheaven: { sign: string; dms: string; longitude: number };
      descendant: { sign: string; dms: string; longitude: number };
      ic: { sign: string; dms: string; longitude: number };
    };
    aspects: Array<{
      bodyA: string;
      bodyB: string;
      aspect: string;
      category: 'Major' | 'Minor';
      angle: number;
      orb: number;
      exactness: string;
    }>;
    elements: Record<'Fire' | 'Earth' | 'Air' | 'Water', number>;
    modalities: Record<'Cardinal' | 'Fixed' | 'Mutable', number>;
    polarities: { Yang: number; Yin: number };
    dominantElement: string;
    dominantModality: string;
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
const ZODIAC_GLYPHS = ['♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓'];

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
  11: { col: 0, row: 0 },
  0: { col: 1, row: 0 },
  1: { col: 2, row: 0 },
  2: { col: 3, row: 0 },
  3: { col: 3, row: 1 },
  4: { col: 3, row: 2 },
  5: { col: 3, row: 3 },
  6: { col: 2, row: 3 },
  7: { col: 1, row: 3 },
  8: { col: 0, row: 3 },
  9: { col: 0, row: 2 },
  10: { col: 0, row: 1 },
};

const SHODASHVARGA_PLANET_COLS = [
  { name: 'Ascendant', short: 'Asc' },
  { name: 'Sun', short: 'Su' },
  { name: 'Moon', short: 'Mo' },
  { name: 'Mars', short: 'Ma' },
  { name: 'Mercury', short: 'Me' },
  { name: 'Jupiter', short: 'Ju' },
  { name: 'Venus', short: 'Ve' },
  { name: 'Saturn', short: 'Sa' },
  { name: 'Rahu', short: 'Ra' },
  { name: 'Ketu', short: 'Ke' },
] as const;

export interface NatalTruthDossierClient {
  version: number;
  generated_at: string;
  layer_a?: {
    birth_time_sensitivity?: {
      caution_note?: string | null;
    };
    snapshot_scores?: {
      overall_natal_power_0_100: number;
      stability_index_0_10: number;
      career_potential_0_10: number;
      wealth_potential_0_10: number;
      marriage_support_0_10: number;
      health_resilience_0_10: number;
      d9_amplification_0_10: number;
      chart_archetype_label: string;
    };
    lagnesh_profile?: {
      ascendant_sign: string;
      ascendant_degree_maturity: string;
      lagnesh: string;
      health_score_0_100: number;
      d1_state: string;
      d9_state: string;
      core_implication: string;
    };
    command_hierarchy?: {
      top_powerhouse_planets?: Array<{
        planet: string;
        composite_health_0_100: number;
        why_dominant: string;
      }>;
    };
    unresolved_contradictions?: string[];
  };
  layer_b?: {
    narrative_kernel?: string;
    generated_by?: string;
  } | null;
}

interface ChartViewerProps {
  chart: CompiledChartJson;
  dailyTransits?: DailyTransitsPayload | null;
  initialMode?: AstrologyMode;
  initialVedicTab?: VedicTabId;
  profileId?: string;
  gender?: string | null;
  dossier?: NatalTruthDossierClient | null;
  lifeContextCompleteness?: number;
  onOpenLifeContext?: () => void;
  onDossierRefreshed?: (nextDossier: NatalTruthDossierClient) => void;
}

export type VedicTabId = 'overview' | 'vargas' | 'planets' | 'kp' | 'dasha' | 'jaimini' | 'shadbala' | 'lalkitab';
type WesternTabId = 'overview' | 'planets' | 'aspects';

function polarToXY(cx: number, cy: number, r: number, angleDeg: number): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

interface KundliSvgProps {
  chartStyle: 'north' | 'south';
  title: string;
  subtitle?: string;
  centerTitle: string;
  centerSub?: string;
  ascendantSignIndex: number;
  placements: Array<{ name: string; signIndex: number; house: number }>;
  natalPlanets: PlanetPosition[];
  compact?: boolean;
}

const KundliSvg: React.FC<KundliSvgProps> = ({
  chartStyle,
  title,
  subtitle,
  centerTitle,
  centerSub,
  ascendantSignIndex,
  placements,
  natalPlanets,
  compact = false,
}) => {
  const retroSet = useMemo(() => {
    const s = new Set<string>();
    for (const p of natalPlanets) {
      if (p.isRetrograde) s.add(p.name);
    }
    return s;
  }, [natalPlanets]);

  const byHouse = useMemo(() => {
    const map: Record<number, string[]> = {};
    for (let h = 1; h <= 12; h++) map[h] = [];
    for (const pl of placements) {
      if (pl.name === 'Ascendant') continue;
      const code = `${PLANET_CODE[pl.name] || pl.name.slice(0, 2)}${retroSet.has(pl.name) ? '*' : ''}`;
      if (map[pl.house]) map[pl.house].push(code);
    }
    return map;
  }, [placements, retroSet]);

  const bySign = useMemo(() => {
    const map: Record<number, string[]> = {};
    for (let s = 0; s < 12; s++) map[s] = [];
    for (const pl of placements) {
      const code =
        pl.name === 'Ascendant'
          ? 'Asc'
          : `${PLANET_CODE[pl.name] || pl.name.slice(0, 2)}${retroSet.has(pl.name) ? '*' : ''}`;
      if (map[pl.signIndex]) map[pl.signIndex].push(code);
    }
    return map;
  }, [placements, retroSet]);

  return (
    <div
      className={`rounded-2xl bg-[#FAF7F2] border border-[#3D3830]/12 ${
        compact ? 'p-3.5 sm:p-4' : 'p-4 sm:p-5'
      } flex flex-col items-center`}
    >
      <div className="w-full flex items-baseline justify-between gap-2 mb-3">
        <h3 className={`font-serif font-medium text-[#3D3830] ${compact ? 'text-base' : 'text-lg sm:text-xl'}`}>
          {title}
        </h3>
        {subtitle && (
          <span className="text-[11px] font-['JetBrains_Mono',monospace] text-[#8B7355] truncate">
            {subtitle}
          </span>
        )}
      </div>

      {chartStyle === 'north' ? (
        <svg
          viewBox="0 0 400 400"
          className={`w-full h-auto select-none ${compact ? 'max-w-[290px]' : 'max-w-[350px]'}`}
          role="img"
          aria-label={`North Indian ${title}`}
        >
          <rect
            x="8"
            y="8"
            width="384"
            height="384"
            rx="14"
            fill="#FDFBF7"
            stroke="rgba(61,56,48,0.34)"
            strokeWidth="1.4"
          />
          <line x1="8" y1="8" x2="392" y2="392" stroke="rgba(61,56,48,0.24)" strokeWidth="1" />
          <line x1="392" y1="8" x2="8" y2="392" stroke="rgba(61,56,48,0.24)" strokeWidth="1" />
          <polygon
            points="200,8 392,200 200,392 8,200"
            fill="none"
            stroke="rgba(61,56,48,0.34)"
            strokeWidth="1.3"
          />

          {Array.from({ length: 12 }, (_, idx) => {
            const house = idx + 1;
            const signNum = ((ascendantSignIndex + idx) % 12) + 1;
            const pos = NORTH_HOUSE_POSITIONS[house];
            const items = byHouse[house] || [];
            const line1 = items.slice(0, 3).join(' ');
            const line2 = items.slice(3).join(' ');
            return (
              <g key={house}>
                <text
                  x={pos.signX}
                  y={pos.signY}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="#8B7355"
                  fontSize="11.5"
                  fontWeight="600"
                  fontFamily="JetBrains Mono, monospace"
                >
                  {signNum}
                </text>
                {line1 && (
                  <text
                    x={pos.x}
                    y={line2 ? pos.y - 7 : pos.y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="#3D3830"
                    fontSize="12.5"
                    fontWeight="600"
                    fontFamily="Plus Jakarta Sans, sans-serif"
                  >
                    {line1}
                  </text>
                )}
                {line2 && (
                  <text
                    x={pos.x}
                    y={pos.y + 10}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="#3D3830"
                    fontSize="12.5"
                    fontWeight="600"
                    fontFamily="Plus Jakarta Sans, sans-serif"
                  >
                    {line2}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      ) : (
        <svg
          viewBox="0 0 400 400"
          className={`w-full h-auto select-none ${compact ? 'max-w-[290px]' : 'max-w-[350px]'}`}
          role="img"
          aria-label={`South Indian ${title}`}
        >
          <rect
            x="8"
            y="8"
            width="384"
            height="384"
            rx="14"
            fill="#FDFBF7"
            stroke="rgba(61,56,48,0.34)"
            strokeWidth="1.4"
          />
          {[1, 2, 3].map((i) => (
            <React.Fragment key={i}>
              <line
                x1={8 + i * 96}
                y1={8}
                x2={8 + i * 96}
                y2={i === 2 ? 104 : 392}
                stroke="rgba(61,56,48,0.22)"
                strokeWidth="1"
              />
              <line
                x1={8}
                y1={8 + i * 96}
                x2={i === 2 ? 104 : 392}
                y2={8 + i * 96}
                stroke="rgba(61,56,48,0.22)"
                strokeWidth="1"
              />
            </React.Fragment>
          ))}
          <line x1="200" y1="304" x2="200" y2="392" stroke="rgba(61,56,48,0.22)" strokeWidth="1" />
          <line x1="296" y1="200" x2="392" y2="200" stroke="rgba(61,56,48,0.22)" strokeWidth="1" />
          <rect
            x="104"
            y="104"
            width="192"
            height="192"
            fill="#F1ECE3"
            stroke="rgba(61,56,48,0.25)"
            strokeWidth="1"
          />
          <text
            x="200"
            y="192"
            textAnchor="middle"
            fill="#3D3830"
            fontSize="16"
            fontWeight="600"
            fontFamily="Cormorant Garamond, serif"
          >
            {centerTitle}
          </text>
          {centerSub && (
            <text
              x="200"
              y="214"
              textAnchor="middle"
              fill="#5C5449"
              fontSize="11"
              fontFamily="Plus Jakarta Sans, sans-serif"
            >
              {centerSub}
            </text>
          )}

          {Object.entries(SOUTH_SIGN_CELLS).map(([sIdxStr, cell]) => {
            const sIdx = Number(sIdxStr);
            const x = 8 + cell.col * 96;
            const y = 8 + cell.row * 96;
            const items = bySign[sIdx] || [];
            const isAsc = sIdx === ascendantSignIndex;
            return (
              <g key={sIdx}>
                {isAsc && (
                  <line
                    x1={x}
                    y1={y + 18}
                    x2={x + 18}
                    y2={y}
                    stroke="#8B7355"
                    strokeWidth="1.5"
                  />
                )}
                <text
                  x={x + 8}
                  y={y + 18}
                  fill="#8B7355"
                  fontSize="9.5"
                  fontWeight="600"
                  fontFamily="JetBrains Mono, monospace"
                >
                  {SIGN_NAMES_SHORT[sIdx]}
                </text>
                <text
                  x={x + 48}
                  y={y + 54}
                  textAnchor="middle"
                  fill="#3D3830"
                  fontSize="12"
                  fontWeight="600"
                >
                  {items.slice(0, 3).join(' ')}
                </text>
                {items.length > 3 && (
                  <text
                    x={x + 48}
                    y={y + 72}
                    textAnchor="middle"
                    fill="#3D3830"
                    fontSize="12"
                    fontWeight="600"
                  >
                    {items.slice(3).join(' ')}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
};

const ChartViewer: React.FC<ChartViewerProps> = ({
  chart,
  dailyTransits: propTransits,
  initialMode,
  initialVedicTab,
  profileId,
  gender,
  dossier,
  lifeContextCompleteness,
  onOpenLifeContext,
  onDossierRefreshed,
}) => {
  const { astrologyMode: sessionMode, getAccessToken, isPreviewMode } = useAuth();
  const [viewMode, setViewMode] = useState<AstrologyMode>(initialMode || sessionMode || 'vedic');
  const [refreshingDossier, setRefreshingDossier] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  useEffect(() => {
    if (!initialMode) {
      setViewMode(sessionMode);
    }
  }, [sessionMode, initialMode]);

  const [chartStyle, setChartStyle] = useState<'north' | 'south'>('north');
  const [vedicTab, setVedicTab] = useState<VedicTabId>(initialVedicTab || 'overview');
  const [westernTab, setWesternTab] = useState<WesternTabId>('overview');
  const [aspectFilter, setAspectFilter] = useState<'all' | 'Major' | 'Minor'>('all');
  const vedicTabsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (initialVedicTab) {
      setVedicTab(initialVedicTab);
    }
  }, [initialVedicTab]);

  const [expandedMD, setExpandedMD] = useState<string | null>(
    chart.vimshottari.currentStack?.mahadasha || null
  );
  const [expandedAD, setExpandedAD] = useState<string | null>(
    chart.vimshottari.currentStack
      ? `${chart.vimshottari.currentStack.mahadasha}-${chart.vimshottari.currentStack.antardasha}`
      : null
  );

  const [liveTransits, setLiveTransits] = useState<DailyTransitsPayload | null>(propTransits ?? null);

  const handleRefreshDossier = async () => {
    if (!profileId || isPreviewMode || refreshingDossier) return;
    const token = await getAccessToken();
    if (!token) return;
    setRefreshingDossier(true);
    try {
      const res = await fetch(`/api/profiles/${profileId}/recompute-dossier`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.natal_truth_dossier_json && onDossierRefreshed) {
        onDossierRefreshed(data.natal_truth_dossier_json as NatalTruthDossierClient);
      }
    } finally {
      setRefreshingDossier(false);
    }
  };

  useEffect(() => {
    if (propTransits) {
      setLiveTransits(propTransits);
      return;
    }
    if (isPreviewMode) return;
    let active = true;
    (async () => {
      try {
        const token = await getAccessToken();
        if (!token || !active) return;
        const res = await fetch('/api/transits/today', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok && active) {
          const data = await res.json();
          setLiveTransits(data);
        }
      } catch {
        // Silent fallback if transits temporarily unavailable
      }
    })();
    return () => {
      active = false;
    };
  }, [propTransits, isPreviewMode, getAccessToken]);

  const allVargas = useMemo(() => resolveCompleteVargas(chart), [chart]);
  const birthMeta = useMemo(() => computeTraditionalBirthMeta(chart, gender), [chart, gender]);
  const jaiminiCharts = useMemo(() => buildJaiminiChartPair(chart), [chart]);

  const handleDownloadPdf = async () => {
    if (exportingPdf) return;
    setExportingPdf(true);
    try {
      await downloadChartPdf(chart, birthMeta, allVargas, chartStyle);
    } finally {
      setExportingPdf(false);
    }
  };

  const d1Asc = chart.planets.find((p) => p.name === 'Ascendant');
  const d1Moon = chart.planets.find((p) => p.name === 'Moon');
  const d1Sun = chart.planets.find((p) => p.name === 'Sun');
  const todayISO = new Date().toISOString().slice(0, 10);

  // Western Natal Wheel geometry
  const westernWheelData = useMemo(() => {
    const w = chart.western;
    if (!w) return null;
    const ascLon = w.angles.ascendant.longitude;
    const toScreenDeg = (lon: number) => 180 - (lon - ascLon);

    // Space planet markers cleanly when tightly conjunct
    const drawableBodies = w.planets
      .filter((p) => p.name !== 'Ascendant' && p.name !== 'Midheaven')
      .map((p) => ({ ...p, screenAngle: toScreenDeg(p.longitude), displayAngle: toScreenDeg(p.longitude) }))
      .sort((a, b) => a.longitude - b.longitude);

    for (let pass = 0; pass < 3; pass++) {
      for (let i = 0; i < drawableBodies.length; i++) {
        const cur = drawableBodies[i];
        const next = drawableBodies[(i + 1) % drawableBodies.length];
        let diff = next.displayAngle - cur.displayAngle;
        while (diff > 180) diff -= 360;
        while (diff < -180) diff += 360;
        if (Math.abs(diff) < 11) {
          const nudge = (11 - Math.abs(diff)) / 2;
          cur.displayAngle += diff >= 0 ? -nudge : nudge;
          next.displayAngle += diff >= 0 ? nudge : -nudge;
        }
      }
    }

    const posMap = new Map<string, { x: number; y: number }>();
    for (const b of drawableBodies) {
      posMap.set(b.name, polarToXY(210, 210, 106, b.screenAngle));
    }

    const majorAspectLines = w.aspects
      .filter((a) => a.category === 'Major' && posMap.has(a.bodyA) && posMap.has(a.bodyB))
      .slice(0, 16)
      .map((a) => {
        const p1 = posMap.get(a.bodyA)!;
        const p2 = posMap.get(a.bodyB)!;
        const stroke =
          a.aspect === 'Trine' || a.aspect === 'Sextile'
            ? 'rgba(45, 106, 79, 0.55)'
            : a.aspect === 'Square' || a.aspect === 'Opposition'
            ? 'rgba(180, 83, 71, 0.50)'
            : 'rgba(184, 150, 90, 0.55)';
        return { ...a, p1, p2, stroke };
      });

    return { ascLon, toScreenDeg, drawableBodies, majorAspectLines, w };
  }, [chart.western]);

  const filteredWesternAspects = useMemo(() => {
    const list = chart.western?.aspects || [];
    if (aspectFilter === 'all') return list;
    return list.filter((a) => a.category === aspectFilter);
  }, [chart.western, aspectFilter]);

  return (
    <div className="space-y-6">
      {/* Light Observatory Chart Hero Section */}
      <div className="rounded-3xl bg-[#FDFBF7] border border-[#3D3830]/12 p-5 sm:p-6 md:p-8 text-[#3D3830]">
        {/* Row 1: Title + Fixed Top-Right Exports & Vedic/Western Mode Toggle */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#3D3830]/10 pb-4 mb-4">
          <div className="min-w-0">
            <p className="text-xs text-[#8B8275] mb-1 truncate">
              {viewMode === 'vedic'
                ? `${chart.meta.ayanamsha} · ${chart.meta.location.locationLabel}`
                : `${chart.western?.system || 'Tropical (Placidus)'} · ${chart.meta.location.locationLabel}`}
            </p>
            <h2 className="font-serif text-2xl md:text-3xl font-medium text-[#3D3830]">
              {chart.meta.name} — {viewMode === 'vedic' ? 'Vedic Kundli (D1 & D9)' : 'Tropical Natal Wheel'}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <div
              role="group"
              aria-label="Download chart data"
              className="inline-flex items-center rounded-xl bg-[#FAF7F2] border border-[#3D3830]/12 p-1 gap-0.5 text-xs"
            >
              <button
                type="button"
                disabled={exportingPdf}
                onClick={() => void handleDownloadPdf()}
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-medium text-[#3D3830] hover:bg-[#EAE3D7]/80 transition-colors cursor-pointer disabled:opacity-50"
                title="Download full chart dossier as PDF"
              >
                {exportingPdf ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-[#8B7355]" />
                ) : (
                  <Download className="h-3.5 w-3.5 text-[#8B7355]" />
                )}
                <span>PDF</span>
              </button>
              <button
                type="button"
                onClick={() => downloadChartText(chart, birthMeta, allVargas)}
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-medium text-[#5C5449] hover:text-[#3D3830] hover:bg-[#EAE3D7]/80 transition-colors cursor-pointer"
                title="Download complete chart data as plain text"
              >
                <FileText className="h-3.5 w-3.5 text-[#8B7355]" />
                <span>Text</span>
              </button>
              <button
                type="button"
                onClick={() => downloadChartJson(chart, birthMeta, allVargas)}
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-medium text-[#5C5449] hover:text-[#3D3830] hover:bg-[#EAE3D7]/80 transition-colors cursor-pointer"
                title="Download raw structured chart data as JSON"
              >
                <span>JSON</span>
              </button>
            </div>

            <AstrologyModeToggle
              value={viewMode}
              onChange={setViewMode}
              variant="light"
              size="sm"
            />
          </div>
        </div>

        {/* Row 2: Fixed Left-Aligned North/South Toggle (No Jumping When Switching Modes) */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6 min-h-[38px]">
          <div
            role="group"
            aria-label="Chart layout style"
            aria-disabled={viewMode !== 'vedic'}
            className={`inline-flex items-center rounded-xl bg-[#EAE3D7]/80 border border-[#3D3830]/12 p-1 text-xs transition-opacity ${
              viewMode === 'vedic' ? 'opacity-100' : 'opacity-40 pointer-events-none'
            }`}
          >
            <button
              type="button"
              onClick={() => setChartStyle('north')}
              className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                chartStyle === 'north'
                  ? 'bg-[#4A453D] text-[#FAF7F2] font-medium shadow-xs'
                  : 'text-[#5C5449] hover:text-[#3D3830]'
              }`}
            >
              North Indian
            </button>
            <button
              type="button"
              onClick={() => setChartStyle('south')}
              className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                chartStyle === 'south'
                  ? 'bg-[#4A453D] text-[#FAF7F2] font-medium shadow-xs'
                  : 'text-[#5C5449] hover:text-[#3D3830]'
              }`}
            >
              South Indian
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <p className="text-xs font-['JetBrains_Mono',monospace] tabular-nums text-[#8B8275]">
              {viewMode === 'vedic'
                ? `D1 Lagna: ${d1Asc?.sign || '—'} · D9 Lagna: ${
                    allVargas.D9 ? VEDIC_SIGNS_SHORT[allVargas.D9.ascendantSignIndex] : '—'
                  }`
                : `AC: ${chart.western?.angles.ascendant.sign || '—'} · MC: ${
                    chart.western?.angles.midheaven.sign || '—'
                  }`}
            </p>
            {viewMode === 'vedic' && (
              <button
                type="button"
                onClick={() => {
                  setVedicTab('vargas');
                  window.setTimeout(() => {
                    vedicTabsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }, 40);
                }}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-medium transition-colors cursor-pointer ${
                  vedicTab === 'vargas'
                    ? 'border-[#4A453D] bg-[#4A453D] text-[#FAF7F2]'
                    : 'border-[#3D3830]/15 bg-[#FAF7F2] text-[#3D3830] hover:bg-[#EAE3D7]'
                }`}
              >
                <Grid3X3 className="h-3 w-3 text-[#8B7355]" />
                <span>All 16 Divisional Charts (D1–D60)</span>
                <ArrowRight className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>

        {/* HERO VISUAL + TELEMETRY */}
        {viewMode === 'vedic' ? (
          <div className="space-y-6">
            {/* Side-by-Side Lagna (D1) and Navamsha (D9) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {allVargas.D1 && (
                <KundliSvg
                  chartStyle={chartStyle}
                  title="Lagna Chart (D1)"
                  subtitle={`${SIGN_NAMES_SHORT[allVargas.D1.ascendantSignIndex]} Lagna`}
                  centerTitle="D1 Lagna"
                  centerSub={`${SIGN_NAMES_SHORT[allVargas.D1.ascendantSignIndex]} Asc`}
                  ascendantSignIndex={allVargas.D1.ascendantSignIndex}
                  placements={allVargas.D1.placements}
                  natalPlanets={chart.planets}
                />
              )}
              {allVargas.D9 && (
                <KundliSvg
                  chartStyle={chartStyle}
                  title="Navamsha Chart (D9)"
                  subtitle={`${SIGN_NAMES_SHORT[allVargas.D9.ascendantSignIndex]} Lagna`}
                  centerTitle="D9 Navamsha"
                  centerSub={`${SIGN_NAMES_SHORT[allVargas.D9.ascendantSignIndex]} Asc`}
                  ascendantSignIndex={allVargas.D9.ascendantSignIndex}
                  placements={allVargas.D9.placements}
                  natalPlanets={chart.planets}
                />
              )}
            </div>

            {/* Light Telemetry Strip Below D1 & D9 */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
              {chart.vimshottari.currentStack && (
                <div className="lg:col-span-6 rounded-2xl bg-[#FAF7F2] border border-[#3D3830]/10 p-4 sm:p-5 flex flex-col justify-center">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-[#8B8275] mb-2.5">
                    Active Vimshottari Phase
                  </p>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs text-[#8B8275]">Mahadasha</p>
                      <p className="font-serif text-lg sm:text-xl text-[#3D3830]">
                        {chart.vimshottari.currentStack.mahadasha}
                      </p>
                      <p className="text-[11px] font-['JetBrains_Mono',monospace] tabular-nums text-[#8B7355]">
                        → {chart.vimshottari.currentStack.mdEnd}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-[#8B8275]">Antardasha</p>
                      <p className="font-serif text-lg sm:text-xl text-[#3D3830]">
                        {chart.vimshottari.currentStack.antardasha}
                      </p>
                      <p className="text-[11px] font-['JetBrains_Mono',monospace] tabular-nums text-[#8B7355]">
                        → {chart.vimshottari.currentStack.adEnd}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-[#8B8275]">Pratyantar</p>
                      <p className="font-serif text-lg sm:text-xl text-[#3D3830]">
                        {chart.vimshottari.currentStack.pratyantardasha}
                      </p>
                      <p className="text-[11px] font-['JetBrains_Mono',monospace] tabular-nums text-[#8B7355]">
                        → {chart.vimshottari.currentStack.pdEnd}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div
                className={`${
                  chart.vimshottari.currentStack ? 'lg:col-span-6' : 'lg:col-span-12'
                } grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 gap-3 text-xs`}
              >
                <div className="rounded-2xl bg-[#FAF7F2] border border-[#3D3830]/10 p-3.5">
                  <p className="text-[#8B8275] mb-0.5">D1 Lagna (Ascendant)</p>
                  <p className="font-serif text-lg text-[#3D3830]">{d1Asc?.sign || '—'}</p>
                  <p className="font-['JetBrains_Mono',monospace] tabular-nums text-[#5C5449] mt-0.5">
                    {d1Asc?.dms || ''} · {d1Asc?.nakshatra || ''}
                  </p>
                </div>
                <div className="rounded-2xl bg-[#FAF7F2] border border-[#3D3830]/10 p-3.5">
                  <p className="text-[#8B8275] mb-0.5">Rashi (Moon Sign)</p>
                  <p className="font-serif text-lg text-[#3D3830]">{d1Moon?.sign || '—'}</p>
                  <p className="font-['JetBrains_Mono',monospace] tabular-nums text-[#5C5449] mt-0.5">
                    {d1Moon?.nakshatra || '—'} P{d1Moon?.pada || '—'}
                  </p>
                </div>
                <div className="rounded-2xl bg-[#FAF7F2] border border-[#3D3830]/10 p-3.5">
                  <p className="text-[#8B8275] mb-0.5">Sun · Karakamsha</p>
                  <p className="font-serif text-base text-[#3D3830]">
                    {d1Sun?.sign || '—'} · {jaiminiCharts.karakamshaSign}
                  </p>
                </div>
                <div className="rounded-2xl bg-[#FAF7F2] border border-[#3D3830]/10 p-3.5">
                  <p className="text-[#8B8275] mb-0.5">Strongest Shadbala</p>
                  <p className="font-serif text-base text-[#8B7355] font-medium">
                    {chart.shadbala?.strongestPlanet || 'Balanced'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : westernWheelData ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Circular Western Natal Wheel SVG (Warm Ivory Light Theme) */}
            <div className="lg:col-span-6 flex justify-center">
              <svg
                viewBox="0 0 420 420"
                className="w-full max-w-[380px] h-auto select-none"
                role="img"
                aria-label="Western Tropical Natal Wheel"
              >
                {/* Outer Zodiac Ring */}
                <circle cx="210" cy="210" r="196" fill="#FAF7F2" stroke="rgba(61,56,48,0.32)" strokeWidth="1.3" />
                <circle cx="210" cy="210" r="162" fill="none" stroke="rgba(61,56,48,0.22)" strokeWidth="1" />
                <circle cx="210" cy="210" r="106" fill="#F1ECE3" stroke="rgba(61,56,48,0.2)" strokeWidth="1" />

                {/* Zodiac 12 Sign Sectors */}
                {Array.from({ length: 12 }, (_, signIdx) => {
                  const startLon = signIdx * 30;
                  const midLon = startLon + 15;
                  const a1 = westernWheelData.toScreenDeg(startLon);
                  const aMid = westernWheelData.toScreenDeg(midLon);
                  const pOuter = polarToXY(210, 210, 196, a1);
                  const pInner = polarToXY(210, 210, 162, a1);
                  const pText = polarToXY(210, 210, 179, aMid);
                  return (
                    <g key={`z-${signIdx}`}>
                      <line x1={pOuter.x} y1={pOuter.y} x2={pInner.x} y2={pInner.y} stroke="rgba(61,56,48,0.18)" strokeWidth="1" />
                      <text
                        x={pText.x}
                        y={pText.y}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill="#8B7355"
                        fontSize="12"
                        fontWeight="600"
                      >
                        {ZODIAC_GLYPHS[signIdx]}
                      </text>
                    </g>
                  );
                })}

                {/* Placidus House Cusps */}
                {westernWheelData.w.cusps.map((cusp) => {
                  const angle = westernWheelData.toScreenDeg(cusp.longitude);
                  const pOut = polarToXY(210, 210, 162, angle);
                  const pIn = polarToXY(210, 210, 106, angle);
                  const isAngle = cusp.house === 1 || cusp.house === 4 || cusp.house === 7 || cusp.house === 10;
                  const labelPos = polarToXY(
                    210,
                    210,
                    118,
                    westernWheelData.toScreenDeg(cusp.longitude + 10)
                  );
                  return (
                    <g key={`c-${cusp.house}`}>
                      <line
                        x1={pOut.x}
                        y1={pOut.y}
                        x2={pIn.x}
                        y2={pIn.y}
                        stroke={isAngle ? '#8B7355' : 'rgba(61,56,48,0.18)'}
                        strokeWidth={isAngle ? '1.5' : '0.8'}
                        strokeDasharray={isAngle ? undefined : '2,2'}
                      />
                      <text
                        x={labelPos.x}
                        y={labelPos.y}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill="#8B8275"
                        fontSize="9"
                        fontFamily="JetBrains Mono, monospace"
                      >
                        {cusp.house}
                      </text>
                    </g>
                  );
                })}

                {/* Central Aspect Chords */}
                {westernWheelData.majorAspectLines.map((line, idx) => (
                  <line
                    key={`asp-${idx}`}
                    x1={line.p1.x}
                    y1={line.p1.y}
                    x2={line.p2.x}
                    y2={line.p2.y}
                    stroke={line.stroke}
                    strokeWidth="1"
                  />
                ))}

                {/* Planet Glyphs */}
                {westernWheelData.drawableBodies.map((b) => {
                  const tickOuter = polarToXY(210, 210, 162, b.screenAngle);
                  const tickInner = polarToXY(210, 210, 155, b.screenAngle);
                  const glyphPos = polarToXY(210, 210, 140, b.displayAngle);
                  return (
                    <g key={`wp-${b.name}`}>
                      <line x1={tickOuter.x} y1={tickOuter.y} x2={tickInner.x} y2={tickInner.y} stroke="#8B7355" strokeWidth="1.2" />
                      <circle cx={glyphPos.x} cy={glyphPos.y} r="10.5" fill="#FDFBF7" stroke="rgba(61,56,48,0.28)" strokeWidth="0.9" />
                      <text
                        x={glyphPos.x}
                        y={glyphPos.y + 0.5}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill="#3D3830"
                        fontSize="11.5"
                      >
                        {b.symbol}
                      </text>
                    </g>
                  );
                })}

                {/* Horizon AC/DC Labels */}
                <text x="16" y="210" textAnchor="middle" dominantBaseline="middle" fill="#8B7355" fontSize="10" fontWeight="600">
                  AC
                </text>
                <text x="404" y="210" textAnchor="middle" dominantBaseline="middle" fill="#8B7355" fontSize="10" fontWeight="600">
                  DC
                </text>
                <text x="210" y="24" textAnchor="middle" dominantBaseline="middle" fill="#8B7355" fontSize="10" fontWeight="600">
                  MC
                </text>
              </svg>
            </div>

            {/* Right Summary Telemetry (Western - Light Theme) */}
            <div className="lg:col-span-6 space-y-4">
              <div className="rounded-2xl bg-[#FAF7F2] border border-[#3D3830]/10 p-5">
                <p className="text-xs text-[#8B8275] mb-3">Tropical Big Three &amp; Midheaven</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-[#8B8275]">Sun</p>
                    <p className="font-serif text-lg text-[#3D3830]">
                      {westernWheelData.w.planets.find((p) => p.name === 'Sun')?.sign || '—'}
                    </p>
                    <p className="text-[11px] font-['JetBrains_Mono',monospace] text-[#8B7355]">
                      {westernWheelData.w.planets.find((p) => p.name === 'Sun')?.dms || ''}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-[#8B8275]">Moon</p>
                    <p className="font-serif text-lg text-[#3D3830]">
                      {westernWheelData.w.planets.find((p) => p.name === 'Moon')?.sign || '—'}
                    </p>
                    <p className="text-[11px] font-['JetBrains_Mono',monospace] text-[#8B7355]">
                      {westernWheelData.w.planets.find((p) => p.name === 'Moon')?.dms || ''}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-[#8B8275]">Rising (AC)</p>
                    <p className="font-serif text-lg text-[#3D3830]">{westernWheelData.w.angles.ascendant.sign}</p>
                    <p className="text-[11px] font-['JetBrains_Mono',monospace] text-[#8B7355]">
                      {westernWheelData.w.angles.ascendant.dms}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-[#8B8275]">Midheaven (MC)</p>
                    <p className="font-serif text-lg text-[#3D3830]">{westernWheelData.w.angles.midheaven.sign}</p>
                    <p className="text-[11px] font-['JetBrains_Mono',monospace] text-[#8B7355]">
                      {westernWheelData.w.angles.midheaven.dms}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="rounded-2xl bg-[#FAF7F2] border border-[#3D3830]/10 p-4">
                  <p className="text-[#8B8275] mb-2">Elemental Signature</p>
                  <p className="font-serif text-lg text-[#3D3830] mb-2">{westernWheelData.w.dominantElement} Dominant</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 font-['JetBrains_Mono',monospace] text-[11px] text-[#5C5449]">
                    <span>Fire {westernWheelData.w.elements.Fire}</span>
                    <span>Earth {westernWheelData.w.elements.Earth}</span>
                    <span>Air {westernWheelData.w.elements.Air}</span>
                    <span>Water {westernWheelData.w.elements.Water}</span>
                  </div>
                </div>
                <div className="rounded-2xl bg-[#FAF7F2] border border-[#3D3830]/10 p-4">
                  <p className="text-[#8B8275] mb-2">Modality &amp; Polarity</p>
                  <p className="font-serif text-lg text-[#3D3830] mb-2">{westernWheelData.w.dominantModality} Mode</p>
                  <p className="font-['JetBrains_Mono',monospace] text-[11px] text-[#5C5449]">
                    Yang {westernWheelData.w.polarities.Yang} · Yin {westernWheelData.w.polarities.Yin}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl bg-[#FAF7F2] border border-[#3D3830]/10 p-6 text-sm text-[#5C5449]">
            Waiting for Tropical coordinates to finish compiling for this profile.
          </div>
        )}
      </div>

      {/* INTERACTIVE FILTER TABS */}
      {viewMode === 'vedic' ? (
        <>
          <div ref={vedicTabsRef} className="flex flex-wrap items-center gap-1.5 rounded-2xl bg-[#F1ECE3] p-1.5 w-fit scroll-mt-4">
            {[
              { id: 'overview', label: 'Overview', icon: Sun },
              { id: 'vargas', label: 'Divisional Charts', icon: Grid3X3 },
              { id: 'planets', label: 'Planetary Positions', icon: Compass },
              { id: 'kp', label: 'KP Cusps & Sub-Lords', icon: Layers },
              { id: 'dasha', label: 'Dashas', icon: Clock },
              { id: 'jaimini', label: 'Jaimini & Ashtakavarga', icon: Sparkles },
              { id: 'shadbala', label: 'Shadbala', icon: BarChart3 },
              { id: 'lalkitab', label: 'Lal Kitab', icon: Flame },
            ].map((tab) => {
              const Icon = tab.icon;
              const active = vedicTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setVedicTab(tab.id as VedicTabId)}
                  className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    active ? 'bg-[#FDFBF7] text-[#3D3830] shadow-sm' : 'text-[#5C5449] hover:text-[#3D3830]'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* VEDIC: OVERVIEW */}
          {vedicTab === 'overview' && (
            <div className="space-y-6">
              {/* Traditional Birth Details & Astronomical Summary Box */}
              <div className="rounded-3xl bg-[#FDFBF7] border border-[#3D3830]/12 p-5 sm:p-6">
                <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
                  <h3 className="font-serif text-xl font-medium text-[#3D3830]">
                    Birth Details &amp; Astronomical Summary
                  </h3>
                  <span className="text-[11px] font-['JetBrains_Mono',monospace] text-[#8B7355]">
                    {birthMeta.ayanType} · {birthMeta.ayanamshaDms}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-2 text-xs">
                  {(
                    [
                      [
                        ['Name', birthMeta.name],
                        ['Sex', birthMeta.sex],
                        ['Date', birthMeta.birthDate],
                        ['Day', birthMeta.dayOfWeek],
                        ['Time of Birth', birthMeta.birthTime],
                        ['SID', birthMeta.siderealTime],
                      ],
                      [
                        ['Julian Day', birthMeta.julianDay],
                        ['Ayan Type', birthMeta.ayanType],
                        ['Ayan', birthMeta.ayanamshaDms],
                        ['Place', birthMeta.place],
                        ['Longitude', birthMeta.longitudeLabel],
                        ['Latitude', birthMeta.latitudeLabel],
                      ],
                      [
                        ['Asc Lord', birthMeta.ascLord],
                        ['Asc', birthMeta.ascendant],
                        ['Yoga', birthMeta.yoga],
                        ['Tithi', birthMeta.tithi],
                        ['Sunset', birthMeta.sunset],
                        ['Sunrise', birthMeta.sunrise],
                      ],
                      [
                        ['Bal. Dasha', birthMeta.balanceOfDasha],
                        ['Karan', birthMeta.karan],
                        ['Star Lord', birthMeta.starLord],
                        ['Star - Pada', birthMeta.starPada],
                        ['Rasi Lord', birthMeta.rasiLord],
                        ['Rasi', birthMeta.rasi],
                      ],
                    ] as Array<Array<[string, string]>>
                  ).map((colRows, cIdx) => (
                    <div
                      key={cIdx}
                      className="rounded-2xl bg-[#FAF7F2] border border-[#3D3830]/8 p-3.5 space-y-1.5"
                    >
                      {colRows.map(([label, val]) => (
                        <div key={label} className="flex items-baseline justify-between gap-3">
                          <span className="text-[#8B8275] shrink-0">{label}</span>
                          <span className="font-medium text-[#3D3830] text-right truncate font-['JetBrains_Mono',monospace] tabular-nums">
                            {val}
                          </span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>

              {/* Vedic Structural Chart DNA Card */}
              {dossier?.layer_a?.snapshot_scores && (
                <div className="rounded-3xl bg-[#FDFBF7] border border-[#3D3830]/12 p-5 sm:p-6 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#8B7355]">
                        Structural Chart DNA
                      </p>
                      <h3 className="font-serif text-xl sm:text-2xl font-medium text-[#3D3830] mt-0.5">
                        {dossier.layer_a.snapshot_scores.chart_archetype_label}
                      </h3>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {onOpenLifeContext && typeof lifeContextCompleteness === 'number' && (
                        <button
                          type="button"
                          onClick={onOpenLifeContext}
                          className="inline-flex items-center gap-1.5 rounded-full border border-[#3D3830]/15 bg-[#FAF7F2] px-3 py-1.5 text-[11px] font-medium text-[#3D3830] hover:bg-[#F1ECE3] transition-colors cursor-pointer"
                        >
                          <span>Context {lifeContextCompleteness}%</span>
                        </button>
                      )}
                      {profileId && !isPreviewMode && (
                        <button
                          type="button"
                          disabled={refreshingDossier}
                          onClick={() => void handleRefreshDossier()}
                          className="inline-flex items-center gap-1.5 rounded-full border border-[#3D3830]/15 bg-[#FAF7F2] px-3 py-1.5 text-[11px] font-medium text-[#5C5449] hover:text-[#3D3830] hover:bg-[#F1ECE3] transition-colors cursor-pointer disabled:opacity-50"
                        >
                          <RefreshCw
                            className={`h-3 w-3 ${refreshingDossier ? 'animate-spin' : ''}`}
                          />
                          <span>{refreshingDossier ? 'Refreshing...' : 'Refresh Breakdown'}</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 text-xs">
                    {[
                      ['Natal Power', `${dossier.layer_a.snapshot_scores.overall_natal_power_0_100}/100`],
                      ['Career', `${dossier.layer_a.snapshot_scores.career_potential_0_10}/10`],
                      ['Wealth', `${dossier.layer_a.snapshot_scores.wealth_potential_0_10}/10`],
                      ['Marriage', `${dossier.layer_a.snapshot_scores.marriage_support_0_10}/10`],
                      ['Health', `${dossier.layer_a.snapshot_scores.health_resilience_0_10}/10`],
                      ['D9 Lift', `${dossier.layer_a.snapshot_scores.d9_amplification_0_10}/10`],
                    ].map(([label, value]) => (
                      <div
                        key={label}
                        className="rounded-2xl bg-[#FAF7F2] border border-[#3D3830]/10 px-3 py-2.5"
                      >
                        <p className="text-[10px] text-[#8B8275]">{label}</p>
                        <p className="font-['JetBrains_Mono',monospace] tabular-nums font-semibold text-sm text-[#3D3830] mt-0.5">
                          {value}
                        </p>
                      </div>
                    ))}
                  </div>

                  {dossier.layer_a.lagnesh_profile && (
                    <p className="text-xs text-[#5C5449] leading-relaxed">
                      <span className="font-semibold text-[#3D3830]">
                        Ascendant &amp; Lagnesh ({dossier.layer_a.lagnesh_profile.lagnesh}):
                      </span>{' '}
                      {dossier.layer_a.lagnesh_profile.ascendant_degree_maturity}.{' '}
                      {dossier.layer_a.lagnesh_profile.core_implication}
                    </p>
                  )}

                  {dossier.layer_b?.narrative_kernel && (
                    <p className="rounded-2xl bg-[#F1ECE3]/75 border border-[#3D3830]/8 px-4 py-3 text-xs text-[#3D3830] leading-relaxed">
                      {dossier.layer_b.narrative_kernel}
                    </p>
                  )}

                  {dossier.layer_a.birth_time_sensitivity?.caution_note && (
                    <p className="text-[11px] text-[#7A3E36]">
                      {dossier.layer_a.birth_time_sensitivity.caution_note}
                    </p>
                  )}
                </div>
              )}

              {/* Panchang & Avakhada Chakra */}
              {chart.panchang && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="rounded-3xl bg-[#FDFBF7] border border-[#3D3830]/10 p-5 sm:p-6">
                    <h3 className="font-serif text-xl font-medium text-[#3D3830] mb-4 flex items-center gap-2">
                      <BookOpen className="h-4 w-4 text-[#8B7355]" />
                      Birth Panchang
                    </h3>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      {[
                        ['Weekday (Vara)', chart.panchang.vara],
                        ['Lunar Day (Tithi)', chart.panchang.tithi.name],
                        ['Nitya Yoga', chart.panchang.yoga.name],
                        ['Karana', chart.panchang.karana],
                        ['Birth Nakshatra', `${chart.panchang.nakshatra} · Pada ${chart.panchang.pada}`],
                        ['Moon / Sun Rashi', `${chart.panchang.moonSign} / ${chart.panchang.sunSign}`],
                      ].map(([k, v]) => (
                        <div key={k} className="rounded-2xl bg-[#FAF7F2] border border-[#3D3830]/8 p-3">
                          <p className="text-[11px] text-[#8B8275]">{k}</p>
                          <p className="font-medium text-[#3D3830] mt-0.5">{v}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-3xl bg-[#FDFBF7] border border-[#3D3830]/10 p-5 sm:p-6">
                    <h3 className="font-serif text-xl font-medium text-[#3D3830] mb-4">Avakhada Chakra</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                      {[
                        ['Varna', chart.panchang.avakhada.varna],
                        ['Vashya', chart.panchang.avakhada.vashya],
                        ['Yoni', chart.panchang.avakhada.yoni],
                        ['Gana', chart.panchang.avakhada.gana],
                        ['Nadi', chart.panchang.avakhada.nadi],
                        ['Tatva', chart.panchang.avakhada.tatva],
                        ['Paya', chart.panchang.avakhada.paya],
                        ['Yunja', chart.panchang.avakhada.yunja],
                        ['Namakshar', chart.panchang.avakhada.namakshar],
                      ].map(([k, v]) => (
                        <div key={k} className="rounded-xl bg-[#FAF7F2] border border-[#3D3830]/8 px-3 py-2">
                          <p className="text-[10px] text-[#8B8275]">{k}</p>
                          <p className="font-medium text-[#3D3830] truncate">{v}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Live Current Transits (Gochar) */}
              <div className="rounded-3xl bg-[#FDFBF7] border border-[#3D3830]/10 overflow-hidden">
                <div className="px-5 sm:px-6 py-4 border-b border-[#3D3830]/10 flex items-center justify-between">
                  <div>
                    <h3 className="font-serif text-xl font-medium text-[#3D3830]">
                      Current Planetary Transits (Gochar)
                    </h3>
                    <p className="text-xs text-[#8B8275]">
                      {liveTransits?.transitDate
                        ? `Live Sidereal Lahiri positions for ${liveTransits.transitDate}`
                        : 'Waiting for today’s live planetary positions.'}
                    </p>
                  </div>
                </div>
                {liveTransits?.planets && liveTransits.planets.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-[#3D3830]/10 text-[#8B8275]">
                          <th className="py-3 px-5 font-medium">Planet</th>
                          <th className="py-3 px-4 font-medium">Transit Sign · Degree</th>
                          <th className="py-3 px-4 font-medium">Nakshatra</th>
                          <th className="py-3 px-4 font-medium">From Lagna</th>
                          <th className="py-3 px-5 font-medium">From Moon</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#3D3830]/10">
                        {liveTransits.planets.map((tp) => {
                          const fromLagna = d1Asc ? ((tp.signIndex - d1Asc.signIndex + 12) % 12) + 1 : null;
                          const fromMoon = d1Moon ? ((tp.signIndex - d1Moon.signIndex + 12) % 12) + 1 : null;
                          return (
                            <tr key={tp.name} className="hover:bg-[#F1ECE3]/50">
                              <td className="py-2.5 px-5 font-medium text-[#3D3830]">
                                {tp.name} {tp.isRetrograde ? '(R)' : ''}
                              </td>
                              <td className="py-2.5 px-4 font-['JetBrains_Mono',monospace] tabular-nums text-[#5C5449]">
                                {tp.sign} {tp.dms}
                              </td>
                              <td className="py-2.5 px-4 text-[#5C5449]">
                                {tp.nakshatra} · P{tp.pada}
                              </td>
                              <td className="py-2.5 px-4 font-['JetBrains_Mono',monospace] text-[#3D3830]">
                                {fromLagna ? `H${fromLagna}` : '—'}
                              </td>
                              <td className="py-2.5 px-5 font-['JetBrains_Mono',monospace] text-[#3D3830]">
                                {fromMoon ? `H${fromMoon}` : '—'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="p-6 text-xs text-[#8B8275]">
                    Current transit table is temporarily unavailable in this view.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* VEDIC: DIVISIONAL CHARTS & SHODASHVARGA */}
          {vedicTab === 'vargas' && (
            <div className="space-y-6">
              {/* Full 16x10 Shodashvarga Table */}
              <div className="overflow-x-auto rounded-3xl bg-[#FDFBF7] border border-[#3D3830]/10">
                <div className="px-5 sm:px-6 py-4 border-b border-[#3D3830]/10 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-serif text-xl font-medium text-[#3D3830]">
                      Shodashvarga Table
                    </h3>
                    <p className="text-xs text-[#8B8275]">
                      Sign number &amp; rashi across all 16 Parashari divisional charts
                    </p>
                  </div>
                </div>
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#3D3830]/10 bg-[#FAF7F2] text-[#8B8275]">
                      <th className="py-3 px-4 font-medium">Chart</th>
                      <th className="py-3 px-4 font-medium">Shodashvarga</th>
                      {SHODASHVARGA_PLANET_COLS.map((col) => (
                        <th key={col.name} className="py-3 px-2.5 text-center font-medium">
                          {col.short}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#3D3830]/10">
                    {SHODASHVARGA_DEFS.map((def) => {
                      const varga = allVargas[def.code];
                      if (!varga) return null;
                      return (
                        <tr key={def.code} className="hover:bg-[#F1ECE3]/50">
                          <td className="py-2.5 px-4 font-['JetBrains_Mono',monospace] font-semibold text-[#8B7355]">
                            {def.code}
                          </td>
                          <td className="py-2.5 px-4 font-medium text-[#3D3830] whitespace-nowrap">
                            {def.name}
                          </td>
                          {SHODASHVARGA_PLANET_COLS.map((col) => {
                            const pl = varga.placements.find((x) => x.name === col.name);
                            return (
                              <td
                                key={col.name}
                                className="py-2.5 px-2.5 text-center font-['JetBrains_Mono',monospace] tabular-nums text-[#3D3830] whitespace-nowrap"
                              >
                                {pl ? (
                                  <span>
                                    <span className="text-[#8B7355]">{pl.signIndex + 1}</span>{' '}
                                    <span>{VEDIC_SIGNS_SHORT[pl.signIndex]}</span>
                                  </span>
                                ) : (
                                  '—'
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* All 16 Visual Divisional Charts */}
              <div className="rounded-3xl bg-[#FDFBF7] border border-[#3D3830]/10 p-5 sm:p-6 space-y-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <h3 className="font-serif text-xl font-medium text-[#3D3830]">
                      All 16 Divisional Charts ({chartStyle === 'north' ? 'North Indian' : 'South Indian'})
                    </h3>
                    <p className="text-xs text-[#8B8275]">
                      Synchronized with the {chartStyle === 'north' ? 'North Indian' : 'South Indian'} chart toggle above
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                  {SHODASHVARGA_DEFS.map((def) => {
                    const varga = allVargas[def.code];
                    if (!varga) return null;
                    return (
                      <KundliSvg
                        key={def.code}
                        chartStyle={chartStyle}
                        title={`${def.code} · ${def.name}`}
                        subtitle={`${SIGN_NAMES_SHORT[varga.ascendantSignIndex]} Asc`}
                        centerTitle={def.code}
                        centerSub={def.name}
                        ascendantSignIndex={varga.ascendantSignIndex}
                        placements={varga.placements}
                        natalPlanets={chart.planets}
                        compact
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* VEDIC: PLANETARY POSITIONS */}
          {vedicTab === 'planets' && (
            <div className="overflow-x-auto rounded-3xl bg-[#FDFBF7] border border-[#3D3830]/10">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#3D3830]/10 text-[#8B8275]">
                    <th className="py-3.5 px-5 font-medium">Body</th>
                    <th className="py-3.5 px-3 font-medium">House</th>
                    <th className="py-3.5 px-4 font-medium">Sign · Degree</th>
                    <th className="py-3.5 px-4 font-medium">Nakshatra · Pada</th>
                    <th className="py-3.5 px-4 font-medium">Sub / Sub-Sub</th>
                    <th className="py-3.5 px-4 font-medium">Dignity & Avastha</th>
                    <th className="py-3.5 px-5 font-medium">Drishti Houses</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#3D3830]/10">
                  {chart.planets.map((p) => {
                    const cond = chart.conditions?.find((c) => c.planet === p.name);
                    return (
                      <tr key={p.name} className="hover:bg-[#F1ECE3]/50">
                        <td className="py-3 px-5 font-medium text-[#3D3830]">
                          {p.name} {p.isRetrograde ? '(R)' : ''}
                          {cond?.isCombust && <span className="ml-1.5 text-[10px] text-[#A94438]">Combust</span>}
                          {cond?.isVargottama && <span className="ml-1.5 text-[10px] text-[#2D6A4F]">Vargottama</span>}
                        </td>
                        <td className="py-3 px-3 font-['JetBrains_Mono',monospace] tabular-nums text-[#5C5449]">
                          H{p.house}
                        </td>
                        <td className="py-3 px-4 text-[#3D3830]">
                          <span>{p.sign}</span>{' '}
                          <span className="font-['JetBrains_Mono',monospace] tabular-nums text-[#5C5449]">
                            {p.dms}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-[#5C5449]">
                          {p.nakshatra} · P{p.pada} ({p.nakshatraLord})
                        </td>
                        <td className="py-3 px-4 text-[#5C5449]">
                          {p.subLord} / {p.subSubLord}
                        </td>
                        <td className="py-3 px-4 text-[#5C5449]">
                          <span>{p.dignity}</span>
                          {cond && (
                            <span className="block text-[10px] text-[#8B8275]">
                              {cond.baladiAvastha.split(' ')[0]} · {cond.jagradadiAvastha.split(' ')[0]}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-5 font-['JetBrains_Mono',monospace] text-[#5C5449]">
                          {cond?.aspectsHouses?.join(', ') || '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* VEDIC: KP */}
          {vedicTab === 'kp' && (
            <div className="space-y-6">
              {chart.kp.rulingPlanets && (
                <div className="rounded-3xl bg-[#FDFBF7] border border-[#3D3830]/10 p-5 sm:p-6">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <h3 className="font-serif text-xl font-medium text-[#3D3830]">Birth Ruling Planets (KP)</h3>
                    <span className="text-xs font-medium text-[#8B7355]">
                      Key Planets: {chart.kp.rulingPlanets.uniqueRulingPlanets.join(' · ')}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 text-xs">
                    {[
                      ['Day Lord', chart.kp.rulingPlanets.dayLord],
                      ['Lagna Sign', chart.kp.rulingPlanets.lagnaSignLord],
                      ['Lagna Star', chart.kp.rulingPlanets.lagnaStarLord],
                      ['Lagna Sub', chart.kp.rulingPlanets.lagnaSubLord],
                      ['Moon Sign', chart.kp.rulingPlanets.moonSignLord],
                      ['Moon Star', chart.kp.rulingPlanets.moonStarLord],
                      ['Moon Sub', chart.kp.rulingPlanets.moonSubLord],
                    ].map(([label, val]) => (
                      <div key={label} className="rounded-xl bg-[#FAF7F2] border border-[#3D3830]/8 p-2.5">
                        <p className="text-[10px] text-[#8B8275]">{label}</p>
                        <p className="font-medium text-[#3D3830] mt-0.5">{val}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

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
            </div>
          )}

          {/* VEDIC: DASHAS (VIMSHOTTARI + JAIMINI CHARA DASHA) */}
          {vedicTab === 'dasha' && (
            <div className="space-y-6">
              <div className="rounded-3xl bg-[#FDFBF7] border border-[#3D3830]/10 divide-y divide-[#3D3830]/10">
                <div className="px-6 py-4">
                  <h3 className="font-serif text-xl font-medium text-[#3D3830]">Vimshottari Mahadasha Timeline</h3>
                </div>
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

              {chart.jaimini.charaDasha && (
                <div className="rounded-3xl bg-[#FDFBF7] border border-[#3D3830]/10 p-5 sm:p-6">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                    <h3 className="font-serif text-xl font-medium text-[#3D3830]">Jaimini Chara Dasha</h3>
                    {chart.jaimini.charaDasha.currentPeriod && (
                      <span className="text-xs font-medium text-[#8B7355]">
                        Active Sign: {chart.jaimini.charaDasha.currentPeriod.sign}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {chart.jaimini.charaDasha.periods.map((cp, idx) => {
                      const isActive = todayISO >= cp.startDate && todayISO <= cp.endDate;
                      return (
                        <div
                          key={`${cp.sign}-${idx}`}
                          className={`rounded-2xl border p-3.5 text-xs ${
                            isActive
                              ? 'border-[#B8965A] bg-[#F1ECE3]/80'
                              : 'border-[#3D3830]/10 bg-[#FAF7F2]'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-serif text-base font-medium text-[#3D3830]">{cp.sign}</span>
                            <span className="font-['JetBrains_Mono',monospace] text-[11px] text-[#8B7355]">
                              {cp.years}y
                            </span>
                          </div>
                          <p className="font-['JetBrains_Mono',monospace] text-[10px] text-[#5C5449] mt-1">
                            {cp.startDate} → {cp.endDate}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* VEDIC: JAIMINI & ASHTAKAVARGA */}
          {vedicTab === 'jaimini' && (
            <div className="space-y-6">
              {/* Jaimini System — Karakamsha & Swamsa Side by Side */}
              <div className="rounded-3xl bg-[#FDFBF7] border border-[#3D3830]/10 p-5 sm:p-6">
                <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
                  <div>
                    <h3 className="font-serif text-xl font-medium text-[#3D3830]">
                      Jaimini System — Karakamsha &amp; Swamsa
                    </h3>
                    <p className="text-xs text-[#8B8275]">
                      D1 and D9 planetary placements anchored to Atmakaraka’s Navamsha sign ({jaiminiCharts.karakamshaSign})
                    </p>
                  </div>
                  <span className="text-xs font-['JetBrains_Mono',monospace] text-[#8B7355]">
                    Karakamsha: {jaiminiCharts.karakamshaSign}
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <KundliSvg
                    chartStyle={chartStyle}
                    title="Karakamsha Chart"
                    subtitle="D1 Planets from Karakamsha"
                    centerTitle="Karakamsha"
                    centerSub={jaiminiCharts.karakamshaSign}
                    ascendantSignIndex={jaiminiCharts.karakamshaSignIndex}
                    placements={jaiminiCharts.karakamshaPlacements}
                    natalPlanets={chart.planets}
                  />
                  <KundliSvg
                    chartStyle={chartStyle}
                    title="Swamsa Chart"
                    subtitle="D9 Planets from Karakamsha"
                    centerTitle="Swamsa"
                    centerSub={jaiminiCharts.karakamshaSign}
                    ascendantSignIndex={jaiminiCharts.karakamshaSignIndex}
                    placements={jaiminiCharts.swamsaPlacements}
                    natalPlanets={chart.planets}
                  />
                </div>
              </div>

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

              {/* Arudha Padas (AL, A2-A11, UL) */}
              {chart.jaimini.arudhaPadas && (
                <div className="rounded-3xl bg-[#FDFBF7] border border-[#3D3830]/10 p-5 sm:p-6">
                  <h3 className="font-serif text-xl font-medium text-[#3D3830] mb-4">
                    Arudha Padas (AL, A2–A11, UL)
                  </h3>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2.5 text-xs">
                    {chart.jaimini.arudhaPadas.map((a) => (
                      <div key={a.code} className="rounded-2xl bg-[#FAF7F2] border border-[#3D3830]/8 p-3">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-[#3D3830]">{a.code}</span>
                          <span className="font-['JetBrains_Mono',monospace] text-[10px] text-[#8B7355]">
                            H{a.padaHouseFromLagna}
                          </span>
                        </div>
                        <p className="text-[#5C5449] mt-0.5">{a.padaSign}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Bhinnashtakavarga Matrix */}
              {chart.ashtakavarga.bhinna && (
                <div className="overflow-x-auto rounded-3xl bg-[#FDFBF7] border border-[#3D3830]/10">
                  <div className="px-5 py-4 border-b border-[#3D3830]/10">
                    <h3 className="font-serif text-xl font-medium text-[#3D3830]">
                      Bhinnashtakavarga (Individual Bindus by Sign)
                    </h3>
                  </div>
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[#3D3830]/10 text-[#8B8275]">
                        <th className="py-3 px-4 font-medium">Planet</th>
                        {SIGN_NAMES_SHORT.map((s) => (
                          <th key={s} className="py-3 px-2.5 text-center font-medium">
                            {s}
                          </th>
                        ))}
                        <th className="py-3 px-4 text-right font-medium">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#3D3830]/10">
                      {Object.entries(chart.ashtakavarga.bhinna).map(([planet, arr]) => (
                        <tr key={planet} className="hover:bg-[#F1ECE3]/50">
                          <td className="py-2.5 px-4 font-medium text-[#3D3830]">{planet}</td>
                          {arr.map((val, i) => (
                            <td
                              key={i}
                              className={`py-2.5 px-2.5 text-center font-['JetBrains_Mono',monospace] tabular-nums ${
                                val >= 5 ? 'text-[#2D6A4F] font-semibold' : val <= 2 ? 'text-[#A94438]' : 'text-[#5C5449]'
                              }`}
                            >
                              {val}
                            </td>
                          ))}
                          <td className="py-2.5 px-4 text-right font-['JetBrains_Mono',monospace] font-medium text-[#3D3830]">
                            {arr.reduce((sum, x) => sum + x, 0)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* VEDIC: SHADBALA */}
          {vedicTab === 'shadbala' && (
            <div className="rounded-3xl bg-[#FDFBF7] border border-[#3D3830]/10 overflow-hidden">
              <div className="px-6 py-4 border-b border-[#3D3830]/10 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-serif text-xl font-medium text-[#3D3830]">Six-Fold Shadbala Strength</h3>
                  <p className="text-xs text-[#8B8275]">
                    Sthana, Dig, Kala, Chesta, Naisargika &amp; Drik Bala (measured in Shashtiamsas / Rupas)
                  </p>
                </div>
                {chart.shadbala && (
                  <span className="text-xs text-[#5C5449]">
                    Strongest: <strong className="text-[#3D3830]">{chart.shadbala.strongestPlanet}</strong>
                  </span>
                )}
              </div>

              {chart.shadbala ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[#3D3830]/10 text-[#8B8275]">
                        <th className="py-3 px-5 font-medium">Planet</th>
                        <th className="py-3 px-3 font-medium">Sthana</th>
                        <th className="py-3 px-3 font-medium">Dig</th>
                        <th className="py-3 px-3 font-medium">Kala</th>
                        <th className="py-3 px-3 font-medium">Chesta</th>
                        <th className="py-3 px-3 font-medium">Naisargika</th>
                        <th className="py-3 px-3 font-medium">Drik</th>
                        <th className="py-3 px-4 font-medium">Rupas / Min</th>
                        <th className="py-3 px-5 font-medium">Strength Ratio</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#3D3830]/10">
                      {chart.shadbala.planets.map((row) => (
                        <tr key={row.planet} className="hover:bg-[#F1ECE3]/50">
                          <td className="py-3 px-5 font-medium text-[#3D3830]">
                            {row.planet}{' '}
                            <span className="text-[10px] text-[#8B8275]">#{row.strengthRank}</span>
                          </td>
                          <td className="py-3 px-3 font-['JetBrains_Mono',monospace] text-[#5C5449]">{row.sthanaBala}</td>
                          <td className="py-3 px-3 font-['JetBrains_Mono',monospace] text-[#5C5449]">{row.digBala}</td>
                          <td className="py-3 px-3 font-['JetBrains_Mono',monospace] text-[#5C5449]">{row.kalaBala}</td>
                          <td className="py-3 px-3 font-['JetBrains_Mono',monospace] text-[#5C5449]">{row.chestaBala}</td>
                          <td className="py-3 px-3 font-['JetBrains_Mono',monospace] text-[#5C5449]">{row.naisargikaBala}</td>
                          <td className="py-3 px-3 font-['JetBrains_Mono',monospace] text-[#5C5449]">{row.drikBala}</td>
                          <td className="py-3 px-4 font-['JetBrains_Mono',monospace] text-[#3D3830]">
                            {row.totalRupas} / {row.requiredRupas}
                          </td>
                          <td className="py-3 px-5 min-w-[140px]">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-2 rounded-full bg-[#3D3830]/10 overflow-hidden">
                                <div
                                  style={{ width: `${Math.min(100, row.ratio * 65)}%` }}
                                  className={`h-full rounded-full ${row.isStrong ? 'bg-[#2D6A4F]' : 'bg-[#B8965A]'}`}
                                />
                              </div>
                              <span
                                className={`font-['JetBrains_Mono',monospace] text-[11px] font-medium ${
                                  row.isStrong ? 'text-[#2D6A4F]' : 'text-[#8B7355]'
                                }`}
                              >
                                {row.ratio.toFixed(2)}x
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="p-6 text-sm text-[#5C5449]">
                  Waiting for Shadbala calculations to finish updating. Re-open this chart shortly to view complete 6-fold strength scores.
                </p>
              )}
            </div>
          )}

          {/* VEDIC: LAL KITAB */}
          {vedicTab === 'lalkitab' && (
            <div className="space-y-6">
              {chart.lalKitab ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                    <div className="rounded-2xl bg-[#FDFBF7] border border-[#3D3830]/10 p-4">
                      <p className="text-[#8B8275]">Chart Archetype</p>
                      <p className="font-serif text-lg font-medium text-[#3D3830] mt-0.5">
                        {chart.lalKitab.isDharmiTewa
                          ? 'Dharmi Tewa (Guided)'
                          : chart.lalKitab.isAndhiKundli
                          ? 'Andhi Kundli Pattern'
                          : 'Standard Kalpurush Chart'}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-[#FDFBF7] border border-[#3D3830]/10 p-4">
                      <p className="text-[#8B8275]">Running Varshaphal</p>
                      <p className="font-serif text-lg font-medium text-[#3D3830] mt-0.5">
                        Age Year {chart.lalKitab.varshaphal.runningAge} · Cycle {chart.lalKitab.varshaphal.cycleYear}/12
                      </p>
                    </div>
                    <div className="rounded-2xl bg-[#FDFBF7] border border-[#3D3830]/10 p-4">
                      <p className="text-[#8B8275]">Empty / Dormant Houses</p>
                      <p className="font-['JetBrains_Mono',monospace] text-sm font-medium text-[#3D3830] mt-1">
                        {chart.lalKitab.sleepingHouses.map((h) => `H${h}`).join(', ') || 'None'}
                      </p>
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded-3xl bg-[#FDFBF7] border border-[#3D3830]/10">
                    <div className="px-5 py-4 border-b border-[#3D3830]/10">
                      <h3 className="font-serif text-xl font-medium text-[#3D3830]">Lal Kitab House Kundli</h3>
                    </div>
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-[#3D3830]/10 text-[#8B8275]">
                          <th className="py-3 px-5 font-medium">Planet</th>
                          <th className="py-3 px-4 font-medium">House</th>
                          <th className="py-3 px-4 font-medium">Pakka Ghar</th>
                          <th className="py-3 px-4 font-medium">Status</th>
                          <th className="py-3 px-5 font-medium">Notes</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#3D3830]/10">
                        {chart.lalKitab.planets.map((lp) => (
                          <tr key={lp.planet} className="hover:bg-[#F1ECE3]/50">
                            <td className="py-2.5 px-5 font-medium text-[#3D3830]">{lp.planet}</td>
                            <td className="py-2.5 px-4 font-['JetBrains_Mono',monospace] text-[#5C5449]">H{lp.house}</td>
                            <td className="py-2.5 px-4 font-['JetBrains_Mono',monospace] text-[#5C5449]">
                              {lp.pakkaGhar.map((h) => `H${h}`).join(', ')}
                            </td>
                            <td className="py-2.5 px-4 font-medium">
                              <span
                                className={
                                  lp.status === 'Benefic'
                                    ? 'text-[#2D6A4F]'
                                    : lp.status === 'Malefic'
                                    ? 'text-[#A94438]'
                                    : 'text-[#8B7355]'
                                }
                              >
                                {lp.status}
                              </span>
                            </td>
                            <td className="py-2.5 px-5 text-[#5C5449]">{lp.notes}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="rounded-3xl bg-[#FDFBF7] border border-[#3D3830]/10 p-5">
                      <h3 className="font-serif text-xl font-medium text-[#3D3830] mb-3">
                        Karmic Debts (Rina Indicators)
                      </h3>
                      <div className="space-y-2.5 text-xs">
                        {chart.lalKitab.karmicDebts.map((debt) => (
                          <div
                            key={debt.name}
                            className={`rounded-2xl border p-3 ${
                              debt.active
                                ? 'border-[#B8965A]/45 bg-[#F1ECE3]/65'
                                : 'border-[#3D3830]/8 bg-[#FAF7F2] opacity-75'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-[#3D3830]">{debt.name}</span>
                              <span className={debt.active ? 'text-[#8B7355] font-medium' : 'text-[#8B8275]'}>
                                {debt.active ? 'Indicated' : 'Inactive'}
                              </span>
                            </div>
                            <p className="text-[11px] text-[#5C5449] mt-0.5">{debt.indicator}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-3xl bg-[#FDFBF7] border border-[#3D3830]/10 p-5">
                      <h3 className="font-serif text-xl font-medium text-[#3D3830] mb-3">
                        Varshaphal Annual House Map (Age {chart.lalKitab.varshaphal.runningAge})
                      </h3>
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 text-xs">
                        {chart.lalKitab.varshaphal.placements.map((vp) => (
                          <div key={vp.natalHouse} className="rounded-xl bg-[#FAF7F2] border border-[#3D3830]/8 p-2.5">
                            <p className="font-['JetBrains_Mono',monospace] text-[10px] text-[#8B8275]">
                              Natal H{vp.natalHouse} → H{vp.annualHouse}
                            </p>
                            <p className="font-medium text-[#3D3830] mt-0.5 truncate">
                              {vp.planets.length > 0 ? vp.planets.map((n) => n.slice(0, 2)).join(', ') : '—'}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="rounded-3xl bg-[#FDFBF7] border border-[#3D3830]/10 p-6 text-sm text-[#5C5449]">
                  Lal Kitab analysis is being prepared for this chart.
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        /* WESTERN MODE */
        <>
          <div className="flex flex-wrap items-center gap-1.5 rounded-2xl bg-[#F1ECE3] p-1.5 w-fit">
            {[
              { id: 'overview', label: 'Overview', icon: Sun },
              { id: 'planets', label: 'Planets & Houses', icon: Orbit },
              { id: 'aspects', label: 'Aspects & Orbs', icon: Sparkles },
            ].map((tab) => {
              const Icon = tab.icon;
              const active = westernTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setWesternTab(tab.id as WesternTabId)}
                  className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
                    active ? 'bg-[#FDFBF7] text-[#3D3830] shadow-sm' : 'text-[#5C5449] hover:text-[#3D3830]'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {chart.western ? (
            <>
              {westernTab === 'overview' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="rounded-3xl bg-[#FDFBF7] border border-[#3D3830]/10 p-5 sm:p-6">
                      <h3 className="font-serif text-xl font-medium text-[#3D3830] mb-4">
                        Elements, Modalities &amp; Polarities
                      </h3>
                      <div className="space-y-3 text-xs">
                        {(['Fire', 'Earth', 'Air', 'Water'] as const).map((el) => {
                          const count = chart.western!.elements[el];
                          return (
                            <div key={el} className="flex items-center gap-3">
                              <span className="w-16 font-medium text-[#3D3830]">{el}</span>
                              <div className="flex-1 h-2 rounded-full bg-[#3D3830]/10 overflow-hidden">
                                <div
                                  style={{ width: `${Math.min(100, (count / 11) * 100)}%` }}
                                  className="h-full rounded-full bg-[#4A453D]"
                                />
                              </div>
                              <span className="w-6 text-right font-['JetBrains_Mono',monospace] text-[#5C5449]">
                                {count}
                              </span>
                            </div>
                          );
                        })}
                        <div className="pt-2 border-t border-[#3D3830]/10 flex flex-wrap justify-between gap-2 text-[#5C5449]">
                          <span>
                            Cardinal {chart.western.modalities.Cardinal} · Fixed {chart.western.modalities.Fixed} · Mutable{' '}
                            {chart.western.modalities.Mutable}
                          </span>
                          <span>
                            Yang {chart.western.polarities.Yang} · Yin {chart.western.polarities.Yin}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-3xl bg-[#FDFBF7] border border-[#3D3830]/10 p-5 sm:p-6">
                      <h3 className="font-serif text-xl font-medium text-[#3D3830] mb-4">Four Chart Angles</h3>
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        {[
                          ['Ascendant (AC)', chart.western.angles.ascendant],
                          ['Midheaven (MC)', chart.western.angles.midheaven],
                          ['Descendant (DC)', chart.western.angles.descendant],
                          ['Imum Coeli (IC)', chart.western.angles.ic],
                        ].map(([label, angle]) => {
                          const angObj = angle as { sign: string; dms: string };
                          return (
                            <div key={label as string} className="rounded-2xl bg-[#FAF7F2] border border-[#3D3830]/8 p-3">
                              <p className="text-[11px] text-[#8B8275]">{label as string}</p>
                              <p className="font-serif text-base font-medium text-[#3D3830] mt-0.5">{angObj.sign}</p>
                              <p className="font-['JetBrains_Mono',monospace] text-[11px] text-[#5C5449]">{angObj.dms}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Live Current Western Transits */}
                  <div className="rounded-3xl bg-[#FDFBF7] border border-[#3D3830]/10 overflow-hidden">
                    <div className="px-5 sm:px-6 py-4 border-b border-[#3D3830]/10">
                      <h3 className="font-serif text-xl font-medium text-[#3D3830]">
                        Current Tropical Transits
                      </h3>
                      <p className="text-xs text-[#8B8275]">
                        {liveTransits?.transitDate
                          ? `Live Tropical Zodiac positions for ${liveTransits.transitDate}`
                          : 'Waiting for today’s Tropical transit positions.'}
                      </p>
                    </div>
                    {liveTransits?.westernPlanets && liveTransits.westernPlanets.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="border-b border-[#3D3830]/10 text-[#8B8275]">
                              <th className="py-3 px-5 font-medium">Body</th>
                              <th className="py-3 px-4 font-medium">Tropical Sign · Degree</th>
                              <th className="py-3 px-4 font-medium">Element</th>
                              <th className="py-3 px-5 font-medium">Natal Whole-Sign House</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#3D3830]/10">
                            {liveTransits.westernPlanets.map((tp) => {
                              const ascSignIdx = Math.floor(chart.western!.angles.ascendant.longitude / 30);
                              const houseNum = ((tp.signIndex - ascSignIdx + 12) % 12) + 1;
                              return (
                                <tr key={tp.name} className="hover:bg-[#F1ECE3]/50">
                                  <td className="py-2.5 px-5 font-medium text-[#3D3830]">
                                    {tp.symbol} {tp.name} {tp.isRetrograde ? '(Rx)' : ''}
                                  </td>
                                  <td className="py-2.5 px-4 font-['JetBrains_Mono',monospace] tabular-nums text-[#5C5449]">
                                    {tp.sign} {tp.dms}
                                  </td>
                                  <td className="py-2.5 px-4 text-[#5C5449]">{tp.element}</td>
                                  <td className="py-2.5 px-5 font-['JetBrains_Mono',monospace] text-[#3D3830]">
                                    House {houseNum}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="p-6 text-xs text-[#8B8275]">
                        Current Tropical transit table is temporarily unavailable in this view.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {westernTab === 'planets' && (
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                  <div className="xl:col-span-8 overflow-x-auto rounded-3xl bg-[#FDFBF7] border border-[#3D3830]/10">
                    <div className="px-5 py-4 border-b border-[#3D3830]/10">
                      <h3 className="font-serif text-xl font-medium text-[#3D3830]">Tropical Planetary Positions</h3>
                    </div>
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-[#3D3830]/10 text-[#8B8275]">
                          <th className="py-3 px-5 font-medium">Body</th>
                          <th className="py-3 px-4 font-medium">Sign · Degree</th>
                          <th className="py-3 px-3 font-medium">Placidus</th>
                          <th className="py-3 px-3 font-medium">Whole Sign</th>
                          <th className="py-3 px-4 font-medium">Element · Mode</th>
                          <th className="py-3 px-5 font-medium">Dignity</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#3D3830]/10">
                        {chart.western.planets.map((p) => (
                          <tr key={p.name} className="hover:bg-[#F1ECE3]/50">
                            <td className="py-2.5 px-5 font-medium text-[#3D3830]">
                              {p.symbol} {p.name} {p.isRetrograde ? '(Rx)' : ''}
                            </td>
                            <td className="py-2.5 px-4 font-['JetBrains_Mono',monospace] tabular-nums text-[#5C5449]">
                              {p.sign} {p.dms}
                            </td>
                            <td className="py-2.5 px-3 font-['JetBrains_Mono',monospace] text-[#3D3830]">H{p.house}</td>
                            <td className="py-2.5 px-3 font-['JetBrains_Mono',monospace] text-[#8B8275]">H{p.wholeSignHouse}</td>
                            <td className="py-2.5 px-4 text-[#5C5449]">
                              {p.element} · {p.modality}
                            </td>
                            <td className="py-2.5 px-5 text-[#5C5449]">{p.dignity}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="xl:col-span-4 overflow-x-auto rounded-3xl bg-[#FDFBF7] border border-[#3D3830]/10">
                    <div className="px-5 py-4 border-b border-[#3D3830]/10">
                      <h3 className="font-serif text-xl font-medium text-[#3D3830]">Placidus House Cusps</h3>
                    </div>
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-[#3D3830]/10 text-[#8B8275]">
                          <th className="py-3 px-4 font-medium">House</th>
                          <th className="py-3 px-4 font-medium">Sign · Degree</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#3D3830]/10">
                        {chart.western.cusps.map((c) => (
                          <tr key={c.house} className="hover:bg-[#F1ECE3]/50">
                            <td className="py-2.5 px-4 font-medium text-[#3D3830]">{c.label}</td>
                            <td className="py-2.5 px-4 font-['JetBrains_Mono',monospace] text-[#5C5449]">
                              {c.sign} {c.dms}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {westernTab === 'aspects' && (
                <div className="rounded-3xl bg-[#FDFBF7] border border-[#3D3830]/10 overflow-hidden">
                  <div className="px-5 sm:px-6 py-4 border-b border-[#3D3830]/10 flex flex-wrap items-center justify-between gap-3">
                    <h3 className="font-serif text-xl font-medium text-[#3D3830]">Natal Aspects &amp; Orbs</h3>
                    <div className="flex items-center rounded-xl bg-[#F1ECE3] p-1 text-xs">
                      {(['all', 'Major', 'Minor'] as const).map((f) => (
                        <button
                          key={f}
                          type="button"
                          onClick={() => setAspectFilter(f)}
                          className={`px-3 py-1 rounded-lg transition-colors ${
                            aspectFilter === f ? 'bg-[#FDFBF7] text-[#3D3830] font-medium shadow-xs' : 'text-[#5C5449]'
                          }`}
                        >
                          {f === 'all' ? 'All' : f}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-[#3D3830]/10 text-[#8B8275]">
                          <th className="py-3 px-5 font-medium">Body A</th>
                          <th className="py-3 px-4 font-medium">Aspect</th>
                          <th className="py-3 px-4 font-medium">Body B</th>
                          <th className="py-3 px-4 font-medium">Category</th>
                          <th className="py-3 px-4 font-medium">Orb</th>
                          <th className="py-3 px-5 font-medium">Strength</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#3D3830]/10">
                        {filteredWesternAspects.map((a, idx) => (
                          <tr key={`${a.bodyA}-${a.bodyB}-${idx}`} className="hover:bg-[#F1ECE3]/50">
                            <td className="py-2.5 px-5 font-medium text-[#3D3830]">{a.bodyA}</td>
                            <td className="py-2.5 px-4 text-[#8B7355] font-medium">{a.aspect}</td>
                            <td className="py-2.5 px-4 font-medium text-[#3D3830]">{a.bodyB}</td>
                            <td className="py-2.5 px-4 text-[#5C5449]">{a.category}</td>
                            <td className="py-2.5 px-4 font-['JetBrains_Mono',monospace] tabular-nums text-[#5C5449]">
                              {a.orb.toFixed(2)}°
                            </td>
                            <td className="py-2.5 px-5 text-[#5C5449]">{a.exactness}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="rounded-3xl bg-[#FDFBF7] border border-[#3D3830]/10 p-6 text-sm text-[#5C5449]">
              Waiting for Western Tropical calculations to finish updating.
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ChartViewer;
