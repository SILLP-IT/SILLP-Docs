// --------------------------------------------------------------------------
// Report type tabs — blank landing screen with 3 centered options; picking
// one navigates into that report's form. A slim tab bar inside the form
// lets the user jump to a different report type or go back to the blank
// landing screen.
//
// Uses event delegation on document (not per-element listeners), so it
// keeps working even if this script runs before some elements exist, and
// avoids any "click does nothing" issue from stale bindings.
// --------------------------------------------------------------------------
(function () {
  function getPanels() {
    return {
      'architectural': document.getElementById('tab-architectural'),
      'multiple-issue': document.getElementById('tab-multiple-issue'),
      'periodic': document.getElementById('tab-periodic')
    };
  }

  function showLanding() {
    const landing = document.getElementById('tabLanding');
    const inFormNav = document.getElementById('reportTabs');
    const panels = getPanels();

    if (landing) landing.style.display = 'flex';
    if (inFormNav) inFormNav.style.display = 'none';

    Object.values(panels).forEach(panel => {
      if (!panel) return;
      panel.style.display = 'none';
      panel.classList.remove('active');
    });

    document.querySelectorAll('.report-tab').forEach(btn => {
      btn.classList.remove('active');
    });
  }

  function openReportTab(tabKey) {
    const panels = getPanels();
    if (!panels[tabKey]) return;

    const landing = document.getElementById('tabLanding');
    const inFormNav = document.getElementById('reportTabs');

    if (landing) landing.style.display = 'none';
    if (inFormNav) inFormNav.style.display = 'block';

    Object.keys(panels).forEach(key => {
      const panel = panels[key];
      if (!panel) return;
      if (key === tabKey) {
        panel.style.display = 'block';
        panel.classList.add('active');
      } else {
        panel.style.display = 'none';
        panel.classList.remove('active');
      }
    });

    document.querySelectorAll('.report-tab').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tabKey);
    });
  }

  // Exposed globally in case anything else needs to trigger a switch
  window.switchReportTab = openReportTab;
  window.showReportLanding = showLanding;

  // Single delegated listener — handles landing cards, in-form tabs, and
  // the back button, regardless of when/how they were added to the page.
  document.addEventListener('click', function (e) {
    const landingCard = e.target.closest('.tab-landing-card');
    if (landingCard) {
      e.preventDefault();
      openReportTab(landingCard.getAttribute('data-tab'));
      return;
    }

    const formTab = e.target.closest('#reportTabs .report-tab');
    if (formTab) {
      e.preventDefault();
      openReportTab(formTab.getAttribute('data-tab'));
      return;
    }

    const backBtn = e.target.closest('#reportTabsBack');
    if (backBtn) {
      e.preventDefault();
      showLanding();
      return;
    }
  });

  function init() {
    // Start on the blank landing screen with nothing else visible.
    showLanding();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();