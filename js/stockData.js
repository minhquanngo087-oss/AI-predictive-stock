/**
 * Stock Price Data Module
 * Fetches OHLCV data from Yahoo Finance (via CORS proxy) with demo fallback
 */

const CORS_PROXY = 'https://api.allorigins.win/raw?url=';

/**
 * Fetch historical stock data for a ticker
 * @param {string} ticker - Stock ticker (e.g. "AAPL")
 * @param {string} range - Time range: '1mo', '3mo', '6mo', '1y' 
 * @returns {Promise<Array>} Array of { time, open, high, low, close, volume }
 */
export async function fetchStockData(ticker, range = '3mo') {
  // Try Yahoo Finance
  try {
    const data = await fetchFromYahoo(ticker, range);
    if (data && data.length >= 5) {
      console.log(`✅ Got ${data.length} candles from Yahoo Finance`);
      return data;
    }
  } catch (err) {
    console.warn('Yahoo Finance failed:', err.message);
  }

  // Fallback to demo data
  console.log('📋 Using demo stock data');
  return generateDemoData(ticker, range);
}

/**
 * Fetch from Yahoo Finance via CORS proxy
 */
async function fetchFromYahoo(ticker, range) {
  const interval = range === '1mo' ? '1d' : range === '3mo' ? '1d' : '1wk';
  const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=${range}&interval=${interval}&includePrePost=false`;
  const proxyUrl = CORS_PROXY + encodeURIComponent(yahooUrl);

  const response = await fetch(proxyUrl, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const json = await response.json();
  const result = json?.chart?.result?.[0];
  if (!result) throw new Error('No data in response');

  const timestamps = result.timestamp;
  const quote = result.indicators?.quote?.[0];
  if (!timestamps || !quote) throw new Error('Missing OHLCV data');

  const candles = [];
  for (let i = 0; i < timestamps.length; i++) {
    if (quote.open[i] != null && quote.close[i] != null) {
      candles.push({
        time: formatDate(new Date(timestamps[i] * 1000)),
        open: +quote.open[i].toFixed(2),
        high: +quote.high[i].toFixed(2),
        low: +quote.low[i].toFixed(2),
        close: +quote.close[i].toFixed(2),
        volume: quote.volume[i] || 0,
      });
    }
  }

  return candles;
}

/**
 * Generate realistic demo candle data
 */
function generateDemoData(ticker, range) {
  const basePrices = {
    'AAPL': 185, 'TSLA': 250, 'MSFT': 420, 'GOOGL': 170,
    'AMZN': 185, 'NVDA': 880, 'META': 500, 'NFLX': 620, 'AMD': 165,
  };
  let price = basePrices[ticker.toUpperCase()] || 100;

  const days = range === '1mo' ? 22 : range === '3mo' ? 66 : range === '6mo' ? 132 : 252;
  const candles = [];
  const now = new Date();

  for (let i = days; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);

    // Skip weekends
    if (date.getDay() === 0 || date.getDay() === 6) continue;

    // Random walk with slight upward bias
    const change = (Math.random() - 0.48) * price * 0.03;
    const open = price;
    const close = price + change;
    const high = Math.max(open, close) + Math.random() * price * 0.01;
    const low = Math.min(open, close) - Math.random() * price * 0.01;
    const volume = Math.floor(20000000 + Math.random() * 30000000);

    candles.push({
      time: formatDate(date),
      open: +open.toFixed(2),
      high: +high.toFixed(2),
      low: +low.toFixed(2),
      close: +close.toFixed(2),
      volume,
    });

    price = close;
  }

  return candles;
}

/**
 * Format date as YYYY-MM-DD for Lightweight Charts
 */
function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
