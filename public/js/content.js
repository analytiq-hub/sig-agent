function toggleUseCase(id) {
    const content = document.getElementById(`${id}-content`);
    const arrow = document.getElementById(`${id}-arrow`);
    const button = arrow.closest('button');
    
    content.classList.toggle('hidden');
    arrow.classList.toggle('rotate-180');
    
    // Toggle rounded bottom corners on button
    if (content.classList.contains('hidden')) {
        button.classList.remove('rounded-t-lg');
        button.classList.add('rounded-lg');
    } else {
        button.classList.remove('rounded-lg');
        button.classList.add('rounded-t-lg');
    }
} 