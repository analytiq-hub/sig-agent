function openCalendly() {
    // Check if we're on mobile
    const isMobile = window.innerWidth <= 768;
    
    if (isMobile) {
        // For mobile, redirect to Calendly URL directly
        // Replace with your actual Calendly URL
        const calendlyUrl = 'https://calendly.com/analytiqhub';
        window.location.href = calendlyUrl;
    } else {
        // For desktop, use Calendly widget (if you want to implement it)
        // This would require the Calendly widget script
        window.open('https://calendly.com/analytiqhub', '_blank', 'width=800,height=600,scrollbars=yes,resizable=yes');
    }
}