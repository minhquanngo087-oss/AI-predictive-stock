/**
 * Technical Analysis Module
 * Candlestick pattern recognition + indicators + combined analysis
 */

// ═══════════════════════════════════════════════════
// INDICATORS
// ═══════════════════════════════════════════════════

/**
 * Simple Moving Average
 */
export function calculateSMA(candles, period) {
  const sma = [];
  for (let i = 0; i < candles.length; i++) {
    if (i < period - 1) {
      sma.push({ time: candles[i].time, value: null });
    } else {
      let sum = 0;
      for (let j = i - period + 1; j <= i; j++) {
        sum += candles[j].close;
      }
      sma.push({ time: candles[i].time, value: +(sum / period).toFixed(2) });
    }
  }
  return sma.filter(s => s.value !== null);
}

/**
 * Relative Strength Index (RSI)
 */
export function calculateRSI(candles, period = 14) {
  if (candles.length < period + 1) return [];

  const rsi = [];
  let gains = 0, losses = 0;

  // Initial average gain/loss
  for (let i = 1; i <= period; i++) {
    const change = candles[i].close - candles[i - 1].close;
    if (change >= 0) gains += change;
    else losses -= change;
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = period; i < candles.length; i++) {
    if (i > period) {
      const change = candles[i].close - candles[i - 1].close;
      avgGain = (avgGain * (period - 1) + (change >= 0 ? change : 0)) / period;
      avgLoss = (avgLoss * (period - 1) + (change < 0 ? -change : 0)) / period;
    }

    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    rsi.push({
      time: candles[i].time,
      value: +(100 - 100 / (1 + rs)).toFixed(2)
    });
  }

  return rsi;
}

/**
 * Exponential Moving Average (for MACD)
 */
function calculateEMA(candles, period) {
  const multiplier = 2 / (period + 1);
  const ema = [];
  
  // First EMA = SMA
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += candles[i].close;
  }
  let prevEma = sum / period;
  ema.push({ time: candles[period - 1].time, value: prevEma });

  for (let i = period; i < candles.length; i++) {
    const current = (candles[i].close - prevEma) * multiplier + prevEma;
    ema.push({ time: candles[i].time, value: +current.toFixed(2) });
    prevEma = current;
  }
  return ema;
}

/**
 * MACD (Moving Average Convergence Divergence)
 * Default: fast=12, slow=26, signal=9
 */
export function calculateMACD(candles, fast = 12, slow = 26, signal = 9) {
  if (candles.length < slow + signal) return { macd: [], signal: [], histogram: [], lastMACD: null, lastSignal: null, lastHistogram: null };

  const emaFast = calculateEMA(candles, fast);
  const emaSlow = calculateEMA(candles, slow);

  // Align arrays (slow EMA starts later)
  const offset = slow - fast;
  const macdLine = [];
  for (let i = 0; i < emaSlow.length; i++) {
    const macdVal = emaFast[i + offset].value - emaSlow[i].value;
    macdLine.push({ time: emaSlow[i].time, value: +macdVal.toFixed(4) });
  }

  // Signal line = EMA of MACD line
  const signalMultiplier = 2 / (signal + 1);
  let prevSignal = 0;
  for (let i = 0; i < Math.min(signal, macdLine.length); i++) {
    prevSignal += macdLine[i].value;
  }
  prevSignal /= signal;

  const signalLine = [];
  const histogram = [];

  for (let i = signal - 1; i < macdLine.length; i++) {
    if (i === signal - 1) {
      signalLine.push({ time: macdLine[i].time, value: +prevSignal.toFixed(4) });
    } else {
      prevSignal = (macdLine[i].value - prevSignal) * signalMultiplier + prevSignal;
      signalLine.push({ time: macdLine[i].time, value: +prevSignal.toFixed(4) });
    }
    const hist = macdLine[i].value - signalLine[signalLine.length - 1].value;
    histogram.push({ time: macdLine[i].time, value: +hist.toFixed(4) });
  }

  return {
    macd: macdLine,
    signal: signalLine,
    histogram,
    lastMACD: macdLine.length > 0 ? macdLine[macdLine.length - 1].value : null,
    lastSignal: signalLine.length > 0 ? signalLine[signalLine.length - 1].value : null,
    lastHistogram: histogram.length > 0 ? histogram[histogram.length - 1].value : null,
  };
}

