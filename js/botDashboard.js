/**
 * Bot Dashboard Module
 * Renders the 3-tab AI Bot Command Center: Watchlist | Scout | Scores
 * + Bot Status Panel + Clickable Sector Badges
 */

const BOT_API = '';  // Same origin

let botDashboardInterval = null;
let activeTab = 'watchlist';

// ═══════════════════════════════════════════════════
// Initialize Dashboard
// ═══════════════════════════════════════════════════

export function initBotDashboard() {
  const section = document.getElementById('botDashboardSection');
  if (!section) return;

  // Tab clicks
  section.querySelectorAll('.bot-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      activeTab = tab.dataset.tab;
      section.querySelectorAll('.bot-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      section.querySelectorAll('.bot-tab-content').forEach(c => c.classList.remove('active'));
      const target = document.getElementById(`botTab_${activeTab}`);
      if (target) target.classList.add('active');

      // Load on-demand tabs
      if (activeTab === 'scores') loadScoresTab();
      if (activeTab === 'top5') loadTop5Tab();
    });
  });

  // Watchlist config save
  const saveBtn = document.getElementById('saveWatchlistBtn');
  if (saveBtn) saveBtn.addEventListener('click', saveWatchlistConfig);

  // Close sector popup on overlay click
  document.addEventListener('click', (e) => {
    const popup = document.getElementById('sectorPopup');
    if (popup && !popup.contains(e.target) && !e.target.closest('.sector-badge')) {
      popup.remove();
    }
  });

  // Initial load
  loadBotDashboard();
  loadBotStatus();

  // Auto refresh every 10 minutes (data) + every 30s (status)
  if (botDashboardInterval) clearInterval(botDashboardInterval);
  botDashboardInterval = setInterval(loadBotDashboard, 10 * 60 * 1000);
  setInterval(loadBotStatus, 30 * 1000);
}


// ═══════════════════════════════════════════════════
// Bot Status Panel
// ═══════════════════════════════════════════════════

async function loadBotStatus() {
  try {
    const resp = await fetch(`${BOT_API}/api/bot/status`);
    if (!resp.ok) return;
    const st = await resp.json();
    renderBotStatus(st);
  } catch (err) {
    console.warn('Bot status load failed:', err.message);
  }
}

function renderBotStatus(st) {
  const container = document.getElementById('botStatusPanel');
  if (!container) return;

  const bots = [
    { key: 'watchlist', icon: '🤖', name: 'Watchlist Bot', interval: '10 phút' },
    { key: 'scout',     icon: '🔭', name: 'Scout Bot',     interval: '30 phút' },
    { key: 'scorer',    icon: '🧠', name: 'AI Scorer',     interval: 'on-demand' },
  ];

  container.innerHTML = bots.map(bot => {
    const info = st[bot.key] || {};
    const isRunning = info.running;
    const lastScan = info.last_scan ? new Date(info.last_scan).toLocaleTimeString('vi-VN') : '--:--';
    const scanCount = info.scan_count || 0;
    const articles = info.articles_total || 0;
    const status = info.status || 'Chờ khởi động';

    const dotClass = isRunning ? 'status-dot scanning' : (info.last_scan ? 'status-dot online' : 'status-dot offline');
    const dotTitle = isRunning ? 'Đang quét...' : (info.last_scan ? 'Hoạt động' : 'Chờ khởi động');

    return `
      <div class="bot-status-item">
        <span class="bot-status-icon">${bot.icon}</span>
        <div class="bot-status-info">
          <div class="bot-status-name">${bot.name} <span class="${dotClass}" title="${dotTitle}"></span></div>
          <div class="bot-status-detail">${status}</div>
        </div>
        <div class="bot-status-meta">
          <span title="Lần quét cuối">🕐 ${lastScan}</span>
          <span title="Số lần quét">🔄 ${scanCount}</span>
          ${bot.key !== 'scorer' ? `<span title="Số bài viết">📰 ${articles}</span>` : ''}
        </div>
      </div>
    `;
  }).join('');
}


// ═══════════════════════════════════════════════════
// Load Dashboard Data
// ═══════════════════════════════════════════════════

async function loadBotDashboard() {
  try {
    const [dashResp, scoutResp] = await Promise.all([
      fetch(`${BOT_API}/api/bot/dashboard`),
      fetch(`${BOT_API}/api/bot/scout`),
    ]);

    if (dashResp.ok) {
      const dashData = await dashResp.json();
      renderWatchlistTab(dashData.watchlist);
    }

    if (scoutResp.ok) {
      const scoutData = await scoutResp.json();
      renderScoutTab(scoutData);
    }

  } catch (err) {
    console.warn('Bot dashboard load failed:', err.message);
  }
}


