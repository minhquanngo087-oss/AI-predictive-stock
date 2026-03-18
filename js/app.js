/**
 * Main Application Controller
 * Orchestrates news fetching, sentiment analysis, and UI rendering
 */
import { fetchNews, getPopularTickers } from './news.js';
import { analyzeHeadlines } from './sentiment.js';
import { generatePrediction, getGaugeAngle, getMomentumText } from './predictor.js';
import { createSentimentChart, createDistributionChart, destroyCharts } from './chart.js';
import { fetchStockData } from './stockData.js';
import { generateAnalysis, calculateSMA } from './technicalAnalysis.js';
import { startRealtime, stopRealtime, setDelayMode, fetchIntradayCandles, fetchSSIDailyChart, fetchVNMarketSummary, isVNMarketOpen, getVNMarketStatus } from './realtimeData.js';
import { fetchVNStockNews, isVNTicker, getVNCompanyName } from './vnNewsScraper.js';
// candleSentiment removed

// ── State ──
let currentTicker = '';
let currentApiKey = '';
let isLoading = false;
let newsRefreshTimer = null;  // Auto-refresh news every 5 minutes
let marketStatusTimer = null; // Update market status clock

// ── DOM Elements ──
const els = {};

/**
 * Initialize the app
 */
function init() {
  cacheElements();
  setupEventListeners();
  renderPopularTickers();
  showWelcome();
  startMarketStatusBar();
}

function cacheElements() {
  els.searchInput = document.getElementById('searchInput');
  els.searchBtn = document.getElementById('searchBtn');
  els.apiKeyInput = document.getElementById('apiKeyInput');
  els.tickerBtns = document.getElementById('tickerBtns');
  els.welcomeSection = document.getElementById('welcomeSection');
  els.dashboardSection = document.getElementById('dashboardSection');
  els.loadingOverlay = document.getElementById('loadingOverlay');
  els.currentTicker = document.getElementById('currentTicker');
  els.currentTickerName = document.getElementById('currentTickerName');

  // Prediction card
  els.predictionSignal = document.getElementById('predictionSignal');
  els.predictionEmoji = document.getElementById('predictionEmoji');
  els.predictionLabel = document.getElementById('predictionLabel');
  els.confidenceValue = document.getElementById('confidenceValue');
  els.confidenceBar = document.getElementById('confidenceBar');
  els.momentumText = document.getElementById('momentumText');
  els.predictionDetails = document.getElementById('predictionDetails');
  els.gaugeNeedle = document.getElementById('gaugeNeedle');

  // Stats
  els.totalNews = document.getElementById('totalNews');
  els.bullishCount = document.getElementById('bullishCount');
  els.bearishCount = document.getElementById('bearishCount');
  els.avgScore = document.getElementById('avgScore');

  // News feed
  els.newsFeed = document.getElementById('newsFeed');

  // Candlestick
  els.tradingviewChart = document.getElementById('tradingviewChart');

  // Analysis
  els.analysisSignal = document.getElementById('analysisSignal');
  els.analysisEmoji = document.getElementById('analysisEmoji');
  els.analysisLabel = document.getElementById('analysisLabel');
  els.sma20Value = document.getElementById('sma20Value');
  els.sma50Value = document.getElementById('sma50Value');
  els.rsiValue = document.getElementById('rsiValue');
  els.patternValue = document.getElementById('patternValue');
  els.patternsSection = document.getElementById('patternsSection');
  els.reasonsList = document.getElementById('reasonsList');
  els.techScoreBar = document.getElementById('techScoreBar');
  els.techScoreValue = document.getElementById('techScoreValue');
  els.sentScoreBar = document.getElementById('sentScoreBar');
  els.sentScoreValue = document.getElementById('sentScoreValue');
}

function setupEventListeners() {
  els.searchBtn.addEventListener('click', () => {
    const ticker = els.searchInput.value.trim().toUpperCase();
    if (ticker) { hideAutocomplete(); analyze(ticker); }
  });

  els.searchInput.addEventListener('keydown', (e) => {
    const dropdown = document.getElementById('autocompleteDropdown');
    const items = dropdown.querySelectorAll('.autocomplete-item');
    let activeIdx = [...items].findIndex(i => i.classList.contains('active'));

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (activeIdx < items.length - 1) {
        items.forEach(i => i.classList.remove('active'));
        items[activeIdx + 1].classList.add('active');
        items[activeIdx + 1].scrollIntoView({ block: 'nearest' });
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (activeIdx > 0) {
        items.forEach(i => i.classList.remove('active'));
        items[activeIdx - 1].classList.add('active');
        items[activeIdx - 1].scrollIntoView({ block: 'nearest' });
      }
    } else if (e.key === 'Enter') {
      if (activeIdx >= 0) {
        e.preventDefault();
        items[activeIdx].click();
      } else {
        const ticker = els.searchInput.value.trim().toUpperCase();
        if (ticker) { hideAutocomplete(); analyze(ticker); }
      }
    } else if (e.key === 'Escape') {
      hideAutocomplete();
    }
  });

  els.searchInput.addEventListener('input', () => {
    const query = els.searchInput.value.trim().toUpperCase();
    if (query.length >= 1) {
      showAutocomplete(query);
    } else {
      hideAutocomplete();
    }
  });

  // Close autocomplete on outside click
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-input-wrapper')) hideAutocomplete();
  });

  // API key toggle
  const apiKeyToggle = document.getElementById('apiKeyToggle');
  const apiKeyPanel = document.getElementById('apiKeyPanel');
  if (apiKeyToggle && apiKeyPanel) {
    apiKeyToggle.addEventListener('click', () => {
      apiKeyPanel.classList.toggle('show');
    });
  }

  // Save API keys
  const saveBtn = document.getElementById('saveApiKeys');
  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      const newsKey = document.getElementById('apiKeyInput')?.value?.trim() || '';
      const finnhubKey = document.getElementById('finnhubKeyInput')?.value?.trim() || '';
      
      if (newsKey) localStorage.setItem('newsApiKey', newsKey);
      if (finnhubKey) localStorage.setItem('finnhubKey', finnhubKey);
      
      // Also send to backend
      fetch('http://localhost:5000/api/set-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ finnhubKey }),
      }).catch(() => {});
      
      saveBtn.textContent = '✅ Đã lưu!';
      setTimeout(() => { saveBtn.textContent = '💾 Lưu API Keys'; }, 2000);
    });
  }

  // Restore saved keys
  const savedNewsKey = localStorage.getItem('newsApiKey');
  const savedFinnhub = localStorage.getItem('finnhubKey');
  if (savedNewsKey) document.getElementById('apiKeyInput').value = savedNewsKey;
  if (savedFinnhub) document.getElementById('finnhubKeyInput').value = savedFinnhub;

  // Indicator toolbar toggles
  document.querySelectorAll('.ind-badge').forEach(badge => {
    badge.addEventListener('click', () => {
      badge.classList.toggle('active');
      updateChartIndicators();
    });
  });

  // Live / Delay toggle
  const btnLive = document.getElementById('btnLive');
  const btnDelay = document.getElementById('btnDelay');
  const btnReset = document.getElementById('btnResetChart');
  if (btnLive && btnDelay) {
    btnLive.addEventListener('click', () => {
      if (btnLive.classList.contains('active')) return;
      btnLive.classList.add('active');
      btnDelay.classList.remove('active');
      setDelayMode(false);
      reloadCurrentChart();
    });
    btnDelay.addEventListener('click', () => {
      if (btnDelay.classList.contains('active')) return;
      btnDelay.classList.add('active');
      btnLive.classList.remove('active');
      setDelayMode(true);
      reloadCurrentChart();
    });
  }
  if (btnReset) {
    btnReset.addEventListener('click', () => {
      btnReset.classList.add('spinning');
      reloadCurrentChart();
      setTimeout(() => btnReset.classList.remove('spinning'), 1000);
    });
  }



  // Glossary toggle
  const glossaryToggle = document.getElementById('glossaryToggle');
  const glossaryCard = document.querySelector('.glossary-card');
  if (glossaryToggle && glossaryCard) {
    glossaryToggle.addEventListener('click', () => {
      glossaryCard.classList.toggle('open');
    });
  }
}

