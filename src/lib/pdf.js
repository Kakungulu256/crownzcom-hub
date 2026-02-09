import { jsPDF } from 'jspdf';

const DEFAULT_MARGIN = 14;
const LINE_HEIGHT = 6;

export const createPdfDoc = ({ title, subtitle, meta = [] } = {}) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let cursorY = DEFAULT_MARGIN;

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

  return { doc, cursorY };
};

export const addSectionTitle = (doc, cursorY, title) => {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(20);
  doc.text(title, DEFAULT_MARGIN, cursorY);
  doc.setDrawColor(230);
  doc.line(DEFAULT_MARGIN, cursorY + 2, doc.internal.pageSize.getWidth() - DEFAULT_MARGIN, cursorY + 2);
  return cursorY + LINE_HEIGHT + 1;
};

export const addKeyValueRows = (doc, cursorY, rows) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFontSize(10);
  rows.forEach(({ label, value }) => {
    const isTotal = String(label || '').toLowerCase().includes('total') || String(label || '').toLowerCase().includes('net');
    doc.setFont('helvetica', isTotal ? 'bold' : 'normal');
    doc.text(`${label}:`, DEFAULT_MARGIN, cursorY);
    doc.text(String(value ?? ''), pageWidth - DEFAULT_MARGIN, cursorY, { align: 'right' });
    cursorY += LINE_HEIGHT;
  });
  return cursorY;
};

export const addSimpleTable = (doc, cursorY, columns, rows) => {
  const startY = cursorY;
  const columnWidth = (doc.internal.pageSize.getWidth() - DEFAULT_MARGIN * 2) / columns.length;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setFillColor(242, 244, 247);
  doc.rect(DEFAULT_MARGIN, cursorY - 4, columnWidth * columns.length, LINE_HEIGHT, 'F');
  columns.forEach((col, idx) => {
    const x = DEFAULT_MARGIN + idx * columnWidth;
    const align = idx === columns.length - 1 ? 'right' : 'left';
    doc.text(col, x + (align === 'right' ? columnWidth - 2 : 0), cursorY, { align });
  });
  cursorY += LINE_HEIGHT - 1;

  rows.forEach((row) => {
    const label = row?.[0] ?? '';
    const isTotal = String(label).toLowerCase().includes('total') || String(label).toLowerCase().includes('net');
    doc.setFont('helvetica', isTotal ? 'bold' : 'normal');
    row.forEach((cell, idx) => {
      const x = DEFAULT_MARGIN + idx * columnWidth;
      const align = idx === row.length - 1 ? 'right' : 'left';
      doc.text(String(cell ?? ''), x + (align === 'right' ? columnWidth - 2 : 0), cursorY, { align });
    });
    cursorY += LINE_HEIGHT - 1;
  });

  return Math.max(cursorY, startY + LINE_HEIGHT);
};

export const savePdf = (doc, filename) => {
  doc.save(filename);
};
