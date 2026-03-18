"""
AI Stock Scoring Engine – Module 3
Chấm điểm cổ phiếu dựa trên: Sentiment + Technical + Momentum
Không dùng API trả phí – tất cả tính toán nội bộ.
"""

import re
from datetime import datetime

# ═══════════════════════════════════════════════════
# Vietnamese Sentiment Keyword Lists
# ═══════════════════════════════════════════════════

POSITIVE_KEYWORDS = [
    'tăng trần', 'tăng mạnh', 'khối ngoại mua ròng', 'mua ròng', 'phá đỉnh',
    'đột phá', 'lợi nhuận kỷ lục', 'vượt kỳ vọng', 'tích cực', 'tốt hơn dự kiến',
    'golden cross', 'breakout', 'sideway tích lũy', 'dòng tiền mạnh', 'triển vọng sáng',
    'mở rộng', 'tăng trưởng', 'lãi lớn', 'nâng giá mục tiêu', 'khuyến nghị mua',
    'outperform', 'overweight', 'cổ tức cao', 'phà giải ngân', 'hưởng lợi',
    'cho vay tăng', 'xuất khẩu tăng', 'doanh thu tăng', 'biên lợi nhuận cải thiện',
    'tín hiệu mua', 'dẫn dắt thị trường', 'thanh khoản cải thiện', 'hồi phục',
]

NEGATIVE_KEYWORDS = [
    'giảm sàn', 'giảm mạnh', 'khối ngoại bán ròng', 'bán ròng', 'phá đáy',
    'rủi ro', 'thua lỗ', 'nợ xấu tăng', 'death cross', 'bán tháo',
    'vi phạm', 'phạt', 'cảnh báo', 'hủy niêm yết', 'ngừng giao dịch',
    'điều tra', 'gian lận', 'sụp đổ', 'phá sản', 'thanh khoản kém',
    'giảm trưởng', 'dưới kỳ vọng', 'hạ giá mục tiêu', 'khuyến nghị bán',
    'underperform', 'underweight', 'nợ lớn', 'thoái vốn', 'pha loãng',
    'thiếu hụt', 'suy giảm', 'biên lợi nhuận thu hẹp', 'tín hiệu bán',
]

HIGH_IMPACT_KEYWORDS = [
    'tăng trần', 'giảm sàn', 'phá đỉnh lịch sử', 'phá đáy', 'breaking',
    'bất ngờ', 'sốc', 'kỷ lục', 'khẩn cấp', 'lần đầu tiên',
    'thâu tóm', 'sáp nhập', 'M&A', 'chia cổ tức đặc biệt', 'hủy niêm yết',
    'CEO từ nhiệm', 'biến động bất thường', 'tạm ngừng giao dịch',
    'ngân hàng nhà nước', 'lãi suất', 'tỷ giá', 'FED', 'FOMC',
]

SECTOR_KEYWORDS = {
    'Ngân hàng':     ['ngân hàng', 'bank', 'tín dụng', 'cho vay', 'lãi suất', 'nợ xấu', 'NHNN', 'SBV'],
    'Bất động sản':  ['bất động sản', 'BĐS', 'nhà ở', 'chung cư', 'dự án', 'quy hoạch', 'giá đất'],
    'Công nghệ':     ['công nghệ', 'CNTT', 'phần mềm', 'AI', 'chuyển đổi số', 'tech', 'digital'],
    'Chứng khoán':   ['chứng khoán', 'CTCK', 'margin', 'môi giới', 'VN-Index', 'thanh khoản'],
    'Năng lượng':    ['năng lượng', 'điện', 'dầu khí', 'xăng', 'gas', 'than', 'điện gió', 'solar'],
    'Tiêu dùng':     ['tiêu dùng', 'bán lẻ', 'sữa', 'thực phẩm', 'bia', 'đồ uống', 'FMCG'],
    'Thép & Vật liệu': ['thép', 'xi măng', 'vật liệu', 'xây dựng', 'kết cấu'],
    'Dệt may':       ['dệt may', 'xuất khẩu', 'textile', 'giày', 'da'],
}


# ═══════════════════════════════════════════════════
# Sentiment Scoring
# ═══════════════════════════════════════════════════

