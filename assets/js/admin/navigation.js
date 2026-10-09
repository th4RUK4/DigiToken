export function switchAdminTab(viewId, navEl) {
    document.querySelectorAll('.nav-item').forEach(item => {
        const isActive = item === navEl;
        item.classList.toggle('active', isActive);
        if (isActive) item.setAttribute('aria-current', 'page');
        else item.removeAttribute('aria-current');
    });

    document.querySelectorAll('.view-section').forEach(section => {
        section.classList.toggle('active', section.id === `view-${viewId}`);
    });
}
