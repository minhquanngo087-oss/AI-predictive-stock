/**
 * Real-time Data Module – SSI Edition
 * Handles SSI intraday polling (VN stocks) + Finnhub WebSocket (US stocks)
 * VN stocks: poll SSI IntradayOhlc every 15 seconds → moving candles
 */

const BACKEND_URL = 'http://localhost:5000';

// ── State ──
let wsConnection       = null;
let pollingInterval    = null;
let realtimeBuffer     = [];
let isDelayMode        = false;
let delayPlaybackTimer = null;
let onTickCallback     = null;
let currentRealtimeTicker   = '';
let currentRealtimeExchange = '';

// VN market hours: 09:00–14:30 ICT (GMT+7) = 02:00–07:30 UTC
const VN_MARKET_OPEN_UTC  = { h: 2, m: 0  };   // 09:00 ICT
const VN_MARKET_CLOSE_UTC = { h: 7, m: 30 };    // 14:30 ICT

/**
 * Check if VN market is currently open
 */
export function isVNMarketOpen() {
  const now = new Date();
  const utcH = now.getUTCHours();
  const utcM = now.getUTCMinutes();
  const utcTotal = utcH * 60 + utcM;
  const open  = VN_MARKET_OPEN_UTC.h  * 60 + VN_MARKET_OPEN_UTC.m;
  const close = VN_MARKET_CLOSE_UTC.h * 60 + VN_MARKET_CLOSE_UTC.m;
  const day = now.getUTCDay(); // 0=Sun, 6=Sat
  return day >= 1 && day <= 5 && utcTotal >= open && utcTotal < close;
}

/**
 * Get VN market status string
 */
export function getVNMarketStatus() {
  if (isVNMarketOpen()) {
    const now = new Date();
    const closeUTC = new Date();
    closeUTC.setUTCHours(VN_MARKET_CLOSE_UTC.h, VN_MARKET_CLOSE_UTC.m, 0, 0);
    const remaining = Math.max(0, closeUTC - now);
    const remH = Math.floor(remaining / 3600000);
    const remM = Math.floor((remaining % 3600000) / 60000);
    return { open: true, label: '🟢 ĐANG GIAO DỊCH', remaining: `${remH}h ${remM}m` };
  }
  return { open: false, label: '🔴 ĐÃ ĐÓNG CỬA', remaining: null };
}

/**
 * Start real-time data feed
 */
export function startRealtime(ticker, exchange, onTick, finnhubKey = '') {
  stopRealtime();
  currentRealtimeTicker   = ticker;
  currentRealtimeExchange = exchange;
  onTickCallback  = onTick;
  realtimeBuffer  = [];

  const isVN = ['HOSE', 'HNX', 'UPCOM'].includes(exchange);

  if (isVN) {
    startSSIPolling(ticker, exchange);
  } else if (finnhubKey) {
    startFinnhubWS(ticker, finnhubKey);
  } else {
    startBackendPolling(ticker, exchange);
  }
}

/**
 * Stop all real-time feeds
 */
export function stopRealtime() {
  if (wsConnection)       { wsConnection.close(); wsConnection = null; }
  if (pollingInterval)    { clearInterval(pollingInterval); pollingInterval = null; }
  if (delayPlaybackTimer) { clearInterval(delayPlaybackTimer); delayPlaybackTimer = null; }
  currentRealtimeTicker = '';
}

/**
 * Toggle delay mode (30-second buffer)
 */
export function setDelayMode(enabled) {
  isDelayMode = enabled;
  if (enabled) {
    delayPlaybackTimer = setInterval(() => {
      const cutoff = Date.now() - 30_000;
      while (realtimeBuffer.length > 0 && realtimeBuffer[0].receivedAt <= cutoff) {
        const item = realtimeBuffer.shift();
        if (onTickCallback) onTickCallback(item.candle);
      }
    }, 1000);
  } else {
    if (delayPlaybackTimer) { clearInterval(delayPlaybackTimer); delayPlaybackTimer = null; }
  }
}

