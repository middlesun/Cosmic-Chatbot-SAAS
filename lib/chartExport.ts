import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import type { CompiledChartJson } from '../components/app/ChartViewer';
import {
  SHODASHVARGA_DEFS,
  VEDIC_SIGNS_SHORT,
  buildJaiminiChartPair,
  type TraditionalBirthMeta,
} from './chartMetaAndVarga';

const PLANET_CODE_MAP: Record<string, string> = {
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

function sanitizeFileBase(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'birth-chart'
  );
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function winAnsiSafe(str: unknown): string {
  return String(str ?? '')
    .replace(/→/g, '->')
    .replace(/′/g, "'")
    .replace(/″/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/·/g, ' | ')
    .replace(/[^\x20-\xFF]/g, ' ');
}

export function downloadChartJson(
  chart: CompiledChartJson,
  birthMeta: TraditionalBirthMeta,
  allVargas: Record<
    string,
    { ascendantSignIndex: number; placements: Array<{ name: string; signIndex: number; sign: string; house: number }> }
  >
): void {
  const jaiminiCharts = buildJaiminiChartPair(chart);
  const exportPayload = {
    ...chart,
    vargas: allVargas,
    traditionalMeta: birthMeta,
    jaiminiCharts: {
      karakamshaSign: jaiminiCharts.karakamshaSign,
      karakamsha: jaiminiCharts.karakamshaPlacements,
      swamsa: jaiminiCharts.swamsaPlacements,
    },
    exportedAt: new Date().toISOString(),
  };
  const blob = new Blob([JSON.stringify(exportPayload, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  triggerBlobDownload(blob, `${sanitizeFileBase(chart.meta.name)}-birth-chart.json`);
}

export function downloadChartText(
  chart: CompiledChartJson,
  birthMeta: TraditionalBirthMeta,
  allVargas: Record<
    string,
    { ascendantSignIndex: number; placements: Array<{ name: string; signIndex: number; sign: string; house: number }> }
  >
): void {
  const lines: string[] = [];
  const hr = '='.repeat(78);
  const subHr = '-'.repeat(78);

  lines.push(hr);
  lines.push(`COSMIC COUNCIL — COMPLETE BIRTH CHART DOSSIER`);
  lines.push(`${chart.meta.name}`);
  lines.push(hr);
  lines.push('');

  lines.push('1. BIRTH DETAILS & ASTRONOMICAL HEADER');
  lines.push(subHr);
  lines.push(
    `Name           : ${birthMeta.name} (${birthMeta.sex})`
  );
  lines.push(
    `Date / Day     : ${birthMeta.birthDate} (${birthMeta.dayOfWeek})    Time: ${birthMeta.birthTime}`
  );
  lines.push(
    `Place          : ${birthMeta.place}`
  );
  lines.push(
    `Coordinates    : ${birthMeta.latitudeLabel}, ${birthMeta.longitudeLabel}`
  );
  lines.push(
    `Julian Day     : ${birthMeta.julianDay}    Sidereal Time (SID): ${birthMeta.siderealTime}`
  );
  lines.push(
    `Ayanamsha      : ${birthMeta.ayanType} (${birthMeta.ayanamshaDms})`
  );
  lines.push(
    `Sunrise/Sunset : ${birthMeta.sunrise} / ${birthMeta.sunset}`
  );
  lines.push(
    `Ascendant      : ${birthMeta.ascendant} (Lord: ${birthMeta.ascLord})`
  );
  lines.push(
    `Moon Sign      : ${birthMeta.rasi} (Lord: ${birthMeta.rasiLord})`
  );
  lines.push(
    `Star / Pada    : ${birthMeta.starPada} (Star Lord: ${birthMeta.starLord})`
  );
  lines.push(
    `Balance Dasha  : ${birthMeta.balanceOfDasha}`
  );
  lines.push(
    `Panchang       : Tithi: ${birthMeta.tithi} | Yoga: ${birthMeta.yoga} | Karan: ${birthMeta.karan}`
  );
  lines.push('');

  lines.push('2. PLANETARY POSITIONS (SIDEREAL LAHIRI D1)');
  lines.push(subHr);
  lines.push(
    `${'Body'.padEnd(11)} ${'H'.padEnd(4)} ${'Sign'.padEnd(12)} ${'Degree'.padEnd(10)} ${'Nakshatra (Lord)'.padEnd(24)} ${'Sub'.padEnd(9)} Dignity`
  );
  for (const p of chart.planets) {
    const rx = p.isRetrograde ? ' (R)' : '';
    lines.push(
      `${(p.name + rx).padEnd(11)} H${String(p.house).padEnd(3)} ${p.sign.padEnd(12)} ${p.dms.padEnd(10)} ${(p.nakshatra + ' P' + p.pada + ' (' + p.nakshatraLord + ')').padEnd(24)} ${p.subLord.padEnd(9)} ${p.dignity}`
    );
  }
  lines.push('');

  lines.push('3. SHODASHVARGA TABLE (ALL 16 DIVISIONAL CHARTS — SIGN)');
  lines.push(subHr);
  const planetCols = ['Ascendant', 'Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu'];
  const headerCols = ['Asc', 'Su', 'Mo', 'Ma', 'Me', 'Ju', 'Ve', 'Sa', 'Ra', 'Ke'];
  lines.push(
    `${'Varga'.padEnd(20)} ${headerCols.map((c) => c.padEnd(5)).join(' ')}`
  );
  for (const def of SHODASHVARGA_DEFS) {
    const varga = allVargas[def.code];
    if (!varga) continue;
    const rowCells = planetCols.map((pName) => {
      const pl = varga.placements.find((x) => x.name === pName);
      if (!pl) return '—'.padEnd(5);
      return `${VEDIC_SIGNS_SHORT[pl.signIndex]}`.padEnd(5);
    });
    lines.push(`${`${def.code} ${def.name}`.slice(0, 19).padEnd(20)} ${rowCells.join(' ')}`);
  }
  lines.push('');

  const jaiminiCharts = buildJaiminiChartPair(chart);
  lines.push('4. JAIMINI SYSTEM (KARAKAS, KARAKAMSHA & SWAMSA)');
  lines.push(subHr);
  lines.push(`Karakamsha Sign: ${jaiminiCharts.karakamshaSign}`);
  for (const k of chart.jaimini.karakas) {
    lines.push(`  ${k.code.padEnd(4)} ${k.title.padEnd(28)} -> ${k.planet.padEnd(8)} (${k.sign} ${k.dms})`);
  }
  lines.push('  Karakamsha Chart (D1 from Karakamsha):');
  for (let h = 1; h <= 12; h++) {
    const list = jaiminiCharts.karakamshaPlacements
      .filter((x) => x.house === h && x.name !== 'Ascendant')
      .map((x) => x.name);
    if (list.length > 0) lines.push(`    H${String(h).padEnd(2)}: ${list.join(', ')}`);
  }
  lines.push('  Swamsa Chart (D9 from Karakamsha):');
  for (let h = 1; h <= 12; h++) {
    const list = jaiminiCharts.swamsaPlacements
      .filter((x) => x.house === h && x.name !== 'Ascendant')
      .map((x) => x.name);
    if (list.length > 0) lines.push(`    H${String(h).padEnd(2)}: ${list.join(', ')}`);
  }
  lines.push('');

  lines.push('5. KP PLACIDUS CUSPS & SIGNIFICATORS');
  lines.push(subHr);
  for (const c of chart.kp.cusps) {
    lines.push(
      `  Cusp H${String(c.house).padEnd(2)} : ${c.sign.padEnd(11)} ${c.dms.padEnd(8)} | Sign: ${c.signLord.padEnd(8)} | Star: ${c.starLord.padEnd(8)} | Sub: ${c.subLord}`
    );
  }
  lines.push('');
  for (const s of chart.kp.significators) {
    lines.push(
      `  ${s.planet.padEnd(9)} Star: ${s.starLord.padEnd(8)} Sub: ${s.subLord.padEnd(8)} | Signifies Houses: ${s.signifiesHouses.join(', ')}`
    );
  }
  lines.push('');

  lines.push('6. VIMSHOTTARI DASHA TIMELINE');
  lines.push(subHr);
  for (const md of chart.vimshottari.timeline) {
    lines.push(`  ${md.lord.padEnd(8)} Mahadasha: ${md.startDate} to ${md.endDate}`);
    for (const ad of md.children || []) {
      lines.push(`    ${md.lord}/${ad.lord}: ${ad.startDate} to ${ad.endDate}`);
    }
  }
  lines.push('');

  if (chart.western) {
    lines.push('7. WESTERN TROPICAL (PLACIDUS)');
    lines.push(subHr);
    lines.push(
      `Angles: AC ${chart.western.angles.ascendant.sign} ${chart.western.angles.ascendant.dms} | MC ${chart.western.angles.midheaven.sign} ${chart.western.angles.midheaven.dms}`
    );
    for (const wp of chart.western.planets) {
      lines.push(
        `  ${wp.name.padEnd(10)} ${wp.sign.padEnd(12)} ${wp.dms.padEnd(9)} Placidus H${wp.house} (Whole H${wp.wholeSignHouse}) [${wp.element}/${wp.modality}]`
      );
    }
    lines.push('');
  }

  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
  triggerBlobDownload(blob, `${sanitizeFileBase(chart.meta.name)}-birth-chart.txt`);
}

function drawNorthIndianChartPdf(
  page: PDFPage,
  x: number,
  y: number,
  size: number,
  title: string,
  ascendantSignIndex: number,
  placements: Array<{ name: string; signIndex: number; house: number }>,
  fonts: { regular: PDFFont; bold: PDFFont }
) {
  const borderColor = rgb(0.24, 0.22, 0.19);
  const innerLineColor = rgb(0.45, 0.41, 0.36);
  const fillBg = rgb(0.99, 0.98, 0.96);
  const accentColor = rgb(0.55, 0.45, 0.33);
  const textColor = rgb(0.18, 0.16, 0.14);

  page.drawText(winAnsiSafe(title), {
    x,
    y: y + size + 8,
    size: 10.5,
    font: fonts.bold,
    color: textColor,
  });

  page.drawRectangle({
    x,
    y,
    width: size,
    height: size,
    color: fillBg,
    borderColor,
    borderWidth: 1.1,
  });

  // Diagonals
  page.drawLine({ start: { x, y }, end: { x: x + size, y: y + size }, thickness: 0.7, color: innerLineColor });
  page.drawLine({ start: { x: x + size, y }, end: { x, y: y + size }, thickness: 0.7, color: innerLineColor });

  // Inner diamond
  const half = size / 2;
  page.drawLine({ start: { x: x + half, y: y + size }, end: { x: x + size, y: y + half }, thickness: 0.9, color: borderColor });
  page.drawLine({ start: { x: x + size, y: y + half }, end: { x: x + half, y }, thickness: 0.9, color: borderColor });
  page.drawLine({ start: { x: x + half, y }, end: { x, y: y + half }, thickness: 0.9, color: borderColor });
  page.drawLine({ start: { x, y: y + half }, end: { x: x + half, y: y + size }, thickness: 0.9, color: borderColor });

  // Coordinates normalized (0..1) from bottom-left of box (PDF y goes UP)
  const houseCoords: Record<number, { px: number; py: number; sx: number; sy: number }> = {
    1: { px: 0.5, py: 0.72, sx: 0.5, sy: 0.56 },
    2: { px: 0.25, py: 0.88, sx: 0.25, sy: 0.79 },
    3: { px: 0.11, py: 0.75, sx: 0.2, sy: 0.75 },
    4: { px: 0.27, py: 0.5, sx: 0.43, sy: 0.5 },
    5: { px: 0.11, py: 0.25, sx: 0.2, sy: 0.25 },
    6: { px: 0.25, py: 0.12, sx: 0.25, sy: 0.21 },
    7: { px: 0.5, py: 0.27, sx: 0.5, sy: 0.43 },
    8: { px: 0.75, py: 0.12, sx: 0.75, sy: 0.21 },
    9: { px: 0.89, py: 0.25, sx: 0.8, sy: 0.25 },
    10: { px: 0.73, py: 0.5, sx: 0.57, sy: 0.5 },
    11: { px: 0.89, py: 0.75, sx: 0.8, sy: 0.75 },
    12: { px: 0.75, py: 0.88, sx: 0.75, sy: 0.79 },
  };

  for (let h = 1; h <= 12; h++) {
    const signNum = ((ascendantSignIndex + h - 1) % 12) + 1;
    const coord = houseCoords[h];
    const items = placements
      .filter((p) => p.house === h && p.name !== 'Ascendant')
      .map((p) => PLANET_CODE_MAP[p.name] || p.name.slice(0, 2));

    const sxText = String(signNum);
    const sxWidth = fonts.regular.widthOfTextAtSize(sxText, 7);
    page.drawText(sxText, {
      x: x + coord.sx * size - sxWidth / 2,
      y: y + coord.sy * size - 2.5,
      size: 7,
      font: fonts.regular,
      color: accentColor,
    });

    if (items.length > 0) {
      const line1 = items.slice(0, 3).join(' ');
      const line2 = items.slice(3).join(' ');
      const w1 = fonts.bold.widthOfTextAtSize(line1, 7.5);
      page.drawText(line1, {
        x: x + coord.px * size - w1 / 2,
        y: y + coord.py * size - (line2 ? 0 : 2.5),
        size: 7.5,
        font: fonts.bold,
        color: textColor,
      });
      if (line2) {
        const w2 = fonts.bold.widthOfTextAtSize(line2, 7.5);
        page.drawText(line2, {
          x: x + coord.px * size - w2 / 2,
          y: y + coord.py * size - 9.5,
          size: 7.5,
          font: fonts.bold,
          color: textColor,
        });
      }
    }
  }
}

function drawSouthIndianChartPdf(
  page: PDFPage,
  x: number,
  y: number,
  size: number,
  title: string,
  centerLabel: string,
  ascendantSignIndex: number,
  placements: Array<{ name: string; signIndex: number; house: number }>,
  fonts: { regular: PDFFont; bold: PDFFont }
) {
  const borderColor = rgb(0.24, 0.22, 0.19);
  const innerLineColor = rgb(0.45, 0.41, 0.36);
  const fillBg = rgb(0.99, 0.98, 0.96);
  const centerBg = rgb(0.95, 0.93, 0.89);
  const accentColor = rgb(0.55, 0.45, 0.33);
  const textColor = rgb(0.18, 0.16, 0.14);

  page.drawText(winAnsiSafe(title), {
    x,
    y: y + size + 8,
    size: 10.5,
    font: fonts.bold,
    color: textColor,
  });

  page.drawRectangle({
    x,
    y,
    width: size,
    height: size,
    color: fillBg,
    borderColor,
    borderWidth: 1.1,
  });

  const cell = size / 4;
  // Center box
  page.drawRectangle({
    x: x + cell,
    y: y + cell,
    width: cell * 2,
    height: cell * 2,
    color: centerBg,
    borderColor: innerLineColor,
    borderWidth: 0.7,
  });

  // Grid subdivisions
  for (let i = 1; i <= 3; i++) {
    // Vertical segments top & bottom
    if (i === 2) {
      page.drawLine({ start: { x: x + cell * i, y: y + size }, end: { x: x + cell * i, y: y + cell * 3 }, thickness: 0.7, color: innerLineColor });
      page.drawLine({ start: { x: x + cell * i, y }, end: { x: x + cell * i, y: y + cell }, thickness: 0.7, color: innerLineColor });
      page.drawLine({ start: { x, y: y + cell * i }, end: { x: x + cell, y: y + cell * i }, thickness: 0.7, color: innerLineColor });
      page.drawLine({ start: { x: x + cell * 3, y: y + cell * i }, end: { x: x + size, y: y + cell * i }, thickness: 0.7, color: innerLineColor });
    } else {
      page.drawLine({ start: { x: x + cell * i, y }, end: { x: x + cell * i, y: y + size }, thickness: 0.7, color: innerLineColor });
      page.drawLine({ start: { x, y: y + cell * i }, end: { x: x + size, y: y + cell * i }, thickness: 0.7, color: innerLineColor });
    }
  }

  const cWidth = fonts.bold.widthOfTextAtSize(centerLabel, 9);
  page.drawText(winAnsiSafe(centerLabel), {
    x: x + size / 2 - cWidth / 2,
    y: y + size / 2 - 3,
    size: 9,
    font: fonts.bold,
    color: textColor,
  });

  // Top row = row 3 (y = y + 3*cell), Bottom row = row 0 (y = y)
  const cells: Record<number, { col: number; row: number }> = {
    11: { col: 0, row: 3 },
    0: { col: 1, row: 3 },
    1: { col: 2, row: 3 },
    2: { col: 3, row: 3 },
    3: { col: 3, row: 2 },
    4: { col: 3, row: 1 },
    5: { col: 3, row: 0 },
    6: { col: 2, row: 0 },
    7: { col: 1, row: 0 },
    8: { col: 0, row: 0 },
    9: { col: 0, row: 1 },
    10: { col: 0, row: 2 },
  };

  for (let sIdx = 0; sIdx < 12; sIdx++) {
    const c = cells[sIdx];
    const cx = x + c.col * cell;
    const cy = y + c.row * cell;
    const signLabel = VEDIC_SIGNS_SHORT[sIdx];
    page.drawText(signLabel, {
      x: cx + 4,
      y: cy + cell - 10,
      size: 6.5,
      font: fonts.regular,
      color: accentColor,
    });
    if (sIdx === ascendantSignIndex) {
      page.drawLine({
        start: { x: cx, y: cy + cell - 11 },
        end: { x: cx + 11, y: cy + cell },
        thickness: 0.8,
        color: accentColor,
      });
    }
    const items = placements
      .filter((p) => p.signIndex === sIdx && p.name !== 'Ascendant')
      .map((p) => PLANET_CODE_MAP[p.name] || p.name.slice(0, 2));
    if (items.length > 0) {
      const l1 = items.slice(0, 2).join(' ');
      const l2 = items.slice(2, 4).join(' ');
      page.drawText(l1, {
        x: cx + 5,
        y: cy + cell * 0.45,
        size: 7.5,
        font: fonts.bold,
        color: textColor,
      });
      if (l2) {
        page.drawText(l2, {
          x: cx + 5,
          y: cy + cell * 0.22,
          size: 7.5,
          font: fonts.bold,
          color: textColor,
        });
      }
    }
  }
}

export async function downloadChartPdf(
  chart: CompiledChartJson,
  birthMeta: TraditionalBirthMeta,
  allVargas: Record<
    string,
    { ascendantSignIndex: number; placements: Array<{ name: string; signIndex: number; sign: string; house: number }> }
  >,
  chartStyle: 'north' | 'south'
): Promise<void> {
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const serifBold = await doc.embedFont(StandardFonts.TimesRomanBold);
  const mono = await doc.embedFont(StandardFonts.Courier);
  const fonts = { regular, bold };

  const ivory = rgb(0.98, 0.97, 0.95);
  const umber = rgb(0.24, 0.22, 0.19);
  const earth = rgb(0.36, 0.33, 0.29);
  const brass = rgb(0.55, 0.45, 0.33);
  const border = rgb(0.84, 0.8, 0.74);

  const pageWidth = 595.28; // A4
  const pageHeight = 841.89;
  const margin = 36;

  // PAGE 1: Header + Traditional Birth Table + Side-by-side D1 & D9 + Planetary Positions
  const p1 = doc.addPage([pageWidth, pageHeight]);
  p1.drawRectangle({ x: 0, y: 0, width: pageWidth, height: pageHeight, color: ivory });

  p1.drawText(winAnsiSafe(`Cosmic Council - Vedic & Western Birth Chart Dossier`), {
    x: margin,
    y: pageHeight - 36,
    size: 9,
    font: regular,
    color: brass,
  });
  p1.drawText(winAnsiSafe(chart.meta.name), {
    x: margin,
    y: pageHeight - 56,
    size: 20,
    font: serifBold,
    color: umber,
  });
  p1.drawText(winAnsiSafe(`${birthMeta.birthDate} | ${birthMeta.birthTime} | ${birthMeta.place}`), {
    x: margin,
    y: pageHeight - 70,
    size: 9,
    font: regular,
    color: earth,
  });

  // Traditional Birth Metadata Box
  const metaBoxTop = pageHeight - 84;
  const metaBoxHeight = 98;
  p1.drawRectangle({
    x: margin,
    y: metaBoxTop - metaBoxHeight,
    width: pageWidth - margin * 2,
    height: metaBoxHeight,
    color: rgb(0.995, 0.99, 0.975),
    borderColor: border,
    borderWidth: 1,
  });

  const metaCols: Array<Array<[string, string]>> = [
    [
      ['Name', birthMeta.name.slice(0, 18)],
      ['Sex', birthMeta.sex],
      ['Date', birthMeta.birthDate],
      ['Day', birthMeta.dayOfWeek],
      ['Time', birthMeta.birthTime],
      ['SID', birthMeta.siderealTime],
    ],
    [
      ['Julian Day', birthMeta.julianDay],
      ['Ayan Type', birthMeta.ayanType],
      ['Ayan', birthMeta.ayanamshaDms],
      ['Place', birthMeta.place.split(',')[0].slice(0, 14)],
      ['Long', birthMeta.longitudeLabel],
      ['Lat', birthMeta.latitudeLabel],
    ],
    [
      ['Asc Lord', birthMeta.ascLord],
      ['Asc', birthMeta.ascendant],
      ['Yoga', birthMeta.yoga.slice(0, 14)],
      ['Tithi', birthMeta.tithi.slice(0, 15)],
      ['Sunset', birthMeta.sunset],
      ['Sunrise', birthMeta.sunrise],
    ],
    [
      ['Bal. Dasha', birthMeta.balanceOfDasha],
      ['Karan', birthMeta.karan.slice(0, 14)],
      ['Star Lord', birthMeta.starLord],
      ['Star-Pada', birthMeta.starPada.slice(0, 15)],
      ['Rasi Lord', birthMeta.rasiLord],
      ['Rasi', birthMeta.rasi],
    ],
  ];

  const colW = (pageWidth - margin * 2 - 16) / 4;
  metaCols.forEach((colRows, cIdx) => {
    const cx = margin + 8 + cIdx * colW;
    colRows.forEach(([k, v], rIdx) => {
      const ry = metaBoxTop - 15 - rIdx * 15;
      p1.drawText(winAnsiSafe(k), { x: cx, y: ry, size: 7.2, font: bold, color: earth });
      p1.drawText(winAnsiSafe(v), { x: cx + 48, y: ry, size: 7.2, font: regular, color: umber });
    });
  });

  // Side-by-side D1 & D9 Charts
  const chartSize = 240;
  const chartsY = metaBoxTop - metaBoxHeight - chartSize - 32;
  const d1 = allVargas.D1;
  const d9 = allVargas.D9;

  if (d1) {
    if (chartStyle === 'north') {
      drawNorthIndianChartPdf(p1, margin, chartsY, chartSize, 'Lagna Chart (D1)', d1.ascendantSignIndex, d1.placements, fonts);
    } else {
      drawSouthIndianChartPdf(p1, margin, chartsY, chartSize, 'Lagna Chart (D1)', 'D1 Lagna', d1.ascendantSignIndex, d1.placements, fonts);
    }
  }
  if (d9) {
    const rightX = pageWidth - margin - chartSize;
    if (chartStyle === 'north') {
      drawNorthIndianChartPdf(p1, rightX, chartsY, chartSize, 'Navamsha Chart (D9)', d9.ascendantSignIndex, d9.placements, fonts);
    } else {
      drawSouthIndianChartPdf(p1, rightX, chartsY, chartSize, 'Navamsha Chart (D9)', 'D9 Navamsha', d9.ascendantSignIndex, d9.placements, fonts);
    }
  }

  // Planetary Positions Table
  let tableY = chartsY - 26;
  p1.drawText('Planetary Longitudes & Dignities (Sidereal Lahiri)', {
    x: margin,
    y: tableY,
    size: 10.5,
    font: bold,
    color: umber,
  });
  tableY -= 16;
  p1.drawText('Body         H     Sign          Degree     Nakshatra (Lord)        Sub       Dignity', {
    x: margin,
    y: tableY,
    size: 7.5,
    font: mono,
    color: brass,
  });
  tableY -= 5;
  p1.drawLine({ start: { x: margin, y: tableY }, end: { x: pageWidth - margin, y: tableY }, thickness: 0.6, color: border });
  tableY -= 12;

  for (const pl of chart.planets) {
    const rowLine = `${(pl.name + (pl.isRetrograde ? ' (R)' : '')).padEnd(12)} H${String(pl.house).padEnd(4)} ${pl.sign.padEnd(13)} ${pl.dms.padEnd(10)} ${(pl.nakshatra + ' P' + pl.pada).padEnd(23)} ${pl.subLord.padEnd(9)} ${pl.dignity}`;
    p1.drawText(winAnsiSafe(rowLine), {
      x: margin,
      y: tableY,
      size: 7.4,
      font: mono,
      color: umber,
    });
    tableY -= 14;
  }

  // PAGE 2: Shodashvarga Table + Side-by-Side Jaimini Karakamsha & Swamsa Charts
  const p2 = doc.addPage([pageWidth, pageHeight]);
  p2.drawRectangle({ x: 0, y: 0, width: pageWidth, height: pageHeight, color: ivory });

  p2.drawText('Shodashvarga Table (All 16 Divisional Charts)', {
    x: margin,
    y: pageHeight - 40,
    size: 13,
    font: serifBold,
    color: umber,
  });

  const planetOrder = ['Ascendant', 'Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu'];
  const colHeaders = ['Asc', 'Su', 'Mo', 'Ma', 'Me', 'Ju', 'Ve', 'Sa', 'Ra', 'Ke'];
  let vy = pageHeight - 62;
  const tableHeader = `${'Chart'.padEnd(20)} ${colHeaders.map((h) => h.padEnd(4)).join(' ')}`;
  p2.drawText(tableHeader, { x: margin, y: vy, size: 7.8, font: mono, color: brass });
  vy -= 5;
  p2.drawLine({ start: { x: margin, y: vy }, end: { x: pageWidth - margin, y: vy }, thickness: 0.7, color: border });
  vy -= 13;

  for (const def of SHODASHVARGA_DEFS) {
    const varga = allVargas[def.code];
    if (!varga) continue;
    const vals = planetOrder.map((pName) => {
      const pl = varga.placements.find((x) => x.name === pName);
      return pl ? VEDIC_SIGNS_SHORT[pl.signIndex].padEnd(4) : '-   ';
    });
    const line = `${`${def.code} ${def.name}`.slice(0, 19).padEnd(20)} ${vals.join(' ')}`;
    p2.drawText(winAnsiSafe(line), { x: margin, y: vy, size: 7.6, font: mono, color: umber });
    vy -= 14;
  }

  // Jaimini Karakamsha & Swamsa Charts side by side
  const jaiminiPair = buildJaiminiChartPair(chart);
  const jChartsTitleY = vy - 18;
  p2.drawText(winAnsiSafe(`Jaimini System - Karakamsha & Swamsa (Karakamsha: ${jaiminiPair.karakamshaSign})`), {
    x: margin,
    y: jChartsTitleY,
    size: 12,
    font: serifBold,
    color: umber,
  });

  const jChartSize = 230;
  const jChartsY = jChartsTitleY - jChartSize - 28;
  if (chartStyle === 'north') {
    drawNorthIndianChartPdf(
      p2,
      margin,
      jChartsY,
      jChartSize,
      'Karakamsha Chart',
      jaiminiPair.karakamshaSignIndex,
      jaiminiPair.karakamshaPlacements,
      fonts
    );
    drawNorthIndianChartPdf(
      p2,
      pageWidth - margin - jChartSize,
      jChartsY,
      jChartSize,
      'Swamsa Chart',
      jaiminiPair.karakamshaSignIndex,
      jaiminiPair.swamsaPlacements,
      fonts
    );
  } else {
    drawSouthIndianChartPdf(
      p2,
      margin,
      jChartsY,
      jChartSize,
      'Karakamsha Chart',
      'Karakamsha',
      jaiminiPair.karakamshaSignIndex,
      jaiminiPair.karakamshaPlacements,
      fonts
    );
    drawSouthIndianChartPdf(
      p2,
      pageWidth - margin - jChartSize,
      jChartsY,
      jChartSize,
      'Swamsa Chart',
      'Swamsa',
      jaiminiPair.karakamshaSignIndex,
      jaiminiPair.swamsaPlacements,
      fonts
    );
  }

  // Chara Karakas summary
  let ky = jChartsY - 22;
  p2.drawText('Jaimini Chara Karakas', { x: margin, y: ky, size: 10, font: bold, color: umber });
  ky -= 14;
  for (const k of chart.jaimini?.karakas || []) {
    if (ky < 36) break;
    p2.drawText(
      winAnsiSafe(`${k.code.padEnd(4)} ${k.title.padEnd(28)} ${k.planet.padEnd(8)} (${k.sign} ${k.dms})`),
      { x: margin, y: ky, size: 7.5, font: mono, color: earth }
    );
    ky -= 12;
  }

  // PAGE 3: Vimshottari Dasha + KP Cusps + Western Summary
  const p3 = doc.addPage([pageWidth, pageHeight]);
  p3.drawRectangle({ x: 0, y: 0, width: pageWidth, height: pageHeight, color: ivory });

  let y3 = pageHeight - 40;
  p3.drawText('Vimshottari Mahadasha Timeline', { x: margin, y: y3, size: 13, font: serifBold, color: umber });
  y3 -= 18;
  for (const md of chart.vimshottari?.timeline || []) {
    if (y3 < 200) break;
    p3.drawText(winAnsiSafe(`${md.lord.padEnd(9)} Mahadasha: ${md.startDate} -> ${md.endDate}`), {
      x: margin,
      y: y3,
      size: 8,
      font: bold,
      color: umber,
    });
    y3 -= 12;
    const ads = (md.children || []).slice(0, 9);
    const chunkText = ads.map((ad) => `${ad.lord} (${ad.endDate.slice(0, 7)})`).join(' | ');
    if (chunkText) {
      p3.drawText(winAnsiSafe(`   ${chunkText}`), { x: margin, y: y3, size: 7, font: mono, color: earth });
      y3 -= 13;
    }
  }

  y3 -= 12;
  p3.drawText('KP Placidus House Cusps', { x: margin, y: y3, size: 12, font: serifBold, color: umber });
  y3 -= 16;
  for (const c of chart.kp?.cusps || []) {
    if (y3 < 130) break;
    p3.drawText(
      winAnsiSafe(`H${String(c.house).padEnd(2)}  ${c.sign.padEnd(11)} ${c.dms.padEnd(8)}  Sign: ${c.signLord.padEnd(8)}  Star: ${c.starLord.padEnd(8)}  Sub: ${c.subLord}`),
      { x: margin, y: y3, size: 7.4, font: mono, color: umber }
    );
    y3 -= 12;
  }

  if (chart.western && y3 > 110) {
    y3 -= 12;
    p3.drawText(
      winAnsiSafe(`Western Tropical (Placidus) - AC: ${chart.western.angles.ascendant.sign} ${chart.western.angles.ascendant.dms} | MC: ${chart.western.angles.midheaven.sign} ${chart.western.angles.midheaven.dms}`),
      { x: margin, y: y3, size: 10.5, font: serifBold, color: umber }
    );
    y3 -= 15;
    for (const wp of chart.western.planets) {
      if (y3 < 36) break;
      p3.drawText(
        winAnsiSafe(`${wp.name.padEnd(10)} ${wp.sign.padEnd(11)} ${wp.dms.padEnd(9)} Placidus H${wp.house} (${wp.element})`),
        { x: margin, y: y3, size: 7.4, font: mono, color: earth }
      );
      y3 -= 12;
    }
  }

  const pdfBytes = await doc.save();
  const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
  triggerBlobDownload(blob, `${sanitizeFileBase(chart.meta.name)}-birth-chart.pdf`);
}
