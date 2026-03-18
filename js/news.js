/**
 * News Fetching Module
 * Uses NewsAPI.org for real headlines, with demo fallback
 */

const NEWS_API_BASE = 'https://newsapi.org/v2';

// ── Demo Headlines (used when no API key is provided) ──
const DEMO_HEADLINES = {
  "AAPL": [
    { title: "Apple Reports Record-Breaking Quarterly Revenue Surging Past Expectations", source: "CNBC", publishedAt: new Date().toISOString(), url: "https://www.google.com/search?q=Apple+Record+Breaking+Quarterly+Revenue&tbm=nws" },
    { title: "iPhone Sales Soar as Apple Dominates Global Smartphone Market", source: "Reuters", publishedAt: new Date(Date.now() - 3600000).toISOString(), url: "https://www.google.com/search?q=iPhone+Sales+Soar+Apple+Smartphone+Market&tbm=nws" },
    { title: "Apple Stock Rallies After Strong Earnings Beat Analyst Forecasts", source: "Bloomberg", publishedAt: new Date(Date.now() - 7200000).toISOString(), url: "https://www.google.com/search?q=Apple+Stock+Rallies+Earnings+Beat&tbm=nws" },
    { title: "Apple's New AI Features Drive Massive User Growth and Engagement", source: "TechCrunch", publishedAt: new Date(Date.now() - 10800000).toISOString(), url: "https://www.google.com/search?q=Apple+AI+Features+User+Growth&tbm=nws" },
    { title: "Concerns Rise Over Apple's Supply Chain Disruptions in Asia", source: "WSJ", publishedAt: new Date(Date.now() - 14400000).toISOString(), url: "https://www.google.com/search?q=Apple+Supply+Chain+Disruptions+Asia&tbm=nws" },
    { title: "Apple Faces Antitrust Investigation from European Regulators", source: "Financial Times", publishedAt: new Date(Date.now() - 18000000).toISOString(), url: "https://www.google.com/search?q=Apple+Antitrust+Investigation+Europe&tbm=nws" },
    { title: "Apple Vision Pro Sales Disappoint as Consumer Demand Weakens", source: "MarketWatch", publishedAt: new Date(Date.now() - 21600000).toISOString(), url: "https://www.google.com/search?q=Apple+Vision+Pro+Sales+Disappoint&tbm=nws" },
    { title: "Analysts Upgrade Apple Stock Citing Strong Services Revenue Growth", source: "Yahoo Finance", publishedAt: new Date(Date.now() - 25200000).toISOString(), url: "https://www.google.com/search?q=Analysts+Upgrade+Apple+Stock+Services+Revenue&tbm=nws" },
    { title: "Apple's Market Cap Hits New All-Time High Amid Tech Rally", source: "CNBC", publishedAt: new Date(Date.now() - 28800000).toISOString(), url: "https://www.google.com/search?q=Apple+Market+Cap+All+Time+High&tbm=nws" },
    { title: "Apple Announces Major Investment in Renewable Energy Infrastructure", source: "Reuters", publishedAt: new Date(Date.now() - 32400000).toISOString(), url: "https://www.google.com/search?q=Apple+Renewable+Energy+Investment&tbm=nws" },
    { title: "Apple's Profit Margins Decline Amid Rising Component Costs", source: "Bloomberg", publishedAt: new Date(Date.now() - 36000000).toISOString(), url: "https://www.google.com/search?q=Apple+Profit+Margins+Decline+Component+Costs&tbm=nws" },
    { title: "Apple Launches Revolutionary Health Monitoring Features for Apple Watch", source: "The Verge", publishedAt: new Date(Date.now() - 39600000).toISOString(), url: "https://www.google.com/search?q=Apple+Watch+Health+Monitoring+Features&tbm=nws" },
  ],
  "TSLA": [
    { title: "Tesla Stock Crashes After Missing Delivery Targets by Wide Margin", source: "CNBC", publishedAt: new Date().toISOString(), url: "https://www.google.com/search?q=Tesla+Stock+Crashes+Missing+Delivery+Targets&tbm=nws" },
    { title: "Tesla's Autopilot Faces New Safety Investigation from Federal Regulators", source: "Reuters", publishedAt: new Date(Date.now() - 3600000).toISOString(), url: "https://www.google.com/search?q=Tesla+Autopilot+Safety+Investigation&tbm=nws" },
    { title: "Tesla Announces Breakthrough Battery Technology Reducing Costs by 50%", source: "Bloomberg", publishedAt: new Date(Date.now() - 7200000).toISOString(), url: "https://www.google.com/search?q=Tesla+Breakthrough+Battery+Technology&tbm=nws" },
    { title: "Elon Musk Warns of Challenging Economic Conditions Ahead for Tesla", source: "WSJ", publishedAt: new Date(Date.now() - 10800000).toISOString(), url: "https://www.google.com/search?q=Elon+Musk+Warns+Economic+Conditions+Tesla&tbm=nws" },
    { title: "Tesla's China Sales Surge Amid Growing Electric Vehicle Demand", source: "Financial Times", publishedAt: new Date(Date.now() - 14400000).toISOString(), url: "https://www.google.com/search?q=Tesla+China+Sales+Surge+Electric+Vehicle&tbm=nws" },
    { title: "Tesla Cybertruck Production Delays Frustrate Customers and Investors", source: "MarketWatch", publishedAt: new Date(Date.now() - 18000000).toISOString(), url: "https://www.google.com/search?q=Tesla+Cybertruck+Production+Delays&tbm=nws" },
    { title: "Tesla Expands Supercharger Network with Record Installation Numbers", source: "Electrek", publishedAt: new Date(Date.now() - 21600000).toISOString(), url: "https://www.google.com/search?q=Tesla+Supercharger+Network+Expansion&tbm=nws" },
    { title: "Competition Intensifies as Legacy Automakers Challenge Tesla's Market Share", source: "Yahoo Finance", publishedAt: new Date(Date.now() - 25200000).toISOString(), url: "https://www.google.com/search?q=Legacy+Automakers+Challenge+Tesla+Market+Share&tbm=nws" },
    { title: "Tesla Reports Stronger Than Expected Profit Growth in Latest Quarter", source: "CNBC", publishedAt: new Date(Date.now() - 28800000).toISOString(), url: "https://www.google.com/search?q=Tesla+Profit+Growth+Latest+Quarter&tbm=nws" },
    { title: "Tesla's Energy Storage Business Booms with Record Megapack Deployments", source: "Reuters", publishedAt: new Date(Date.now() - 32400000).toISOString(), url: "https://www.google.com/search?q=Tesla+Energy+Storage+Megapack+Deployments&tbm=nws" },
    { title: "Analysts Downgrade Tesla Citing Slowing Growth and Margin Pressure", source: "Bloomberg", publishedAt: new Date(Date.now() - 36000000).toISOString(), url: "https://www.google.com/search?q=Analysts+Downgrade+Tesla+Slowing+Growth&tbm=nws" },
    { title: "Tesla Signs Major Deal to Supply Electric Vehicles to Government Fleets", source: "The Verge", publishedAt: new Date(Date.now() - 39600000).toISOString(), url: "https://www.google.com/search?q=Tesla+Electric+Vehicles+Government+Fleets&tbm=nws" },
  ],
  "MSFT": [
    { title: "Microsoft's Cloud Revenue Surges Past $30 Billion in Record Quarter", source: "CNBC", publishedAt: new Date().toISOString(), url: "https://www.google.com/search?q=Microsoft+Cloud+Revenue+Surges+Record+Quarter&tbm=nws" },
    { title: "Microsoft AI Copilot Drives Massive Enterprise Adoption and Revenue Growth", source: "Reuters", publishedAt: new Date(Date.now() - 3600000).toISOString(), url: "https://www.google.com/search?q=Microsoft+AI+Copilot+Enterprise+Adoption&tbm=nws" },
    { title: "Microsoft Stock Hits All-Time High After Beating Earnings Expectations", source: "Bloomberg", publishedAt: new Date(Date.now() - 7200000).toISOString(), url: "https://www.google.com/search?q=Microsoft+Stock+All+Time+High+Earnings&tbm=nws" },
    { title: "Microsoft Faces Regulatory Scrutiny Over AI Competition Practices", source: "WSJ", publishedAt: new Date(Date.now() - 10800000).toISOString(), url: "https://www.google.com/search?q=Microsoft+Regulatory+Scrutiny+AI+Competition&tbm=nws" },
    { title: "Azure Growth Accelerates as Companies Embrace Cloud Computing", source: "Financial Times", publishedAt: new Date(Date.now() - 14400000).toISOString(), url: "https://www.google.com/search?q=Azure+Growth+Accelerates+Cloud+Computing&tbm=nws" },
    { title: "Microsoft Gaming Division Struggles After Activision Integration Challenges", source: "MarketWatch", publishedAt: new Date(Date.now() - 18000000).toISOString(), url: "https://www.google.com/search?q=Microsoft+Gaming+Activision+Integration+Challenges&tbm=nws" },
    { title: "Microsoft's LinkedIn Shows Strong Growth in Professional Networking Revenue", source: "Yahoo Finance", publishedAt: new Date(Date.now() - 21600000).toISOString(), url: "https://www.google.com/search?q=Microsoft+LinkedIn+Growth+Revenue&tbm=nws" },
    { title: "Microsoft Announces Massive Data Center Expansion Across Global Markets", source: "TechCrunch", publishedAt: new Date(Date.now() - 25200000).toISOString(), url: "https://www.google.com/search?q=Microsoft+Data+Center+Expansion+Global&tbm=nws" },
    { title: "Investors Worry About Microsoft's Rising Capital Expenditure on AI", source: "Bloomberg", publishedAt: new Date(Date.now() - 28800000).toISOString(), url: "https://www.google.com/search?q=Microsoft+Rising+Capital+Expenditure+AI&tbm=nws" },
    { title: "Microsoft Partners with Healthcare Companies to Deploy AI Diagnostic Tools", source: "Reuters", publishedAt: new Date(Date.now() - 32400000).toISOString(), url: "https://www.google.com/search?q=Microsoft+Healthcare+AI+Diagnostic+Tools&tbm=nws" },
  ],
  "GOOGL": [
    { title: "Google Search Revenue Grows Despite Rising AI Competition Threats", source: "CNBC", publishedAt: new Date().toISOString(), url: "https://www.google.com/search?q=Google+Search+Revenue+AI+Competition&tbm=nws" },
    { title: "Alphabet Stock Rallies After Announcing Record Share Buyback Program", source: "Reuters", publishedAt: new Date(Date.now() - 3600000).toISOString(), url: "https://www.google.com/search?q=Alphabet+Stock+Rallies+Share+Buyback&tbm=nws" },
    { title: "YouTube Ad Revenue Disappoints Amid Slowing Growth in Digital Advertising", source: "Bloomberg", publishedAt: new Date(Date.now() - 7200000).toISOString(), url: "https://www.google.com/search?q=YouTube+Ad+Revenue+Disappoints&tbm=nws" },
    { title: "Google's Gemini AI Model Receives Positive Reviews from Enterprise Customers", source: "WSJ", publishedAt: new Date(Date.now() - 10800000).toISOString(), url: "https://www.google.com/search?q=Google+Gemini+AI+Enterprise+Reviews&tbm=nws" },
    { title: "Antitrust Ruling Against Google Could Force Major Business Changes", source: "Financial Times", publishedAt: new Date(Date.now() - 14400000).toISOString(), url: "https://www.google.com/search?q=Antitrust+Ruling+Google+Business+Changes&tbm=nws" },
    { title: "Google Cloud Platform Achieves Profitability for First Time in History", source: "MarketWatch", publishedAt: new Date(Date.now() - 18000000).toISOString(), url: "https://www.google.com/search?q=Google+Cloud+Platform+Profitability&tbm=nws" },
    { title: "Alphabet Faces Mounting Pressure from Regulators in Multiple Countries", source: "Yahoo Finance", publishedAt: new Date(Date.now() - 21600000).toISOString(), url: "https://www.google.com/search?q=Alphabet+Regulators+Pressure+Multiple+Countries&tbm=nws" },
    { title: "Google's Waymo Self-Driving Cars Expand to Ten New Major Cities", source: "TechCrunch", publishedAt: new Date(Date.now() - 25200000).toISOString(), url: "https://www.google.com/search?q=Google+Waymo+Self+Driving+Cars+Expand&tbm=nws" },
    { title: "Google Invests Billions in Renewable Energy to Power Data Centers", source: "Reuters", publishedAt: new Date(Date.now() - 28800000).toISOString(), url: "https://www.google.com/search?q=Google+Renewable+Energy+Data+Centers&tbm=nws" },
    { title: "Pixel Phone Sales Show Promising Growth in Competitive Smartphone Market", source: "The Verge", publishedAt: new Date(Date.now() - 32400000).toISOString(), url: "https://www.google.com/search?q=Pixel+Phone+Sales+Growth+Smartphone+Market&tbm=nws" },
  ],
  "AMZN": [
    { title: "Amazon Web Services Revenue Soars with AI Workload Expansion", source: "CNBC", publishedAt: new Date().toISOString(), url: "https://www.google.com/search?q=Amazon+Web+Services+Revenue+AI+Workload&tbm=nws" },
    { title: "Amazon Prime Membership Reaches Record Numbers Worldwide", source: "Reuters", publishedAt: new Date(Date.now() - 3600000).toISOString(), url: "https://www.google.com/search?q=Amazon+Prime+Membership+Record+Numbers&tbm=nws" },
    { title: "Amazon Stock Drops After Warning of Increased Competition in E-Commerce", source: "Bloomberg", publishedAt: new Date(Date.now() - 7200000).toISOString(), url: "https://www.google.com/search?q=Amazon+Stock+Drops+Competition+E-Commerce&tbm=nws" },
    { title: "Amazon's Advertising Business Becomes Major Profit Driver", source: "WSJ", publishedAt: new Date(Date.now() - 10800000).toISOString(), url: "https://www.google.com/search?q=Amazon+Advertising+Business+Profit+Driver&tbm=nws" },
    { title: "Amazon Faces Labor Disputes as Warehouse Workers Demand Better Conditions", source: "Financial Times", publishedAt: new Date(Date.now() - 14400000).toISOString(), url: "https://www.google.com/search?q=Amazon+Labor+Disputes+Warehouse+Workers&tbm=nws" },
    { title: "Amazon Expands Healthcare Services with New Virtual Clinic Network", source: "MarketWatch", publishedAt: new Date(Date.now() - 18000000).toISOString(), url: "https://www.google.com/search?q=Amazon+Healthcare+Services+Virtual+Clinic&tbm=nws" },
    { title: "Amazon's Logistics Network Achieves Same-Day Delivery in Major Markets", source: "Yahoo Finance", publishedAt: new Date(Date.now() - 21600000).toISOString(), url: "https://www.google.com/search?q=Amazon+Same+Day+Delivery+Major+Markets&tbm=nws" },
    { title: "Analysts Raise Amazon Price Target After Impressive Earnings Report", source: "TechCrunch", publishedAt: new Date(Date.now() - 25200000).toISOString(), url: "https://www.google.com/search?q=Analysts+Raise+Amazon+Price+Target+Earnings&tbm=nws" },
    { title: "Amazon's Alexa Division Reports Losses Amid Restructuring Efforts", source: "Bloomberg", publishedAt: new Date(Date.now() - 28800000).toISOString(), url: "https://www.google.com/search?q=Amazon+Alexa+Division+Losses+Restructuring&tbm=nws" },
    { title: "Amazon Invests in Satellite Internet to Compete with Starlink", source: "Reuters", publishedAt: new Date(Date.now() - 32400000).toISOString(), url: "https://www.google.com/search?q=Amazon+Satellite+Internet+Compete+Starlink&tbm=nws" },
  ],
  "NVDA": [
    { title: "NVIDIA Reports Explosive Revenue Growth Fueled by Insatiable AI Demand", source: "CNBC", publishedAt: new Date().toISOString(), url: "https://www.google.com/search?q=NVIDIA+Explosive+Revenue+Growth+AI+Demand&tbm=nws" },
    { title: "NVIDIA Stock Surges to Record High as Data Center Sales Skyrocket", source: "Reuters", publishedAt: new Date(Date.now() - 3600000).toISOString(), url: "https://www.google.com/search?q=NVIDIA+Stock+Surges+Record+High+Data+Center&tbm=nws" },
    { title: "NVIDIA's New GPU Architecture Delivers Breakthrough AI Performance Gains", source: "Bloomberg", publishedAt: new Date(Date.now() - 7200000).toISOString(), url: "https://www.google.com/search?q=NVIDIA+GPU+Architecture+Breakthrough+AI+Performance&tbm=nws" },
    { title: "Concerns Grow Over NVIDIA Chip Export Restrictions to China", source: "WSJ", publishedAt: new Date(Date.now() - 10800000).toISOString(), url: "https://www.google.com/search?q=NVIDIA+Chip+Export+Restrictions+China&tbm=nws" },
    { title: "NVIDIA Partners with Major Cloud Providers for Next-Gen AI Infrastructure", source: "Financial Times", publishedAt: new Date(Date.now() - 14400000).toISOString(), url: "https://www.google.com/search?q=NVIDIA+Cloud+Providers+AI+Infrastructure&tbm=nws" },
    { title: "NVIDIA Faces Growing Competition from AMD and Custom AI Chips", source: "MarketWatch", publishedAt: new Date(Date.now() - 18000000).toISOString(), url: "https://www.google.com/search?q=NVIDIA+Competition+AMD+Custom+AI+Chips&tbm=nws" },
    { title: "NVIDIA's Gaming Revenue Rebounds After Extended Slump Period", source: "Yahoo Finance", publishedAt: new Date(Date.now() - 21600000).toISOString(), url: "https://www.google.com/search?q=NVIDIA+Gaming+Revenue+Rebounds+Slump&tbm=nws" },
    { title: "NVIDIA CEO Predicts Trillion-Dollar AI Infrastructure Buildout", source: "TechCrunch", publishedAt: new Date(Date.now() - 25200000).toISOString(), url: "https://www.google.com/search?q=NVIDIA+CEO+Trillion+Dollar+AI+Infrastructure&tbm=nws" },
    { title: "Supply Constraints Limit NVIDIA's Ability to Meet Overwhelming Demand", source: "Bloomberg", publishedAt: new Date(Date.now() - 28800000).toISOString(), url: "https://www.google.com/search?q=NVIDIA+Supply+Constraints+Overwhelming+Demand&tbm=nws" },
    { title: "NVIDIA Automotive Division Shows Strong Growth in Self-Driving Technology", source: "Reuters", publishedAt: new Date(Date.now() - 32400000).toISOString(), url: "https://www.google.com/search?q=NVIDIA+Automotive+Self+Driving+Technology&tbm=nws" },
  ]
};

