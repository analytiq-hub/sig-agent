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
        date = new Date(dateInput);
    } else {
        date = dateInput;
    }
    
    // Check if the date is valid
    if (isNaN(date.getTime())) {
        console.warn('Invalid date input:', dateInput);
        return String(dateInput);
    }
    
    const now = new Date();
    const isCurrentYear = date.getFullYear() === now.getFullYear();

    // Build date format options
    const dateOptions: Intl.DateTimeFormatOptions = {
        month: 'short', // Month as string
        day: '2-digit',
        ...(isCurrentYear ? {} : { year: 'numeric' })
    };

    const datePart = date.toLocaleDateString(undefined, dateOptions);
    
    // Build time format options
    const timeOptions: Intl.DateTimeFormatOptions = {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false, // 24-hour format
        ...(displayMsec ? { fractionalSecondDigits: 3 } : {})
    };
    
    const timePart = date.toLocaleTimeString(undefined, timeOptions);

    return `${datePart}, ${timePart}`;
} 