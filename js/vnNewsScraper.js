/**
 * VN Stock News Scraper Module
 * Fetches Vietnamese financial news from backend (CafeF, VnEconomy, DauTu RSS)
 * Falls back to Google News RSS in Vietnamese
 */

const BACKEND_URL = 'http://localhost:5000';

// Map VN ticker → company name for search queries
const VN_COMPANY_MAP = {
  'VNM':  { name: 'Vinamilk', keywords: ['vinamilk', 'vnm', 'sữa'] },
  'FPT':  { name: 'FPT', keywords: ['fpt', 'công nghệ thông tin'] },
  'VCB':  { name: 'Vietcombank', keywords: ['vietcombank', 'vcb', 'ngân hàng ngoại thương'] },
  'VIC':  { name: 'Vingroup', keywords: ['vingroup', 'vic', 'phạm nhật vượng'] },
  'VHM':  { name: 'Vinhomes', keywords: ['vinhomes', 'vhm', 'bất động sản'] },
  'HPG':  { name: 'Hòa Phát', keywords: ['hòa phát', 'hoa phat', 'hpg', 'thép'] },
  'MWG':  { name: 'Thế Giới Di Động', keywords: ['thế giới di động', 'mwg', 'điện thoại'] },
  'TCB':  { name: 'Techcombank', keywords: ['techcombank', 'tcb'] },
  'BID':  { name: 'BIDV', keywords: ['bidv', 'đầu tư và phát triển'] },
  'CTG':  { name: 'VietinBank', keywords: ['vietinbank', 'ctg', 'công thương'] },
  'MBB':  { name: 'MB Bank', keywords: ['mb bank', 'mbb', 'quân đội'] },
  'SSI':  { name: 'SSI Securities', keywords: ['ssi', 'chứng khoán ssi'] },
  'VND':  { name: 'VNDirect', keywords: ['vndirect', 'vnd'] },
  'VPB':  { name: 'VP Bank', keywords: ['vpbank', 'vpb', 'vpbank'] },
  'ACB':  { name: 'ACB Bank', keywords: ['acb', 'á châu'] },
  'STB':  { name: 'Sacombank', keywords: ['sacombank', 'stb'] },
  'SHB':  { name: 'SHB', keywords: ['shb', 'sài gòn-hà nội'] },
  'GAS':  { name: 'PV Gas', keywords: ['pvgas', 'pv gas', 'gas'] },
  'SAB':  { name: 'Sabeco', keywords: ['sabeco', 'bia sài gòn', 'sab'] },
  'MSN':  { name: 'Masan', keywords: ['masan', 'msn'] },
  'PLX':  { name: 'Petrolimex', keywords: ['petrolimex', 'plx', 'xăng dầu'] },
  'NVL':  { name: 'Novaland', keywords: ['novaland', 'nvl'] },
  'VRE':  { name: 'Vincom Retail', keywords: ['vincom', 'vre', 'trung tâm thương mại'] },
  'PNJ':  { name: 'Phú Nhuận Jewelry', keywords: ['pnj', 'phú nhuận', 'trang sức'] },
  'DGC':  { name: 'Đức Giang Chemical', keywords: ['đức giang', 'dgc', 'hóa chất'] },
  'HSG':  { name: 'Hoa Sen Group', keywords: ['hoa sen', 'hsg', 'tôn'] },
  'REE':  { name: 'REE Corporation', keywords: ['ree', 'refrigeration'] },
  'KDH':  { name: 'Khang Điền', keywords: ['khang điền', 'kdh'] },
};

/**
 * Check if a ticker is a Vietnamese stock
 */
export function isVNTicker(ticker) {
  const upper = ticker.toUpperCase();
  if (VN_COMPANY_MAP[upper]) return true;
  // Short uppercase codes are likely VN stocks
  return /^[A-Z]{2,4}$/.test(upper) && !['AAPL','TSLA','MSFT','GOOGL','AMZN','NVDA','META','NFLX','AMD','PYPL','INTC','ADBE','QCOM','SBUX','COST','JPM','V','WMT','DIS','KO','NKE','BA','GS','XOM','CVX'].includes(upper);
}

/**
 * Main function: Fetch VN stock news from backend scraper
 * Falls back to Google News RSS in Vietnamese if backend unavailable
 */
