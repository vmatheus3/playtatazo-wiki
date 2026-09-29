/* TATAZO Wiki: instant search, the day/night switch, the phone menu, the creature filters, and filtering and sorting tables.
   Everything runs in the page; nothing is sent anywhere. The search index is a local file
   (assets/search-index.js) loaded the first time the search box is used. */
(function () {
  'use strict';

  var root = document.documentElement.getAttribute('data-root') || '';
  var index = null;
  var loading = false;
  var waiting = [];

  function fold(s) {
    return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9%+.' -]/g, ' ');
  }

  function loadIndex(done) {
    if (index) { done(); return; }
    waiting.push(done);
    if (loading) return;
    loading = true;
    var s = document.createElement('script');
    s.src = root + 'assets/search-index.js' + (document.documentElement.getAttribute('data-sv') ? '?v=' + document.documentElement.getAttribute('data-sv') : '');
    s.onload = function () {
      index = (window.WIKI_INDEX || []).map(function (e) {
        return { t: e[0], u: e[1], k: e[2], s: e[3] || '', w: e[4] || '', ft: fold(e[0]), fw: fold(e[4] || '') + ' ' + fold(e[3] || '') };
      });
      var w = waiting; waiting = [];
      w.forEach(function (f) { f(); });
    };
    s.onerror = function () { loading = false; };
    document.head.appendChild(s);
  }

  function search(q, limit) {
    var words = fold(q).split(/\s+/).filter(Boolean);
    if (!words.length || !index) return [];
    var out = [];
    for (var i = 0; i < index.length; i++) {
      var e = index[i];
      var score = 0;
      var ok = true;
      for (var j = 0; j < words.length; j++) {
        var w = words[j];
        var p = e.ft.indexOf(w);
        if (p === 0) score += 12;
        else if (p > 0 && e.ft.charAt(p - 1) === ' ') score += 8;
        else if (p > 0) score += 4;
        else if (e.fw.indexOf(w) >= 0) score += 2;
        else { ok = false; break; }
      }
      if (!ok) continue;
      if (e.ft === fold(q)) score += 30;
      score -= e.t.length * 0.02;
      out.push({ e: e, s: score });
    }
    out.sort(function (a, b) { return b.s - a.s || a.e.t.localeCompare(b.e.t); });
    return limit ? out.slice(0, limit) : out;
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
  }

  function setupSearch(form) {
    var input = form.querySelector('input');
    var box = form.querySelector('.results');
    var cur = -1;
    var links = [];

    function render() {
      var q = input.value.trim();
      if (!q) { box.hidden = true; return; }
      loadIndex(function () {
        var hits = search(q, 12);
        if (!hits.length) {
          box.innerHTML = '<div class="none">Nothing found for “' + esc(q) + '”. Try a shorter word.</div>';
        } else {
          box.innerHTML = hits.map(function (h) {
            return '<a href="' + root + h.e.u + '"><span><b>' + esc(h.e.t) + '</b><small>' + esc(h.e.s) + '</small></span><span class="k">' + esc(h.e.k) + '</span></a>';
          }).join('') + '<a class="more" href="' + root + 'search.html?q=' + encodeURIComponent(q) + '">All results for “' + esc(q) + '”</a>';
        }
        links = Array.prototype.slice.call(box.querySelectorAll('a'));
        cur = -1;
        box.hidden = false;
      });
    }

    input.addEventListener('input', render);
    input.addEventListener('focus', function () { loadIndex(function () {}); if (input.value.trim()) render(); });
    input.addEventListener('keydown', function (ev) {
      if (box.hidden) return;
      if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
        ev.preventDefault();
        if (!links.length) return;
        cur = (cur + (ev.key === 'ArrowDown' ? 1 : -1) + links.length) % links.length;
        links.forEach(function (a, i) { a.classList.toggle('on', i === cur); });
        links[cur].scrollIntoView({ block: 'nearest' });
      } else if (ev.key === 'Enter') {
        var go = cur >= 0 ? links[cur] : links[0];
        if (go && !go.classList.contains('more')) { ev.preventDefault(); window.location.href = go.href; }
      } else if (ev.key === 'Escape') {
        box.hidden = true;
      }
    });
    document.addEventListener('click', function (ev) {
      if (!form.contains(ev.target)) box.hidden = true;
    });
  }

  function setupSearchPage() {
    var out = document.getElementById('search-page');
    if (!out) return;
    var q = new URLSearchParams(window.location.search).get('q') || '';
    var input = document.querySelector('.top .search input');
    if (input) input.value = q;
    if (!q.trim()) { out.innerHTML = '<section class="panel apanel"><p>Type a word in the search box above: an item, a creature, a place, a guide or a tale.</p></section>'; return; }
    out.innerHTML = '<section class="panel apanel"><p>Searching…</p></section>';
    loadIndex(function () {
      var hits = search(q, 0);
      document.title = 'Search: ' + q + ' · TATAZO Wiki';
      if (!hits.length) { out.innerHTML = '<section class="panel apanel"><p>Nothing found for “' + esc(q) + '”. Try a shorter or different word.</p></section>'; return; }
      var groups = {};
      var order = [];
      hits.forEach(function (h) {
        if (!groups[h.e.k]) { groups[h.e.k] = []; order.push(h.e.k); }
        groups[h.e.k].push(h.e);
      });
      // One framed panel a kind, with the home page's rows (gem, title, line, chevron).
      out.innerHTML = '<p class="found">' + hits.length + ' result' + (hits.length === 1 ? '' : 's') + ' for “' + esc(q) + '”.</p>' + order.map(function (k) {
        return '<section class="panel apanel"><h2 class="line-h">' + esc(k) + ' <span class="count">' + groups[k].length + '</span></h2><ul class="rows found-rows">' + groups[k].map(function (e) {
          return '<li><a href="' + root + e.u + '"><span class="gem"></span><span class="t"><b>' + esc(e.t) + '</b><small>' + esc(e.s) + '</small></span><span class="chev" aria-hidden="true"></span></a></li>';
        }).join('') + '</ul></section>';
      }).join('');
    });
  }

  function setupTheme() {
    var btn = document.querySelector('.theme');
    if (!btn) return;
    // The day look is the default (the approved design); the night look is a choice kept in this browser.
    function current() { return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'; }
    function label() {
      var dark = current() === 'dark';
      btn.setAttribute('aria-label', dark ? 'Switch to the day look' : 'Switch to the night look');
      btn.title = btn.getAttribute('aria-label');
    }
    label();
    btn.addEventListener('click', function () {
      var next = current() === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      try { localStorage.setItem('wiki-theme', next); } catch (e) { /* private window: fine */ }
      label();
    });
  }

  function setupMenu() {
    var burger = document.querySelector('.burger');
    var drawer = document.getElementById('drawer');
    if (!burger || !drawer) return;
    var close = drawer.querySelector('.close');
    function open() {
      drawer.hidden = false;
      burger.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
      (close || drawer).focus();
    }
    function shut() {
      drawer.hidden = true;
      burger.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
      burger.focus();
    }
    burger.addEventListener('click', open);
    if (window.location.hash === '#menu') open();
    if (close) close.addEventListener('click', shut);
    drawer.addEventListener('click', function (ev) { if (ev.target === drawer) shut(); });
    document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && !drawer.hidden) shut(); });
    var find = document.querySelector('.find');
    var top = document.querySelector('.top');
    if (find && top) {
      find.addEventListener('click', function () {
        var on = !top.classList.contains('searching');
        top.classList.toggle('searching', on);
        find.setAttribute('aria-expanded', on ? 'true' : 'false');
        if (on) { var i = top.querySelector('.search input'); if (i) i.focus(); }
      });
    }
  }

  // The creatures page: filter by realm, level and kind, sort, and show as cards or rows.
  function setupCreatureFilters() {
    var form = document.querySelector('form.filters');
    var grid = document.querySelector('.cgrid');
    if (!form || !grid) return;
    var cards = Array.prototype.slice.call(grid.children);
    var lo = form.querySelector('input[name="lo"]');
    var hi = form.querySelector('input[name="hi"]');
    var fill = form.querySelector('.range .fill');
    var loOut = form.querySelector('.range .lo');
    var hiOut = form.querySelector('.range .hi');
    var none = document.querySelector('.nothing');
    var sort = document.querySelector('select.sort');
    var det = form.querySelector('details.fdet');
    if (det && window.matchMedia && window.matchMedia('(max-width: 1100px)').matches) det.open = false;
    function checked(name) {
      return Array.prototype.slice.call(form.querySelectorAll('input[name="' + name + '"]:checked')).map(function (i) { return i.value; });
    }
    function apply() {
      var a = parseInt(lo.value, 10), b = parseInt(hi.value, 10);
      if (a > b) { var t = a; a = b; b = t; }
      var min = parseInt(lo.min, 10), max = parseInt(lo.max, 10);
      if (fill) { fill.style.left = ((a - min) / (max - min) * 100) + '%'; fill.style.right = (100 - (b - min) / (max - min) * 100) + '%'; }
      if (loOut) loOut.textContent = a;
      if (hiOut) hiOut.textContent = b >= max ? max + '+' : b;
      var realms = checked('realm'), kinds = checked('kind'), shown = 0;
      cards.forEach(function (c) {
        var lv = parseInt(c.getAttribute('data-lv'), 10);
        var ok = (!realms.length || realms.indexOf(c.getAttribute('data-realm')) >= 0) &&
                 (!kinds.length || kinds.indexOf(c.getAttribute('data-kind')) >= 0) &&
                 lv >= a && (lv <= b || b >= max);
        c.hidden = !ok;
        if (ok) shown++;
      });
      if (none) none.hidden = shown > 0;
    }
    function order() {
      var by = sort ? sort.value : 'level';
      cards.sort(function (x, y) {
        if (by === 'name') return x.getAttribute('data-name').localeCompare(y.getAttribute('data-name'));
        if (by === 'realm') return (parseInt(x.getAttribute('data-ro'), 10) - parseInt(y.getAttribute('data-ro'), 10)) || (parseInt(x.getAttribute('data-lv'), 10) - parseInt(y.getAttribute('data-lv'), 10));
        return (parseInt(x.getAttribute('data-lv'), 10) - parseInt(y.getAttribute('data-lv'), 10)) || x.getAttribute('data-name').localeCompare(y.getAttribute('data-name'));
      });
      cards.forEach(function (c) { grid.appendChild(c); });
    }
    form.addEventListener('input', apply);
    form.addEventListener('change', apply);
    form.addEventListener('submit', function (ev) { ev.preventDefault(); });
    form.addEventListener('reset', function () { setTimeout(apply, 0); });
    if (sort) sort.addEventListener('change', order);
    Array.prototype.forEach.call(document.querySelectorAll('.vbtn'), function (btn) {
      btn.addEventListener('click', function () {
        var rows = btn.getAttribute('data-view') === 'rows';
        grid.classList.toggle('as-rows', rows);
        Array.prototype.forEach.call(document.querySelectorAll('.vbtn'), function (b) { b.setAttribute('aria-pressed', b === btn ? 'true' : 'false'); });
        try { localStorage.setItem('wiki-view', rows ? 'rows' : 'grid'); } catch (e) { /* fine */ }
      });
    });
    try { if (localStorage.getItem('wiki-view') === 'rows') { var r = document.querySelector('.vbtn[data-view="rows"]'); if (r) r.click(); } } catch (e) { /* fine */ }
    order();
    apply();
  }

  function setupTables() {
    Array.prototype.forEach.call(document.querySelectorAll('input.filter[data-for]'), function (input) {
      var table = document.getElementById(input.getAttribute('data-for'));
      if (!table) return;
      var rows = Array.prototype.slice.call(table.tBodies[0].rows);
      input.addEventListener('input', function () {
        var words = fold(input.value).split(/\s+/).filter(Boolean);
        rows.forEach(function (r) {
          var text = fold(r.textContent + ' ' + (r.getAttribute('data-k') || ''));
          r.hidden = !words.every(function (w) { return text.indexOf(w) >= 0; });
        });
      });
      // A phone shows the table as cards, with no header to tap: a "Sort by" menu drives the same header clicks.
      var heads = table.querySelectorAll('th[data-sort]');
      if (table.classList.contains('stack') && heads.length > 1) {
        var sel = document.createElement('select');
        sel.className = 'tsort';
        sel.setAttribute('aria-label', 'Sort this list');
        sel.innerHTML = '<option value="">Sort by\u2026</option>';
        Array.prototype.forEach.call(heads, function (th, n) {
          var name = th.textContent.replace(/[\u21c5\s]+$/, ''), isNum = th.getAttribute('data-sort') === 'num';
          [isNum ? ['desc', 'high to low'] : ['asc', 'A to Z'], isNum ? ['asc', 'low to high'] : ['desc', 'Z to A']].forEach(function (d) {
            var o = document.createElement('option');
            o.value = n + ':' + d[0];
            o.textContent = name + ', ' + d[1];
            sel.appendChild(o);
          });
        });
        input.parentNode.insertBefore(sel, input.nextSibling);
        sel.addEventListener('change', function () {
          if (!sel.value) return;
          var bits = sel.value.split(':'), th = heads[+bits[0]];
          th.setAttribute('data-dir', bits[1] === 'asc' ? 'desc' : 'asc');
          th.click();
        });
      }
    });
    Array.prototype.forEach.call(document.querySelectorAll('table.list th[data-sort]'), function (th) {
      th.tabIndex = 0;
      function sort() {
        var table = th.closest('table');
        var body = table.tBodies[0];
        var col = Array.prototype.indexOf.call(th.parentNode.children, th);
        var num = th.getAttribute('data-sort') === 'num';
        var dir = th.getAttribute('data-dir') === 'asc' ? -1 : 1;
        th.setAttribute('data-dir', dir === 1 ? 'asc' : 'desc');
        var rows = Array.prototype.slice.call(body.rows);
        rows.sort(function (a, b) {
          var x = a.cells[col].getAttribute('data-v') || a.cells[col].textContent;
          var y = b.cells[col].getAttribute('data-v') || b.cells[col].textContent;
          if (num) { x = parseFloat(x) || 0; y = parseFloat(y) || 0; return (x - y) * dir; }
          return x.localeCompare(y) * dir;
        });
        rows.forEach(function (r) { body.appendChild(r); });
      }
      th.addEventListener('click', sort);
      th.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); sort(); } });
    });
  }

  // "On this page": always open beside the article; folded at the top of narrow windows until tapped.
  function setupToc() {
    var narrow = window.matchMedia && window.matchMedia('(max-width: 1100px)');
    Array.prototype.forEach.call(document.querySelectorAll('details.tdet'), function (det) {
      if (narrow && narrow.matches) det.open = false;
      det.querySelector('summary').addEventListener('click', function (ev) {
        if (!(narrow && narrow.matches)) ev.preventDefault();
      });
      Array.prototype.forEach.call(det.querySelectorAll('a'), function (a) {
        a.addEventListener('click', function () { if (narrow && narrow.matches) det.open = false; });
      });
    });
  }

  // One logo at a time (owner, 2026-09-27): on the home page the header logo waits until the
  // hero's big logo has scrolled away.
  function setupHeroLogo() {
    var big = document.querySelector('.pg-home .hero h1 img'), root = document.documentElement;
    if (!big) return;
    if (!('IntersectionObserver' in window)) { root.classList.add('past-hero'); return; }
    new IntersectionObserver(function (es) {
      root.classList.toggle('past-hero', !es[0].isIntersecting);
    }, { rootMargin: '-64px 0px 0px 0px' }).observe(big);
  }

  document.addEventListener('DOMContentLoaded', function () {
    setupHeroLogo();
    Array.prototype.forEach.call(document.querySelectorAll('form.search, form.hsearch'), setupSearch);
    setupSearchPage();
    setupTheme();
    setupMenu();
    setupCreatureFilters();
    setupTables();
    setupToc();
  });
})();
