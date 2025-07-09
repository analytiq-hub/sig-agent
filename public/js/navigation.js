// Function to get the active section based on scroll position
function getActiveSection() {
    const sections = document.querySelectorAll('section[id]');
    let closest = null;
    let closestDistance = Infinity;
    
    sections.forEach(section => {
        const rect = section.getBoundingClientRect();
        // Consider a section "active" when its top is within 100px of the viewport top
        // or when it takes up most of the viewport
        const distance = Math.abs(rect.top - 100);
        if (distance < closestDistance) {
            closestDistance = distance;
            closest = section;
        }
    });
    
    return closest?.id;
}

// Function to update active navigation link
function updateActiveNav() {
    const activeId = getActiveSection();
    
    // Remove active class from all nav links
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    
    // Add active class to current section's nav link
    if (activeId) {
        const activeLink = document.querySelector(`a[href="#${activeId}"]`);
        if (activeLink) {
            activeLink.classList.add('active');
        }
    }
}

// Listen for scroll events
window.addEventListener('scroll', updateActiveNav);

// Initial check
updateActiveNav();

// Mobile menu toggle
const mobileMenuButton = document.getElementById('mobile-menu-button');
const mobileMenu = document.querySelector('.mobile-menu');

if (mobileMenuButton) {
    mobileMenuButton.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent click from bubbling to document
        mobileMenu.classList.toggle('show');
    });
}

// Handle all mobile menu link clicks
document.querySelectorAll('.mobile-menu .nav-link').forEach(link => {
    link.addEventListener('click', () => {
        mobileMenu.classList.remove('show');
        
        // Handle smooth scrolling for anchor links
        if (link.getAttribute('href').startsWith('#')) {
            const targetId = link.getAttribute('href').slice(1);
            const targetElement = document.getElementById(targetId);
            if (targetElement) {
                targetElement.scrollIntoView({ behavior: 'smooth' });
            }
        }
    });
});

// Close mobile menu when clicking outside
document.addEventListener('click', (e) => {
    if (mobileMenu.classList.contains('show') && 
        !mobileMenu.contains(e.target) && 
        !mobileMenuButton.contains(e.target)) {
        mobileMenu.classList.remove('show');
    }
});

if (mobileMenu) {
    // Prevent clicks inside mobile menu from closing it
    mobileMenu.addEventListener('click', (e) => {
        e.stopPropagation();
    }); 
}