export function getIsDelayMode() { return isDelayMode; }


// ═══════════════════════════════════════════════════
// SSI Intraday Polling (VN Stocks) – PRIMARY
// ═══════════════════════════════════════════════════

let lastSSICandles = [];   // Keep track of last set of candles
let lastSentCandleTime = 0;

function startSSIPolling(ticker, exchange) {
  console.log(`📡 Starting SSI real-time polling for ${ticker} (${exchange})`);
  lastSSICandles = [];
  lastSentCandleTime = 0;

  // Fetch immediately
  fetchSSIIntraday(ticker);

  // Poll every 15 seconds during market hours, 60s otherwise
  const pollMs = isVNMarketOpen() ? 15000 : 60000;
  pollingInterval = setInterval(() => {
    fetchSSIIntraday(ticker);
  }, pollMs);
}

async function fetchSSIIntraday(ticker) {
  try {
    const resp = await fetch(
      `${BACKEND_URL}/api/ssi-intraday/${ticker}`,
      { signal: AbortSignal.timeout(10000) }
    );
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();

    const candles = data.candles || [];
    if (candles.length === 0) return;

    // Deliver NEW candles we haven't sent yet
    for (const c of candles) {
      if (c.time > lastSentCandleTime) {
        deliverTick(c);
        lastSentCandleTime = c.time;
      } else if (c.time === lastSentCandleTime) {
        // Update existing (in-progress) candle → makes it "move"
        deliverTick({ ...c, _update: true });
      }
    }
    lastSSICandles = candles;
    console.log(`🕯 SSI tick: ${candles.length} bars, latest = ${new Date(candles[candles.length-1].time * 1000).toLocaleTimeString('vi-VN')}`);
  } catch (err) {
    console.warn('SSI intraday poll error:', err.message);
    // Fallback to Yahoo if SSI fails
    fetchYahooRealtime(ticker, currentRealtimeExchange);
  }
}


// ═══════════════════════════════════════════════════
// Yahoo Finance Polling (VN Stocks fallback)
// ═══════════════════════════════════════════════════

async function fetchYahooRealtime(ticker, exchange) {
  try {
    const resp = await fetch(`${BACKEND_URL}/api/quote/${ticker}?exchange=${exchange}`, {
      signal: AbortSignal.timeout(8000),
    });
    const data = await resp.json();
    if (data.candles && data.candles.length > 0) {
      const latest = data.candles[data.candles.length - 1];
      deliverTick(latest);
    }
  } catch (err) {
    console.warn('Yahoo polling error:', err.message);
  }
}


// ═══════════════════════════════════════════════════
// Finnhub WebSocket (US stocks)
// ═══════════════════════════════════════════════════

function startFinnhubWS(ticker, apiKey) {
  const ws = new WebSocket(`wss://ws.finnhub.io?token=${apiKey}`);
  wsConnection = ws;

  let lastCandle = null;
  let candleStartTime = 0;

  ws.onopen = () => {
    console.log(`🔌 Finnhub WS connected for ${ticker}`);
    ws.send(JSON.stringify({ type: 'subscribe', symbol: ticker }));
  };

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.type !== 'trade' || !msg.data) return;

    for (const trade of msg.data) {
      const price = trade.p;
      const volume = trade.v;
      const timestamp = Math.floor(trade.t / 1000);
      const minuteStart = timestamp - (timestamp % 60);

      if (minuteStart !== candleStartTime) {
        if (lastCandle) deliverTick(lastCandle);
        candleStartTime = minuteStart;
        lastCandle = { time: minuteStart, open: price, high: price, low: price, close: price, volume };
      } else if (lastCandle) {
        lastCandle.high   = Math.max(lastCandle.high, price);
        lastCandle.low    = Math.min(lastCandle.low, price);
        lastCandle.close  = price;
        lastCandle.volume += volume;
      }
    }
    if (lastCandle) deliverTick({ ...lastCandle, _update: true });
  };

  ws.onerror = err => console.error('Finnhub WS error:', err);
  ws.onclose = () => console.log('Finnhub WS closed');
}


