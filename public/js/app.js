// Search + theme. No dependencies; the index is a single small JSON file.
(function () {
  var root = document.querySelector('.brand').getAttribute('href');

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

  // ---- search ----
  var input = document.getElementById('q');
  var panel = document.getElementById('results');
  var docs = null, loading = false;

  function load() {
    if (docs || loading) return Promise.resolve();
    loading = true;
    return fetch(root + 'js/search-index.json')
      .then(function (r) { return r.json(); })
      .then(function (d) { docs = d; });
  }

  // subsequence match so "grav dr" finds "Gravity Drive"
  function score(title, q) {
    var t = title.toLowerCase();
    if (t === q) return 0;
    if (t.indexOf(q) === 0) return 1;
    var i = t.indexOf(q);
    if (i > 0) return 2 + i / 100;
    var pos = 0;
    for (var c = 0; c < q.length; c++) {
      if (q[c] === ' ') continue;
      pos = t.indexOf(q[c], pos);
      if (pos < 0) return -1;
      pos++;
    }
    return 50;
  }

  function render(q) {
    if (!q) { panel.hidden = true; panel.innerHTML = ''; return; }
    var hits = [];
    for (var i = 0; i < docs.length; i++) {
      var s = score(docs[i].t, q);
      if (s >= 0) hits.push([s, docs[i]]);
    }
    hits.sort(function (a, b) { return a[0] - b[0] || a[1].t.localeCompare(b[1].t); });
    panel.hidden = false;
    if (!hits.length) {
      panel.innerHTML = '<p class="empty">Nothing matches “' +
        q.replace(/[<&]/g, '') + '”.</p>';
      return;
    }
    var html = '<ul>';
    for (var j = 0; j < Math.min(hits.length, 40); j++) {
      var d = hits[j][1];
      html += '<li><a href="' + root + d.u + '"><span>' + d.t +
              '</span><span class="k">' + d.k + '</span></a></li>';
    }
    panel.innerHTML = html + '</ul>';
  }

  input.addEventListener('input', function () {
    var q = input.value.trim().toLowerCase();
    if (!q) return render('');
    load().then(function () { render(q); });
  });
  input.addEventListener('focus', load);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { input.value = ''; render(''); input.blur(); }
    if (e.key === '/' && document.activeElement !== input) { e.preventDefault(); input.focus(); }
  });
})();