/**
 * Bollinger Bands (default: period=20, stdDev=2)
 */
export function calculateBollingerBands(candles, period = 20, stdDev = 2) {
  if (candles.length < period) return { upper: null, middle: null, lower: null, position: null };

  const slice = candles.slice(-period);
  const closes = slice.map(c => c.close);
  const mean = closes.reduce((a, b) => a + b, 0) / period;
  const variance = closes.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / period;
  const sd = Math.sqrt(variance);

  const upper = +(mean + stdDev * sd).toFixed(2);
  const lower = +(mean - stdDev * sd).toFixed(2);
  const middle = +mean.toFixed(2);
  const lastClose = candles[candles.length - 1].close;

  // Position: 0=at lower band, 0.5=middle, 1=at upper band
  const position = upper !== lower ? +((lastClose - lower) / (upper - lower)).toFixed(2) : 0.5;

  return { upper, middle, lower, position };
}

// ═══════════════════════════════════════════════════
// CANDLESTICK PATTERNS
// ═══════════════════════════════════════════════════

/**
 * Detect candlestick patterns in the last few candles
 * @returns {Array} Array of { name, type: 'bullish'|'bearish'|'neutral', description }
 */
export function detectPatterns(candles) {
  if (candles.length < 3) return [];
  const patterns = [];

  const last = candles[candles.length - 1];
  const prev = candles[candles.length - 2];
  const prev2 = candles[candles.length - 3];

  const body = Math.abs(last.close - last.open);
  const range = last.high - last.low;
  const upperShadow = last.high - Math.max(last.open, last.close);
  const lowerShadow = Math.min(last.open, last.close) - last.low;
  const isBullish = last.close > last.open;
  const isBearish = last.close < last.open;

  // ── Doji ──
  if (body < range * 0.1 && range > 0) {
    patterns.push({
      name: 'Doji',
      nameVi: 'Nến Doji',
      type: 'neutral',
      description: 'Thị trường do dự, lực mua/bán cân bằng. Có thể báo hiệu đảo chiều.'
    });
  }

  // ── Hammer (bullish reversal) ──
  if (lowerShadow > body * 2 && upperShadow < body * 0.3 && prev.close < prev.open) {
    patterns.push({
      name: 'Hammer',
      nameVi: 'Nến Búa',
      type: 'bullish',
      description: 'Tín hiệu đảo chiều tăng. Người mua đã đẩy giá lên từ đáy mạnh mẽ.'
    });
  }

  // ── Inverted Hammer ──
  if (upperShadow > body * 2 && lowerShadow < body * 0.3 && prev.close < prev.open) {
    patterns.push({
      name: 'Inverted Hammer',
      nameVi: 'Nến Búa Ngược',
      type: 'bullish',
      description: 'Tín hiệu đảo chiều tăng tiềm năng. Cần xác nhận từ nến tiếp theo.'
    });
  }

  // ── Shooting Star (bearish reversal) ──
  if (upperShadow > body * 2 && lowerShadow < body * 0.3 && prev.close > prev.open) {
    patterns.push({
      name: 'Shooting Star',
      nameVi: 'Sao Băng',
      type: 'bearish',
      description: 'Tín hiệu đảo chiều giảm. Người bán đã đẩy giá xuống từ đỉnh.'
    });
  }

  // ── Bullish Engulfing ──
  if (isBullish && prev.close < prev.open &&
      last.open < prev.close && last.close > prev.open) {
    patterns.push({
      name: 'Bullish Engulfing',
      nameVi: 'Nhấn Chìm Tăng',
      type: 'bullish',
      description: 'Mẫu đảo chiều tăng mạnh. Nến xanh lớn nuốt trọn nến đỏ trước đó.'
    });
  }

  // ── Bearish Engulfing ──
  if (isBearish && prev.close > prev.open &&
      last.open > prev.close && last.close < prev.open) {
    patterns.push({
      name: 'Bearish Engulfing',
      nameVi: 'Nhấn Chìm Giảm',
      type: 'bearish',
      description: 'Mẫu đảo chiều giảm mạnh. Nến đỏ lớn nuốt trọn nến xanh trước đó.'
    });
  }

  // ── Morning Star (3-candle bullish reversal) ──
  if (prev2.close < prev2.open &&
      Math.abs(prev.close - prev.open) < (prev2.high - prev2.low) * 0.1 &&
      last.close > last.open && last.close > (prev2.open + prev2.close) / 2) {
    patterns.push({
      name: 'Morning Star',
      nameVi: 'Sao Mai',
      type: 'bullish',
      description: 'Mẫu 3 nến đảo chiều tăng mạnh. Xu hướng giảm đã chấm dứt.'
    });
  }

  // ── Evening Star (3-candle bearish reversal) ──
  if (prev2.close > prev2.open &&
      Math.abs(prev.close - prev.open) < (prev2.high - prev2.low) * 0.1 &&
      last.close < last.open && last.close < (prev2.open + prev2.close) / 2) {
    patterns.push({
      name: 'Evening Star',
      nameVi: 'Sao Hôm',
      type: 'bearish',
      description: 'Mẫu 3 nến đảo chiều giảm. Xu hướng tăng có thể kết thúc.'
    });
  }

  // ── Strong Bullish (big green candle) ──
  if (isBullish && body > range * 0.7 && range > 0) {
    patterns.push({
      name: 'Strong Bullish',
      nameVi: 'Nến Tăng Mạnh',
      type: 'bullish',
      description: 'Nến thân dài cho thấy lực mua rất mạnh, kiểm soát toàn phiên.'
    });
  }

  // ── Strong Bearish (big red candle) ──
  if (isBearish && body > range * 0.7 && range > 0) {
    patterns.push({
      name: 'Strong Bearish',
      nameVi: 'Nến Giảm Mạnh',
      type: 'bearish',
      description: 'Nến thân dài cho thấy lực bán rất mạnh, kiểm soát toàn phiên.'
    });
  }

  // If no patterns found
  if (patterns.length === 0) {
    patterns.push({
      name: isBullish ? 'Bullish Candle' : isBearish ? 'Bearish Candle' : 'Neutral',
      nameVi: isBullish ? 'Nến Tăng' : isBearish ? 'Nến Giảm' : 'Trung Lập',
      type: isBullish ? 'bullish' : isBearish ? 'bearish' : 'neutral',
      description: isBullish
        ? 'Nến tăng bình thường, không có mẫu đặc biệt.'
        : isBearish
        ? 'Nến giảm bình thường, không có mẫu đặc biệt.'
        : 'Giá đóng cửa gần bằng giá mở cửa.'
    });
  }

  return patterns;
}