// ── Free RSS-to-JSON converters (no API key needed) ──
const RSS_CONVERTERS = [
  (rssUrl) => `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`,
  (rssUrl) => `https://rss2json.com/api.json?rss_url=${encodeURIComponent(rssUrl)}`,
];

/**
 * Fetch news for a given stock ticker
 * Tries: 1) Google News RSS (free, no key) → 2) NewsAPI (if key provided) → 3) Demo data
 * @param {string} ticker - Stock ticker symbol (e.g. "AAPL")
 * @param {string} apiKey - NewsAPI key (optional)
 * @returns {Promise<Array>} Array of news articles
 */
export async function fetchNews(ticker, apiKey = '') {

  // ── Method 1: Google News RSS (FREE, no API key needed) ──
  try {
    const articles = await fetchFromGoogleNewsRSS(ticker);
    if (articles && articles.length >= 3) {
      console.log(`✅ Got ${articles.length} articles from Google News RSS`);
      return articles;
    }
  } catch (err) {
    console.warn('Google News RSS failed:', err.message);
  }

  // ── Method 2: NewsAPI (if user provided a key) ──
  if (apiKey && apiKey.trim()) {
    try {
      const query = getSearchQuery(ticker);
      const url = `${NEWS_API_BASE}/everything?q=${encodeURIComponent(query)}&language=en&sortBy=publishedAt&pageSize=20&apiKey=${apiKey}`;

      const response = await fetch(url);
      if (!response.ok) throw new Error(`API error: ${response.status}`);
      const data = await response.json();

      if (data.articles && data.articles.length > 0) {
        console.log(`✅ Got ${data.articles.length} articles from NewsAPI`);
        return data.articles.map(a => ({
          title: a.title,
          source: a.source?.name || 'Unknown',
          publishedAt: a.publishedAt,
          url: a.url,
          description: a.description
        }));
      }
    } catch (err) {
      console.warn('NewsAPI failed:', err.message);
    }
  }

  // ── Method 3: Demo data (always available) ──
  console.log('📋 Using demo data');
  return getDemoNews(ticker);
}

