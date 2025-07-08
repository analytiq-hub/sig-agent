function loadFounderBio() {
    // Determine the correct path to assets based on current page location
    const currentPath = window.location.pathname;
    
    // Count how many levels deep we are from the root
    const pathSegments = currentPath.split('/').filter(segment => segment !== '');
    const depthFromRoot = pathSegments.length;
    
    // Build the path to root by going up the appropriate number of levels
    const pathToRoot = '../'.repeat(depthFromRoot);
    
    const founderBioHTML = `
        <section class="bg-white rounded-lg shadow-lg p-8 mb-12">
            <div class="text-center">
                <div class="flex flex-col items-center">
                    <img src="${pathToRoot}assets/andrei.jpg" alt="Andrei Radulescu-Banu" class="w-20 h-20 rounded-full mb-4 border-4 border-blue-200 shadow-md">
                    <h2 class="text-2xl font-semibold text-gray-900 mb-2">Meet the Founder</h2>
                    <p class="text-gray-700 mb-2">
                        <strong>Andrei Radulescu-Banu</strong> is the founder and hands-on architect of DocRouter.AI, with 20+ years of experience building AI-powered automation for regulated industries. A PhD in Mathematics from MIT and former Staff Software Engineer at isee ai (self-driving cars), Andrei has architected ML infrastructure and human-in-the-loop systems for fintech, health tech, and robotics applications.
                    </p>
                    <p class="text-gray-700 mb-2">
                        Andrei's mission: deliver reliable, human-in-the-loop AI that cuts processing time by 90% while eliminating manual errors.
                    </p>
                    <a href="https://www.linkedin.com/in/andrei-radulescu-banu/" target="_blank" class="text-blue-600 hover:text-blue-800 underline">View LinkedIn Profile</a>
                </div>
            </div>
        </section>
    `;
    
    // Find the div with class="team-bio" and insert the content
    const teamBioDiv = document.querySelector('.team-bio');
    if (teamBioDiv) {
        teamBioDiv.innerHTML = founderBioHTML;
    }
}

// Load when DOM is ready
document.addEventListener('DOMContentLoaded', loadFounderBio);
