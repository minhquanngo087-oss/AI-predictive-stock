/**
 * Candle Sentiment Module
 * AI-powered analysis when user clicks on a candlestick
 * Uses EXISTING scraped news from the page DOM + Gemini AI
 */

const BACKEND_URL = 'http://localhost:5000';

/**
 * Collect news articles already displayed on the page (from BẢN TIN TÀI CHÍNH section)
 * Matches HTML structure from renderNewsFeed() in app.js:
 *   .news-item > a.news-title-link > h4.news-title
 *   .news-item > .news-header > .news-source
 */
function getScrapedNewsFromDOM() {
  const articles = [];
  
  // Match the actual DOM structure from renderNewsFeed()
  document.querySelectorAll('#newsFeed .news-item').forEach(el => {
    const linkEl = el.querySelector('a.news-title-link');
    const titleEl = el.querySelector('h4.news-title, .news-title');
    const sourceEl = el.querySelector('.news-source');
    
    const title = titleEl ? titleEl.textContent.trim() : '';
    if (title && title.length > 5) {
      articles.push({
        title: title,
        url: linkEl ? linkEl.href : '',
        summary: '',
        source: sourceEl ? sourceEl.textContent.trim() : '',
      });
    }
  });

  // Fallback: try any links inside common news containers
  if (articles.length === 0) {
    document.querySelectorAll('.news-card-item a, .news-feed a, [class*="news"] a').forEach(a => {
      const text = a.textContent.trim();
      if (text.length > 15 && !articles.some(ar => ar.title === text)) {
        articles.push({
          title: text,
          url: a.href || '',
          summary: '',
          source: '',
        });
      }
    });
  }

  return articles;
}

/**
 * Show sentiment popup for a clicked candle
 */