/**
 * Fetch real news from Google News RSS feed (completely free, no API key)
 */
async function fetchFromGoogleNewsRSS(ticker) {
  const query = getSearchQuery(ticker);
  const keywords = getRelevanceKeywords(ticker);
  // Use exact-match quotes for better Google News results
  const googleNewsRSS = `https://news.google.com/rss/search?q=${encodeURIComponent('"' + query + '"')}&hl=en-US&gl=US&ceid=US:en`;

  // Try each RSS converter
  for (const buildUrl of RSS_CONVERTERS) {
    try {
      const apiUrl = buildUrl(googleNewsRSS);
      const response = await fetch(apiUrl);

      if (!response.ok) continue;

      const data = await response.json();

      if (data.status === 'ok' && data.items && data.items.length > 0) {
        const articles = data.items
          .filter(item => item.title && item.title.length > 15)
          .map(item => ({
            title: cleanTitle(item.title),
            source: item.author || extractSource(item.title) || 'Google News',
            publishedAt: item.pubDate || new Date().toISOString(),
            url: item.link || item.guid || '#',
            description: item.description ? stripHtml(item.description) : ''
          }))
          // ★ RELEVANCE FILTER: only keep articles about this stock/company
          .filter(article => isRelevantArticle(article, keywords))
          .slice(0, 15);

        if (articles.length >= 3) return articles;
      }
    } catch (err) {
      continue; // Try next converter
    }
  }

  return []; // All converters failed
}

