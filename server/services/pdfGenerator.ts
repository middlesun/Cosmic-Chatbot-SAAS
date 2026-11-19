import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';

export interface ReportPdfInput {
  orderId: string;
  reportTitle: string;
  category: string;
  profileName: string;
  birthSummary: string;
  generatedAt: string;
  finalMarkdown: string;
}

function stripInlineMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .trim();
}

/**
 * Standard PDF Type-1 fonts (Helvetica / TimesRoman / Courier) use WinAnsi encoding.
 * Normalize punctuation & replace unsupported Unicode glyphs gracefully so PDF generation
 * never throws in Node.js or Cloudflare Workers V8 isolates.
 */
function toWinAnsiSafe(text: string): string {
  return text
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/\u2022/g, '-')
    .replace(/\u2032/g, "'")
    .replace(/\u2033/g, '"')
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, '');
}

function wrapTextLines(
  text: string,
  font: PDFFont,
  fontSize: number,
  maxWidth: number
): string[] {
  const safe = toWinAnsiSafe(text);
  const words = safe.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const lines: string[] = [];
  let current = words[0];

  for (let i = 1; i < words.length; i++) {
    const candidate = `${current} ${words[i]}`;
    if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
      current = candidate;
    } else {
      lines.push(current);
      current = words[i];
    }
  }
  lines.push(current);
  return lines;
}

