/* 
   DigiToken - Main Script
   Handles Global Logic (Theme, Navigation Helpers)
*/

document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initSplash();
});

/* Theme Management */
function initTheme() {
    const themeToggleBtn = document.getElementById('theme-toggle');
    const storedTheme = localStorage.getItem('theme');
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    // Set initial theme
    if (storedTheme) {
        document.documentElement.setAttribute('data-theme', storedTheme);
        updateToggleIcon(storedTheme);
    } else if (systemDark) {
        document.documentElement.setAttribute('data-theme', 'dark');
        updateToggleIcon('dark');
    }

    // Toggle Listener
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

            document.documentElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
            updateToggleIcon(newTheme);
        });
    }
}


function updateToggleIcon(theme) {
    const btn = document.getElementById('theme-toggle');
    if (!btn) return;

    // Clear any previous icons/text as it's now a CSS switch
    btn.innerHTML = '';
    btn.setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`);
}

/* Splash Screen Logic */
function initSplash() {
    const splash = document.getElementById('splash-screen');
    if (splash) {
        setTimeout(() => {
            splash.style.opacity = '0';
            setTimeout(() => {
                splash.style.display = 'none';
            }, 500); // Wait for fade out
        }, 2000); // Display time
    }
}
