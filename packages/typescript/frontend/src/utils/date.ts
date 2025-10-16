/**
 * Formats a date string or Date object to "Mon/DD HH:MM TZ" (local time zone).
 * Only displays the year if it's not the current year.
 * Month is a short string, hour is 24-hour format.
 */
export function formatLocalDateWithTZ(dateInput: string | Date): string {
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    const now = new Date();
    const isCurrentYear = date.getFullYear() === now.getFullYear();

    // Build date format options
    const dateOptions: Intl.DateTimeFormatOptions = {
        month: 'short', // Month as string
        day: '2-digit',
        ...(isCurrentYear ? {} : { year: 'numeric' })
    };

    const datePart = date.toLocaleDateString(undefined, dateOptions);
    const timePart = date.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false, // 24-hour format
    });

    return `${datePart}, ${timePart}`;
} 