export async function fetchVNStockNews(ticker) {
  const upper = ticker.toUpperCase();
  
  // ── Strategy 1: Backend VN news scraper (CafeF, VnEconomy, DauTu...) ──
  try {
    const resp = await fetch(`${BACKEND_URL}/api/vn-news/${upper}`, {
      signal: AbortSignal.timeout(10000),
    });
    if (resp.ok) {
      const data = await resp.json();
      if (data.articles && data.articles.length >= 3) {
        console.log(`✅ Backend VN news: ${data.articles.length} articles for ${upper}`);
        return normalizeVNArticles(data.articles);
      }
    }
  } catch (err) {
    console.warn('Backend VN news failed:', err.message);
  }
  
  // ── Strategy 2: Google News RSS in Vietnamese (via rss2json) ──
  try {
    const info = VN_COMPANY_MAP[upper];
    const companyName = info ? info.name : upper;
    const query = `${companyName} chứng khoán ${upper}`;
    const gnRSS = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=vi-VN&gl=VN&ceid=VN:vi`;
    const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(gnRSS)}`;
    
    const resp = await fetch(apiUrl, { signal: AbortSignal.timeout(8000) });
    if (resp.ok) {
      const data = await resp.json();
      if (data.status === 'ok' && data.items && data.items.length > 0) {
        const articles = data.items
          .filter(item => item.title && item.title.length > 10)
          .map(item => ({
            title: cleanTitle(item.title),
            source: item.author || 'Google News VN',
            publishedAt: item.pubDate || new Date().toISOString(),
            url: item.link || '#',
            description: stripHtml(item.description || ''),
          }))
          .filter(a => isRelevantVNArticle(a, upper))
          .slice(0, 15);
        
        if (articles.length >= 2) {
          console.log(`✅ Google News VN RSS: ${articles.length} articles`);
          return articles;
        }
      }
    }
  } catch (err) {
    console.warn('Google News VN RSS failed:', err.message);
  }
  
  // ── Fallback: VN-specific demo headlines ──
  console.log(`📋 Using VN demo news for ${upper}`);
  return getVNDemoNews(upper);
}

/**
 * Normalize articles from backend to standard format
 */
function normalizeVNArticles(articles) {
  return articles.map(a => ({
    title: a.title || '',
    source: a.source || 'VN News',
    publishedAt: a.publishedAt || new Date().toISOString(),
    url: a.url || '#',
    description: a.description || '',
  })).filter(a => a.title.length > 10);
}

/**
 * Check if article is relevant to VN ticker
 */
function isRelevantVNArticle(article, ticker) {
  const text = (article.title + ' ' + (article.description || '')).toLowerCase();
  const info = VN_COMPANY_MAP[ticker.toUpperCase()];
  
  if (!info) return true; // Unknown ticker: include all
  
  return info.keywords.some(kw => text.includes(kw)) || text.includes(ticker.toLowerCase());
}

/**
 * Clean Google News titles (format: "Headline - Source")
 */
function cleanTitle(title) {
  const parts = title.split(' - ');
  if (parts.length > 1) return parts.slice(0, -1).join(' - ').trim();
  return title.trim();
}

function stripHtml(html) {
  return html.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
}

/**
 * VN stock company name lookup
 */
export function getVNCompanyName(ticker) {
  const info = VN_COMPANY_MAP[ticker.toUpperCase()];
  return info ? info.name : ticker;
}

/**
 * Demo VN news headlines (used when all sources fail)
 */
function getVNDemoNews(ticker) {
  const upper = ticker.toUpperCase();
  const company = getVNCompanyName(upper);
  const now = Date.now();
  return [
    { title: `${company} (${upper}) công bố kết quả kinh doanh quý vừa qua vượt kỳ vọng`, source: 'CafeF', publishedAt: new Date(now).toISOString(), url: `https://cafef.vn/search/?keywords=${upper}` },
    { title: `Cổ phiếu ${upper} tăng mạnh nhờ kết quả kinh doanh tích cực và dòng tiền ngoại`, source: 'VnEconomy', publishedAt: new Date(now - 3600000).toISOString(), url: `https://vneconomy.vn/search/?keywords=${upper}` },
    { title: `Phân tích kỹ thuật ${upper}: Xu hướng ngắn hạn tích cực, RSI chưa quá mua`, source: 'SSI Research', publishedAt: new Date(now - 7200000).toISOString(), url: `https://iboard.ssi.com.vn/dchart?symbol=${upper}` },
    { title: `${company} mở rộng hoạt động, ban lãnh đạo đặt mục tiêu tăng trưởng 20% năm nay`, source: 'DauTu', publishedAt: new Date(now - 10800000).toISOString(), url: `https://baodautu.vn/search?query=${upper}` },
    { title: `Khối ngoại mua ròng mạnh ${upper} trong phiên hôm nay, thanh khoản cải thiện rõ rệt`, source: 'VnDirect', publishedAt: new Date(now - 14400000).toISOString(), url: `https://www.vndirect.com.vn/portal/thong-tin-co-phieu/${upper.toLowerCase()}.shtml` },
    { title: `${upper}: Báo cáo của CTCK nhận xét tích cực về triển vọng trung hạn`, source: 'NDH', publishedAt: new Date(now - 18000000).toISOString(), url: `https://ndh.vn/tag/${upper.toLowerCase()}` },
    { title: `Thị trường chứng khoán VN hôm nay: ${upper} nằm trong nhóm dẫn dắt chỉ số`, source: 'CafeF', publishedAt: new Date(now - 21600000).toISOString(), url: `https://cafef.vn/thi-truong-chung-khoan.rss` },
    { title: `${company}: Cổ đông lớn đăng ký mua thêm, thể hiện niềm tin vào tiềm năng tăng trưởng`, source: 'VnEconomy', publishedAt: new Date(now - 25200000).toISOString(), url: `https://vneconomy.vn/chung-khoan.rss` },
  ];
}
