/**
 * Loads the navigation component with the appropriate root path
 * @param {string} rootPath - The root path to prepend to navigation links (e.g., "" for root, "../" for subdirectories)
 */
function loadNavigation(rootPath) {
    // Create a default root path if none is provided
    rootPath = rootPath || "";
    
    // Get the navigation container
    const navContainer = document.getElementById('nav-container');
    if (!navContainer) {
        console.error("Navigation container not found");
        return;
    }
    
    // Fetch the navigation template
    fetch(rootPath + 'components/sticky_nav.html')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.text();
        })
        .then(html => {
            // Replace the rootPath placeholder with the actual value
            html = html.replace(/\{\{rootPath\}\}/g, rootPath);
            
            // Insert the modified HTML into the container
            navContainer.innerHTML = html;
            
            // Make sure the nav has the sticky class - important!
            const navElement = navContainer.querySelector('nav');
            if (navElement && !navElement.classList.contains('sticky')) {
                navElement.classList.add('sticky', 'top-0', 'z-50');
            }
            
            // Re-initialize navigation event listeners
            const mobileMenuButton = document.getElementById('mobile-menu-button');
            const mobileMenu = document.querySelector('.mobile-menu');
            
            if (mobileMenuButton && mobileMenu) {
                mobileMenuButton.addEventListener('click', (e) => {
                    e.stopPropagation();
                    mobileMenu.classList.toggle('show');
                });
                
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
                
                // Prevent clicks inside mobile menu from closing it
                mobileMenu.addEventListener('click', (e) => {
                    e.stopPropagation();
                });
            }
            
            // Initialize the active nav state
            updateActiveNav();
        })
        .catch(error => {
            console.error('Error loading navigation:', error);
            navContainer.innerHTML = `<div class="bg-red-100 p-4 rounded">Error loading navigation. Please start a local server.</div>`;
        });
}

// Make sure we have this function defined or imported
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

// Helper function to get active section
function getActiveSection() {
    const sections = document.querySelectorAll('section[id]');
    let closest = null;
    let closestDistance = Infinity;
    
    sections.forEach(section => {
        const rect = section.getBoundingClientRect();
        const distance = Math.abs(rect.top - 100);
        if (distance < closestDistance) {
            closestDistance = distance;
            closest = section;
        }
    });
    
    return closest?.id;
}