def score_sentiment(articles):
    """
    Score sentiment from news articles (list of {title, description}).
    Returns: {score: 1-10, positive_count, negative_count, highlight_articles, reasoning}
    """
    if not articles:
        return {'score': 5, 'positive_count': 0, 'negative_count': 0, 'highlights': [], 'reasoning': 'Không có tin tức để phân tích'}

    pos_count = 0
    neg_count = 0
    highlights = []
    total_weight = 0
    weighted_score = 0

    for art in articles:
        text = (art.get('title', '') + ' ' + art.get('description', '')).lower()
        pos_hits = sum(1 for kw in POSITIVE_KEYWORDS if kw in text)
        neg_hits = sum(1 for kw in NEGATIVE_KEYWORDS if kw in text)

        # Impact weight
        is_highlight = any(kw in text for kw in HIGH_IMPACT_KEYWORDS)
        weight = 3 if is_highlight else 1

        if pos_hits > neg_hits:
            pos_count += 1
            weighted_score += weight
        elif neg_hits > pos_hits:
            neg_count += 1
            weighted_score -= weight
        total_weight += weight

        if is_highlight:
            highlights.append({
                'title': art.get('title', ''),
                'source': art.get('source', 'Unknown'),
                'impact': 'positive' if pos_hits > neg_hits else ('negative' if neg_hits > pos_hits else 'neutral'),
            })

    # Normalize to 1-10 scale
    if total_weight > 0:
        raw = weighted_score / total_weight  # -1 to +1
        score = round(min(10, max(1, (raw + 1) * 4.5 + 1)), 1)
    else:
        score = 5

    # Reasoning
    if score >= 8:
        reasoning = f"Tin tức rất tích cực ({pos_count} tin tốt vs {neg_count} tin xấu). Sentiment mạnh theo hướng tăng."
    elif score >= 6:
        reasoning = f"Tin tức nghiêng tích cực ({pos_count} tin tốt vs {neg_count} tin xấu). Tâm lý thị trường khá lạc quan."
    elif score >= 4:
        reasoning = f"Tin tức trung lập ({pos_count} tin tốt, {neg_count} tin xấu). Chưa có tín hiệu rõ ràng từ tin tức."
    elif score >= 2:
        reasoning = f"Tin tức nghiêng tiêu cực ({neg_count} tin xấu vs {pos_count} tin tốt). Tâm lý thận trọng."
    else:
        reasoning = f"Tin tức rất tiêu cực ({neg_count} tin xấu vs {pos_count} tin tốt). Rủi ro cao từ thông tin thị trường."

    return {
        'score': score,
        'positive_count': pos_count,
        'negative_count': neg_count,
        'neutral_count': len(articles) - pos_count - neg_count,
        'highlights': highlights[:5],
        'reasoning': reasoning,
    }


# ═══════════════════════════════════════════════════
# Technical Scoring
# ═══════════════════════════════════════════════════

