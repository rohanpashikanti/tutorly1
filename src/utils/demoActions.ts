/**
 * Demo Action Utilities for Tutorly
 * Provides genuine local file downloads (CSV, JSON, sample docs),
 * browser printing, and honest simulated messaging/payment notifications.
 */

/**
 * Downloads a genuine CSV file directly in the browser.
 * Supports either an array of objects Record<string, any>[] OR (headers, rows).
 */
export function downloadCSV(
  filename: string,
  headersOrData: string[] | Record<string, any>[],
  maybeRows?: (string | number | boolean)[][]
): void {
  const sanitize = (val: unknown): string => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  let headerRow = '';
  let bodyRows = '';

  if (
    Array.isArray(headersOrData) &&
    headersOrData.length > 0 &&
    typeof headersOrData[0] === 'object' &&
    !Array.isArray(headersOrData[0])
  ) {
    // Array of objects
    const objects = headersOrData as Record<string, any>[];
    const keys = Object.keys(objects[0]);
    headerRow = keys.map(sanitize).join(',');
    bodyRows = objects.map((obj) => keys.map((k) => sanitize(obj[k])).join(',')).join('\n');
  } else if (Array.isArray(headersOrData) && Array.isArray(maybeRows)) {
    // Headers and rows
    const headers = headersOrData as string[];
    headerRow = headers.map(sanitize).join(',');
    bodyRows = maybeRows.map((row) => row.map(sanitize).join(',')).join('\n');
  } else {
    headerRow = 'Notice';
    bodyRows = '"No records to export"';
  }

  const csvContent = '\uFEFF' + headerRow + '\n' + bodyRows;
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Downloads a genuine JSON file directly in the browser
 */
export function downloadJSON(filename: string, data: unknown): void {
  const jsonContent = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename.endsWith('.json') ? filename : `${filename}.json`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Downloads a sample document/receipt text/markdown file
 */
export function downloadSampleDocument(title: string, content: string, extension = 'txt'): void {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${title.toLowerCase().replace(/[^a-z0-9]+/g, '_')}.${extension}`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Triggers standard browser print dialog
 */
export function triggerPrint(): void {
  window.print();
}

/**
 * Formats an honest feedback message for external service dependencies (SMS, WhatsApp, Gateway)
 */
export function getIntegrationFeedback(
  service: 'SMS' | 'WhatsApp' | 'Email' | 'Payment Gateway' | 'Cloud Storage',
  actionDescription: string
): { message: string; type: 'info' | 'warning' } {
  return {
    message: `[Demo] ${actionDescription} simulated. Live ${service} provider integration required in production.`,
    type: 'info'
  };
}
