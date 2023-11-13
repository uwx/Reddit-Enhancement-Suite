const escapeLookups = {
  '&': '&amp;',
  '"': '&quot;',
  "'": '&apos;',
  // eslint-disable-line quotes
  '<': '&lt;',
  '>': '&gt;',
  '/': '&#47;'
};
export function escapeHTML(str: string | null | undefined): string {
  return str ? str.toString().replace(/[&"'<>\/]/g, m => escapeLookups[m]) : '';
}