def score_technical(candles):
    """
    Score based on price action and technical indicators.
    candles: list of {open, high, low, close, volume}
    Returns: {score: 1-10, trend, signals, reasoning}
    """
    if not candles or len(candles) < 20:
        return {'score': 5, 'trend': 'Không đủ dữ liệu', 'signals': [], 'reasoning': 'Cần ít nhất 20 nến để phân tích kỹ thuật'}

    closes = [c['close'] for c in candles]
    volumes = [c.get('volume', 0) for c in candles]
    signals = []
    score = 5.0

    # SMA 20 vs SMA 50
    sma20 = sum(closes[-20:]) / 20
    if len(closes) >= 50:
        sma50 = sum(closes[-50:]) / 50
        if sma20 > sma50:
            signals.append('SMA20 > SMA50 → xu hướng tăng trung hạn')
            score += 1.0
        else:
            signals.append('SMA20 < SMA50 → xu hướng giảm trung hạn')
            score -= 1.0

        # Golden/Death Cross (SMA20 cắt SMA50)
        prev_sma20 = sum(closes[-21:-1]) / 20
        prev_sma50 = sum(closes[-51:-1]) / 50
        if prev_sma20 <= prev_sma50 and sma20 > sma50:
            signals.append('🔥 Golden Cross – tín hiệu mua mạnh')
            score += 1.5
        elif prev_sma20 >= prev_sma50 and sma20 < sma50:
            signals.append('⚠️ Death Cross – tín hiệu bán mạnh')
            score -= 1.5

    # Price vs SMA20
    current_price = closes[-1]
    if current_price > sma20:
        signals.append(f'Giá ({current_price:,.0f}) > SMA20 ({sma20:,.0f}) → vùng mua')
        score += 0.5
    else:
        signals.append(f'Giá ({current_price:,.0f}) < SMA20 ({sma20:,.0f}) → vùng bán')
        score -= 0.5

    # RSI calculation
    gains = []
    losses = []
    for i in range(1, min(15, len(closes))):
        change = closes[-i] - closes[-i - 1]
        if change > 0:
            gains.append(change)
        else:
            losses.append(abs(change))
    avg_gain = sum(gains) / 14 if gains else 0.001
    avg_loss = sum(losses) / 14 if losses else 0.001
    rs = avg_gain / avg_loss
    rsi = 100 - (100 / (1 + rs))

    if rsi > 70:
        signals.append(f'RSI = {rsi:.0f} → quá mua, có thể điều chỉnh')
        score -= 0.5
    elif rsi < 30:
        signals.append(f'RSI = {rsi:.0f} → quá bán, cơ hội mua')
        score += 1.0
    else:
        signals.append(f'RSI = {rsi:.0f} → trung lập')

    # Volume trend
    if len(volumes) >= 10:
        recent_avg_vol = sum(volumes[-5:]) / 5
        older_avg_vol = sum(volumes[-10:-5]) / 5
        if older_avg_vol > 0 and recent_avg_vol > older_avg_vol * 1.5:
            signals.append('📈 Volume tăng đột biến → dòng tiền mạnh')
            score += 0.5

    # Trend determination
    if len(closes) >= 5:
        change_5d = (closes[-1] - closes[-5]) / closes[-5] * 100
        if change_5d > 3:
            trend = 'Tăng'
        elif change_5d < -3:
            trend = 'Giảm'
        else:
            trend = 'Tích lũy'
    else:
        trend = 'Chưa xác định'

    score = round(min(10, max(1, score)), 1)

    # Reasoning
    if score >= 7:
        reasoning = f'Kỹ thuật tích cực: {trend}. Các chỉ báo hỗ trợ xu hướng tăng.'
    elif score >= 4:
        reasoning = f'Kỹ thuật trung lập: {trend}. Chưa có tín hiệu rõ ràng.'
    else:
        reasoning = f'Kỹ thuật tiêu cực: {trend}. Nhiều chỉ báo cảnh báo giảm.'

    return {
        'score': score,
        'trend': trend,
        'rsi': round(rsi, 1),
        'sma20': round(sma20, 0),
        'signals': signals[:5],
        'reasoning': reasoning,
    }


# ═══════════════════════════════════════════════════
# Momentum Scoring
# ═══════════════════════════════════════════════════

def score_momentum(candles):
    """
    Score based on price momentum and volatility.
    Returns: {score: 1-10, change_5d, volatility, reasoning}
    """
    if not candles or len(candles) < 5:
        return {'score': 5, 'change_5d': 0, 'volatility': 'N/A', 'reasoning': 'Không đủ dữ liệu'}

    closes = [c['close'] for c in candles]

    # 5-day change
    change_5d = (closes[-1] - closes[-5]) / closes[-5] * 100

    # 20-day change
    change_20d = 0
    if len(closes) >= 20:
        change_20d = (closes[-1] - closes[-20]) / closes[-20] * 100

    # Volatility (standard deviation of daily returns)
    returns = [(closes[i] - closes[i-1]) / closes[i-1] * 100 for i in range(max(1, len(closes)-20), len(closes))]
    if returns:
        mean_ret = sum(returns) / len(returns)
        variance = sum((r - mean_ret) ** 2 for r in returns) / len(returns)
        volatility = variance ** 0.5
    else:
        volatility = 0

    # Score
    score = 5.0
    if change_5d > 5:
        score += 2
    elif change_5d > 2:
        score += 1
    elif change_5d < -5:
        score -= 2
    elif change_5d < -2:
        score -= 1

    if change_20d > 10:
        score += 1
    elif change_20d < -10:
        score -= 1

    # Volatility penalty/bonus
    vol_label = 'Thấp'
    if volatility > 3:
        vol_label = 'Rất cao'
        score -= 0.5
    elif volatility > 2:
        vol_label = 'Cao'
    elif volatility > 1:
        vol_label = 'Trung bình'

    score = round(min(10, max(1, score)), 1)

    if score >= 7:
        reasoning = f'Momentum mạnh: +{change_5d:.1f}% (5 ngày). Xu hướng tăng rõ rệt.'
    elif score >= 4:
        reasoning = f'Momentum trung lập: {change_5d:+.1f}% (5 ngày). Giá đi ngang.'
    else:
        reasoning = f'Momentum yếu: {change_5d:+.1f}% (5 ngày). Áp lực bán chiếm ưu thế.'

    return {
        'score': score,
        'change_5d': round(change_5d, 2),
        'change_20d': round(change_20d, 2),
        'volatility': vol_label,
        'volatility_pct': round(volatility, 2),
        'reasoning': reasoning,
    }