/**
 * Check if an article is relevant to the given stock
 * Must mention the company name, ticker, OR be clearly financial
 */
function isRelevantArticle(article, keywords) {
  const text = (article.title + ' ' + (article.description || '')).toLowerCase();

  // Must match at least one company/ticker keyword
  const hasCompanyMatch = keywords.some(kw => text.includes(kw.toLowerCase()));
  if (!hasCompanyMatch) return false;

  // Reject clearly unrelated content (politics, sports, entertainment gossip)
  const REJECT_PATTERNS = [
    /\b(war|military|troops|bombing|missile|airstrike|casualties)\b/i,
    /\b(election|vote|ballot|senator|congressman|political party)\b/i,
    /\b(murder|crime|prison|arrested|convicted|sentenced)\b/i,
    /\b(celebrity|gossip|dating|divorce|wedding|reality show)\b/i,
    /\b(soccer|football|basketball|cricket|tennis|olympics)\b/i,
  ];

  // Only reject if it has reject patterns AND doesn't have financial keywords
  const FINANCIAL_KEYWORDS = [
    'stock', 'share', 'market', 'revenue', 'earnings', 'profit', 'investor',
    'analyst', 'quarter', 'growth', 'dividend', 'valuation', 'forecast',
    'buy', 'sell', 'upgrade', 'downgrade', 'target', 'price', 'trading',
    'ceo', 'ipo', 'sec', 'wall street', 'nasdaq', 'nyse', 'billion',
    'million', 'percent', 'rally', 'surge', 'drop', 'fall', 'rise',
    'streaming', 'subscriber', 'ai', 'cloud', 'sales', 'delivery',
    'product', 'launch', 'partnership', 'acquisition', 'merger',
  ];

  const hasFinancialContext = FINANCIAL_KEYWORDS.some(fw => text.includes(fw));
  const hasRejectPattern = REJECT_PATTERNS.some(rp => rp.test(text));

  // If it has reject patterns but no financial context, skip it
  if (hasRejectPattern && !hasFinancialContext) return false;

  return true;
}

