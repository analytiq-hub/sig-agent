function openVideoModal() {
    // This function is no longer needed, as we're directly linking to YouTube
    window.open("https://www.youtube.com/watch?v=CDH4oan2Nc8", "_blank");
}

function closeVideoModal() {
    try {
        const modal = document.getElementById('videoModal');
        const videoFrame = document.getElementById('videoFrame');
        
        // Clear the iframe source to stop video playback
        videoFrame.src = "";
        modal.style.display = "none";
        
        // Re-enable scrolling
        document.body.style.overflow = "auto";
    } catch (error) {
        console.error("Error closing video modal:", error);
    }
}

// Close modal when clicking outside of it
window.addEventListener('click', function(event) {
    const modal = document.getElementById('videoModal');
    if (event.target == modal) {
        closeVideoModal();
    }
});

// Close modal with Escape key
window.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        closeVideoModal();
    }
}); 