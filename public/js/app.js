// Header controls + sticky header measurements.
(function () {
  var root = document.querySelector('.brand').getAttribute('href');

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

  // ---- search: load the small generated index only when requested ----
  var searchShell = document.querySelector('.search-shell');
  var searchToggle = document.getElementById('search-toggle');
  var searchPopover = document.getElementById('site-search');
  var searchClose = document.getElementById('search-close');
  var searchForm = document.querySelector('.search-form');
  var input = document.getElementById('q');
  var panel = document.getElementById('results');
  var docs = null;
  var loading = false;

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (character) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character];
    });
  }

  function loadSearchIndex() {
    if (docs) return Promise.resolve(docs);
    if (loading) return loading;
    loading = fetch(root + 'js/search-index.json')
      .then(function (response) {
        if (!response.ok) throw new Error('Search index request failed');
        return response.json();
      })
      .then(function (data) {
        docs = data;
        return docs;
      })
      .catch(function () {
        loading = false;
        panel.hidden = false;
        panel.innerHTML = '<p class="search-empty">Search could not load. Please try again.</p>';
        return [];
      });
    return loading;
  }

  // Subsequence matching means “grav dr” still finds “Gravity Drive.”
  function score(value, query) {
    var text = value.toLowerCase();
    if (text === query) return 0;
    if (text.indexOf(query) === 0) return 1;
    var index = text.indexOf(query);
    if (index > 0) return 2 + index / 100;
    if (query.indexOf(' ') < 0) return -1;
    var position = 0;
    for (var character = 0; character < query.length; character++) {
      if (query[character] === ' ') continue;
      position = text.indexOf(query[character], position);
      if (position < 0) return -1;
      position++;
    }
    return 50;
  }

  function renderSearch(query) {
    if (!query) {
      panel.hidden = true;
      panel.innerHTML = '';
      return;
    }
    var hits = [];
    for (var index = 0; index < docs.length; index++) {
      var titleScore = score(docs[index].t, query);
      var kindScore = score(docs[index].k, query);
      var resultScore = titleScore >= 0 ? titleScore : (kindScore >= 0 ? 70 + kindScore : -1);
      if (resultScore >= 0) hits.push([resultScore, docs[index]]);
    }
    hits.sort(function (a, b) {
      return a[0] - b[0] || a[1].t.localeCompare(b[1].t);
    });
    panel.hidden = false;
    if (!hits.length) {
      panel.innerHTML = '<p class="search-empty">Nothing matches “' +
        escapeHtml(input.value.trim()) + '”.</p>';
      return;
    }
    var html = '<ul>';
    for (var hit = 0; hit < Math.min(hits.length, 30); hit++) {
      var item = hits[hit][1];
      html += '<li><a href="' + root + escapeHtml(item.u) + '"><span>' +
        escapeHtml(item.t) + '</span><span class="search-kind">' +
        escapeHtml(item.k) + '</span></a></li>';
    }
    panel.innerHTML = html + '</ul>';
  }

  function openSearch() {
    searchPopover.hidden = false;
    searchShell.classList.add('open');
    searchToggle.setAttribute('aria-expanded', 'true');
    searchToggle.setAttribute('aria-label', 'Close search');
    loadSearchIndex();
    window.requestAnimationFrame(function () { input.focus(); });
  }

  function closeSearch(restoreFocus) {
    searchPopover.hidden = true;
    searchShell.classList.remove('open');
    searchToggle.setAttribute('aria-expanded', 'false');
    searchToggle.setAttribute('aria-label', 'Open search');
    if (restoreFocus) searchToggle.focus();
  }

  searchToggle.addEventListener('click', function () {
    if (searchPopover.hidden) openSearch();
    else closeSearch(false);
  });
  searchClose.addEventListener('click', function () { closeSearch(true); });
  searchForm.addEventListener('submit', function (event) { event.preventDefault(); });
  input.addEventListener('focus', loadSearchIndex);
  input.addEventListener('input', function () {
    var query = input.value.trim().toLowerCase();
    if (!query) return renderSearch('');
    loadSearchIndex().then(function () { renderSearch(query); });
  });
  input.addEventListener('keydown', function (event) {
    if (event.key !== 'ArrowDown') return;
    var firstResult = panel.querySelector('a');
    if (firstResult) {
      event.preventDefault();
      firstResult.focus();
    }
  });
  panel.addEventListener('keydown', function (event) {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    var links = [].slice.call(panel.querySelectorAll('a'));
    var current = links.indexOf(document.activeElement);
    var next = event.key === 'ArrowDown' ? current + 1 : current - 1;
    if (next >= 0 && next < links.length) {
      event.preventDefault();
      links[next].focus();
    } else if (event.key === 'ArrowUp' && current === 0) {
      event.preventDefault();
      input.focus();
    }
  });
  document.addEventListener('click', function (event) {
    if (!searchPopover.hidden && !searchShell.contains(event.target)) closeSearch(false);
  });
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && !searchPopover.hidden) {
      event.preventDefault();
      closeSearch(true);
    }
    if (event.key === '/' && document.activeElement !== input &&
        !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) {
      event.preventDefault();
      openSearch();
    }
  });

  // Search links to FAQ entries reveal the answer as well as scrolling to it.
  function revealHashTarget() {
    if (!window.location.hash) return;
    var target = document.getElementById(decodeURIComponent(window.location.hash.slice(1)));
    if (target && target.tagName === 'DETAILS') target.open = true;
  }
  revealHashTarget();
  window.addEventListener('hashchange', revealHashTarget);

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