// ═══════════════════════════════════════════════════
// STOCK DATABASE & AUTOCOMPLETE
// ═══════════════════════════════════════════════════
const STOCK_DB = [
  // HOSE - Top stocks
  { s: 'VCG', n: 'Vinaconex', e: 'HOSE' },
  { s: 'VNM', n: 'Vinamilk', e: 'HOSE' },
  { s: 'FPT', n: 'FPT Corporation', e: 'HOSE' },
  { s: 'VIC', n: 'Vingroup', e: 'HOSE' },
  { s: 'VHM', n: 'Vinhomes', e: 'HOSE' },
  { s: 'VRE', n: 'Vincom Retail', e: 'HOSE' },
  { s: 'MWG', n: 'Thế Giới Di Động', e: 'HOSE' },
  { s: 'HPG', n: 'Hòa Phát Group', e: 'HOSE' },
  { s: 'TCB', n: 'Techcombank', e: 'HOSE' },
  { s: 'VCB', n: 'Vietcombank', e: 'HOSE' },
  { s: 'BID', n: 'BIDV', e: 'HOSE' },
  { s: 'CTG', n: 'VietinBank', e: 'HOSE' },
  { s: 'MBB', n: 'MB Bank', e: 'HOSE' },
  { s: 'SSI', n: 'SSI Securities', e: 'HOSE' },
  { s: 'VND', n: 'VNDirect', e: 'HOSE' },
  { s: 'HDB', n: 'HD Bank', e: 'HOSE' },
  { s: 'TPB', n: 'TP Bank', e: 'HOSE' },
  { s: 'ACB', n: 'Á Châu Bank', e: 'HOSE' },
  { s: 'STB', n: 'Sacombank', e: 'HOSE' },
  { s: 'GAS', n: 'PV Gas', e: 'HOSE' },
  { s: 'SAB', n: 'Sabeco', e: 'HOSE' },
  { s: 'MSN', n: 'Masan Group', e: 'HOSE' },
  { s: 'VJC', n: 'Vietjet Air', e: 'HOSE' },
  { s: 'PLX', n: 'Petrolimex', e: 'HOSE' },
  { s: 'POW', n: 'PV Power', e: 'HOSE' },
  { s: 'PVD', n: 'PV Drilling', e: 'HOSE' },
  { s: 'DIG', n: 'DIC Group', e: 'HOSE' },
  { s: 'DXG', n: 'Đất Xanh Group', e: 'HOSE' },
  { s: 'NVL', n: 'Novaland', e: 'HOSE' },
  { s: 'PDR', n: 'Phát Đạt', e: 'HOSE' },
  { s: 'KDH', n: 'Khang Điền', e: 'HOSE' },
  { s: 'NLG', n: 'Nam Long', e: 'HOSE' },
  { s: 'HDG', n: 'Hà Đô Group', e: 'HOSE' },
  { s: 'REE', n: 'REE Corporation', e: 'HOSE' },
  { s: 'GEX', n: 'GELEX', e: 'HOSE' },
  { s: 'PNJ', n: 'Phú Nhuận Jewelry', e: 'HOSE' },
  { s: 'DGC', n: 'Đức Giang Chemical', e: 'HOSE' },
  { s: 'HSG', n: 'Hoa Sen Group', e: 'HOSE' },
  { s: 'CTD', n: 'Coteccons', e: 'HOSE' },
  { s: 'VGC', n: 'Viglacera', e: 'HOSE' },
  { s: 'KBC', n: 'Kinh Bắc', e: 'HOSE' },
  { s: 'HAG', n: 'Hoàng Anh Gia Lai', e: 'HOSE' },
  { s: 'DPM', n: 'Đạm Phú Mỹ', e: 'HOSE' },
  { s: 'DCM', n: 'Đạm Cà Mau', e: 'HOSE' },
  { s: 'GMD', n: 'Gemadept', e: 'HOSE' },
  { s: 'SHB', n: 'SHB Bank', e: 'HOSE' },
  { s: 'LPB', n: 'LienVietPostBank', e: 'HOSE' },
  { s: 'EIB', n: 'Eximbank', e: 'HOSE' },
  { s: 'VPB', n: 'VP Bank', e: 'HOSE' },
  { s: 'BCM', n: 'Becamex IDC', e: 'HOSE' },
  // HNX
  { s: 'PVS', n: 'PV Shipping', e: 'HNX' },
  { s: 'SHS', n: 'SHS Securities', e: 'HNX' },
  { s: 'IDC', n: 'IDICO', e: 'HNX' },
  { s: 'PVI', n: 'PVI Holdings', e: 'HNX' },
  { s: 'CEO', n: 'CEO Group', e: 'HNX' },
  { s: 'TNG', n: 'TNG Investment', e: 'HNX' },
  { s: 'DTD', n: 'Đại Thiên Lộc', e: 'HNX' },
  { s: 'HUT', n: 'TASCO', e: 'HNX' },
  { s: 'NDN', n: 'Nhà Đà Nẵng', e: 'HNX' },
  { s: 'TVS', n: 'Thiên Việt Securities', e: 'HNX' },
  // UPCOM
  { s: 'BSR', n: 'Bình Sơn Refining', e: 'UPCOM' },
  { s: 'OIL', n: 'PVOil', e: 'UPCOM' },
  { s: 'VTP', n: 'Viettel Post', e: 'UPCOM' },
  { s: 'ACV', n: 'Airports Corporation', e: 'UPCOM' },
  { s: 'MCH', n: 'Masan Consumer', e: 'UPCOM' },
  { s: 'QNS', n: 'Đường Quảng Ngãi', e: 'UPCOM' },
  // NASDAQ
  { s: 'AAPL', n: 'Apple Inc.', e: 'NASDAQ' },
  { s: 'MSFT', n: 'Microsoft Corp.', e: 'NASDAQ' },
  { s: 'GOOGL', n: 'Alphabet Inc.', e: 'NASDAQ' },
  { s: 'AMZN', n: 'Amazon.com', e: 'NASDAQ' },
  { s: 'META', n: 'Meta Platforms', e: 'NASDAQ' },
  { s: 'TSLA', n: 'Tesla Inc.', e: 'NASDAQ' },
  { s: 'NVDA', n: 'NVIDIA Corp.', e: 'NASDAQ' },
  { s: 'NFLX', n: 'Netflix Inc.', e: 'NASDAQ' },
  { s: 'PYPL', n: 'PayPal Holdings', e: 'NASDAQ' },
  { s: 'ADBE', n: 'Adobe Inc.', e: 'NASDAQ' },
  { s: 'INTC', n: 'Intel Corp.', e: 'NASDAQ' },
  { s: 'AMD', n: 'AMD Inc.', e: 'NASDAQ' },
  { s: 'QCOM', n: 'Qualcomm', e: 'NASDAQ' },
  { s: 'SBUX', n: 'Starbucks', e: 'NASDAQ' },
  { s: 'COST', n: 'Costco', e: 'NASDAQ' },
  // NYSE
  { s: 'JPM', n: 'JPMorgan Chase', e: 'NYSE' },
  { s: 'V', n: 'Visa Inc.', e: 'NYSE' },
  { s: 'WMT', n: 'Walmart Inc.', e: 'NYSE' },
  { s: 'DIS', n: 'Walt Disney', e: 'NYSE' },
  { s: 'KO', n: 'Coca-Cola', e: 'NYSE' },
  { s: 'NKE', n: 'Nike Inc.', e: 'NYSE' },
  { s: 'BA', n: 'Boeing Co.', e: 'NYSE' },
  { s: 'GS', n: 'Goldman Sachs', e: 'NYSE' },
  { s: 'XOM', n: 'Exxon Mobil', e: 'NYSE' },
  { s: 'CVX', n: 'Chevron Corp.', e: 'NYSE' },
];

let selectedExchange = 'AUTO';

function getSelectedExchange() {
  const sel = document.getElementById('exchangeSelect');
  return sel ? sel.value : 'AUTO';
}

function showAutocomplete(query) {
  const dropdown = document.getElementById('autocompleteDropdown');
  const exchange = getSelectedExchange();

  let filtered = STOCK_DB.filter(stock => {
    const matchQuery = stock.s.includes(query) || stock.n.toUpperCase().includes(query);
    const matchExchange = exchange === 'AUTO' || stock.e === exchange;
    return matchQuery && matchExchange;
  }).slice(0, 8);

  if (filtered.length === 0) {
    dropdown.innerHTML = `<div class="ac-empty">Không tìm thấy mã "${query}"${exchange !== 'AUTO' ? ' trên sàn ' + exchange : ''}</div>`;
  } else {
    dropdown.innerHTML = filtered.map((stock, i) => {
      const highlighted = stock.s.replace(new RegExp(`(${query})`, 'gi'), '<b style="color:var(--accent-blue)">$1</b>');
      return `<div class="autocomplete-item${i === 0 ? ' active' : ''}" data-symbol="${stock.s}" data-exchange="${stock.e}">
        <span class="ac-symbol">${highlighted}</span>
        <span class="ac-name">${stock.n}</span>
        <span class="ac-exchange ${stock.e.toLowerCase()}">${stock.e}</span>
      </div>`;
    }).join('');

    dropdown.querySelectorAll('.autocomplete-item').forEach(item => {
      item.addEventListener('click', () => {
        const sym = item.dataset.symbol;
        const exch = item.dataset.exchange;
        els.searchInput.value = sym;
        document.getElementById('exchangeSelect').value = exch;
        selectedExchange = exch;
        hideAutocomplete();
        analyze(sym);
      });
    });
  }

  dropdown.classList.add('show');
}

function hideAutocomplete() {
  const dropdown = document.getElementById('autocompleteDropdown');
  if (dropdown) dropdown.classList.remove('show');
}

function renderPopularTickers() {
  const tickers = getPopularTickers();
  els.tickerBtns.innerHTML = tickers.map(t =>
    `<button class="ticker-btn" data-symbol="${t.symbol}" title="${t.name}">
      <span class="ticker-symbol">${t.symbol}</span>
    </button>`
  ).join('');

  els.tickerBtns.addEventListener('click', (e) => {
    const btn = e.target.closest('.ticker-btn');
    if (btn) {
      const symbol = btn.dataset.symbol;
      els.searchInput.value = symbol;
      analyze(symbol);
    }
  });
}

function showWelcome() {
  els.welcomeSection.style.display = 'block';
  els.dashboardSection.style.display = 'none';
}

function showDashboard() {
  els.welcomeSection.style.display = 'none';
  els.dashboardSection.style.display = 'grid';
  // Trigger animations
  requestAnimationFrame(() => {
    els.dashboardSection.classList.add('visible');
  });
}

function setLoading(loading) {
  isLoading = loading;
  els.loadingOverlay.classList.toggle('active', loading);
  els.searchBtn.disabled = loading;
}

/**
 * Main analysis flow
 */