// ═══════════════════════════════════════════════════
// Backend Polling (US stocks fallback)
// ═══════════════════════════════════════════════════

function startBackendPolling(ticker, exchange) {
  console.log(`📡 Starting backend polling for ${ticker}`);
  fetchBackendQuote(ticker, exchange);
  pollingInterval = setInterval(() => fetchBackendQuote(ticker, exchange), 15000);
}

async function fetchBackendQuote(ticker, exchange) {
  try {
    const resp = await fetch(`${BACKEND_URL}/api/quote/${ticker}?exchange=${exchange}`, {
      signal: AbortSignal.timeout(8000),
    });
    const data = await resp.json();
    if (data.price) {
      deliverTick({
        time: Math.floor(Date.now() / 1000),
        open: data.price, high: data.price, low: data.price, close: data.price, volume: 0,
      });
    }
  } catch (err) {
    console.warn('Backend polling error:', err.message);
  }
}


// ═══════════════════════════════════════════════════
// Delivery Logic
// ═══════════════════════════════════════════════════

function deliverTick(candle) {
  if (isDelayMode) {
    realtimeBuffer.push({ candle, receivedAt: Date.now() });
  } else {
    if (onTickCallback) onTickCallback(candle);
  }
}


// ═══════════════════════════════════════════════════
// Fetch initial candles for chart load
// ═══════════════════════════════════════════════════

/**
 * Fetch initial SSI intraday candles for chart bootstrap
 */
export async function fetchIntradayCandles(ticker, exchange) {
  const isVN = ['HOSE', 'HNX', 'UPCOM'].includes(exchange);

  if (isVN) {
    // Try SSI intraday first
    try {
      const resp = await fetch(`${BACKEND_URL}/api/ssi-intraday/${ticker}`, {
        signal: AbortSignal.timeout(10000),
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data.candles && data.candles.length > 0) {
          console.log(`✅ SSI initial intraday: ${data.candles.length} candles`);
          return data.candles;
        }
      }
    } catch (err) {
      console.warn('SSI intraday initial fetch failed:', err.message);
    }
  }

  // Fallback: backend /api/intraday
  try {
    const resp = await fetch(`${BACKEND_URL}/api/intraday/${ticker}?exchange=${exchange}`, {
      signal: AbortSignal.timeout(10000),
    });
    const data = await resp.json();
    return data.candles || [];
  } catch (err) {
    console.warn('Intraday fetch error:', err.message);
    return [];
  }
}

/**
 * Fetch SSI daily OHLCV for historical chart (3mo / 6mo view)
 */
export async function fetchSSIDailyChart(ticker) {
  try {
    const resp = await fetch(`${BACKEND_URL}/api/ssi-chart/${ticker}`, {
      signal: AbortSignal.timeout(12000),
    });
    if (resp.ok) {
      const data = await resp.json();
      if (data.candles && data.candles.length >= 5) {
        console.log(`✅ SSI daily chart: ${data.candles.length} candles (source: ${data.source})`);
        return { candles: data.candles, source: data.source };
      }
    }
  } catch (err) {
    console.warn('SSI daily chart fetch failed:', err.message);
  }
  return null;
}

/**
 * Fetch VN market summary (VN-Index etc.)
 */
export async function fetchVNMarketSummary() {
  try {
    const resp = await fetch(`${BACKEND_URL}/api/vn-market-summary`, {
      signal: AbortSignal.timeout(8000),
    });
    if (resp.ok) return await resp.json();
  } catch (err) {
    console.warn('VN market summary error:', err.message);
  }
  return null;
}
