// Theme + sticky header measurements.
(function () {
  // Keep secondary sticky controls flush beneath the header. Its rendered
  // height can change with platform safe areas and browser text metrics.
  var topbar = document.querySelector('.top');
  function syncStickyHeaderHeight() {
    document.documentElement.style.setProperty(
      '--sticky-header-height', topbar.getBoundingClientRect().height + 'px'
    );
  }
  syncStickyHeaderHeight();
  window.addEventListener('resize', syncStickyHeaderHeight, { passive: true });

  // ---- theme: respect the OS until the reader overrides it ----
  var saved = null;
  try { saved = localStorage.getItem('ti4-theme'); } catch (e) {}
  if (saved) document.documentElement.style.colorScheme = saved;
  document.getElementById('theme').addEventListener('click', function () {
    var dark = (document.documentElement.style.colorScheme ||
      (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')) === 'dark';
    var next = dark ? 'light' : 'dark';
    document.documentElement.style.colorScheme = next;
    try { localStorage.setItem('ti4-theme', next); } catch (e) {}
  });

  // ---- mobile navigation: native details with familiar outside/Escape dismissal ----
  var mobileMenu = document.querySelector('.mobile-menu');
  if (mobileMenu) {
    document.addEventListener('click', function (event) {
      if (mobileMenu.open && !mobileMenu.contains(event.target)) mobileMenu.open = false;
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && mobileMenu.open) {
        mobileMenu.open = false;
        mobileMenu.querySelector('summary').focus();
      }
    });
  }

})();

// ---- homepage stats report switcher ----
(function () {
  var tabs = [].slice.call(document.querySelectorAll('[data-stats-tab]'));
  if (!tabs.length) return;

  function activate(tab, moveFocus) {
    tabs.forEach(function (button) {
      var selected = button === tab;
      button.setAttribute('aria-selected', selected ? 'true' : 'false');
      button.tabIndex = selected ? 0 : -1;
      var panel = document.getElementById('report-' + button.getAttribute('data-stats-tab'));
      if (panel) panel.hidden = !selected;
    });
    if (moveFocus) tab.focus();
  }

  tabs.forEach(function (tab, index) {
    tab.addEventListener('click', function () { activate(tab, false); });
    tab.addEventListener('keydown', function (event) {
      var next = null;
      if (event.key === 'ArrowRight') next = tabs[(index + 1) % tabs.length];
      if (event.key === 'ArrowLeft') next = tabs[(index - 1 + tabs.length) % tabs.length];
      if (event.key === 'Home') next = tabs[0];
      if (event.key === 'End') next = tabs[tabs.length - 1];
      if (next) {
        event.preventDefault();
        activate(next, true);
      }
    });
  });
})();

// ---- Ω help: float above scrolling tables without being clipped ----
(function () {
  var activeMark = null;

  function positionTooltip(mark) {
    var tip = mark.querySelector('.omega-tooltip');
    if (!tip) return;
    var markRect = mark.getBoundingClientRect();
    var tipRect = tip.getBoundingClientRect();
    var margin = 16;
    var center = markRect.left + markRect.width / 2;
    center = Math.max(margin + tipRect.width / 2,
      Math.min(window.innerWidth - margin - tipRect.width / 2, center));
    var top = markRect.bottom + 8;
    if (top + tipRect.height > window.innerHeight - 12) {
      top = Math.max(12, markRect.top - tipRect.height - 8);
    }
    tip.style.left = center + 'px';
    tip.style.top = top + 'px';
  }

  document.querySelectorAll('.omega-mark').forEach(function (mark) {
    mark.addEventListener('pointerenter', function () {
      activeMark = mark;
      positionTooltip(mark);
    });
    mark.addEventListener('pointerleave', function () { activeMark = null; });
    mark.addEventListener('focus', function () {
      activeMark = mark;
      positionTooltip(mark);
    });
    mark.addEventListener('blur', function () { activeMark = null; });
  });

  window.addEventListener('resize', function () {
    if (activeMark) positionTooltip(activeMark);
  }, { passive: true });
  window.addEventListener('scroll', function () {
    if (activeMark) positionTooltip(activeMark);
  }, { passive: true, capture: true });
})();

// ---- strategy cards: compare the original faces with Thunder's Edge updates ----
(function () {
  var buttons = [].slice.call(document.querySelectorAll('[data-strategy-version]'));
  if (!buttons.length) return;

  function activate(version) {
    buttons.forEach(function (button) {
      button.setAttribute(
        'aria-pressed',
        button.getAttribute('data-strategy-version') === version ? 'true' : 'false'
      );
    });
    document.querySelectorAll('[data-strategy-copy]').forEach(function (copy) {
      copy.hidden = copy.getAttribute('data-strategy-copy') !== version;
    });
  }

  buttons.forEach(function (button) {
    button.addEventListener('click', function () {
      activate(button.getAttribute('data-strategy-version'));
    });
  });
})();

// ---- category filters: hide non-matching rows in the sections below ----
(function () {
  var bars = document.querySelectorAll('.filters');
  if (!bars.length) return;
  bars.forEach(function (bar) {
    bar.addEventListener('click', function (e) {
      var btn = e.target.closest('.f');
      if (!btn) return;
      bar.querySelectorAll('.f').forEach(function (b) { b.classList.remove('on'); });
      btn.classList.add('on');
      var want = btn.getAttribute('data-v');
      document.querySelectorAll('li[data-cat],tr[data-cat]').forEach(function (li) {
        li.hidden = Boolean(want) && li.getAttribute('data-cat') !== want;
      });
      // hide a section whose rows are now all filtered out
      document.querySelectorAll('.panel').forEach(function (p) {
        var rows = p.querySelectorAll('li[data-cat],tr[data-cat]');
        if (!rows.length) return;
        var any = [].some.call(rows, function (li) { return !li.hidden; });
        p.hidden = !any;
      });
    });
  });
})();