async function analyze(ticker) {
  if (isLoading) return;

  currentTicker = ticker;
  currentApiKey = els.apiKeyInput?.value?.trim() || '';

  setLoading(true);

  // Stop any existing news refresh timer
  if (newsRefreshTimer) { clearInterval(newsRefreshTimer); newsRefreshTimer = null; }

  try {
    // 1. Determine if VN or US stock and fetch appropriate news
    const isVN = isVNTicker(ticker);
    let articles;
    if (isVN) {
      articles = await fetchVNStockNews(ticker);
    } else {
      articles = await fetchNews(ticker, currentApiKey);
    }

    if (!articles || articles.length === 0) {
      showError('Không tìm thấy tin tức cho mã cổ phiếu này.');
      return;
    }

    // 2. Analyze sentiment
    const headlines = articles.map(a => a.title);
    const sentimentData = analyzeHeadlines(headlines);

    if (!sentimentData) {
      showError('Lỗi phân tích cảm xúc.');
      return;
    }

    // 3. Generate prediction
    const prediction = generatePrediction(sentimentData);

    // 4. Fetch stock price data
    let stockData;
    if (isVN) {
      // Try SSI chart first for VN stocks
      const ssiResult = await fetchSSIDailyChart(ticker);
      if (ssiResult && ssiResult.candles.length >= 5) {
        stockData = ssiResult.candles;
      } else {
        stockData = await fetchStockData(ticker + '.VN', '3mo').catch(() => null)
                 || await fetchStockData(ticker, '3mo');
      }
    } else {
      stockData = await fetchStockData(ticker, '3mo');
    }

    // 5. Technical analysis
    const analysis = generateAnalysis(stockData, sentimentData, prediction);

    // 6. Render everything
    showDashboard();
    renderTickerInfo(ticker, isVN);
    renderPrediction(prediction);
    renderStats(prediction, sentimentData);
    renderCandlestickChart(stockData, analysis);
    renderAnalysis(analysis);
    renderNewsFeed(articles, sentimentData);
    createSentimentChart(sentimentData, prediction);
    createDistributionChart(sentimentData);
    updateMarketStatusBadge(ticker, isVN);

    // Highlight active ticker button
    document.querySelectorAll('.ticker-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.symbol === ticker);
    });

    // 7. Auto-refresh news every 5 minutes for VN stocks
    if (isVN) {
      newsRefreshTimer = setInterval(async () => {
        if (currentTicker !== ticker) return;
        try {
          const fresh = await fetchVNStockNews(ticker);
          if (fresh && fresh.length > 0) {
            const freshSentiment = analyzeHeadlines(fresh.map(a => a.title));
            renderNewsFeed(fresh, freshSentiment);
            renderStats(generatePrediction(freshSentiment), freshSentiment);
            console.log(`🔄 News refreshed for ${ticker}: ${fresh.length} articles`);
          }
        } catch (e) { /* silent fail */ }
      }, 5 * 60 * 1000); // 5 minutes
    }

  } catch (error) {
    console.error('Analysis error:', error);
    showError('Đã xảy ra lỗi. Vui lòng thử lại.');
  } finally {
    setLoading(false);
  }
}

function renderTickerInfo(ticker, isVN = false) {
  const tickers = getPopularTickers();
  const info = tickers.find(t => t.symbol === ticker);

  els.currentTicker.textContent = ticker;
  // For VN stocks use VN company name
  const vnName = isVN ? getVNCompanyName(ticker) : null;
  els.currentTickerName.textContent = vnName || (info ? info.name : ticker);
}

function renderPrediction(prediction) {
  const { signal, confidence, score, momentum, details } = prediction;

  // Signal
  els.predictionSignal.style.setProperty('--signal-color', signal.color);
  els.predictionEmoji.textContent = signal.emoji;
  els.predictionLabel.textContent = signal.label;
  els.predictionLabel.style.color = signal.color;

  // Confidence
  animateCounter(els.confidenceValue, confidence, '%');
  els.confidenceBar.style.width = `${confidence}%`;
  els.confidenceBar.style.background = `linear-gradient(90deg, ${signal.color}, ${signal.color}88)`;

  // Momentum
  els.momentumText.textContent = getMomentumText(momentum);

  // Details
  els.predictionDetails.textContent = details;

  // Gauge needle
  const angle = getGaugeAngle(score);
  els.gaugeNeedle.style.transform = `rotate(${angle}deg)`;
}

function renderStats(prediction, sentimentData) {
  animateCounter(els.totalNews, prediction.stats.total);
  animateCounter(els.bullishCount, prediction.stats.bullish);
  animateCounter(els.bearishCount, prediction.stats.bearish);
  els.avgScore.textContent = sentimentData.mean.toFixed(4);

  // Color the avg score
  if (sentimentData.mean > 0.05) {
    els.avgScore.style.color = '#00d4aa';
  } else if (sentimentData.mean < -0.05) {
    els.avgScore.style.color = '#ff4757';
  } else {
    els.avgScore.style.color = '#8892b0';
  }
}

