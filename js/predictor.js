/**
 * Stock Prediction Engine
 * Converts sentiment analysis into trading signals
 */

/**
 * Signal levels and their thresholds
 */
const SIGNALS = {
  STRONG_BUY:  { label: 'STRONG BUY',  color: '#00d4aa', emoji: '🚀', min: 0.35 },
  BUY:         { label: 'BUY',         color: '#51cf66', emoji: '📈', min: 0.15 },
  HOLD:        { label: 'HOLD',        color: '#4c9be8', emoji: '⏸️', min: -0.15 },
  SELL:        { label: 'SELL',        color: '#ff8c42', emoji: '📉', min: -0.35 },
  STRONG_SELL: { label: 'STRONG SELL', color: '#ff4757', emoji: '🔻', min: -Infinity },
};

/**
 * Generate a prediction from sentiment analysis results
 * @param {object} sentimentData - Result from analyzeHeadlines()
 * @returns {object} Prediction with signal, confidence, and details
 */
export function generatePrediction(sentimentData) {
  if (!sentimentData || sentimentData.total === 0) {
    return {
      signal: SIGNALS.HOLD,
      confidence: 0,
      score: 0,
      momentum: 'neutral',
      details: 'Không đủ dữ liệu để phân tích'
    };
  }

  const { scores, mean, std, positiveCount, negativeCount, neutralCount, total } = sentimentData;

  // ── Weighted Score (recent news weighted more) ──
  const weights = scores.map((_, i) => {
    const recency = 1 + (scores.length - i) / scores.length; // 2.0 → 1.0
    return recency;
  });
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const weightedScore = scores.reduce((sum, s, i) => sum + s * weights[i], 0) / totalWeight;

  // ── Agreement Score (how much headlines agree) ──
  const agreement = 1 - Math.min(std / 0.5, 1); // Lower std = higher agreement

  // ── Sentiment ratio ──
  const sentimentRatio = (positiveCount - negativeCount) / total;

  // ── Combined score ──
  const combinedScore = weightedScore * 0.5 + sentimentRatio * 0.3 + mean * 0.2;

  // ── Determine signal ──
  let signal;
  if (combinedScore >= SIGNALS.STRONG_BUY.min) signal = SIGNALS.STRONG_BUY;
  else if (combinedScore >= SIGNALS.BUY.min) signal = SIGNALS.BUY;
  else if (combinedScore >= SIGNALS.HOLD.min) signal = SIGNALS.HOLD;
  else if (combinedScore >= SIGNALS.SELL.min) signal = SIGNALS.SELL;
  else signal = SIGNALS.STRONG_SELL;

  // ── Confidence (0-100%) ──
  const magnitude = Math.abs(combinedScore);
  const confidence = Math.min(Math.round(
    (magnitude * 40 + agreement * 35 + (total / 20) * 25)
  ), 99);

  // ── Momentum ──
  let momentum = 'neutral';
  if (scores.length >= 4) {
    const firstHalf = scores.slice(0, Math.floor(scores.length / 2));
    const secondHalf = scores.slice(Math.floor(scores.length / 2));
    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

    if (secondAvg > firstAvg + 0.05) momentum = 'improving';
    else if (secondAvg < firstAvg - 0.05) momentum = 'declining';
  }

  // ── Generate detail text ──
  const bullPct = Math.round((positiveCount / total) * 100);
  const bearPct = Math.round((negativeCount / total) * 100);

  let details = '';
  if (signal === SIGNALS.STRONG_BUY || signal === SIGNALS.BUY) {
    details = `Tin tức cho thấy xu hướng tích cực mạnh (${bullPct}% tin tốt). Tâm lý thị trường lạc quan.`;
  } else if (signal === SIGNALS.STRONG_SELL || signal === SIGNALS.SELL) {
    details = `Tin tức cho thấy xu hướng tiêu cực (${bearPct}% tin xấu). Tâm lý thị trường bi quan.`;
  } else {
    details = `Thị trường đang trong trạng thái cân bằng. Chưa có tín hiệu rõ ràng.`;
  }

  return {
    signal,
    confidence,
    score: combinedScore,
    weightedScore,
    sentimentRatio,
    agreement,
    momentum,
    details,
    stats: {
      bullish: positiveCount,
      bearish: negativeCount,
      neutral: neutralCount,
      total
    }
  };
}

/**
 * Get gauge rotation angle for the prediction meter
 * @param {number} score - Combined score (-1 to 1)
 * @returns {number} Rotation angle in degrees (-90 to 90)
 */
export function getGaugeAngle(score) {
  return Math.max(-90, Math.min(90, score * 90));
}

/**
 * Get trend description text
 */
export function getMomentumText(momentum) {
  const map = {
    'improving': '📈 Xu hướng đang cải thiện',
    'declining': '📉 Xu hướng đang suy giảm',
    'neutral':   '➡️ Xu hướng ổn định'
  };
  return map[momentum] || map.neutral;
}
