(function (global) {
  function paintProfile(user, elements, initialsFor) {
    const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
    const displayName = fullName || user.email || 'Name not provided';
    elements.name.textContent = displayName;
    elements.email.textContent = user.email || '';
    elements.initials.textContent = initialsFor(user);
    elements.firstName.value = user.firstName || '';
    elements.lastName.value = user.lastName || '';
    elements.phone.value = user.phone || '';
  }

  function bindLogoutButton(button, { apiRequest, showStatus, navigate, confirmLogout } = {}) {
    if (!button || typeof apiRequest !== 'function' || typeof navigate !== 'function') return;
    const confirm = confirmLogout || (message => global.confirm(message));

    button.addEventListener('click', async () => {
      if (!confirm('Are you sure you want to logout?')) return;

      button.disabled = true;
      showStatus('Signing out…', 'info');
      try {
        await apiRequest('/api/auth/logout', { method: 'POST', body: {} });
        navigate('auth.html?tab=signup');
      } catch (error) {
        showStatus(`Could not log out: ${error.message || 'Please try again.'}`, 'error');
        button.disabled = false;
      }
    });
  }

  const profileUi = { bindLogoutButton, paintProfile };
  global.DigiTokenProfileUi = profileUi;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = profileUi;
  }
})(typeof window !== 'undefined' ? window : globalThis);
