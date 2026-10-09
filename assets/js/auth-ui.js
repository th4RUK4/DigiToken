(function (global) {
  function setClassActive(classList, className, isActive) {
    if (!classList) return;
    if (isActive) {
      if (typeof classList.add === 'function') classList.add(className);
      return;
    }
    if (typeof classList.remove === 'function') classList.remove(className);
  }

  function setActiveAuthTab(targetTab, tabs = [], sections = {}) {
    const tabList = Array.isArray(tabs) ? tabs : Object.values(tabs || {});
    tabList.forEach(tab => {
      const tabName = tab && tab.dataset ? tab.dataset.tab : null;
      const isActive = tabName === targetTab;
      setClassActive(tab && tab.classList, 'active', isActive);
      if (tab && typeof tab.setAttribute === 'function') {
        tab.setAttribute('aria-selected', String(isActive));
      }
      if (tab && 'tabIndex' in tab) tab.tabIndex = isActive ? 0 : -1;
    });

    Object.entries(sections).forEach(([sectionName, section]) => {
      const isActive = sectionName === targetTab;
      setClassActive(section && section.classList, 'active', isActive);
      if (section && 'hidden' in section) section.hidden = !isActive;
    });
  }

  function initAuthTabs(statusEl) {
    const tabs = Array.from(document.querySelectorAll('#main-tabs .tab'));
    const sections = {
      login: document.getElementById('view-login'),
      signup: document.getElementById('view-signup')
    };

    if (!tabs.length || !sections.login || !sections.signup) return;

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const targetTab = (tab.dataset && tab.dataset.tab) || 'login';
        setActiveAuthTab(targetTab, tabs, sections);

        if (global.DigiTokenApi && typeof global.DigiTokenApi.showStatus === 'function') {
          global.DigiTokenApi.showStatus(statusEl, '');
        }
      });

      tab.addEventListener('keydown', event => {
        const currentIndex = tabs.indexOf(tab);
        let nextIndex = currentIndex;
        if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabs.length;
        else if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
        else if (event.key === 'Home') nextIndex = 0;
        else if (event.key === 'End') nextIndex = tabs.length - 1;
        else return;

        event.preventDefault();
        tabs[nextIndex].focus();
        tabs[nextIndex].click();
      });
    });

    document.querySelectorAll('[data-auth-target]').forEach(control => {
      control.addEventListener('click', () => {
        const target = control.dataset.authTarget;
        setActiveAuthTab(target, tabs, sections);
        tabs.find(tab => tab.dataset.tab === target)?.focus();
        if (global.DigiTokenApi && typeof global.DigiTokenApi.showStatus === 'function') {
          global.DigiTokenApi.showStatus(statusEl, '');
        }
      });
    });

    const activeTab = tabs.find(tab => tab.classList.contains('active'))?.dataset?.tab || 'login';
    setActiveAuthTab(activeTab, tabs, sections);
  }

  const authUi = {
    setActiveAuthTab,
    initAuthTabs
  };

  global.DigiTokenAuth = authUi;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = authUi;
  }
})(typeof window !== 'undefined' ? window : globalThis);
