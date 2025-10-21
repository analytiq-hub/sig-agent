/**
 * Formats a date string, Date object, or Unix timestamp to "Mon/DD HH:MM TZ" (local time zone).
 * Only displays the year if it's not the current year.
 * Month is a short string, hour is 24-hour format.
 * 
 * @param dateInput - Date in string format, Date object, or Unix timestamp (number)
 * @param displayMsec - Whether to display milliseconds (default: false)
 */
export function formatLocalDateWithTZ(dateInput: string | Date | number, displayMsec: boolean = false): string {
    let date: Date;
    
    // Handle different input types
    if (typeof dateInput === 'number') {
        // Unix timestamp - check if it's in seconds or milliseconds
        date = new Date(dateInput < 1e10 ? dateInput * 1000 : dateInput);
    } else if (typeof dateInput === 'string') {
        // Ensure proper UTC parsing for ISO strings
        if (dateInput.includes('T') && !dateInput.includes('Z') && !dateInput.includes('+')) {
            // If it's an ISO string without timezone info, assume UTC
            date = new Date(dateInput + 'Z');
        } else {
            date = new Date(dateInput);
        }
    } else {
        date = dateInput;
    }
    
    // Check if the date is valid
    if (isNaN(date.getTime())) {
        console.warn('Invalid date input:', dateInput);
        return String(dateInput);
    }
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const logDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const isToday = logDate.getTime() === today.getTime();
    const isCurrentYear = date.getFullYear() === now.getFullYear();

    // Build time format options
    const timeOptions: Intl.DateTimeFormatOptions = {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false, // 24-hour format
        ...(displayMsec ? { fractionalSecondDigits: 3 } : {})
    };
    
    const timePart = date.toLocaleTimeString(undefined, timeOptions);

    // If it's today, show only time
    if (isToday) {
        return timePart;
    }

    // For other dates, show date and time
    const dateOptions: Intl.DateTimeFormatOptions = {
        month: 'short', // Month as string
        day: '2-digit',
        ...(isCurrentYear ? {} : { year: 'numeric' })
    };

    const datePart = date.toLocaleDateString(undefined, dateOptions);
    return `${datePart}, ${timePart}`;
} 