/**
 * Get keywords used to check article relevance for a ticker
 */
function getRelevanceKeywords(ticker) {
  const upper = ticker.toUpperCase();
  const map = {
    'AAPL':  ['apple', 'aapl', 'iphone', 'ipad', 'mac', 'tim cook'],
    'TSLA':  ['tesla', 'tsla', 'elon musk', 'cybertruck', 'model 3', 'model y'],
    'MSFT':  ['microsoft', 'msft', 'azure', 'windows', 'xbox', 'satya nadella', 'copilot'],
    'GOOGL': ['google', 'alphabet', 'googl', 'youtube', 'android', 'sundar pichai', 'gemini'],
    'AMZN':  ['amazon', 'amzn', 'aws', 'prime', 'jeff bezos', 'andy jassy', 'alexa'],
    'NVDA':  ['nvidia', 'nvda', 'gpu', 'jensen huang', 'geforce', 'cuda'],
    'META':  ['meta', 'facebook', 'instagram', 'whatsapp', 'zuckerberg', 'threads'],
    'NFLX':  ['netflix', 'nflx', 'streaming', 'subscriber'],
    'AMD':   ['amd', 'advanced micro', 'radeon', 'ryzen', 'lisa su'],
  };
  return map[upper] || [ticker.toLowerCase(), upper];
}