function renderNewsFeed(articles, sentimentData) {
  els.newsFeed.innerHTML = articles.map((article, i) => {
    const score = sentimentData.scores[i] || 0;
    let sentimentClass, sentimentText;

    if (score > 0.05) {
      sentimentClass = 'positive';
      sentimentText = '🟢 Tích cực';
    } else if (score < -0.05) {
      sentimentClass = 'negative';
      sentimentText = '🔴 Tiêu cực';
    } else {
      sentimentClass = 'neutral';
      sentimentText = '⚪ Trung lập';
    }

    const timeAgo = getTimeAgo(article.publishedAt);

    return `
      <div class="news-item ${sentimentClass}" style="animation-delay: ${i * 0.05}s">
        <div class="news-header">
          <span class="news-source">${article.source}</span>
          <span class="news-time">${timeAgo}</span>
        </div>
        <a href="${article.url || '#'}" target="_blank" rel="noopener noreferrer" class="news-title-link">
          <h4 class="news-title">${article.title}</h4>
        </a>
        <div class="news-footer">
          <span class="news-sentiment ${sentimentClass}">${sentimentText}</span>
          <span class="news-score">${score.toFixed(3)}</span>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Render TradingView Advanced Chart widget
 */
function getTradingViewSymbol(ticker) {
  const upper = ticker.toUpperCase();
  const exchange = getSelectedExchange();

  // If user manually selected an exchange, use it
  if (exchange !== 'AUTO') {
    return `${exchange}:${upper}`;
  }

  // Auto-detect from STOCK_DB
  const found = STOCK_DB.find(s => s.s === upper);
  if (found) return `${found.e}:${upper}`;

  // Fallback: let TradingView search
  return upper;
}

/**
 * Reload the current chart with fresh data
 */
function reloadCurrentChart() {
  if (!currentTicker) return;
  stopRealtime();
  activeChart = null;
  activeCandleSeries = null;
  activeChartData = [];
  activeIndicatorSeries = {};
  renderCandlestickChart(null, null);
}

function renderCandlestickChart(candles, analysis) {
  stopRealtime(); // Stop any existing feed
  const tvContainer = document.getElementById('tradingviewChart');
  tvContainer.innerHTML = '';

  const tvSymbol = getTradingViewSymbol(currentTicker);
  const exchange = getSelectedExchange();
  const upper = currentTicker.toUpperCase();

  // Check if this is a Vietnamese stock that TradingView widget might not support
  const isVN = ['HOSE', 'HNX', 'UPCOM'].includes(exchange) ||
    (exchange === 'AUTO' && STOCK_DB.find(s => s.s === upper && ['HOSE', 'HNX', 'UPCOM'].includes(s.e)));

  if (isVN) {
    // Use fallback chart with real Yahoo Finance data
    renderFallbackChart(tvContainer, upper);
  } else {
    // Use TradingView embedded widget for international stocks
    renderTradingViewWidget(tvContainer, tvSymbol);
  }
}

function renderTradingViewWidget(container, symbol) {
  const script = document.createElement('script');
  script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
  script.type = 'text/javascript';
  script.async = true;
  script.innerHTML = JSON.stringify({
    "autosize": true,
    "symbol": symbol,
    "interval": "D",
    "timezone": "Asia/Ho_Chi_Minh",
    "theme": "dark",
    "style": "1",
    "locale": "vi_VN",
    "backgroundColor": "rgba(10, 14, 23, 0)",
    "gridColor": "rgba(136, 146, 176, 0.06)",
    "hide_side_toolbar": false,
    "allow_symbol_change": true,
    "calendar": false,
    "studies": [
      "STD;Bollinger_Bands",
      "STD;MACD",
      "STD;RSI"
    ],
    "support_host": "https://www.tradingview.com"
  });

  const widgetContainer = document.createElement('div');
  widgetContainer.className = 'tradingview-widget-container';
  widgetContainer.style.height = '100%';
  widgetContainer.style.width = '100%';

  const widgetInner = document.createElement('div');
  widgetInner.className = 'tradingview-widget-container__widget';
  widgetInner.style.height = 'calc(100% - 32px)';
  widgetInner.style.width = '100%';

  widgetContainer.appendChild(widgetInner);
  widgetContainer.appendChild(script);
  container.appendChild(widgetContainer);
}

// ── Global chart references for dynamic indicator management ──
let activeChart = null;
let activeCandleSeries = null;
let activeChartData = [];
let activeIndicatorSeries = {};

// ── Timeframe + Interval state ──
let activeChartRange = '1d';
let activeChartInterval = '15m';
let activeChartScale = 'linear'; // 'linear' | 'log'
let activeChartAutoScale = true;

async function renderFallbackChart(container, ticker, range, interval) {
  // Use provided range/interval or current state
  if (range)    activeChartRange    = range;
  if (interval) activeChartInterval = interval;
  const selectedRange    = activeChartRange;
  const selectedInterval = activeChartInterval;

  container.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;height:100%;flex-direction:column;gap:12px">
      <div class="loading-spinner" style="width:32px;height:32px"></div>
      <span style="color:var(--text-muted);font-size:13px">Đang tải dữ liệu ${ticker} (${selectedRange})...</span>
    </div>`;

  try {
    const { candles: data, intraday: isIntraday } = await fetchYahooFinanceData(ticker, selectedRange, selectedInterval);
    if (!data || data.length === 0) {
      container.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:center;height:100%;flex-direction:column;gap:12px">
          <span style="font-size:48px">📉</span>
          <span style="color:var(--text-muted);font-size:14px">Không tải được dữ liệu cho ${ticker}</span>
        </div>`;
      return;
    }

    container.innerHTML = '';
    activeChartData = data;

    const chartWrapper = document.createElement('div');
    chartWrapper.id = 'fallbackChartWrapper';
    chartWrapper.style.cssText = 'width:100%;height:100%;position:relative;';
    container.appendChild(chartWrapper);

    // Info bar with colored price
    const infoBar = document.createElement('div');
    infoBar.id = 'realtimeInfoBar';
    infoBar.style.cssText = 'position:absolute;top:8px;left:12px;z-index:10;font-size:12px;color:var(--text-muted);display:flex;gap:12px;align-items:center;flex-wrap:wrap;';
    const lastCandle = data[data.length - 1];
    const prevCandle = data[data.length - 2];
    const change = lastCandle.close - prevCandle.close;
    const changePct = (change / prevCandle.close * 100).toFixed(2);
    
    // Determine price color & symbol based on candle state
    const refPrice = prevCandle.close;
    const exchForColor = getSelectedExchange();
    const isVNStock = ['HOSE', 'HNX', 'UPCOM'].includes(exchForColor) || 
                      (exchForColor === 'AUTO' && STOCK_DB.some(s => s.s === ticker.toUpperCase()));
    let priceLimitPct = 0.07;
    if (exchForColor === 'HNX') priceLimitPct = 0.10;
    else if (exchForColor === 'UPCOM') priceLimitPct = 0.15;
    
    const priceCeiling = Math.round(refPrice * (1 + priceLimitPct) / 50) * 50;
    const priceFloor = Math.round(refPrice * (1 - priceLimitPct) / 50) * 50;
    
    let priceColor, priceSymbol, priceLabel;
    if (isVNStock && lastCandle.close >= priceCeiling) {
      priceColor = '#9B59B6'; priceSymbol = '▲'; priceLabel = 'CE';  // Ceiling/Trần
    } else if (isVNStock && lastCandle.close <= priceFloor) {
      priceColor = '#1E90FF'; priceSymbol = '▼'; priceLabel = 'FL';  // Floor/Sàn
    } else if (lastCandle.close === lastCandle.open) {
      priceColor = '#FFD700'; priceSymbol = '■'; priceLabel = 'TC';  // Tham chiếu
    } else if (change >= 0) {
      priceColor = '#00d4aa'; priceSymbol = '▲'; priceLabel = '';    // Tăng
    } else {
      priceColor = '#ff4757'; priceSymbol = '▼'; priceLabel = '';    // Giảm
    }

    const formattedPrice = lastCandle.close >= 1000 
      ? lastCandle.close.toLocaleString('vi-VN') 
      : lastCandle.close.toFixed(2);

    infoBar.innerHTML = `
      <span style="font-family:'Orbitron',monospace;font-size:14px;font-weight:700;color:var(--text-primary)">${ticker}</span>
      <span style="font-family:'Orbitron',monospace;font-size:18px;font-weight:800;color:${priceColor};text-shadow:0 0 8px ${priceColor}40">
        ${priceSymbol} ${formattedPrice}
        ${priceLabel ? `<span style="font-size:10px;font-weight:600;margin-left:4px;padding:1px 4px;border-radius:3px;background:${priceColor}20">${priceLabel}</span>` : ''}
      </span>
      <span style="color:${priceColor};font-weight:600;font-size:13px">${change >= 0 ? '+' : ''}${change.toFixed(2)} (${change >= 0 ? '+' : ''}${changePct}%)</span>
      <span style="font-size:11px;background:rgba(76,155,232,0.1);padding:2px 8px;border-radius:4px;color:#4c9be8">Yahoo Finance</span>
    `;
    chartWrapper.appendChild(infoBar);

    // ── Timeframe + Interval selector buttons ──
    // Format: { label, range, interval, title, separator (optional) }
    const TIMEFRAMES = [
      // Intraday – 1p/5p/15p chỉ hôm nay, 30p/1G nhiều ngày hơn cho đủ nến
      { label: '1p',  range: '1d',  interval: '1m',  title: '1 Phút (hôm nay)' },
      { label: '5p',  range: '1d',  interval: '5m',  title: '5 Phút (hôm nay)' },
      { label: '15p', range: '1d',  interval: '15m', title: '15 Phút (hôm nay)' },
      { label: '30p', range: '5d',  interval: '30m', title: '30 Phút (5 ngày)' },
      { label: '1G',  range: '5d',  interval: '60m', title: '1 Giờ (5 ngày)' },
      { separator: true },
      // Ngày / Tuần / Tháng / Năm
      { label: '1D',  range: '2d',  interval: '5m',  title: '1 Ngày (hôm qua + hôm nay, nến 5p)' },
      { label: '1W',  range: '5d',  interval: '15m', title: '1 Tuần (5 ngày, nến 15 phút)' },
      { label: '1T',  range: '1mo', interval: '1d',  title: '1 Tháng (nến ngày)' },
      { label: '3T',  range: '3mo', interval: '1d',  title: '3 Tháng' },
      { label: '6T',  range: '6mo', interval: '1d',  title: '6 Tháng' },
      { label: '1N',  range: '1y',  interval: '1d',  title: '1 Năm' },
      { label: '2N',  range: '2y',  interval: '1wk', title: '2 Năm (nến tuần)' },
      { label: '5N',  range: '5y',  interval: '1wk', title: '5 Năm (nến tuần)' },
    ];
    const tfBar = document.createElement('div');
    tfBar.style.cssText = 'position:absolute;top:6px;right:12px;z-index:20;display:flex;gap:4px;align-items:center;flex-wrap:wrap;justify-content:flex-end;max-width:420px;';

    TIMEFRAMES.forEach(({ label, range: r, interval: iv, title, separator }) => {
      if (separator) {
        const sep = document.createElement('span');
        sep.style.cssText = 'width:1px;height:14px;background:rgba(136,146,176,0.25);margin:0 2px;display:inline-block;';
        tfBar.appendChild(sep);
        return;
      }
      const isActive = r === selectedRange && iv === selectedInterval;
      const btn = document.createElement('button');
      btn.textContent = label;
      btn.title = title;
      btn.style.cssText = `
        padding:2px 7px;font-size:11px;font-weight:600;border-radius:4px;cursor:pointer;
        border:1px solid ${isActive ? '#4c9be8' : 'rgba(136,146,176,0.2)'};
        background:${isActive ? 'rgba(76,155,232,0.2)' : 'transparent'};
        color:${isActive ? '#4c9be8' : 'var(--text-muted)'};
        transition:all .15s;
      `;
      btn.onmouseover = () => { if (!(r === activeChartRange && iv === activeChartInterval)) btn.style.background = 'rgba(136,146,176,0.1)'; };
      btn.onmouseout  = () => { if (!(r === activeChartRange && iv === activeChartInterval)) btn.style.background = 'transparent'; };
      btn.onclick = () => {
        stopRealtime();
        if (window._stopRealtimeCleanup) { window._stopRealtimeCleanup(); }
        const tvContainer = document.getElementById('tradingviewChart');
        renderFallbackChart(tvContainer, ticker, r, iv);
      };
      tfBar.appendChild(btn);
    });

    // ── Log / Auto scale toggle buttons ──
    const scaleBar = document.createElement('div');
    scaleBar.style.cssText = 'position:absolute;top:34px;right:12px;z-index:20;display:flex;gap:4px;align-items:center;';

    // Log toggle
    const logBtn = document.createElement('button');
    logBtn.textContent = 'Log';
    logBtn.title = 'Chế độ thang logarit – % thay đổi bằng nhau = khoảng cách bằng nhau';
    const isLogActive = activeChartScale === 'log';
    logBtn.style.cssText = `
      padding:2px 7px;font-size:10px;font-weight:600;border-radius:4px;cursor:pointer;
      border:1px solid ${isLogActive ? '#a259ff' : 'rgba(136,146,176,0.2)'};
      background:${isLogActive ? 'rgba(162,89,255,0.2)' : 'transparent'};
      color:${isLogActive ? '#a259ff' : 'var(--text-muted)'};
      transition:all .15s;
    `;
    logBtn.onclick = () => {
      activeChartScale = activeChartScale === 'log' ? 'linear' : 'log';
      if (activeChart) {
        const scaleMode = activeChartScale === 'log'
          ? LightweightCharts.PriceScaleMode.Logarithmic
          : LightweightCharts.PriceScaleMode.Normal;
        activeChart.priceScale('right').applyOptions({ mode: scaleMode });
        logBtn.style.color = activeChartScale === 'log' ? '#a259ff' : 'var(--text-muted)';
        logBtn.style.border = `1px solid ${activeChartScale === 'log' ? '#a259ff' : 'rgba(136,146,176,0.2)'}`;
        logBtn.style.background = activeChartScale === 'log' ? 'rgba(162,89,255,0.2)' : 'transparent';
      }
    };
    scaleBar.appendChild(logBtn);

    // Auto toggle
    const autoBtn = document.createElement('button');
    autoBtn.textContent = 'Auto';
    autoBtn.title = 'Tự động căn chỉnh trục giá theo vùng đang xem';
    const isAutoActive = activeChartAutoScale;
    autoBtn.style.cssText = `
      padding:2px 7px;font-size:10px;font-weight:600;border-radius:4px;cursor:pointer;
      border:1px solid ${isAutoActive ? '#00d4aa' : 'rgba(136,146,176,0.2)'};
      background:${isAutoActive ? 'rgba(0,212,170,0.15)' : 'transparent'};
      color:${isAutoActive ? '#00d4aa' : 'var(--text-muted)'};
      transition:all .15s;
    `;
    autoBtn.onclick = () => {
      activeChartAutoScale = !activeChartAutoScale;
      if (activeChart) {
        activeChart.priceScale('right').applyOptions({ autoScale: activeChartAutoScale });
        if (activeChartAutoScale) activeChart.timeScale().fitContent();
        autoBtn.style.color = activeChartAutoScale ? '#00d4aa' : 'var(--text-muted)';
        autoBtn.style.border = `1px solid ${activeChartAutoScale ? '#00d4aa' : 'rgba(136,146,176,0.2)'}`;
        autoBtn.style.background = activeChartAutoScale ? 'rgba(0,212,170,0.15)' : 'transparent';
      }
    };
    scaleBar.appendChild(autoBtn);

    chartWrapper.appendChild(tfBar);
    chartWrapper.appendChild(scaleBar);

    // Create chart
    const chart = LightweightCharts.createChart(chartWrapper, {
      width: chartWrapper.clientWidth,
      height: chartWrapper.clientHeight,
      layout: {
        background: { type: 'solid', color: 'transparent' },
        textColor: '#8892b0',
        fontFamily: 'Inter, sans-serif',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: 'rgba(136, 146, 176, 0.06)' },
        horzLines: { color: 'rgba(136, 146, 176, 0.06)' },
      },
      crosshair: {
        mode: LightweightCharts.CrosshairMode.Normal,
        vertLine: { color: 'rgba(76, 155, 232, 0.3)', width: 1, style: 2 },
        horzLine: { color: 'rgba(76, 155, 232, 0.3)', width: 1, style: 2 },
      },
      rightPriceScale: { borderColor: 'rgba(136, 146, 176, 0.1)' },
      timeScale: { borderColor: 'rgba(136, 146, 176, 0.1)', timeVisible: false },
    });
    activeChart = chart;

    // Candlestick series
    const candleSeries = chart.addCandlestickSeries({
      upColor: '#00d4aa', downColor: '#ff4757',
      borderUpColor: '#00d4aa', borderDownColor: '#ff4757',
      wickUpColor: '#00d4aa', wickDownColor: '#ff4757',
    });

    // ── Apply VN stock market candle colors ──
    // Yellow: close == open (unchanged/reference)
    // Blue: close hits floor (sàn, -7% HOSE, -10% HNX, -15% UPCOM)
    // Purple: close hits ceiling (trần, +7% HOSE, +10% HNX, +15% UPCOM)
    const chartExchange = getSelectedExchange();
    const isVN = ['HOSE', 'HNX', 'UPCOM'].includes(chartExchange) || 
                 (chartExchange === 'AUTO' && STOCK_DB.some(s => s.s === ticker.toUpperCase()));
    
    let limitPct = 0.07; // HOSE default
    if (chartExchange === 'HNX') limitPct = 0.10;
    else if (chartExchange === 'UPCOM') limitPct = 0.15;

    const coloredData = data.map((d, i) => {
      const candle = { ...d };
      
      if (isVN && i > 0) {
        const refPrice = data[i - 1].close; // Previous close = reference price
        const ceiling = Math.round(refPrice * (1 + limitPct) / 50) * 50; // Round to tick size
        const floor = Math.round(refPrice * (1 - limitPct) / 50) * 50;
        
        // Check ceiling (trần) → purple
        if (d.close >= ceiling) {
          candle.color = '#9B59B6';
          candle.borderColor = '#9B59B6';
          candle.wickColor = '#9B59B6';
        }
        // Check floor (sàn) → blue
        else if (d.close <= floor) {
          candle.color = '#1E90FF';
          candle.borderColor = '#1E90FF';
          candle.wickColor = '#1E90FF';
        }
        // Check unchanged (tham chiếu) → yellow
        else if (d.close === d.open) {
          candle.color = '#FFD700';
          candle.borderColor = '#FFD700';
          candle.wickColor = '#FFD700';
        }
      } else if (!isVN) {
        // Non-VN stocks: just yellow for unchanged
        if (d.close === d.open) {
          candle.color = '#FFD700';
          candle.borderColor = '#FFD700';
          candle.wickColor = '#FFD700';
        }
      }
      
      return candle;
    });
    
    candleSeries.setData(coloredData);
    activeCandleSeries = candleSeries;

    // Volume - match candle colors
    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    });
    chart.priceScale('volume').applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } });
    volumeSeries.setData(coloredData.map((d, i) => {
      let volColor = d.close >= d.open ? 'rgba(0,212,170,0.2)' : 'rgba(255,71,87,0.2)';
      // Match special colors
      if (d.color === '#9B59B6') volColor = 'rgba(155,89,182,0.3)'; // Purple
      else if (d.color === '#1E90FF') volColor = 'rgba(30,144,255,0.3)'; // Blue
      else if (d.color === '#FFD700') volColor = 'rgba(255,215,0,0.3)'; // Yellow
      return { time: d.time, value: d.volume || 0, color: volColor };
    }));

    // Apply active indicators from toolbar
    activeIndicatorSeries = {};
    updateChartIndicators();

    chart.timeScale().fitContent();

    // Responsive resize
    const resizeObserver = new ResizeObserver(() => {
      chart.applyOptions({ width: chartWrapper.clientWidth, height: chartWrapper.clientHeight });
    });
    resizeObserver.observe(chartWrapper);



    // ── Start real-time data feed ──
    const exchange = getSelectedExchange();
    const finnhubKey = localStorage.getItem('finnhubKey') || '';

    // Helper: format Unix timestamp → 'YYYY-MM-DD'
    const toDateStr = (t) => typeof t === 'number'
      ? new Date(t * 1000).toISOString().split('T')[0]
      : String(t).split('T')[0];

    // Helper: update info bar price display
    const updateInfoBar = (close, open) => {
      const bar = document.getElementById('realtimeInfoBar');
      if (!bar) return;
      const ref = activeChartData.length >= 2 ? activeChartData[activeChartData.length - 2].close : open;
      const change = close - ref;
      const changePct = ref ? (change / ref * 100).toFixed(2) : 0;
      const color = change >= 0 ? '#00d4aa' : '#ff4757';
      const sym = change >= 0 ? '▲' : '▼';
      const formatted = close >= 1000 ? close.toLocaleString('vi-VN') : close.toFixed(2);
      const priceEl = bar.querySelector('.live-price');
      const changeEl = bar.querySelector('.live-change');
      if (priceEl) { priceEl.textContent = `${sym} ${formatted}`; priceEl.style.color = color; priceEl.style.textShadow = `0 0 8px ${color}40`; }
      if (changeEl) { changeEl.textContent = `${change >= 0 ? '+' : ''}${change.toFixed(0)} (${change >= 0 ? '+' : ''}${changePct}%)`; changeEl.style.color = color; }
    };

    // Mark info bar elements with classes for easy update
    const bar = document.getElementById('realtimeInfoBar');
    if (bar) {
      const spans = bar.querySelectorAll('span');
      if (spans[1]) spans[1].classList.add('live-price');
      if (spans[2]) spans[2].classList.add('live-change');
    }

    // onTick callback from SSI intraday  → update today's daily candle
    startRealtime(ticker, exchange, (tick) => {
      if (!activeCandleSeries) return;
      const todayStr = new Date().toISOString().split('T')[0];
      const timeStr  = toDateStr(tick.time);

      // Only update if it's today's candle (don't retroactively change historical)
      if (timeStr === todayStr || tick._update) {
        try {
          activeCandleSeries.update({
            time:  todayStr,
            open:  tick.open  || activeChartData[activeChartData.length - 1].open,
            high:  tick.high  || tick.close,
            low:   tick.low   || tick.close,
            close: tick.close,
          });
          updateInfoBar(tick.close, tick.open);
        } catch(e) { /* ignore time ordering errors */ }
      }
    }, finnhubKey);

    // ── Live price poller (every 30s) – works even when market closed ──
    // Fetches latest price from backend /api/quote and updates last candle close
    let livePollTimer = null;
    const pollLivePrice = async () => {
      try {
        const resp = await fetch(`/api/quote/${encodeURIComponent(ticker)}?exchange=${exchange}`, {
          signal: AbortSignal.timeout(8000)
        });
        if (!resp.ok) return;
        const d = await resp.json();
        const price = d.price;
        if (!price || !activeCandleSeries) return;

        const todayStr = new Date().toISOString().split('T')[0];
        const lastCandle = activeChartData[activeChartData.length - 1];
        try {
          activeCandleSeries.update({
            time:  todayStr,
            open:  lastCandle.open,
            high:  Math.max(lastCandle.high, price),
            low:   Math.min(lastCandle.low, price),
            close: price,
          });
          updateInfoBar(price, lastCandle.open);
        } catch(e) { /* ignore */ }
      } catch(e) { /* ignore polling errors */ }
    };

    // Poll immediately then every 30 seconds
    pollLivePrice();
    livePollTimer = setInterval(pollLivePrice, 30000);

    // Clean up timer when chart is stopped
    const origStop = window._stopRealtimeCleanup;
    window._stopRealtimeCleanup = () => {
      if (livePollTimer) { clearInterval(livePollTimer); livePollTimer = null; }
      if (origStop) origStop();
    };

  } catch (err) {
    console.error('Fallback chart error:', err);
    container.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;height:100%;flex-direction:column;gap:12px">
        <span style="font-size:48px">⚠️</span>
        <span style="color:var(--text-muted);font-size:14px">Lỗi tải dữ liệu: ${err.message}</span>
      </div>`;
  }
}

/**
 * Update indicators on the chart based on toolbar badge states
 */
function updateChartIndicators() {
  if (!activeChart || !activeChartData.length) return;

  const data = activeChartData;
  const activeBadges = [...document.querySelectorAll('.ind-badge.active')].map(b => b.dataset.ind);

  // Remove old indicator series
  Object.keys(activeIndicatorSeries).forEach(key => {
    if (!activeBadges.includes(key)) {
      try { activeChart.removeSeries(activeIndicatorSeries[key]); } catch(e) {}
      delete activeIndicatorSeries[key];
    }
  });

  // Add new indicator series
  const addLine = (key, calcData, color) => {
    if (activeBadges.includes(key) && !activeIndicatorSeries[key]) {
      const series = activeChart.addLineSeries({
        color, lineWidth: 1.5, priceLineVisible: false, lastValueVisible: false,
      });
      series.setData(calcData);
      activeIndicatorSeries[key] = series;
    }
  };

  addLine('sma20', calcSMA(data, 20), '#4c9be8');
  addLine('sma50', calcSMA(data, 50), '#ff8c42');
  addLine('ema12', calcEMA(data, 12), '#a259ff');
  addLine('ema26', calcEMA(data, 26), '#ff6b9d');

  // Bollinger Bands (SMA20 ± 2*StdDev)
  if (activeBadges.includes('bollinger') && !activeIndicatorSeries['bollinger']) {
    const bb = calcBollinger(data, 20);
    const upper = activeChart.addLineSeries({
      color: 'rgba(255,71,87,0.5)', lineWidth: 1, priceLineVisible: false, lastValueVisible: false,
    });
    upper.setData(bb.upper);
    const lower = activeChart.addLineSeries({
      color: 'rgba(0,212,170,0.5)', lineWidth: 1, priceLineVisible: false, lastValueVisible: false,
    });
    lower.setData(bb.lower);
    activeIndicatorSeries['bollinger'] = upper; // store one reference
    activeIndicatorSeries['bollinger_lower'] = lower;
  } else if (!activeBadges.includes('bollinger') && activeIndicatorSeries['bollinger']) {
    try { activeChart.removeSeries(activeIndicatorSeries['bollinger']); } catch(e) {}
    try { activeChart.removeSeries(activeIndicatorSeries['bollinger_lower']); } catch(e) {}
    delete activeIndicatorSeries['bollinger'];
    delete activeIndicatorSeries['bollinger_lower'];
  }

  // VWAP
  if (activeBadges.includes('vwap') && !activeIndicatorSeries['vwap']) {
    const vwapData = calcVWAP(data);
    const series = activeChart.addLineSeries({
      color: '#ffd700', lineWidth: 1.5, lineStyle: 2, priceLineVisible: false, lastValueVisible: false,
    });
    series.setData(vwapData);
    activeIndicatorSeries['vwap'] = series;
  }

  // RSI and MACD are pane indicators — show as tooltip info since lightweight-charts
  // doesn't natively support sub-panes in the free version
  if (activeBadges.includes('rsi') && !activeIndicatorSeries['rsi']) {
    const rsiData = calcRSI14(data);
    // Display RSI as an area on a separate price scale
    const series = activeChart.addLineSeries({
      color: '#a259ff', lineWidth: 1, priceLineVisible: false, lastValueVisible: true,
      priceScaleId: 'rsi',
    });
    activeChart.priceScale('rsi').applyOptions({
      scaleMargins: { top: 0.8, bottom: 0.02 },
    });
    series.setData(rsiData);
    activeIndicatorSeries['rsi'] = series;
  }

  if (activeBadges.includes('macd') && !activeIndicatorSeries['macd']) {
    const macdData = calcMACDLine(data);
    const series = activeChart.addHistogramSeries({
      priceScaleId: 'macd',
    });
    activeChart.priceScale('macd').applyOptions({
      scaleMargins: { top: 0.85, bottom: 0 },
    });
    series.setData(macdData);
    activeIndicatorSeries['macd'] = series;
  }
}

function calcSMA(data, period) {
  const result = [];
  for (let i = period - 1; i < data.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) sum += data[i - j].close;
    result.push({ time: data[i].time, value: sum / period });
  }
  return result;
}

function calcEMA(data, period) {
  const k = 2 / (period + 1);
  const result = [];
  let ema = data[0].close;
  for (let i = 0; i < data.length; i++) {
    ema = data[i].close * k + ema * (1 - k);
    if (i >= period - 1) {
      result.push({ time: data[i].time, value: ema });
    }
  }
  return result;
}

function calcBollinger(data, period) {
  const sma = calcSMA(data, period);
  const upper = [], lower = [];
  for (let i = period - 1; i < data.length; i++) {
    const smaIdx = i - (period - 1);
    if (smaIdx >= sma.length) break;
    let variance = 0;
    for (let j = 0; j < period; j++) {
      variance += Math.pow(data[i - j].close - sma[smaIdx].value, 2);
    }
    const stdDev = Math.sqrt(variance / period);
    upper.push({ time: data[i].time, value: sma[smaIdx].value + 2 * stdDev });
    lower.push({ time: data[i].time, value: sma[smaIdx].value - 2 * stdDev });
  }
  return { upper, lower };
}

function calcVWAP(data) {
  const result = [];
  let cumVol = 0, cumTP = 0;
  for (const d of data) {
    const tp = (d.high + d.low + d.close) / 3;
    cumTP += tp * (d.volume || 1);
    cumVol += (d.volume || 1);
    result.push({ time: d.time, value: cumTP / cumVol });
  }
  return result;
}

function calcRSI14(data, period = 14) {
  if (data.length < period + 1) return [];
  const result = [];
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const change = data[i].close - data[i - 1].close;
    if (change >= 0) gains += change; else losses -= change;
  }
  let avgGain = gains / period, avgLoss = losses / period;
  for (let i = period; i < data.length; i++) {
    if (i > period) {
      const change = data[i].close - data[i - 1].close;
      avgGain = (avgGain * (period - 1) + (change >= 0 ? change : 0)) / period;
      avgLoss = (avgLoss * (period - 1) + (change < 0 ? -change : 0)) / period;
    }
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    result.push({ time: data[i].time, value: +(100 - 100 / (1 + rs)).toFixed(2) });
  }
  return result;
}

function calcMACDLine(data) {
  const ema12 = calcEMA(data, 12);
  const ema26 = calcEMA(data, 26);
  const result = [];
  const offset = ema12.length - ema26.length;
  for (let i = 0; i < ema26.length; i++) {
    const macdVal = ema12[i + offset].value - ema26[i].value;
    result.push({
      time: ema26[i].time,
      value: macdVal,
      color: macdVal >= 0 ? 'rgba(0,212,170,0.5)' : 'rgba(255,71,87,0.5)',
    });
  }
  return result;
}

async function fetchYahooFinanceData(ticker, range = '6mo', interval = '1d') {
  // Call the local backend which fetches Yahoo Finance server-side (no CORS issues)
  const url = `/api/ssi-chart/${encodeURIComponent(ticker)}?range=${range}&interval=${interval}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`Lỗi server: ${res.status}`);
  const json = await res.json();
  if (!json.candles || json.candles.length === 0) throw new Error('Không tải được dữ liệu từ server');
  // For intraday, time is Unix timestamp (number); for daily, it's 'YYYY-MM-DD' (string)
  return { candles: json.candles, intraday: json.intraday || false };
}

// ── Market Status Bar ──────────────────────────────────────

function startMarketStatusBar() {
  updateMarketStatusClock();
  marketStatusTimer = setInterval(updateMarketStatusClock, 30000); // update every 30s
}

async function updateMarketStatusClock() {
  const bar = document.getElementById('marketStatusBar');
  if (!bar) return;
  
  const status = getVNMarketStatus();
  const now = new Date();
  const timeVN = now.toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' });
  
  bar.innerHTML = `
    <span class="market-time">🕐 ${timeVN}</span>
    <span class="market-state ${status.open ? 'open' : 'closed'}">${status.label}</span>
    ${status.remaining ? `<span class="market-remaining">Còn ${status.remaining}</span>` : ''}
    <span id="marketIndexDisplay" class="market-index">📈 VN-Index --</span>
  `;
  
  // Fetch VN-Index in background
  fetchVNMarketSummary().then(data => {
    if (!data) return;
    const idx = data.indices?.VNINDEX || data.indices?.['VN-INDEX'];
    const el = document.getElementById('marketIndexDisplay');
    if (idx && el) {
      const color = idx.changePct >= 0 ? '#00d4aa' : '#ff4757';
      const arrow = idx.changePct >= 0 ? '▲' : '▼';
      el.innerHTML = `📈 VN-Index <span style="color:${color};font-weight:700">${idx.value.toFixed(2)} ${arrow} ${Math.abs(idx.changePct).toFixed(2)}%</span>`;
    }
  }).catch(() => {});
}

function updateMarketStatusBadge(ticker, isVN) {
  const badge = document.getElementById('liveStatusBadge');
  if (!badge) return;
  if (isVN && isVNMarketOpen()) {
    badge.textContent = '🔴 LIVE';
    badge.classList.add('live-pulse');
    badge.style.display = 'inline-block';
  } else if (isVN) {
    badge.textContent = '⏸ CLOSED';
    badge.classList.remove('live-pulse');
    badge.style.display = 'inline-block';
  } else {
    badge.textContent = '🔴 LIVE';
    badge.classList.add('live-pulse');
    badge.style.display = 'inline-block';
  }
}

/**
 * Render technical analysis panel
 */
let lastAnalysis = null;

function renderAnalysis(analysis) {
  lastAnalysis = analysis;

  // Signal — clickable
  els.analysisEmoji.textContent = analysis.signalEmoji;
  els.analysisLabel.textContent = analysis.signalVi;
  els.analysisLabel.style.color = analysis.signalColor;
  els.analysisSignal.style.background = `${analysis.signalColor}10`;
  els.analysisSignal.classList.add('clickable');
  els.analysisSignal.onclick = () => showPopup('signal', analysis);

  // Indicators
  els.sma20Value.textContent = analysis.indicators.sma20 != null ? `$${analysis.indicators.sma20}` : '--';
  els.sma50Value.textContent = analysis.indicators.sma50 != null ? `$${analysis.indicators.sma50}` : '--';
  els.rsiValue.textContent = analysis.indicators.rsi != null ? analysis.indicators.rsi.toFixed(1) : '--';

  // RSI color
  if (analysis.indicators.rsi > 70) {
    els.rsiValue.style.color = '#ff4757';
  } else if (analysis.indicators.rsi < 30) {
    els.rsiValue.style.color = '#00d4aa';
  } else {
    els.rsiValue.style.color = '';
  }

  // MACD
  const macdEl = document.getElementById('macdValue');
  if (macdEl && analysis.indicators.macd != null) {
    const macdVal = analysis.indicators.macd;
    macdEl.textContent = macdVal.toFixed(2);
    macdEl.style.color = macdVal > analysis.indicators.macdSignal ? '#00d4aa' : '#ff4757';
  }

  // Bollinger
  const bollEl = document.getElementById('bollingerValue');
  if (bollEl && analysis.indicators.bollingerPosition != null) {
    const pos = (analysis.indicators.bollingerPosition * 100).toFixed(0);
    bollEl.textContent = `${pos}%`;
    bollEl.style.color = analysis.indicators.bollingerPosition > 0.8 ? '#ff4757'
      : analysis.indicators.bollingerPosition < 0.2 ? '#00d4aa' : '';
  }

  // Make indicator items clickable
  const indicatorItems = document.querySelectorAll('.indicator-item');
  const indicatorKeys = ['sma20', 'sma50', 'rsi', 'macd', 'bollinger', 'pattern'];
  indicatorItems.forEach((item, i) => {
    item.classList.add('clickable');
    item.onclick = () => showPopup(indicatorKeys[i], analysis);
  });

  // Patterns — clickable
  els.patternValue.textContent = analysis.patterns[0]?.nameVi || '--';
  els.patternsSection.innerHTML = analysis.patterns.map((p, i) =>
    `<span class="pattern-badge clickable ${p.type}" data-pattern-index="${i}">${p.nameVi}</span>`
  ).join('');
  els.patternsSection.querySelectorAll('.pattern-badge').forEach(badge => {
    badge.onclick = () => {
      const idx = parseInt(badge.dataset.patternIndex);
      showPopup('pattern-detail', analysis, idx);
    };
  });

  // Reasons — clickable
  els.reasonsList.innerHTML = analysis.reasons.map((r, i) => {
    const icon = r.type === 'bullish' ? '📈' : r.type === 'bearish' ? '📉' : 'ℹ️';
    return `
      <div class="reason-item clickable ${r.type}" data-reason-index="${i}" style="animation-delay: ${i * 0.05}s">
        <span class="reason-icon">${icon}</span>
        <span>${r.text}</span>
      </div>
    `;
  }).join('');
  els.reasonsList.querySelectorAll('.reason-item').forEach(item => {
    item.onclick = () => {
      const idx = parseInt(item.dataset.reasonIndex);
      showPopup('reason', analysis, idx);
    };
  });

  // Score bars
  const techPct = Math.min(100, Math.max(0, (analysis.techScore + 60) / 120 * 100));
  const sentPct = Math.min(100, Math.max(0, (analysis.sentScore + 50) / 100 * 100));

  setTimeout(() => {
    els.techScoreBar.style.width = `${techPct}%`;
    els.techScoreBar.style.background = analysis.techScore > 0
      ? 'linear-gradient(90deg, #00d4aa, #51cf66)'
      : 'linear-gradient(90deg, #ff4757, #ff8c42)';

    els.sentScoreBar.style.width = `${sentPct}%`;
    els.sentScoreBar.style.background = analysis.sentScore > 0
      ? 'linear-gradient(90deg, #00d4aa, #51cf66)'
      : 'linear-gradient(90deg, #ff4757, #ff8c42)';
  }, 300);

  els.techScoreValue.textContent = analysis.techScore > 0 ? `+${analysis.techScore}` : analysis.techScore;
  els.sentScoreValue.textContent = analysis.sentScore > 0 ? `+${analysis.sentScore}` : analysis.sentScore;
}

// ═══════════════════════════════════════════════════
// INDICATOR DETAIL POPUP
// ═══════════════════════════════════════════════════

function showPopup(type, analysis, extraIndex = 0) {
  const overlay = document.getElementById('indicatorPopupOverlay');
  const header = document.getElementById('popupHeader');
  const body = document.getElementById('popupBody');

  const content = getPopupContent(type, analysis, extraIndex);
  header.innerHTML = content.header;
  body.innerHTML = content.body;

  overlay.classList.add('show');

  // Close handlers
  document.getElementById('popupClose').onclick = closePopup;
  overlay.onclick = (e) => { if (e.target === overlay) closePopup(); };
  document.onkeydown = (e) => { if (e.key === 'Escape') closePopup(); };
}

function closePopup() {
  document.getElementById('indicatorPopupOverlay').classList.remove('show');
}

function getPopupContent(type, a, idx) {
  const ind = a.indicators;
  const price = a.price;

  const popupData = {
    signal: () => {
      const isGood = a.combinedScore > 10;
      const isBad = a.combinedScore < -10;
      return {
        header: `<h3>${a.signalEmoji} ${a.signalVi}</h3><div class="popup-subtitle">Tín hiệu tổng hợp dựa trên ${a.reasons.length} yếu tố phân tích</div>`,
        body: `
          <div class="popup-section">
            <div class="popup-section-title">Điểm tổng hợp</div>
            <div class="popup-value ${isGood ? 'bullish' : isBad ? 'bearish' : 'neutral'}">${a.combinedScore > 0 ? '+' : ''}${a.combinedScore}</div>
            <div class="popup-meter"><div class="popup-meter-fill" style="width:${Math.min(100, Math.max(0, (a.combinedScore + 60) / 120 * 100))}%; background:${a.signalColor}"></div></div>
            <div class="popup-text">Điểm từ -60 đến +60. Trên +30 = mua mạnh, trên +10 = mua, -10 đến +10 = giữ, dưới -10 = bán.</div>
          </div>
          <div class="popup-section">
            <div class="popup-section-title">Cách tính</div>
            <div class="popup-text">
              <b>60% kỹ thuật</b> (SMA, RSI, MACD, Bollinger, mẫu nến) + <b>40% cảm xúc</b> (tin tức)<br>
              Kỹ thuật: <b>${a.techScore > 0 ? '+' : ''}${a.techScore}</b> × 0.6 = ${(a.techScore * 0.6).toFixed(1)}<br>
              Cảm xúc: <b>${a.sentScore > 0 ? '+' : ''}${a.sentScore}</b> × 0.4 = ${(a.sentScore * 0.4).toFixed(1)}
            </div>
          </div>
          <div class="popup-section">
            <div class="popup-tip">💡 <b>Gợi ý:</b> ${isGood ? 'Tín hiệu tích cực. Có thể xem xét mua nếu khớp với xu hướng dài hạn.' : isBad ? 'Tín hiệu tiêu cực. Nên cẩn thận, có thể chờ đợi hoặc giảm vị thế.' : 'Tín hiệu trung lập. Nên chờ tín hiệu rõ ràng hơn trước khi hành động.'}</div>
          </div>`
      };
    },
    sma20: () => {
      const above = price.current > ind.sma20;
      return {
        header: `<h3>📏 SMA 20 (Simple Moving Average)</h3><div class="popup-subtitle">Trung bình giá đơn giản 20 ngày</div>`,
        body: `
          <div class="popup-section">
            <div class="popup-section-title">Giá trị hiện tại</div>
            <div class="popup-value ${above ? 'bullish' : 'bearish'}">$${ind.sma20}</div>
            <div class="popup-text">Giá hiện tại: <b>$${price.current}</b> — ${above ? '<span style="color:#00d4aa"><b>CAO HƠN</b></span> SMA20 → xu hướng tăng' : '<span style="color:#ff4757"><b>THẤP HƠN</b></span> SMA20 → xu hướng giảm'}</div>
          </div>
          <div class="popup-section">
            <div class="popup-section-title">SMA 20 là gì?</div>
            <div class="popup-text">Là giá trung bình đóng cửa của 20 phiên gần nhất. Đây là "đường xu hướng ngắn hạn" — nếu giá luôn trên đường này, xu hướng tăng mạnh.</div>
          </div>
          <div class="popup-section">
            <div class="popup-chart-hint">📊 <b>Nhìn trên biểu đồ:</b> SMA 20 là đường <b style="color:#4c9be8">xanh dương</b> mượt chạy qua các nến. Khi nến xanh vượt lên trên đường này = tín hiệu mua.</div>
          </div>
          <div class="popup-section">
            <div class="popup-tip">💡 <b>Mẹo giao dịch:</b> Khi giá vừa chạm đường SMA20 rồi bật lên → đây thường là điểm mua tốt (support). Khi giá xuyên xuống SMA20 → cân nhắc bán.</div>
          </div>`
      };
    },
    sma50: () => {
      const above = price.current > ind.sma50;
      const golden = ind.sma20 > ind.sma50;
      return {
        header: `<h3>📏 SMA 50 (Simple Moving Average)</h3><div class="popup-subtitle">Trung bình giá đơn giản 50 ngày</div>`,
        body: `
          <div class="popup-section">
            <div class="popup-section-title">Giá trị hiện tại</div>
            <div class="popup-value ${above ? 'bullish' : 'bearish'}">$${ind.sma50}</div>
            <div class="popup-text">Giá hiện tại: <b>$${price.current}</b> — ${above ? '<span style="color:#00d4aa"><b>CAO HƠN</b></span> SMA50 → xu hướng trung hạn tăng' : '<span style="color:#ff4757"><b>THẤP HƠN</b></span> SMA50 → xu hướng trung hạn giảm'}</div>
          </div>
          <div class="popup-section">
            <div class="popup-section-title">Golden Cross / Death Cross</div>
            <div class="popup-text">${golden ? '🟢 <b>GOLDEN CROSS</b> — SMA20 ($' + ind.sma20 + ') > SMA50 ($' + ind.sma50 + '). Đây là tín hiệu mua trung hạn mạnh!' : '🔴 <b>DEATH CROSS</b> — SMA20 ($' + ind.sma20 + ') < SMA50 ($' + ind.sma50 + '). Tín hiệu bán trung hạn.'}</div>
          </div>
          <div class="popup-section">
            <div class="popup-chart-hint">📊 <b>Nhìn trên biểu đồ:</b> SMA50 là đường trung bình dài hơn. Khi đường SMA20 (ngắn hạn) cắt lên trên SMA50 = Golden Cross. Cắt xuống = Death Cross.</div>
          </div>`
      };
    },
    rsi: () => {
      const val = ind.rsi;
      const zone = val > 70 ? 'overbought' : val < 30 ? 'oversold' : val > 50 ? 'bullish' : 'bearish';
      return {
        header: `<h3>⚡ RSI 14 (Relative Strength Index)</h3><div class="popup-subtitle">Chỉ số sức mạnh tương đối 14 ngày</div>`,
        body: `
          <div class="popup-section">
            <div class="popup-section-title">Giá trị hiện tại</div>
            <div class="popup-value ${zone === 'overbought' ? 'bearish' : zone === 'oversold' ? 'bullish' : 'neutral'}">${val?.toFixed(1)}</div>
            <div class="popup-meter"><div class="popup-meter-fill" style="width:${val}%; background:${val > 70 ? '#ff4757' : val < 30 ? '#00d4aa' : '#4c9be8'}"></div></div>
            <div class="popup-text">${zone === 'overbought' ? '🔴 <b>QUÁ MUA!</b> RSI > 70 — cổ phiếu đã tăng quá nhiều, có thể sắp điều chỉnh giảm. Cẩn thận!' : zone === 'oversold' ? '🟢 <b>QUÁ BÁN!</b> RSI < 30 — cổ phiếu bị bán quá nhiều, có cơ hội phục hồi tốt.' : val > 50 ? '🟢 RSI > 50 — Lực mua đang mạnh hơn lực bán. Xu hướng tích cực.' : '🟠 RSI < 50 — Lực bán đang mạnh hơn lực mua. Xu hướng tiêu cực.'}</div>
          </div>
          <div class="popup-section">
            <div class="popup-section-title">RSI đo gì?</div>
            <div class="popup-text">RSI đo tốc độ và biên độ thay đổi giá. Thang điểm 0–100:<br>• <b>0–30:</b> Quá bán (oversold) → cơ hội MUA<br>• <b>30–50:</b> Yếu → lực bán chiếm ưu<br>• <b>50–70:</b> Mạnh → lực mua chiếm ưu<br>• <b>70–100:</b> Quá mua (overbought) → nên BÁN</div>
          </div>
          <div class="popup-section">
            <div class="popup-chart-hint">📊 <b>Nhìn trên biểu đồ:</b> RSI là đường <b style="color:#a855f7">tím</b> ở phần dưới cùng biểu đồ. Hai đường nét đứt ngang ở mức 30 và 70 là ranh giới quá bán/quá mua.</div>
          </div>`
      };
    },
    macd: () => {
      const macdVal = ind.macd;
      const sigVal = ind.macdSignal;
      const above = macdVal > sigVal;
      return {
        header: `<h3>📈 MACD (Moving Average Convergence Divergence)</h3><div class="popup-subtitle">Chỉ báo hội tụ/phân kỳ trung bình động</div>`,
        body: `
          <div class="popup-section">
            <div class="popup-section-title">Giá trị hiện tại</div>
            <div class="popup-value ${above ? 'bullish' : 'bearish'}">${macdVal?.toFixed(2)}</div>
            <div class="popup-text">MACD: <b>${macdVal?.toFixed(2)}</b> | Signal: <b>${sigVal?.toFixed(2)}</b><br>
            ${above ? '🟢 <b>MACD > Signal</b> — Momentum TĂNG! Lực mua đang mạnh lên, đà tăng giá.' : '🔴 <b>MACD < Signal</b> — Momentum GIẢM! Lực bán đang mạnh lên, đà giảm giá.'}</div>
          </div>
          <div class="popup-section">
            <div class="popup-section-title">MACD hoạt động thế nào?</div>
            <div class="popup-text">MACD = EMA(12) − EMA(26). So sánh xu hướng nhanh và chậm:<br>• <b>Histogram xanh</b> (cột lên) = momentum tăng<br>• <b>Histogram đỏ</b> (cột xuống) = momentum giảm<br>• MACD cắt lên Signal = <b>tín hiệu MUA</b><br>• MACD cắt xuống Signal = <b>tín hiệu BÁN</b></div>
          </div>
          <div class="popup-section">
            <div class="popup-chart-hint">📊 <b>Nhìn trên biểu đồ:</b> MACD ở phần giữa biểu đồ. Đường <b style="color:#4c9be8">xanh dương</b> = MACD, đường <b style="color:#ff8c42">cam</b> = Signal. Các cột histogram xanh/đỏ ở giữa cho thấy sức mạnh của đà tăng/giảm.</div>
          </div>`
      };
    },
    bollinger: () => {
      const pos = ind.bollingerPosition;
      const upper = ind.bollingerUpper;
      const lower = ind.bollingerLower;
      return {
        header: `<h3>🎯 Bollinger Bands (20, 2)</h3><div class="popup-subtitle">Dải Bollinger — đo biến động giá</div>`,
        body: `
          <div class="popup-section">
            <div class="popup-section-title">Vị trí giá trong Bollinger Bands</div>
            <div class="popup-value ${pos > 0.8 ? 'bearish' : pos < 0.2 ? 'bullish' : 'neutral'}">${(pos * 100).toFixed(0)}%</div>
            <div class="popup-meter"><div class="popup-meter-fill" style="width:${pos * 100}%; background:${pos > 0.8 ? '#ff4757' : pos < 0.2 ? '#00d4aa' : '#4c9be8'}"></div></div>
            <div class="popup-text">Band trên: <b>$${upper}</b> | Band dưới: <b>$${lower}</b> | Giá: <b>$${price.current}</b><br>
            ${pos > 0.95 ? '🔴 Giá chạm Bollinger Band TRÊN → quá mua, khả năng cao sẽ quay đầu giảm!' : pos < 0.05 ? '🟢 Giá chạm Bollinger Band DƯỚI → quá bán, khả năng cao sẽ phục hồi!' : pos > 0.7 ? '🟡 Giá ở vùng trên, xu hướng tăng nhưng gần đỉnh.' : pos < 0.3 ? '🟡 Giá ở vùng dưới, xu hướng giảm nhưng gần đáy.' : '🔵 Giá ở vùng giữa — trung lập, chờ breakout.'}</div>
          </div>
          <div class="popup-section">
            <div class="popup-section-title">Bollinger Bands là gì?</div>
            <div class="popup-text">3 đường bao quanh giá dựa trên độ lệch chuẩn:<br>• <b>Band trên (đỏ):</b> SMA20 + 2σ → ngưỡng kháng cự<br>• <b>Band giữa:</b> SMA20 → xu hướng trung bình<br>• <b>Band dưới (xanh lá):</b> SMA20 − 2σ → ngưỡng hỗ trợ<br><br>⚡ <b>Bands co lại</b> = sắp có breakout mạnh!</div>
          </div>
          <div class="popup-section">
            <div class="popup-chart-hint">📊 <b>Nhìn trên biểu đồ:</b> Bollinger là 3 đường bao quanh nến. <b style="color:#ff4757">Đỏ</b> = band trên, <b style="color:#00d4aa">xanh lá</b> = band dưới. Khi nến chạm/vượt band → tín hiệu quan trọng!</div>
          </div>`
      };
    },
    pattern: () => {
      const p = a.patterns[0] || { nameVi: '--', description: 'Không có mẫu nến đặc biệt', type: 'neutral' };
      return {
        header: `<h3>🕯️ Mẫu Nến: ${p.nameVi}</h3><div class="popup-subtitle">Nhận diện mẫu hình nến Nhật</div>`,
        body: `
          <div class="popup-section">
            <div class="popup-section-title">Mẫu nến phát hiện</div>
            <div class="popup-text" style="font-size:16px"><b>${p.nameVi}</b> (${p.name || ''}) — <span style="color:${p.type === 'bullish' ? '#00d4aa' : p.type === 'bearish' ? '#ff4757' : '#4c9be8'}">${p.type === 'bullish' ? '🟢 Tăng giá' : p.type === 'bearish' ? '🔴 Giảm giá' : '🔵 Trung lập'}</span></div>
          </div>
          <div class="popup-section">
            <div class="popup-section-title">Giải thích</div>
            <div class="popup-text">${p.description}</div>
          </div>
          <div class="popup-section">
            <div class="popup-chart-hint">📊 <b>Nhìn trên biểu đồ:</b> Xem nến cuối cùng (ngoài cùng bên phải). Hình dạng thân nến + bóng nến tạo thành mẫu hình này. ${p.type === 'bullish' ? 'Mẫu này dự báo giá sẽ tăng.' : p.type === 'bearish' ? 'Mẫu này dự báo giá sẽ giảm.' : 'Thị trường chưa có xu hướng rõ ràng.'}</div>
          </div>
          <div class="popup-section">
            <div class="popup-tip">💡 <b>Lưu ý:</b> Mẫu nến nên kết hợp với chỉ báo khác (RSI, MACD) để xác nhận tín hiệu. Một mẫu nến đơn lẻ chưa đủ để quyết định mua/bán.</div>
          </div>`
      };
    },
    'pattern-detail': () => {
      const p = a.patterns[idx] || a.patterns[0];
      return popupData.pattern();
    },
    reason: () => {
      const r = a.reasons[idx];
      return {
        header: `<h3>${r.type === 'bullish' ? '📈' : r.type === 'bearish' ? '📉' : 'ℹ️'} Chi tiết phân tích</h3><div class="popup-subtitle">${r.type === 'bullish' ? 'Yếu tố tích cực (tăng giá)' : r.type === 'bearish' ? 'Yếu tố tiêu cực (giảm giá)' : 'Yếu tố trung lập'}</div>`,
        body: `
          <div class="popup-section">
            <div class="popup-section-title">Nội dung</div>
            <div class="popup-text" style="font-size:15px">${r.text}</div>
          </div>
          <div class="popup-section">
            <div class="popup-section-title">Ý nghĩa</div>
            <div class="popup-text">${r.type === 'bullish' ? '🟢 Đây là yếu tố <b>TÍCH CỰC</b> cho giá cổ phiếu. Tín hiệu này ủng hộ quyết định <b>MUA</b> hoặc <b>GIỮ</b>.' : r.type === 'bearish' ? '🔴 Đây là yếu tố <b>TIÊU CỰC</b> cho giá cổ phiếu. Tín hiệu này ủng hộ quyết định <b>BÁN</b> hoặc <b>CHỜ ĐỢI</b>.' : '🔵 Đây là yếu tố <b>TRUNG LẬP</b>. Không đủ mạnh để ảnh hưởng quyết định mua/bán.'}</div>
          </div>
          <div class="popup-section">
            <div class="popup-tip">💡 <b>Mẹo:</b> Kết hợp nhiều yếu tố cùng chiều (ví dụ: 4 bullish + 1 bearish) để đưa ra quyết định chính xác hơn. Không nên dựa vào chỉ 1 yếu tố.</div>
          </div>`
      };
    }
  };

  const generator = popupData[type];
  return generator ? generator() : { header: '<h3>Thông tin</h3>', body: '<div class="popup-text">Không có dữ liệu.</div>' };
}

/**
 * Animate a counter from 0 to value
 */
function animateCounter(element, target, suffix = '') {
  const duration = 1000;
  const start = performance.now();
  const from = 0;

  function update(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
    const current = Math.round(from + (target - from) * eased);
    element.textContent = current + suffix;
    if (progress < 1) requestAnimationFrame(update);
  }
  requestAnimationFrame(update);
}

/**
 * Get relative time string
 */
function getTimeAgo(dateStr) {
  const now = new Date();
  const date = new Date(dateStr);
  const diff = Math.floor((now - date) / 1000);

  if (diff < 60) return 'Vừa xong';
  if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
  return `${Math.floor(diff / 86400)} ngày trước`;
}

function showError(message) {
  setLoading(false);
  // Show simple alert for now
  const errorDiv = document.createElement('div');
  errorDiv.className = 'error-toast';
  errorDiv.textContent = message;
  document.body.appendChild(errorDiv);
  setTimeout(() => errorDiv.classList.add('show'), 10);
  setTimeout(() => {
    errorDiv.classList.remove('show');
    setTimeout(() => errorDiv.remove(), 300);
  }, 3000);
}

// ── Boot ──
document.addEventListener('DOMContentLoaded', init);