export async function showCandleSentiment(ticker, candle, container) {
  const popup = document.getElementById('candleSentimentPopup');
  if (!popup) return;

  const overlay = document.getElementById('candleSentimentOverlay');
  const date = typeof candle.time === 'number' 
    ? new Date(candle.time * 1000).toISOString().split('T')[0]
    : candle.time;
  
  const priceChange = candle.close - candle.open;
  const changePct = ((priceChange / candle.open) * 100).toFixed(2);
  const direction = priceChange >= 0 ? 'tăng' : 'giảm';
  const dirColor = priceChange >= 0 ? '#00d4aa' : '#ff4757';
  const dirEmoji = priceChange >= 0 ? '📈' : '📉';

  // Show loading state
  overlay.classList.add('show');
  popup.innerHTML = `
    <div class="cs-header">
      <div class="cs-title">
        <span class="cs-emoji">${dirEmoji}</span>
        <span>${ticker} — ${date}</span>
      </div>
      <button class="cs-close" onclick="document.getElementById('candleSentimentOverlay').classList.remove('show')">✕</button>
    </div>
    <div class="cs-price-bar">
      <div class="cs-price-item">
        <span class="cs-label">Mở</span>
        <span class="cs-value">${formatPrice(candle.open)}</span>
      </div>
      <div class="cs-price-item">
        <span class="cs-label">Cao</span>
        <span class="cs-value" style="color:#00d4aa">${formatPrice(candle.high)}</span>
      </div>
      <div class="cs-price-item">
        <span class="cs-label">Thấp</span>
        <span class="cs-value" style="color:#ff4757">${formatPrice(candle.low)}</span>
      </div>
      <div class="cs-price-item">
        <span class="cs-label">Đóng</span>
        <span class="cs-value" style="color:${dirColor}">${formatPrice(candle.close)}</span>
      </div>
      <div class="cs-price-item">
        <span class="cs-label">Thay đổi</span>
        <span class="cs-value" style="color:${dirColor}">${priceChange >= 0 ? '+' : ''}${changePct}%</span>
      </div>
    </div>
    <div class="cs-body">
      <div class="cs-loading">
        <div class="loading-spinner" style="width:24px;height:24px"></div>
        <span>🧠 AI đang phân tích lý do giá ${direction}...</span>
      </div>
    </div>
  `;

  // Gather news from multiple sources
  try {
    const finnhubKey = localStorage.getItem('finnhubKey') || '';
    const geminiKey = localStorage.getItem('geminiKey') || '';

    // ── Step 1: Collect news articles ──
    // Source A: Already-scraped news from the page DOM
    let articles = getScrapedNewsFromDOM();
    console.log(`📰 News from DOM: ${articles.length} articles`);

    // Source B: Try Finnhub API (mostly for US stocks)
    if (finnhubKey && articles.length < 3) {
      try {
        const newsResp = await fetch(`${BACKEND_URL}/api/news/${ticker}?date=${date}&finnhub_key=${finnhubKey}`, {
          signal: AbortSignal.timeout(8000)
        });
        if (newsResp.ok) {
          const newsData = await newsResp.json();
          const finnhubArticles = newsData.articles || [];
          console.log(`📰 News from Finnhub: ${finnhubArticles.length} articles`);
          // Merge, avoid duplicates
          for (const fa of finnhubArticles) {
            if (!articles.some(a => a.title === fa.title)) {
              articles.push(fa);
            }
          }
        }
      } catch (e) {
        console.warn('Finnhub news fetch skipped:', e.message);
      }
    }

    console.log(`📰 Total articles for AI: ${articles.length}`);

    // ── Step 2: Get AI analysis ──
    if (geminiKey) {
      // Get exchange from page
      const exchangeSelect = document.getElementById('exchangeSelect');
      const exchange = exchangeSelect ? exchangeSelect.value : 'HOSE';
      
      const analyzeBody = {
        ticker,
        exchange,
        date,
        priceChange,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        articles: articles.slice(0, 8),
        geminiKey,
      };

      console.log('🧠 Sending to AI analyze:', JSON.stringify(analyzeBody).substring(0, 300));

      const analyzeResp = await fetch(`${BACKEND_URL}/api/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(25000),
        body: JSON.stringify(analyzeBody),
      });

      const aiData = await analyzeResp.json();
      console.log('🧠 AI response:', aiData);

      if (aiData.error) {
        throw new Error(aiData.error);
      }

      // Render results
      const bodyEl = popup.querySelector('.cs-body');
      bodyEl.innerHTML = `
        ${articles.length > 0 ? `
          <div class="cs-section">
            <div class="cs-section-title">📰 Tin tức liên quan (${articles.length} bài)</div>
            ${articles.slice(0, 4).map(a => `
              <div class="cs-news-item">
                ${a.url ? `<a href="${a.url}" target="_blank" rel="noopener">${a.title}</a>` : `<span style="color:var(--text-primary);font-size:13px">${a.title}</span>`}
                ${a.source ? `<span class="cs-news-source">${a.source}</span>` : ''}
                ${a.summary ? `<p class="cs-news-summary">${a.summary.substring(0, 150)}${a.summary.length > 150 ? '...' : ''}</p>` : ''}
              </div>
            `).join('')}
          </div>
        ` : `
          <div class="cs-section">
            <div class="cs-section-title">📰 Tin tức</div>
            <p style="color:var(--text-muted);font-size:12px">Chưa tìm thấy tin tức. AI sẽ phân tích dựa trên dữ liệu giá.</p>
          </div>
        `}
        <div class="cs-section">
          <div class="cs-section-title">🧠 Phân tích AI (Gemini)</div>
          <div class="cs-ai-text">${formatAIText(aiData.analysis || 'AI không trả về kết quả. Hãy kiểm tra Gemini API key.')}</div>
        </div>
      `;
    } else {
      // No Gemini key
      const bodyEl = popup.querySelector('.cs-body');
      bodyEl.innerHTML = `
        <div class="cs-no-key">
          <span>⚠️</span>
          <p>Cần nhập <b>Gemini API Key</b> trong phần ⚙️ Cài đặt API Keys rồi bấm 💾 Lưu.</p>
          <p style="font-size:11px;color:var(--text-muted)">Lấy key tại: <a href="https://aistudio.google.com/apikey" target="_blank" style="color:var(--accent-blue)">aistudio.google.com/apikey</a></p>
        </div>
      `;
    }
  } catch (err) {
    console.error('AI Sentiment error:', err);
    const bodyEl = popup.querySelector('.cs-body');
    bodyEl.innerHTML = `
      <div class="cs-error">
        <span>❌</span>
        <p>Lỗi: ${err.message}</p>
        <p style="font-size:12px;color:var(--text-muted)">
          • Server backend chạy chưa? → <code>python server.py</code><br>
          • Đã lưu Gemini API key chưa? → Bấm ⚙️ → nhập key → 💾 Lưu
        </p>
      </div>
    `;
  }
}

function formatPrice(price) {
  if (price >= 1000) return price.toLocaleString('vi-VN');
  return price.toFixed(2);
}

function formatAIText(text) {
  return text
    // Horizontal rules
    .replace(/^---+$/gm, '<hr>')
    // Bold text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    // Bullet points
    .replace(/^[-•] (.+)$/gm, '<li style="margin-left:16px;list-style:disc;color:var(--text-secondary)">$1</li>')
    // Line breaks
    .replace(/\n/g, '<br>');
}

/**
 * Close the sentiment popup
 */
export function closeCandleSentiment() {
  const overlay = document.getElementById('candleSentimentOverlay');
  if (overlay) overlay.classList.remove('show');
}