/**
 * Clean Google News title (often appends " - Source Name")
 */
function cleanTitle(title) {
  // Google News format: "Headline text - Source Name"
  const parts = title.split(' - ');
  if (parts.length > 1) {
    return parts.slice(0, -1).join(' - ').trim();
  }
  return title.trim();
}

/**
 * Extract source name from Google News title
 */
function extractSource(title) {
  const parts = title.split(' - ');
  if (parts.length > 1) {
    return parts[parts.length - 1].trim();
  }
  return null;
}

/**
 * Strip HTML tags from description
 */
function stripHtml(html) {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
}

/**
 * Get demo headlines for a ticker
 */
function getDemoNews(ticker) {
  const upper = ticker.toUpperCase();
  if (DEMO_HEADLINES[upper]) {
    return DEMO_HEADLINES[upper];
  }

  // Generate generic headlines for unknown tickers
  return [
    { title: `${upper} Stock Shows Mixed Signals Amid Market Uncertainty`, source: "Market Analysis", publishedAt: new Date().toISOString() },
    { title: `Analysts Debate Whether ${upper} Is Overvalued at Current Levels`, source: "Financial Times", publishedAt: new Date(Date.now() - 3600000).toISOString() },
    { title: `${upper} Reports Steady Earnings Growth in Latest Quarter`, source: "CNBC", publishedAt: new Date(Date.now() - 7200000).toISOString() },
    { title: `${upper} Faces Increasing Competition in Core Business Segments`, source: "Reuters", publishedAt: new Date(Date.now() - 10800000).toISOString() },
    { title: `Investors Remain Cautious on ${upper} Despite Positive Outlook`, source: "Bloomberg", publishedAt: new Date(Date.now() - 14400000).toISOString() },
    { title: `${upper} Announces New Product Launch Expected to Boost Revenue`, source: "MarketWatch", publishedAt: new Date(Date.now() - 18000000).toISOString() },
    { title: `${upper} Expands Operations into Emerging Markets`, source: "WSJ", publishedAt: new Date(Date.now() - 21600000).toISOString() },
    { title: `${upper} Stock Drops on Concerns Over Rising Interest Rates`, source: "Yahoo Finance", publishedAt: new Date(Date.now() - 25200000).toISOString() },
  ];
}

