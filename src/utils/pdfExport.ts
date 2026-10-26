/**
 * PDF Export Utility for Tutorly Reports
 * Generates an executive, print-optimized document styled with Tutorly branding,
 * headers, metadata, summary statistics, and clean paginated data tables.
 * Triggers native high-fidelity PDF printing via an isolated print frame.
 */

export interface PDFExportColumn {
  header: string;
  key: string;
  align?: 'left' | 'center' | 'right';
  format?: (value: any, row: any) => string;
}

export interface PDFExportOptions {
  title: string;
  subtitle?: string;
  institutionName?: string;
  generatedBy?: string;
  metadata?: { label: string; value: string }[];
  summaryStats?: { label: string; value: string | number }[];
  columns: PDFExportColumn[];
  rows: Record<string, any>[];
  filename?: string;
}

export function exportReportToPDF(options: PDFExportOptions): void {
  const {
    title,
    subtitle = 'Administrative Academic & Operational Report',
    institutionName = 'Tutorly Learning Academy',
    generatedBy = 'Administrator',
    metadata = [],
    summaryStats = [],
    columns,
    rows
  } = options;

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
  const timeStr = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });

  const metadataHtml = metadata.length > 0 ? `
    <div class="metadata-grid">
      ${metadata.map(m => `
        <div class="meta-item">
          <span class="meta-label">${m.label}:</span>
          <span class="meta-value">${m.value}</span>
        </div>
      `).join('')}
    </div>
  ` : '';

  const summaryHtml = summaryStats.length > 0 ? `
    <div class="summary-cards">
      ${summaryStats.map(s => `
        <div class="summary-card">
          <div class="summary-val">${s.value}</div>
          <div class="summary-lbl">${s.label}</div>
        </div>
      `).join('')}
    </div>
  ` : '';

  const tableHeaderHtml = `
    <thead>
      <tr>
        <th style="width: 40px; text-align: center;">#</th>
        ${columns.map(col => `
          <th style="text-align: ${col.align || 'left'};">${col.header}</th>
        `).join('')}
      </tr>
    </thead>
  `;

  const tableBodyHtml = `
    <tbody>
      ${rows.map((row, idx) => `
        <tr>
          <td style="text-align: center; color: #64748B;">${idx + 1}</td>
          ${columns.map(col => {
            const rawVal = row[col.key];
            const displayVal = col.format ? col.format(rawVal, row) : (rawVal !== undefined && rawVal !== null ? String(rawVal) : '—');
            return `<td style="text-align: ${col.align || 'left'};">${displayVal}</td>`;
          }).join('')}
        </tr>
      `).join('')}
    </tbody>
  `;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${title} - ${institutionName}</title>
      <style>
        @page {
          size: A4 portrait;
          margin: 15mm 15mm 15mm 15mm;
        }
        * {
          box-sizing: border-box;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          color: #0F172A;
          background: #FFFFFF;
          margin: 0;
          padding: 24px;
          font-size: 11pt;
          line-height: 1.4;
        }
        .header-container {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          border-bottom: 2px solid #4F46E5;
          padding-bottom: 16px;
          margin-bottom: 16px;
        }
        .brand-title {
          font-size: 20pt;
          font-weight: 800;
          color: #4F46E5;
          letter-spacing: -0.5px;
          margin: 0;
        }
        .brand-sub {
          font-size: 10pt;
          color: #64748B;
          margin-top: 2px;
        }
        .report-title {
          font-size: 15pt;
          font-weight: 700;
          color: #1E293B;
          margin: 12px 0 4px 0;
        }
        .report-sub {
          font-size: 10pt;
          color: #64748B;
          margin: 0;
        }
        .gen-info {
          text-align: right;
          font-size: 9pt;
          color: #64748B;
        }
        .gen-info strong {
          color: #334155;
        }
        .metadata-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 12px 24px;
          background: #F8FAFC;
          border: 1px solid #E2E8F0;
          border-radius: 6px;
          padding: 10px 14px;
          margin-bottom: 16px;
          font-size: 9.5pt;
        }
        .meta-item {
          display: flex;
          gap: 6px;
        }
        .meta-label {
          color: #64748B;
          font-weight: 500;
        }
        .meta-value {
          color: #0F172A;
          font-weight: 600;
        }
        .summary-cards {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
          gap: 10px;
          margin-bottom: 18px;
        }
        .summary-card {
          background: #EEF2FF;
          border: 1px solid #C7D2FE;
          border-radius: 6px;
          padding: 8px 12px;
          text-align: center;
        }
        .summary-val {
          font-size: 16pt;
          font-weight: 700;
          color: #4338CA;
          line-height: 1.1;
        }
        .summary-lbl {
          font-size: 8.5pt;
          color: #475569;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-top: 4px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 8px;
          font-size: 9.5pt;
        }
        thead {
          display: table-header-group;
        }
        tr {
          page-break-inside: avoid;
        }
        th {
          background: #F1F5F9;
          color: #334155;
          font-weight: 700;
          padding: 8px 10px;
          border: 1px solid #CBD5E1;
          font-size: 9pt;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }
        td {
          padding: 7px 10px;
          border: 1px solid #E2E8F0;
          color: #1E293B;
        }
        tbody tr:nth-child(even) {
          background: #F8FAFC;
        }
        .footer-note {
          margin-top: 24px;
          padding-top: 12px;
          border-top: 1px solid #E2E8F0;
          display: flex;
          justify-content: space-between;
          font-size: 8.5pt;
          color: #94A3B8;
        }
      </style>
    </head>
    <body>
      <div class="header-container">
        <div>
          <div class="brand-title">Tutorly</div>
          <div class="brand-sub">${institutionName}</div>
          <div class="report-title">${title}</div>
          <div class="report-sub">${subtitle}</div>
        </div>
        <div class="gen-info">
          <div><strong>Generated:</strong> ${dateStr} ${timeStr}</div>
          <div><strong>Officer:</strong> ${generatedBy}</div>
          <div><strong>Total Records:</strong> ${rows.length}</div>
        </div>
      </div>

      ${metadataHtml}
      ${summaryHtml}

      <table>
        ${tableHeaderHtml}
        ${tableBodyHtml}
      </table>

      <div class="footer-note">
        <span>Confidential & Proprietary • Tutorly Tuition Management Platform</span>
        <span>Generated from Live Operational Database</span>
      </div>

      <script>
        window.onload = function() {
          setTimeout(function() {
            window.focus();
            window.print();
          }, 300);
        };
      </script>
    </body>
    </html>
  `;

  // Create an isolated hidden iframe for pristine printing without disturbing current DOM
  let iframe = document.getElementById('tutorly-pdf-print-frame') as HTMLIFrameElement;
  if (!iframe) {
    iframe = document.createElement('iframe');
    iframe.id = 'tutorly-pdf-print-frame';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    iframe.style.visibility = 'hidden';
    document.body.appendChild(iframe);
  }

  const doc = iframe.contentWindow?.document || iframe.contentDocument;
  if (doc) {
    doc.open();
    doc.write(html);
    doc.close();
  }
}