// ═══════════════════════════════════════════════════
// COMBINED ANALYSIS
// ═══════════════════════════════════════════════════

/**
 * Generate comprehensive analysis combining technical + sentiment
 * @param {Array} candles - OHLCV data
 * @param {object} sentimentData - From analyzeHeadlines()
 * @param {object} prediction - From generatePrediction()
 * @returns {object} Complete analysis report
 */
export function generateAnalysis(candles, sentimentData, prediction) {
  const last = candles[candles.length - 1];
  const prev = candles[candles.length - 2];
  const priceChange = last.close - prev.close;
  const priceChangePct = ((priceChange / prev.close) * 100).toFixed(2);

  // Indicators
  const sma20 = calculateSMA(candles, 20);
  const sma50 = calculateSMA(candles, 50);
  const rsi = calculateRSI(candles, 14);
  const macd = calculateMACD(candles);
  const bollinger = calculateBollingerBands(candles);
  const patterns = detectPatterns(candles);

  const lastSMA20 = sma20.length > 0 ? sma20[sma20.length - 1].value : null;
  const lastSMA50 = sma50.length > 0 ? sma50[sma50.length - 1].value : null;
  const lastRSI = rsi.length > 0 ? rsi[rsi.length - 1].value : null;

  // ── Technical Score (-100 to +100) ──
  let techScore = 0;
  const reasons = [];

  // Price vs SMA
  if (lastSMA20) {
    if (last.close > lastSMA20) {
      techScore += 12;
      reasons.push({ text: `Giá (${last.close}) > SMA20 (${lastSMA20}): xu hướng ngắn hạn tăng`, type: 'bullish' });
    } else {
      techScore -= 12;
      reasons.push({ text: `Giá (${last.close}) < SMA20 (${lastSMA20}): xu hướng ngắn hạn giảm`, type: 'bearish' });
    }
  }

  if (lastSMA50) {
    if (last.close > lastSMA50) {
      techScore += 12;
      reasons.push({ text: `Giá (${last.close}) > SMA50 (${lastSMA50}): xu hướng trung hạn tăng`, type: 'bullish' });
    } else {
      techScore -= 12;
      reasons.push({ text: `Giá (${last.close}) < SMA50 (${lastSMA50}): xu hướng trung hạn giảm`, type: 'bearish' });
    }
  }

  // Golden Cross / Death Cross
  if (lastSMA20 && lastSMA50) {
    if (lastSMA20 > lastSMA50) {
      techScore += 8;
      reasons.push({ text: 'SMA20 > SMA50 (Golden Cross): tín hiệu tăng trung hạn', type: 'bullish' });
    } else {
      techScore -= 8;
      reasons.push({ text: 'SMA20 < SMA50 (Death Cross): tín hiệu giảm trung hạn', type: 'bearish' });
    }
  }

  // RSI
  if (lastRSI) {
    if (lastRSI > 70) {
      techScore -= 18;
      reasons.push({ text: `RSI = ${lastRSI} (>70): Quá mua, có thể điều chỉnh giảm`, type: 'bearish' });
    } else if (lastRSI < 30) {
      techScore += 18;
      reasons.push({ text: `RSI = ${lastRSI} (<30): Quá bán, có thể phục hồi`, type: 'bullish' });
    } else if (lastRSI > 50) {
      techScore += 5;
      reasons.push({ text: `RSI = ${lastRSI}: Vùng tích cực, lực mua áp đảo`, type: 'bullish' });
    } else {
      techScore -= 5;
      reasons.push({ text: `RSI = ${lastRSI}: Vùng tiêu cực, lực bán áp đảo`, type: 'bearish' });
    }
  }

  // MACD
  if (macd.lastMACD !== null && macd.lastSignal !== null) {
    if (macd.lastMACD > macd.lastSignal) {
      techScore += 15;
      reasons.push({ text: `MACD (${macd.lastMACD.toFixed(2)}) > Signal (${macd.lastSignal.toFixed(2)}): Momentum tăng, lực mua đang mạnh lên`, type: 'bullish' });
    } else {
      techScore -= 15;
      reasons.push({ text: `MACD (${macd.lastMACD.toFixed(2)}) < Signal (${macd.lastSignal.toFixed(2)}): Momentum giảm, lực bán đang mạnh lên`, type: 'bearish' });
    }

    if (macd.lastHistogram !== null) {
      const prevHist = macd.histogram.length > 1 ? macd.histogram[macd.histogram.length - 2].value : 0;
      if (macd.lastHistogram > 0 && macd.lastHistogram > prevHist) {
        techScore += 5;
        reasons.push({ text: 'MACD Histogram đang tăng: Đà tăng đang mạnh dần', type: 'bullish' });
      } else if (macd.lastHistogram < 0 && macd.lastHistogram < prevHist) {
        techScore -= 5;
        reasons.push({ text: 'MACD Histogram đang giảm: Đà giảm đang mạnh dần', type: 'bearish' });
      }
    }
  }

  // Bollinger Bands
  if (bollinger.position !== null) {
    if (bollinger.position > 0.95) {
      techScore -= 15;
      reasons.push({ text: `Giá chạm Bollinger Band trên ($${bollinger.upper}): Quá mua, có thể đảo chiều giảm`, type: 'bearish' });
    } else if (bollinger.position < 0.05) {
      techScore += 15;
      reasons.push({ text: `Giá chạm Bollinger Band dưới ($${bollinger.lower}): Quá bán, có thể phục hồi`, type: 'bullish' });
    } else if (bollinger.position > 0.7) {
      techScore += 5;
      reasons.push({ text: `Giá ở vùng trên Bollinger Bands (${(bollinger.position * 100).toFixed(0)}%): Xu hướng tăng`, type: 'bullish' });
    } else if (bollinger.position < 0.3) {
      techScore -= 5;
      reasons.push({ text: `Giá ở vùng dưới Bollinger Bands (${(bollinger.position * 100).toFixed(0)}%): Xu hướng giảm`, type: 'bearish' });
    } else {
      reasons.push({ text: `Giá ở giữa Bollinger Bands (${(bollinger.position * 100).toFixed(0)}%): Vùng trung lập`, type: 'neutral' });
    }
  }

  // Candlestick patterns
  patterns.forEach(p => {
    if (p.type === 'bullish') {
      techScore += 12;
      reasons.push({ text: `Mẫu nến "${p.nameVi}": ${p.description}`, type: 'bullish' });
    } else if (p.type === 'bearish') {
      techScore -= 12;
      reasons.push({ text: `Mẫu nến "${p.nameVi}": ${p.description}`, type: 'bearish' });
    } else {
      reasons.push({ text: `Mẫu nến "${p.nameVi}": ${p.description}`, type: 'neutral' });
    }
  });

  // ── Sentiment Score ──
  let sentScore = 0;
  if (prediction) {
    const sentMean = sentimentData?.mean || 0;
    sentScore = Math.round(sentMean * 100);

    if (sentMean > 0.1) {
      reasons.push({ text: `Cảm xúc tin tức tích cực (${sentMean.toFixed(3)}): Thị trường lạc quan`, type: 'bullish' });
    } else if (sentMean < -0.1) {
      reasons.push({ text: `Cảm xúc tin tức tiêu cực (${sentMean.toFixed(3)}): Thị trường bi quan`, type: 'bearish' });
    } else {
      reasons.push({ text: `Cảm xúc tin tức trung lập (${sentMean.toFixed(3)})`, type: 'neutral' });
    }
  }

  // ── Combined Score ──
  const combinedScore = techScore * 0.6 + sentScore * 0.4;

  // ── Final Signal ──
  let signal, signalVi, signalColor, signalEmoji;
  if (combinedScore > 30) {
    signal = 'STRONG BUY'; signalVi = 'NÊN MUA MẠNH'; signalColor = '#00d4aa'; signalEmoji = '🟢';
  } else if (combinedScore > 10) {
    signal = 'BUY'; signalVi = 'NÊN MUA'; signalColor = '#51cf66'; signalEmoji = '🟢';
  } else if (combinedScore > -10) {
    signal = 'HOLD'; signalVi = 'GIỮ / CHỜ'; signalColor = '#4c9be8'; signalEmoji = '🔵';
  } else if (combinedScore > -30) {
    signal = 'SELL'; signalVi = 'NÊN BÁN'; signalColor = '#ff8c42'; signalEmoji = '🟠';
  } else {
    signal = 'STRONG SELL'; signalVi = 'NÊN BÁN MẠNH'; signalColor = '#ff4757'; signalEmoji = '🔴';
  }

  return {
    price: {
      current: last.close,
      previous: prev.close,
      change: +priceChange.toFixed(2),
      changePct: +priceChangePct,
      high: last.high,
      low: last.low,
    },
    indicators: {
      sma20: lastSMA20,
      sma50: lastSMA50,
      rsi: lastRSI,
      macd: macd.lastMACD,
      macdSignal: macd.lastSignal,
      macdHistogram: macd.lastHistogram,
      bollingerUpper: bollinger.upper,
      bollingerLower: bollinger.lower,
      bollingerPosition: bollinger.position,
    },
    patterns,
    signal, signalVi, signalColor, signalEmoji,
    techScore,
    sentScore,
    combinedScore: +combinedScore.toFixed(1),
    reasons,
    sma20Data: sma20,
    sma50Data: sma50,
  };
}