/**
 * Map ticker to search query for Google News / NewsAPI
 */
function getSearchQuery(ticker) {
  const tickerMap = {
    'AAPL': 'Apple stock',
    'TSLA': 'Tesla stock',
    'MSFT': 'Microsoft stock',
    'GOOGL': 'Alphabet Google stock',
    'AMZN': 'Amazon stock',
    'NVDA': 'NVIDIA stock',
    'META': 'Meta Platforms stock',
    'NFLX': 'Netflix stock',
    'AMD': 'AMD stock',
  };
  return tickerMap[ticker.toUpperCase()] || `${ticker} stock`;
}

/**
 * Get list of popular tickers for quick access
 */
export function getPopularTickers() {
  return [
    { symbol: 'AAPL', name: 'Apple Inc.' },
    { symbol: 'TSLA', name: 'Tesla Inc.' },
    { symbol: 'MSFT', name: 'Microsoft Corp.' },
    { symbol: 'GOOGL', name: 'Alphabet Inc.' },
    { symbol: 'AMZN', name: 'Amazon.com Inc.' },
    { symbol: 'NVDA', name: 'NVIDIA Corp.' },
    { symbol: 'META', name: 'Meta Platforms' },
    { symbol: 'NFLX', name: 'Netflix Inc.' },
  ];
}