export async function generateReportPdfBuffer(input: ReportPdfInput): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle(toWinAnsiSafe(`${input.reportTitle} - ${input.profileName}`));
  pdfDoc.setAuthor('Cosmic Council PRO');
  pdfDoc.setSubject(
    toWinAnsiSafe(`Deep Research Vedic Astrology Dossier (${input.category})`)
  );

  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const timesBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
  const timesItalic = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);
  const courier = await pdfDoc.embedFont(StandardFonts.Courier);

  // A4 dimensions in PDF points: 595.28 x 841.89
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const marginLeft = 54;
  const marginBottom = 56;
  const contentWidth = pageWidth - marginLeft * 2;

  const colNight = rgb(0x1f / 255, 0x22 / 255, 0x29 / 255);
  const colGold = rgb(0xb8 / 255, 0x96 / 255, 0x5a / 255);
  const colIvory = rgb(0xf4 / 255, 0xef / 255, 0xe6 / 255);
  const colLightTaupe = rgb(0xd8 / 255, 0xd0 / 255, 0xc3 / 255);
  const colUmber = rgb(0x3d / 255, 0x38 / 255, 0x30 / 255);
  const colWarmEarth = rgb(0x5c / 255, 0x54 / 255, 0x49 / 255);
  const colMuted = rgb(0x8b / 255, 0x82 / 255, 0x75 / 255);
  const colAccent = rgb(0x8b / 255, 0x73 / 255, 0x55 / 255);
  const colRule = rgb(0xe2 / 255, 0xda / 255, 0xd0 / 255);
  const colTable = rgb(0x4a / 255, 0x45 / 255, 0x3d / 255);

  let page: PDFPage = pdfDoc.addPage([pageWidth, pageHeight]);
  // PDF coordinate y runs from bottom (0) to top (pageHeight).
  // Draw Observatory Night Header Band (top 148pt)
  page.drawRectangle({
    x: 0,
    y: pageHeight - 148,
    width: pageWidth,
    height: 148,
    color: colNight,
  });

  page.drawText(
    toWinAnsiSafe(`COSMIC COUNCIL PRO  ·  ${input.category.toUpperCase()}`),
    {
      x: marginLeft,
      y: pageHeight - 48,
      size: 9,
      font: helveticaBold,
      color: colGold,
    }
  );

  const titleLines = wrapTextLines(input.reportTitle, timesBold, 21, contentWidth).slice(0, 2);
  let titleY = pageHeight - 76;
  for (const tLine of titleLines) {
    page.drawText(tLine, {
      x: marginLeft,
      y: titleY,
      size: 21,
      font: timesBold,
      color: colIvory,
    });
    titleY -= 24;
  }

  page.drawText(
    toWinAnsiSafe(`Prepared for ${input.profileName}  ·  ${input.birthSummary}`).slice(0, 95),
    {
      x: marginLeft,
      y: pageHeight - 126,
      size: 10,
      font: helvetica,
      color: colLightTaupe,
    }
  );

  let cursorY = pageHeight - 176;

  const compiledDate = new Date(input.generatedAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  page.drawText(
    toWinAnsiSafe(
      `Compiled ${compiledDate}  ·  Multi-Pass Sidereal Lahiri Synthesis  ·  Reference ${input.orderId.slice(0, 8)}`
    ),
    {
      x: marginLeft,
      y: cursorY,
      size: 8.5,
      font: helvetica,
      color: colMuted,
    }
  );

  cursorY -= 14;
  page.drawLine({
    start: { x: marginLeft, y: cursorY },
    end: { x: pageWidth - marginLeft, y: cursorY },
    thickness: 0.75,
    color: colLightTaupe,
  });
  cursorY -= 24;

  const ensureRoom = (neededHeight: number) => {
    if (cursorY - neededHeight < marginBottom + 12) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      cursorY = pageHeight - 56;
    }
  };

  const drawWrapped = (
    text: string,
    opts: {
      x?: number;
      width?: number;
      font: PDFFont;
      size: number;
      color: ReturnType<typeof rgb>;
      lineHeight?: number;
      bottomGap?: number;
    }
  ) => {
    const x = opts.x ?? marginLeft;
    const width = opts.width ?? contentWidth;
    const lineHeight = opts.lineHeight ?? opts.size * 1.42;
    const wrapped = wrapTextLines(text, opts.font, opts.size, width);
    if (wrapped.length === 0) return;

    for (const line of wrapped) {
      ensureRoom(lineHeight);
      page.drawText(line, {
        x,
        y: cursorY,
        size: opts.size,
        font: opts.font,
        color: opts.color,
      });
      cursorY -= lineHeight;
    }
    cursorY -= opts.bottomGap ?? 6;
  };

  const mdLines = input.finalMarkdown.replace(/\r\n/g, '\n').split('\n');

  for (const rawLine of mdLines) {
    const line = rawLine.trim();

    if (!line) {
      cursorY -= 7;
      continue;
    }

    if (line === '---' || line === '***') {
      ensureRoom(22);
      cursorY -= 6;
      page.drawLine({
        start: { x: marginLeft, y: cursorY },
        end: { x: pageWidth - marginLeft, y: cursorY },
        thickness: 0.6,
        color: colRule,
      });
      cursorY -= 16;
      continue;
    }

    if (line.startsWith('# ')) {
      ensureRoom(38);
      cursorY -= 10;
      drawWrapped(stripInlineMarkdown(line.slice(2)), {
        font: timesBold,
        size: 16.5,
        color: colUmber,
        lineHeight: 22,
        bottomGap: 8,
      });
      continue;
    }

    if (line.startsWith('## ')) {
      ensureRoom(34);
      cursorY -= 8;
      drawWrapped(stripInlineMarkdown(line.slice(3)), {
        font: timesBold,
        size: 13.5,
        color: colUmber,
        lineHeight: 19,
        bottomGap: 6,
      });
      continue;
    }

    if (line.startsWith('### ') || line.startsWith('#### ')) {
      const prefixLen = line.startsWith('#### ') ? 5 : 4;
      ensureRoom(26);
      cursorY -= 5;
      drawWrapped(stripInlineMarkdown(line.slice(prefixLen)), {
        font: helveticaBold,
        size: 11,
        color: colWarmEarth,
        lineHeight: 16,
        bottomGap: 4,
      });
      continue;
    }

    if (line.startsWith('> ')) {
      ensureRoom(28);
      const quoteStartY = cursorY + 9;
      drawWrapped(stripInlineMarkdown(line.slice(2)), {
        x: marginLeft + 14,
        width: contentWidth - 18,
        font: timesItalic,
        size: 10.5,
        color: colWarmEarth,
        lineHeight: 15,
        bottomGap: 8,
      });
      page.drawLine({
        start: { x: marginLeft + 2, y: quoteStartY },
        end: { x: marginLeft + 2, y: cursorY + 12 },
        thickness: 2,
        color: colGold,
      });
      continue;
    }

    if (line.startsWith('- ') || line.startsWith('* ') || /^\d+\.\s/.test(line)) {
      ensureRoom(22);
      const bulletMatch = line.match(/^(\d+\.)\s+(.*)$/);
      const marker = bulletMatch ? bulletMatch[1] : '-';
      const body = bulletMatch ? bulletMatch[2] : line.slice(2);

      page.drawText(toWinAnsiSafe(marker), {
        x: marginLeft + 4,
        y: cursorY,
        size: 10,
        font: helveticaBold,
        color: colAccent,
      });

      drawWrapped(stripInlineMarkdown(body), {
        x: marginLeft + 22,
        width: contentWidth - 22,
        font: helvetica,
        size: 10,
        color: colUmber,
        lineHeight: 14.5,
        bottomGap: 5,
      });
      continue;
    }

    if (line.startsWith('|')) {
      if (/^\|[\s-:|]+\|$/.test(line)) {
        continue;
      }
      const cells = line
        .split('|')
        .slice(1, -1)
        .map((c) => stripInlineMarkdown(c))
        .join('   |   ');
      drawWrapped(cells, {
        x: marginLeft + 4,
        width: contentWidth - 8,
        font: courier,
        size: 8.5,
        color: colTable,
        lineHeight: 12.5,
        bottomGap: 4,
      });
      continue;
    }

    drawWrapped(stripInlineMarkdown(line), {
      font: helvetica,
      size: 10.2,
      color: colUmber,
      lineHeight: 14.8,
      bottomGap: 6,
    });
  }

  // Running Observatory Page Footers across all pages
  const allPages = pdfDoc.getPages();
  const totalPages = allPages.length;
  allPages.forEach((p, idx) => {
    const footer = toWinAnsiSafe(
      `Cosmic Council PRO  ·  ${input.profileName}  ·  Page ${idx + 1} of ${totalPages}`
    );
    const footerWidth = helvetica.widthOfTextAtSize(footer, 8);
    p.drawText(footer, {
      x: Math.max(marginLeft, (pageWidth - footerWidth) / 2),
      y: 28,
      size: 8,
      font: helvetica,
      color: colMuted,
    });
  });

  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
}
