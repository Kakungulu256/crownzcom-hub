import { jsPDF } from 'jspdf';

const DEFAULT_MARGIN = 14;
const LINE_HEIGHT = 6;
const NUMERIC_COLUMN_PATTERN = /(amount|balance|total|paid|owed|savings|payment|forecast|overdue|net|equity|income|expense|interest|disbursed|cleared|credit|debit)/i;

const looksNumericValue = (value) => {
  if (typeof value === 'number') return true;
  if (typeof value !== 'string') return false;
  const normalized = value.trim();
  return /^((USh|UGX)\s*)?[-+]?\d[\d,]*(\.\d+)?$/.test(normalized);
};

const applyWatermark = (doc, pageWidth, pageHeight, watermark) => {
  if (!watermark) return;

  try {
    if (watermark.imageData) {
      const maxSize = Math.min(pageWidth, pageHeight) * 0.62;
      const x = (pageWidth - maxSize) / 2;
      const y = (pageHeight - maxSize) / 2;
      doc.addImage(watermark.imageData, 'PNG', x, y, maxSize, maxSize, undefined, 'FAST');
    }
  } catch {
    // Ignore watermark image failures and continue rendering the report.
  }

  if (watermark.text) {
    doc.setTextColor(235);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(watermark.textSize || 42);
    doc.text(watermark.text, pageWidth / 2, pageHeight / 2, {
      align: 'center',
      angle: 45
    });
    doc.setTextColor(20);
  }
};

export const createPdfDoc = ({ title, subtitle, meta = [], watermark = null, showTitleOnNewPages = true } = {}) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let cursorY = DEFAULT_MARGIN;
  applyWatermark(doc, pageWidth, pageHeight, watermark);

  if (title) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(title, DEFAULT_MARGIN, cursorY);
    cursorY += LINE_HEIGHT + 2;
  }

  if (subtitle) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.text(subtitle, DEFAULT_MARGIN, cursorY);
    cursorY += LINE_HEIGHT;
  }

  if (meta.length > 0) {
    doc.setFontSize(9);
    doc.setTextColor(90);
    meta.forEach((line) => {
      doc.text(line, DEFAULT_MARGIN, cursorY);
      cursorY += LINE_HEIGHT - 2;
    });
    cursorY += 2;
  }

  doc.setDrawColor(220);
  doc.line(DEFAULT_MARGIN, cursorY, pageWidth - DEFAULT_MARGIN, cursorY);
  cursorY += 4;
  doc.setTextColor(20);

  return {
    doc,
    cursorY,
    meta: { title, subtitle, pageWidth, pageHeight, watermark, showTitleOnNewPages }
  };
};

const addPageIfNeeded = (doc, cursorY, meta, rowsNeeded = 1) => {
  const pageHeight = meta?.pageHeight || doc.internal.pageSize.getHeight();
  const requiredSpace = rowsNeeded * LINE_HEIGHT;
  if (cursorY + requiredSpace <= pageHeight - DEFAULT_MARGIN) {
    return cursorY;
  }
  doc.addPage();
  applyWatermark(
    doc,
    meta?.pageWidth || doc.internal.pageSize.getWidth(),
    pageHeight,
    meta?.watermark || null
  );
  let newY = DEFAULT_MARGIN;
  if (meta?.title && meta?.showTitleOnNewPages !== false) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(meta.title, DEFAULT_MARGIN, newY);
    newY += LINE_HEIGHT;
  }
  if (meta?.subtitle && meta?.showTitleOnNewPages !== false) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(meta.subtitle, DEFAULT_MARGIN, newY);
    newY += LINE_HEIGHT - 1;
  }
  doc.setDrawColor(230);
  doc.line(DEFAULT_MARGIN, newY, (meta?.pageWidth || doc.internal.pageSize.getWidth()) - DEFAULT_MARGIN, newY);
  return newY + 4;
};

export const addSectionTitle = (doc, cursorY, title, meta, rowsNeededAfter = 2) => {
  cursorY = addPageIfNeeded(doc, cursorY, meta, rowsNeededAfter + 1);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(20);
  doc.text(title, DEFAULT_MARGIN, cursorY);
  doc.setDrawColor(230);
  doc.line(DEFAULT_MARGIN, cursorY + 2, doc.internal.pageSize.getWidth() - DEFAULT_MARGIN, cursorY + 2);
  return cursorY + LINE_HEIGHT + 1;
};