# ═══════════════════════════════════════════════════
# Combined Score & Strategy
# ═══════════════════════════════════════════════════

def compute_full_score(articles, candles):
    """
    Compute combined score from sentiment + technical + momentum.
    Returns full analysis dict.
    """
    sent = score_sentiment(articles)
    tech = score_technical(candles)
    momen = score_momentum(candles)

    # Weighted average: Sentiment 40%, Technical 35%, Momentum 25%
    overall = round(sent['score'] * 0.4 + tech['score'] * 0.35 + momen['score'] * 0.25, 1)

    # Confidence (1-10 based on data quality)
    data_points = len(articles) + len(candles)
    if data_points > 100:
        confidence = min(10, 6 + len(articles) * 0.1)
    elif data_points > 30:
        confidence = 5
    else:
        confidence = 3
    confidence = round(min(10, confidence), 1)

    # Risk level
    vol = momen.get('volatility_pct', 0)
    if vol > 3 or overall < 3:
        risk = 'Rất cao'
        risk_color = '#ff4757'
    elif vol > 2 or overall < 4.5:
        risk = 'Cao'
        risk_color = '#ff8c42'
    elif vol > 1:
        risk = 'Trung bình'
        risk_color = '#ffd700'
    else:
        risk = 'Thấp'
        risk_color = '#00d4aa'

    # Trend
    if overall >= 7:
        trend = 'Tăng'
        trend_emoji = '🟢'
    elif overall >= 4:
        trend = 'Tích lũy'
        trend_emoji = '🟡'
    else:
        trend = 'Giảm'
        trend_emoji = '🔴'

    # Strategy
    if overall >= 8:
        strategy = 'Giải ngân mạnh – Xu hướng rõ ràng, dòng tiền tốt'
        strategy_emoji = '🚀'
    elif overall >= 6.5:
        strategy = 'Giải ngân thăm dò – Chia nhỏ lệnh, chờ xác nhận'
        strategy_emoji = '📈'
    elif overall >= 5:
        strategy = 'Quan sát – Chưa có tín hiệu mạnh, giữ tiền mặt'
        strategy_emoji = '👀'
    elif overall >= 3.5:
        strategy = 'Chốt lời một phần – Bảo vệ lợi nhuận nếu đang giữ'
        strategy_emoji = '⚠️'
    else:
        strategy = 'Đứng ngoài – Rủi ro cao, chờ đợi cơ hội mới'
        strategy_emoji = '🛑'

    # Combined reasoning
    reasoning = f"{trend_emoji} Xu hướng: {trend}. {sent['reasoning']} {tech['reasoning']} {momen['reasoning']}"

    return {
        'overall_score': overall,
        'confidence': confidence,
        'trend': trend,
        'trend_emoji': trend_emoji,
        'risk': risk,
        'risk_color': risk_color,
        'strategy': strategy,
        'strategy_emoji': strategy_emoji,
        'reasoning': reasoning,
        'sentiment': sent,
        'technical': tech,
        'momentum': momen,
        'timestamp': datetime.now().isoformat(),
    }


def detect_sectors(articles):
    """Detect which sectors are trending from news articles."""
    sector_scores = {}
    for sector, keywords in SECTOR_KEYWORDS.items():
        count = 0
        for art in articles:
            text = (art.get('title', '') + ' ' + art.get('description', '')).lower()
            count += sum(1 for kw in keywords if kw.lower() in text)
        if count > 0:
            sector_scores[sector] = count

    # Sort by frequency
    sorted_sectors = sorted(sector_scores.items(), key=lambda x: x[1], reverse=True)
    return [{'sector': s, 'mentions': c} for s, c in sorted_sectors[:5]]
