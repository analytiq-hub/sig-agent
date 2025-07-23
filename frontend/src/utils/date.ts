/**
 * Formats a date string or Date object to MM/DD/YYYY HH:MM TZ (local time zone).
 */
export function formatLocalDateWithTZ(dateInput: string | Date): string {
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    return date.toLocaleDateString(undefined, {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric'
    }) + ' ' + date.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    });
  } 