export const addKeyValueRows = (doc, cursorY, rows, meta) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFontSize(10);
  rows.forEach(({ label, value }) => {
    cursorY = addPageIfNeeded(doc, cursorY, meta, 1);
    const isTotal = String(label || '').toLowerCase().includes('total') || String(label || '').toLowerCase().includes('net');
    doc.setFont('helvetica', isTotal ? 'bold' : 'normal');
    doc.text(`${label}:`, DEFAULT_MARGIN, cursorY);
    doc.text(String(value ?? ''), pageWidth - DEFAULT_MARGIN, cursorY, { align: 'right' });
    cursorY += LINE_HEIGHT;
  });
  return cursorY;
};

export const addSimpleTable = (doc, cursorY, columns, rows, meta) => {
  const startY = cursorY;
  const columnWidth = (doc.internal.pageSize.getWidth() - DEFAULT_MARGIN * 2) / columns.length;
  const numericColumns = columns.map(col => NUMERIC_COLUMN_PATTERN.test(String(col || '')));

  const tableTitle = meta?.tableTitle || null;
  const showTitleOnFirst = meta?.tableTitleShowOnFirst !== false;
  let headerCount = 0;
  const lineStep = LINE_HEIGHT - 1;
  const cellPaddingX = 1.5;
  const cellPaddingY = 1.5;
  const textWidth = Math.max(6, columnWidth - (cellPaddingX * 2));

  const wrapCell = (cell) => {
    const value = String(cell ?? '');
    const lines = doc.splitTextToSize(value, textWidth);
    if (Array.isArray(lines) && lines.length > 0) return lines;
    return [value];
  };

  const getBlockHeight = (lineMatrix) => {
    const maxLines = Math.max(1, ...lineMatrix.map(lines => lines.length));
    return (maxLines * lineStep) + (cellPaddingY * 2);
  };

  const drawLineMatrix = (lineMatrix, topY, useBoldFont = false) => {
    doc.setFont('helvetica', useBoldFont ? 'bold' : 'normal');
    lineMatrix.forEach((lines, idx) => {
      const leftX = DEFAULT_MARGIN + (idx * columnWidth) + cellPaddingX;
      const rightX = DEFAULT_MARGIN + ((idx + 1) * columnWidth) - cellPaddingX;
      const align = numericColumns[idx] || idx === lineMatrix.length - 1 ? 'right' : 'left';
      lines.forEach((line, lineIdx) => {
        const y = topY + cellPaddingY + ((lineIdx + 1) * lineStep);
        doc.text(String(line ?? ''), align === 'right' ? rightX : leftX, y, { align });
      });
    });
  };

  const headerLines = columns.map(col => wrapCell(col));
  const headerHeight = getBlockHeight(headerLines);

  const drawHeader = () => {
    headerCount += 1;
    const showTitle = tableTitle && (showTitleOnFirst || headerCount > 1);
    let headerTop = cursorY - 4;
    if (showTitle) {
      let titleY = headerTop - 6;
      const minTitleY = DEFAULT_MARGIN + (meta?.title || meta?.subtitle ? 12 : 6);
      if (titleY < minTitleY) {
        cursorY += 10;
        headerTop = cursorY - 4;
        titleY = headerTop - 6;
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(90);
      doc.text(tableTitle, DEFAULT_MARGIN, titleY);
      doc.setTextColor(20);
    }
    doc.setFontSize(9);
    doc.setFillColor(242, 244, 247);
    doc.rect(DEFAULT_MARGIN, headerTop, columnWidth * columns.length, headerHeight, 'F');
    drawLineMatrix(headerLines, headerTop, true);
    cursorY = headerTop + headerHeight + 2;
  };

  cursorY = addPageIfNeeded(
    doc,
    cursorY,
    meta,
    Math.ceil((headerHeight + LINE_HEIGHT) / LINE_HEIGHT)
  );
  drawHeader();

  rows.forEach((row) => {
    const label = row?.[0] ?? '';
    const isTotal = String(label).toLowerCase().includes('total') || String(label).toLowerCase().includes('net');
    const rowLines = columns.map((_, idx) => wrapCell(row?.[idx] ?? ''));
    const rowHeight = getBlockHeight(rowLines);

    const before = cursorY;
    cursorY = addPageIfNeeded(
      doc,
      cursorY,
      meta,
      Math.ceil((rowHeight + 2) / LINE_HEIGHT)
    );
    if (cursorY !== before) {
      drawHeader();
    }

    const rowTop = cursorY - 1;
    drawLineMatrix(rowLines, rowTop, isTotal);
    cursorY = rowTop + rowHeight + 1;
  });

  return cursorY;
};

export const savePdf = (doc, filename) => {
  doc.save(filename);
};