// ═══════════════════════════════════════════════════
// Tab 1: Watchlist
// ═══════════════════════════════════════════════════

function renderWatchlistTab(watchlist) {
  const container = document.getElementById('botTab_watchlist');
  if (!container || !watchlist) return;

  const { config, data } = watchlist;
  const tickers = config?.tickers || [];

  const tickerInput = document.getElementById('watchlistTickerInput');
  if (tickerInput && !tickerInput.dataset.userEdited) {
    tickerInput.value = tickers.join(', ');
  }

  const cardsEl = container.querySelector('.watchlist-cards');
  if (!cardsEl) return;

  let html = '';
  for (const ticker of tickers) {
    const info = data?.[ticker] || {};
    const articles = info.articles || [];
    const sentiment = info.sentiment || {};
    const score = sentiment.score || 5;
    const scoreColor = score >= 7 ? '#00d4aa' : score >= 4 ? '#ffd700' : '#ff4757';
    const lastUpdated = info.last_updated ? new Date(info.last_updated).toLocaleTimeString('vi-VN') : '--:--';

    html += `
      <div class="watchlist-ticker-card">
        <div class="wtc-header">
          <span class="wtc-ticker">${ticker}</span>
          <span class="wtc-score" style="color:${scoreColor};border-color:${scoreColor}30;background:${scoreColor}15">
            ${score}/10
          </span>
          <span class="wtc-time">🕐 ${lastUpdated}</span>
        </div>
        <div class="wtc-news-list">
          ${articles.length === 0 ? '<div class="wtc-empty">⏳ Bot đang cào dữ liệu...</div>' : ''}
          ${articles.slice(0, 5).map(art => `
            <div class="wtc-news-item ${art.isHighlight ? 'highlight' : ''}">
              ${art.isHighlight ? '<span class="wtc-highlight-badge">⚡ QUAN TRỌNG</span>' : ''}
              <a href="${art.url}" target="_blank" rel="noopener">${art.title}</a>
              <span class="wtc-news-source">${art.source}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  cardsEl.innerHTML = html;
}


// ═══════════════════════════════════════════════════
// Tab 2: Scout (with clickable sectors)
// ═══════════════════════════════════════════════════

function renderScoutTab(scout) {
  const container = document.getElementById('botTab_scout');
  if (!container) return;

  const recommendations = scout?.recommendations || [];
  const hotSectors = scout?.hot_sectors || [];
  const macroNews = scout?.macro_news || [];
  const lastUpdated = scout?.last_updated ? new Date(scout.last_updated).toLocaleTimeString('vi-VN') : '--:--';

  const statusEl = container.querySelector('.scout-status');
  if (statusEl) statusEl.innerHTML = `🔭 Cập nhật lần cuối: ${lastUpdated}`;

  // Recommendations
  const recsEl = container.querySelector('.scout-recommendations');
  if (recsEl) {
    if (recommendations.length === 0) {
      recsEl.innerHTML = '<div class="scout-empty">⏳ Scout Bot đang phân tích...</div>';
    } else {
      recsEl.innerHTML = recommendations.map(rec => {
        const actionColor = rec.action === 'MUA' ? '#00d4aa' : '#ff4757';
        const actionEmoji = rec.action === 'MUA' ? '🟢' : '🔴';
        return `
          <div class="scout-rec-card">
            <div class="src-header">
              <span class="src-ticker">${rec.ticker}</span>
              <span class="src-action" style="color:${actionColor};background:${actionColor}15;border-color:${actionColor}30">
                ${actionEmoji} ${rec.action}
              </span>
              <span class="src-change" style="color:${rec.change_pct >= 0 ? '#00d4aa' : '#ff4757'}">
                ${rec.change_pct >= 0 ? '+' : ''}${rec.change_pct}%
              </span>
            </div>
            <div class="src-company">${rec.company}</div>
            <div class="src-reason">${rec.reason}</div>
          </div>
        `;
      }).join('');
    }
  }

  // Hot sectors (CLICKABLE!)
  const sectorsEl = container.querySelector('.scout-sectors');
  if (sectorsEl && hotSectors.length > 0) {
    sectorsEl.innerHTML = hotSectors.map((s, i) => {
      const heat = i === 0 ? '🔥' : i === 1 ? '🟡' : '⚪';
      return `<span class="sector-badge clickable" data-sector="${s.sector}" title="Bấm để xem cổ phiếu ${s.sector} (${s.mentions} lượt nhắc)">${heat} ${s.sector}</span>`;
    }).join('');

    // Attach click handlers
    sectorsEl.querySelectorAll('.sector-badge.clickable').forEach(badge => {
      badge.addEventListener('click', (e) => {
        e.stopPropagation();
        const sectorName = badge.dataset.sector;
        openSectorPopup(sectorName, badge);
      });
    });
  }

  // Macro news
  const macroEl = container.querySelector('.scout-macro-news');
  if (macroEl) {
    macroEl.innerHTML = macroNews.slice(0, 8).map(art => `
      <div class="scout-macro-item">
        <a href="${art.url}" target="_blank" rel="noopener">${art.title}</a>
        <span class="macro-source">${art.source}</span>
      </div>
    `).join('');
  }
}


// ═══════════════════════════════════════════════════
// Sector Popup – shows stocks when clicking a sector badge
// ═══════════════════════════════════════════════════

async function openSectorPopup(sectorName, anchorEl) {
  // Remove existing popup
  const old = document.getElementById('sectorPopup');
  if (old) old.remove();

  // Create popup
  const popup = document.createElement('div');
  popup.id = 'sectorPopup';
  popup.className = 'sector-popup';
  popup.innerHTML = `
    <div class="sector-popup-header">
      <span class="sector-popup-title">📊 ${sectorName}</span>
      <button class="sector-popup-close" onclick="this.closest('.sector-popup').remove()">✕</button>
    </div>
    <div class="sector-popup-body">
      <div class="sector-loading">⏳ Đang tải giá cổ phiếu ${sectorName}...</div>
    </div>
  `;

  // Position near the badge
  const rect = anchorEl.getBoundingClientRect();
  popup.style.position = 'fixed';
  popup.style.top = `${rect.bottom + 8}px`;
  popup.style.left = `${Math.max(10, rect.left - 100)}px`;
  popup.style.zIndex = '9999';

  document.body.appendChild(popup);

  // Fetch sector stocks
  try {
    const resp = await fetch(`${BOT_API}/api/bot/sector/${encodeURIComponent(sectorName)}`);
    if (!resp.ok) throw new Error('API lỗi');
    const data = await resp.json();

    const body = popup.querySelector('.sector-popup-body');
    if (!body || !data.stocks || data.stocks.length === 0) {
      body.innerHTML = '<div class="sector-loading">Không có dữ liệu</div>';
      return;
    }

    body.innerHTML = `
      <table class="sector-stocks-table">
        <thead>
          <tr><th>Mã</th><th>Tên</th><th>Giá</th><th>%</th><th>Tín hiệu</th></tr>
        </thead>
        <tbody>
          ${data.stocks.map(s => {
            const chgColor = s.change_pct > 0 ? '#00d4aa' : s.change_pct < 0 ? '#ff4757' : '#ffd700';
            return `
              <tr>
                <td><span class="sector-stock-ticker">${s.ticker}</span></td>
                <td class="sector-stock-name">${s.name}</td>
                <td>${s.price ? s.price.toLocaleString() : '--'}</td>
                <td style="color:${chgColor};font-weight:600">${s.change_pct >= 0 ? '+' : ''}${s.change_pct}%</td>
                <td><span class="sector-signal" style="color:${s.signal === 'MUA' ? '#00d4aa' : s.signal === 'BÁN' ? '#ff4757' : '#ffd700'}">${s.signal_emoji} ${s.signal}</span></td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  } catch (err) {
    const body = popup.querySelector('.sector-popup-body');
    if (body) body.innerHTML = `<div class="sector-loading" style="color:#ff4757">❌ Lỗi: ${err.message}</div>`;
  }
}


// ═══════════════════════════════════════════════════
// Tab 3: AI Scores
// ═══════════════════════════════════════════════════

async function loadScoresTab() {
  const container = document.getElementById('botTab_scores');
  if (!container) return;

  const tableBody = container.querySelector('.scores-table-body');
  if (!tableBody) return;

  try {
    const configResp = await fetch(`${BOT_API}/api/bot/watchlist/config`);
    if (!configResp.ok) return;
    const config = await configResp.json();
    const tickers = config.tickers || ['FPT', 'VCB', 'MBB', 'HPG', 'VNM'];

    tableBody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:20px;color:var(--text-muted)">⏳ Đang phân tích ${tickers.length} mã...</td></tr>`;

    const scores = [];
    for (const ticker of tickers) {
      try {
        const resp = await fetch(`${BOT_API}/api/bot/score/${ticker}`);
        if (resp.ok) scores.push(await resp.json());
      } catch { /* skip */ }
    }

    if (scores.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:20px;color:var(--text-muted)">Không có dữ liệu</td></tr>';
      return;
    }

    tableBody.innerHTML = scores.map(s => {
      const oc = s.overall_score >= 7 ? '#00d4aa' : s.overall_score >= 4 ? '#ffd700' : '#ff4757';
      return `
        <tr>
          <td><span class="scores-ticker">${s.ticker}</span></td>
          <td style="color:${oc};font-weight:700">${s.overall_score}/10</td>
          <td>${s.trend_emoji} ${s.trend}</td>
          <td>${s.sentiment?.score || '-'}</td>
          <td>${s.technical?.score || '-'}</td>
          <td>${s.momentum?.score || '-'}</td>
          <td><span style="color:${s.risk_color}">${s.risk}</span></td>
          <td>${s.strategy_emoji} ${s.strategy?.split('–')[0] || '-'}</td>
        </tr>
      `;
    }).join('');

  } catch (err) {
    tableBody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:#ff4757">❌ Lỗi: ${err.message}</td></tr>`;
  }
}


// ═══════════════════════════════════════════════════
// Tab 4: Top 5 Daily Movers
// ═══════════════════════════════════════════════════

async function loadTop5Tab() {
  const cardsEl = document.getElementById('top5Cards');
  const dateEl = document.getElementById('top5Date');
  const overviewEl = document.getElementById('top5Overview');
  if (!cardsEl) return;

  cardsEl.innerHTML = '<div class="top5-loading">⏳ Đang quét 30 cổ phiếu thị trường...</div>';

  try {
    const resp = await fetch(`${BOT_API}/api/bot/top-movers`);
    if (!resp.ok) throw new Error('API lỗi');
    const data = await resp.json();

    // Date
    if (dateEl) dateEl.textContent = `📅 ${data.date} • ${data.time}`;

    // Market overview
    if (overviewEl && data.market_overview) {
      const mo = data.market_overview;
      overviewEl.innerHTML = `
        <div class="top5-overview-bar">
          <span class="top5-ov-item" style="color:#00d4aa">🟢 Tăng: ${mo.gainers}</span>
          <span class="top5-ov-item" style="color:#ff4757">🔴 Giảm: ${mo.losers}</span>
          <span class="top5-ov-item" style="color:#ffd700">⚪ Đứng: ${mo.unchanged}</span>
          <span class="top5-ov-item" style="color:var(--text-muted)">📊 ${data.total_scanned} mã đã quét</span>
        </div>
      `;
    }

    // Top 5 cards
    if (!data.top5 || data.top5.length === 0) {
      cardsEl.innerHTML = '<div class="top5-loading">Không có dữ liệu</div>';
      return;
    }

    const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
    cardsEl.innerHTML = data.top5.map((m, i) => {
      const chgColor = m.change_pct > 0 ? '#00d4aa' : m.change_pct < 0 ? '#ff4757' : '#ffd700';
      const volStr = m.volume ? (m.volume / 1000).toFixed(0) + 'K' : '--';
      return `
        <div class="top5-card">
          <div class="top5-rank">${medals[i]}</div>
          <div class="top5-card-body">
            <div class="top5-card-header">
              <span class="top5-card-ticker">${m.ticker}</span>
              <span class="top5-card-company">${m.company}</span>
            </div>
            <div class="top5-card-stats">
              <div class="top5-stat">
                <span class="top5-stat-label">Giá</span>
                <span class="top5-stat-value">${m.price ? m.price.toLocaleString() : '--'}</span>
              </div>
              <div class="top5-stat">
                <span class="top5-stat-label">Thay đổi</span>
                <span class="top5-stat-value" style="color:${chgColor};font-weight:700">${m.change_pct >= 0 ? '+' : ''}${m.change_pct}%</span>
              </div>
              <div class="top5-stat">
                <span class="top5-stat-label">KLGD</span>
                <span class="top5-stat-value">${volStr}</span>
              </div>
            </div>
            <div class="top5-card-label" style="color:${m.label_color}">${m.label}</div>
          </div>
        </div>
      `;
    }).join('');

  } catch (err) {
    cardsEl.innerHTML = `<div class="top5-loading" style="color:#ff4757">❌ Lỗi: ${err.message}</div>`;
  }
}


// ═══════════════════════════════════════════════════
// Watchlist Config Save
// ═══════════════════════════════════════════════════

async function saveWatchlistConfig() {
  const input = document.getElementById('watchlistTickerInput');
  if (!input) return;

  const tickers = input.value.split(',').map(t => t.trim().toUpperCase()).filter(t => t.length >= 2);
  if (tickers.length === 0 || tickers.length > 10) {
    alert('Vui lòng nhập 1-10 mã cổ phiếu, cách nhau bằng dấu phẩy');
    return;
  }

  try {
    const resp = await fetch(`${BOT_API}/api/bot/watchlist/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tickers }),
    });
    if (resp.ok) {
      input.dataset.userEdited = '';
      const btn = document.getElementById('saveWatchlistBtn');
      if (btn) {
        btn.textContent = '✅ Đã lưu!';
        setTimeout(() => { btn.textContent = '💾 Lưu'; }, 2000);
      }
      loadBotDashboard();
    }
  } catch (err) {
    alert('Lỗi lưu: ' + err.message);
  }
}
