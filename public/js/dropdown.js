document.addEventListener('DOMContentLoaded', function() {
    // Initialize desktop dropdowns
    const dropdownButtons = document.querySelectorAll('.dropdown-button');
    
    dropdownButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            e.stopPropagation();
            const dropdownMenu = this.nextElementSibling;
            dropdownMenu.classList.toggle('hidden');
        });
    });
    
    // Close dropdowns when clicking outside
    document.addEventListener('click', function() {
        const dropdownMenus = document.querySelectorAll('.dropdown-menu');
        dropdownMenus.forEach(menu => {
            menu.classList.add('hidden');
        });
    });
    
    // Initialize mobile dropdowns
    const mobileDropdownButtons = document.querySelectorAll('.mobile-dropdown-button');
    
    mobileDropdownButtons.forEach(button => {
        button.addEventListener('click', function() {
            const content = this.nextElementSibling;
            const arrow = this.querySelector('svg');
            
            content.classList.toggle('hidden');
            arrow.classList.toggle('rotate-180');
        });
    });
});
