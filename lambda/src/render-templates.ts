/**
 * Eta HTML template for the rendered schedule page.
 * Template variables (via `it`):
 *   title      — string
 *   syncedAt   — string  (pre-formatted, e.g. "Synced 7:42 AM")
 *   categories — { id, name, color }[]
 *   locations  — { abbr, name, color, colorLight }[]
 *   days       — { label, dateShort, dateKey, events: RenderEvent[] }[]
 *
 * RenderEvent: { uid, title, timeRange, locationAbbr, locationName,
 *                color, description, url, soldOut, hasDetails,
 *                startTime, category, instructor }
 */
export const PAGE_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title><%= it.title %></title>
  <link rel="icon" type="image/x-icon" href="/favicon.ico" />
  <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
  <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
  <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
  <link rel="manifest" href="/site.webmanifest" />
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      background: #FAF7F4;
      min-height: 100vh;
    }

    /* ── Nav ── */
    .nav {
      background: #FAF7F4;
      border-bottom: 1px solid #EDE8E3;
    }
    .nav-inner {
      max-width: 960px;
      margin: 0 auto;
      padding: 28px 48px 0;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .wordmark {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 10px;
    }
    .wordmark-left {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .wordmark-text {
      font-weight: 700;
      font-size: 18px;
      color: #2C2420;
      letter-spacing: -0.3px;
    }
    .wordmark-right {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-shrink: 0;
    }
    .synced-text {
      font-family: Georgia, 'Times New Roman', serif;
      font-style: italic;
      font-weight: 400;
      font-size: 11px;
      color: #B0A49E;
    }
    .ical-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 7px 13px;
      border-radius: 8px;
      border: 1.5px solid #C4B8B2;
      background: white;
      color: #6B5E57;
      cursor: pointer;
      font-family: inherit;
      font-weight: 500;
      font-size: 12px;
      transition: border-color 0.2s, background 0.2s, color 0.2s;
    }
    .ical-btn.copied {
      border-color: #4A9B7F;
      background: #E6F4EF;
      color: #357A62;
    }

    .nav-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    /* Tabs */
    .tabs { display: flex; }
    .tab-btn {
      background: none;
      border: none;
      border-bottom: 2px solid transparent;
      cursor: pointer;
      color: #B0A49E;
      font-family: inherit;
      font-weight: 400;
      font-size: 14px;
      padding: 14px 16px 14px 0;
      margin-right: 8px;
      transition: color 0.2s, border-color 0.2s, font-weight 0.2s;
    }
    .tab-btn.active {
      color: #2C2420;
      font-weight: 600;
      border-bottom-color: #B83A3A;
    }

    /* Location filter chips */
    .loc-chips {
      display: flex;
      gap: 6px;
      overflow-x: auto;
      scrollbar-width: none;
    }
    .loc-chip {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      border-radius: 20px;
      border: 1.5px solid #E5DDD8;
      background: transparent;
      color: #B0A49E;
      cursor: pointer;
      font-family: inherit;
      font-weight: 500;
      font-size: 12px;
      transition: border-color 0.15s, background 0.15s, color 0.15s;
    }
    .loc-chip.active {
      border-color: var(--accent);
      background: var(--light);
      color: var(--accent);
    }
    .chip-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      display: inline-block;
      flex-shrink: 0;
      opacity: 0.5;
    }
    .loc-chip.active .chip-dot { opacity: 1; }

    /* ── Main body ── */
    .main {
      max-width: 960px;
      margin: 0 auto;
      padding: 36px 48px 80px;
    }

    /* Day group */
    .day-group { margin-bottom: 40px; }
    .day-header {
      position: sticky;
      top: 0;
      z-index: 10;
      background: #FAF7F4;
      display: flex;
      align-items: baseline;
      gap: 10px;
      margin-bottom: 16px;
      padding-top: 8px;
      padding-bottom: 12px;
      border-bottom: 1px solid #EDE8E3;
    }
    .day-label {
      font-size: 18px;
      font-weight: 700;
      color: #2C2420;
      letter-spacing: -0.2px;
    }
    .day-sub {
      font-size: 13px;
      color: #B0A49E;
      font-weight: 400;
    }
    .cards {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    /* ── Event card ── */
    .card {
      background: white;
      border-radius: 12px;
      border: 1px solid #EDE8E3;
      box-shadow: 0 1px 3px rgba(0,0,0,0.04);
      overflow: hidden;
      transition: box-shadow 0.25s, border-color 0.25s, background 0.25s;
    }
    .card.open {
      background: #FDFAF7;
      border-color: color-mix(in srgb, var(--accent) 27%, transparent);
      box-shadow: 0 4px 20px rgba(0,0,0,0.06);
    }

    .card-row {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 14px 16px;
      cursor: pointer;
      user-select: none;
    }

    .strip {
      width: 3px;
      align-self: stretch;
      border-radius: 4px;
      flex-shrink: 0;
    }

    .card-info { flex: 1; min-width: 0; }
    .card-title {
      font-weight: 700;
      font-size: 15px;
      color: #2C2420;
      margin-bottom: 4px;
      letter-spacing: -0.1px;
    }
    .card-meta {
      display: flex;
      align-items: center;
      gap: 5px;
      font-size: 12px;
      color: #9C8E86;
      flex-wrap: wrap;
    }
    .sep { color: #D6CEC9; }
    .loc-name {
      display: flex;
      align-items: center;
      gap: 3px;
    }
    .loc-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      display: inline-block;
    }

    .card-aside {
      display: flex;
      align-items: center;
      gap: 7px;
      flex-shrink: 0;
    }
    .badge-full {
      font-size: 11px;
      color: #B87A6A;
      font-weight: 600;
      background: #F9EDE9;
      padding: 3px 8px;
      border-radius: 6px;
    }

    /* Chevron — default stroke set by CSS so .card.open can override it */
    .chevron {
      stroke: #C4B8B2;
      flex-shrink: 0;
      transition: transform 0.3s cubic-bezier(0.4,0,0.2,1), stroke 0.2s;
    }
    .card.open .chevron {
      stroke: var(--accent);
      transform: rotate(180deg);
    }

    /* Expand / collapse animation (same grid trick as alt.jsx) */
    .expand-wrap {
      display: grid;
      grid-template-rows: 0fr;
      transition: grid-template-rows 0.35s cubic-bezier(0.4,0,0.2,1);
    }
    .card.open .expand-wrap { grid-template-rows: 1fr; }
    .expand-inner { overflow: hidden; }

    .card-body { padding: 0 16px 18px 33px; }
    .divider { height: 1px; background: #EDE8E3; margin-bottom: 16px; }
    .card-desc {
      font-size: 13px;
      line-height: 1.75;
      color: #6B5F59;
      margin: 0 0 18px;
    }
    .card-link {
      display: inline-block;
      padding: 11px 20px;
      border-radius: 8px;
      text-decoration: none;
      color: white;
      font-weight: 600;
      font-size: 13px;
      letter-spacing: 0.01em;
      transition: opacity 0.15s;
    }
    .card-link:hover { opacity: 0.82; }

    /* ── Empty state ── */
    .empty {
      text-align: center;
      padding: 80px 20px;
      color: #B0A49E;
    }
    .empty-icon { font-size: 36px; margin-bottom: 12px; }
    .empty-title { font-size: 17px; margin-bottom: 6px; color: #7A6E69; }
    .empty-sub { font-size: 13px; }

    .hidden { display: none !important; }

    /* ── Responsive ── */
    @media (max-width: 767px) {
      .nav-inner { padding: 20px 20px 0; }
      .wordmark-right { flex-direction: column; align-items: flex-end; gap: 4px; }
      .nav-row { flex-direction: column; align-items: flex-start; }
      .loc-chips { padding: 10px 0 14px; width: 100%; }
      .main { padding: 24px 16px 80px; max-width: 100%; }
    }
  </style>
</head>
<body>

<nav class="nav">
  <div class="nav-inner">
    <div class="wordmark">
      <div class="wordmark-left">
        <img src="/android-chrome-192x192.png" alt="TRC" style="height:20px;width:auto;flex-shrink:0;border-radius:3px" />
        <span class="wordmark-text"><%= it.title %></span>
      </div>
      <div class="wordmark-right">
        <span class="synced-text"><%= it.syncedAt %></span>
        <button id="ical-btn" class="ical-btn" onclick="copyIcal()">
          <svg id="ical-icon-copy" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
          <svg id="ical-icon-check" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:none">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          <span id="ical-label">iCal</span>
        </button>
      </div>
    </div>

    <div class="nav-row">
      <div class="tabs">
        <% it.categories.forEach(function(cat, i) { %>
        <button class="tab-btn<%= i === 0 ? ' active' : '' %>" data-tab="<%= cat.id %>"><%= cat.name %></button>
        <% }) %>
      </div>
      <div class="loc-chips">
        <% it.locations.forEach(function(loc) { %>
        <button class="loc-chip" data-loc="<%= loc.abbr %>" style="--accent:<%= loc.color %>;--light:<%= loc.colorLight %>">
          <span class="chip-dot" style="background:<%= loc.color %>"></span>
          <%= loc.name %>
        </button>
        <% }) %>
      </div>
    </div>
  </div>
</nav>

<main class="main">
  <% it.days.forEach(function(day) { %>
  <section class="day-group">
    <div class="day-header">
      <span class="day-label"><%= day.label %></span>
      <span class="day-sub"><%= day.dateShort %></span>
    </div>
    <div class="cards">
      <% day.events.forEach(function(ev) { %>
      <div class="card" data-category="<%= ev.category %>" data-loc="<%= ev.locationAbbr %>" style="--accent:<%= ev.color %>">
        <div class="card-row" onclick="toggleCard(this.closest('.card'))">
          <div class="strip" style="background:<%= ev.color %>"></div>
          <div class="card-info">
            <div class="card-title"><%= ev.title %></div>
            <div class="card-meta">
              <span><%= ev.timeRange %></span>
              <% if (ev.instructor) { %>
              <span class="sep">·</span>
              <span><%= ev.instructor %></span>
              <% } %>
              <span class="sep">·</span>
              <span class="loc-name">
                <span class="loc-dot" style="background:<%= ev.color %>"></span>
                <%= ev.locationName %>
              </span>
            </div>
          </div>
          <div class="card-aside">
            <% if (ev.soldOut) { %>
            <span class="badge-full">Full</span>
            <% } %>
            <svg class="chevron" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        </div>
        <% if (ev.hasDetails) { %>
        <div class="expand-wrap">
          <div class="expand-inner">
            <div class="card-body">
              <div class="divider"></div>
              <% if (ev.description) { %>
              <p class="card-desc"><%= ev.description %></p>
              <% } %>
              <% if (ev.url) { %>
              <a class="card-link" href="<%= ev.url %>" target="_blank" rel="noopener" style="background:<%= ev.color %>">Reserve a spot</a>
              <% } %>
            </div>
          </div>
        </div>
        <% } %>
      </div>
      <% }) %>
    </div>
  </section>
  <% }) %>

  <div class="empty hidden" id="empty-state">
    <div class="empty-icon">🪷</div>
    <div class="empty-title">No classes found</div>
    <div class="empty-sub">Try adjusting your studio filters</div>
  </div>
</main>

<script>
(function () {
  function getCookie(name) {
    var match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return match ? decodeURIComponent(match[1]) : null;
  }
  function setCookie(name, value) {
    document.cookie = name + '=' + encodeURIComponent(value) + '; path=/; max-age=' + (365 * 24 * 60 * 60);
  }

  var activeLocs = new Set();

  // Sorted abbreviations from the rendered chips
  var ALL_LOCS = Array.from(document.querySelectorAll('.loc-chip')).map(function (c) { return c.dataset.loc; }).sort();

  function buildIcalUrl() {
    var tab = document.querySelector('.tab-btn.active').dataset.tab;
    var locs = activeLocs.size === 0 ? ALL_LOCS : Array.from(activeLocs).sort();
    return 'https://trc.yoga/calendars/' + tab + '/' + locs.join('_') + '.ics';
  }

  var copyTimeout = null;
  window.copyIcal = function () {
    navigator.clipboard.writeText(buildIcalUrl()).then(function () {
      var btn = document.getElementById('ical-btn');
      btn.classList.add('copied');
      document.getElementById('ical-icon-copy').style.display = 'none';
      document.getElementById('ical-icon-check').style.display = 'inline';
      document.getElementById('ical-label').textContent = 'Copied!';
      if (copyTimeout) clearTimeout(copyTimeout);
      copyTimeout = setTimeout(function () {
        btn.classList.remove('copied');
        document.getElementById('ical-icon-copy').style.display = 'inline';
        document.getElementById('ical-icon-check').style.display = 'none';
        document.getElementById('ical-label').textContent = 'iCal';
      }, 2000);
    });
  };

  function applyFilters() {
    var tab = document.querySelector('.tab-btn.active').dataset.tab;
    var visibleCount = 0;

    document.querySelectorAll('.card').forEach(function (card) {
      var matchCat = card.dataset.category === tab;
      var matchLoc = activeLocs.size === 0 || activeLocs.has(card.dataset.loc);
      var visible = matchCat && matchLoc;
      card.classList.toggle('hidden', !visible);
      if (visible) visibleCount++;
    });

    document.querySelectorAll('.day-group').forEach(function (group) {
      var hasVisible = group.querySelectorAll('.card:not(.hidden)').length > 0;
      group.classList.toggle('hidden', !hasVisible);
    });

    document.getElementById('empty-state').classList.toggle('hidden', visibleCount > 0);
  }

  document.querySelectorAll('.tab-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.tab-btn').forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      setCookie('trc_tab', btn.dataset.tab);
      // Collapse any open card when switching tabs
      document.querySelectorAll('.card.open').forEach(function (c) { c.classList.remove('open'); });
      applyFilters();
    });
  });

  document.querySelectorAll('.loc-chip').forEach(function (chip) {
    chip.addEventListener('click', function () {
      var loc = chip.dataset.loc;
      if (activeLocs.has(loc)) {
        activeLocs.delete(loc);
        chip.classList.remove('active');
      } else {
        activeLocs.add(loc);
        chip.classList.add('active');
      }
      setCookie('trc_locs', Array.from(activeLocs).sort().join(','));
      applyFilters();
    });
  });

  window.toggleCard = function (card) {
    var isOpen = card.classList.contains('open');
    document.querySelectorAll('.card.open').forEach(function (c) { c.classList.remove('open'); });
    if (!isOpen) card.classList.add('open');
  };

  // Restore saved tab
  var savedTab = getCookie('trc_tab');
  if (savedTab) {
    document.querySelectorAll('.tab-btn').forEach(function (b) {
      b.classList.toggle('active', b.dataset.tab === savedTab);
    });
  }

  // Restore saved locations
  var savedLocs = getCookie('trc_locs');
  if (savedLocs) {
    savedLocs.split(',').forEach(function (loc) {
      if (!loc) return;
      activeLocs.add(loc);
      var chip = document.querySelector('.loc-chip[data-loc="' + loc + '"]');
      if (chip) chip.classList.add('active');
    });
  }

  applyFilters();
}());
</script>

</body>
</html>`;
