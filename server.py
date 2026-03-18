"""
StockSense AI – Backend Server
Flask API: SSI chart data scraping, VN news scraping, real-time quotes
No paid API keys required.
"""
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
import requests
import json
import time
import os
import re
from datetime import datetime, timedelta
import threading
from ai_scorer import compute_full_score, score_sentiment, detect_sectors

# Serve frontend from the same folder as server.py
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
app = Flask(__name__, static_folder=BASE_DIR, static_url_path='')
CORS(app)

# Disable browser cache for JS/CSS files
@app.after_request
def add_no_cache(response):
    if response.content_type and ('javascript' in response.content_type or 'css' in response.content_type):
        response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
        response.headers['Pragma'] = 'no-cache'
        response.headers['Expires'] = '0'
    return response

# ── Serve index.html at root ──
@app.route('/')
def serve_index():
    return send_from_directory(BASE_DIR, 'index.html')


# ── Config ──
SSI_DATA_BASE = 'https://fc-data.ssi.com.vn/api/v2/Market'
ALLORIGINS = 'https://api.allorigins.win/raw?url='

YAHOO_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.5',
}

def yahoo_get(path):
    """Make a Yahoo Finance request. Googlebot UA bypasses anti-scraping reliably."""
    s = requests.Session()
    return s.get(
        f'https://query1.finance.yahoo.com{path}',
        headers=YAHOO_HEADERS,
        timeout=12
    )


SSI_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
    'Origin': 'https://iboard.ssi.com.vn',
    'Referer': 'https://iboard.ssi.com.vn/',
}

VN_MAP = {
    'VNM': 'Vinamilk', 'FPT': 'FPT', 'VCB': 'Vietcombank', 'VIC': 'Vingroup',
    'VHM': 'Vinhomes', 'HPG': 'Hòa Phát', 'MWG': 'Thế Giới Di Động',
    'TCB': 'Techcombank', 'BID': 'BIDV', 'CTG': 'VietinBank', 'MBB': 'MB Bank',
    'SSI': 'SSI Securities', 'VND': 'VNDirect', 'ACB': 'ACB Bank',
    'STB': 'Sacombank', 'VPB': 'VP Bank', 'SHB': 'SHB Bank',
    'GAS': 'PV Gas', 'SAB': 'Sabeco', 'PLX': 'Petrolimex',
    'NVL': 'Novaland', 'PDR': 'Phát Đạt', 'VRE': 'Vincom Retail',
    'MSN': 'Masan', 'PNJ': 'Phú Nhuận', 'DGC': 'Đức Giang',
}


# ╔══════════════════════════════════════════════════════════╗
# ║  ENDPOINT 1: SSI Chart Data (Daily OHLCV)                ║
# ╚══════════════════════════════════════════════════════════╝

@app.route('/api/ssi-chart/<ticker>')
def get_ssi_chart(ticker):
    """
    Get daily OHLCV candlestick data.
    Query params:
      range: 1mo | 3mo | 6mo | 1y | 2y | 5y  (default: 6mo)
    Priority: SSI API → Yahoo Finance .VN
    """
    ticker = ticker.upper()
    # Map range param → days for SSI + Yahoo range string
    RANGE_MAP = {
        '1d':   (1,    '1d'),
        '2d':   (2,    '2d'),
        '5d':   (5,    '5d'),
        '1mo':  (35,  '1mo'),
        '3mo':  (95,  '3mo'),
        '6mo':  (185, '6mo'),
        '1y':   (370, '1y'),
        '2y':   (740, '2y'),
        '5y':   (1830,'5y'),
    }
    range_param = request.args.get('range', '6mo').lower()
    if range_param not in RANGE_MAP:
        range_param = '6mo'
    days, yf_range = RANGE_MAP[range_param]

    # ── Intraday intervals: bypass SSI, go straight to Yahoo Finance ──
    interval_param = request.args.get('interval', '1d').lower()
    INTRADAY_INTERVALS = ['1m', '5m', '15m', '30m', '60m', '1h']
    if interval_param in INTRADAY_INTERVALS:
        # Use the range from frontend (e.g. '1d' for today only)
        yf_intra_range = range_param  # Use whatever the frontend sent
        yf_intra_interval = '60m' if interval_param == '1h' else interval_param
        try:
            yahoo_ticker = f"{ticker}.VN"
            resp = yahoo_get(f'/v8/finance/chart/{yahoo_ticker}?range={yf_intra_range}&interval={yf_intra_interval}&includePrePost=false')
            data = resp.json()
            result = data.get('chart', {}).get('result', [{}])[0]
            timestamps = result.get('timestamp', [])
            quote = result.get('indicators', {}).get('quote', [{}])[0]
            candles = []
            for i in range(len(timestamps)):
                try:
                    o = quote['open'][i]
                    h = quote['high'][i]
                    l = quote['low'][i]
                    c = quote['close'][i]
                    if o is None or h is None or l is None or c is None:
                        continue
                    candles.append({
                        'time':   timestamps[i],          # Unix timestamp (seconds) for intraday
                        'open':   round(float(o), 2),
                        'high':   round(float(h), 2),
                        'low':    round(float(l), 2),
                        'close':  round(float(c), 2),
                        'volume': int(quote.get('volume', [0])[i] or 0),
                    })
                except:
                    continue
            if candles:
                print(f"✅ Yahoo Intraday {yf_intra_interval}/{yf_intra_range}: {len(candles)} bars for {ticker}")
                return jsonify({'ticker': ticker, 'source': f'Yahoo-{yf_intra_interval}', 'candles': candles, 'intraday': True})
        except Exception as e:
            print(f"Intraday fetch failed: {e}")
        return jsonify({'error': f'No intraday data for {ticker}', 'candles': []}), 404

    # ── Strategy 1: SSI DailyOhlc API ──
    try:
        from_date = (datetime.now() - timedelta(days=days)).strftime('%d/%m/%Y')
        to_date   = datetime.now().strftime('%d/%m/%Y')
        url = (f"{SSI_DATA_BASE}/DailyOhlc"
               f"?symbol={ticker}&fromDate={from_date}&toDate={to_date}"
               f"&pageIndex=1&pageSize=500&ascending=true")
        resp = requests.get(url, headers=SSI_HEADERS, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            candles = []
            items = data.get('data', [])
            if isinstance(items, list):
                for item in items:
                    try:
                        t = str(item.get('tradingDate', item.get('date', '')))
                        if '/' in t:
                            parts = t.split('/')
                            date_str = f"{parts[2][:4]}-{parts[1].zfill(2)}-{parts[0].zfill(2)}"
                        else:
                            date_str = t[:10]
                        o = float(item.get('open', 0) or 0)
                        c = float(item.get('close', 0) or 0)
                        if o > 0 and c > 0:
                            candles.append({
                                'time': date_str,
                                'open': o,
                                'high': float(item.get('high', c)),
                                'low':  float(item.get('low', c)),
                                'close': c,
                                'volume': int(item.get('volume', 0) or 0),
                            })
                    except:
                        continue
            if len(candles) >= 5:
                print(f"✅ SSI DailyOhlc: {len(candles)} candles for {ticker} ({range_param})")
                return jsonify({'ticker': ticker, 'source': 'SSI', 'candles': candles})
    except Exception as e:
        print(f"SSI DailyOhlc failed: {e}")

    # ── Strategy 2: Yahoo Finance fallback (ticker.VN) ──
    # Try requested range first, then fallbacks
    yf_ranges_to_try = [yf_range]
    for fb in ['6mo', '1y', '3mo']:
        if fb != yf_range:
            yf_ranges_to_try.append(fb)
    for range_str in yf_ranges_to_try:
        try:
            yahoo_ticker = f"{ticker}.VN"
            resp = yahoo_get(f'/v8/finance/chart/{yahoo_ticker}?range={range_str}&interval=1d&includePrePost=false')
            data = resp.json()
            result = data.get('chart', {}).get('result', [{}])[0]
            timestamps = result.get('timestamp', [])
            quote = result.get('indicators', {}).get('quote', [{}])[0]
            candles = []
            for i in range(len(timestamps)):
                try:
                    o = quote['open'][i]
                    h = quote['high'][i]
                    l = quote['low'][i]
                    c = quote['close'][i]
                    if o is None or h is None or l is None or c is None:
                        continue
                    d = datetime.fromtimestamp(timestamps[i])
                    candles.append({
                        'time':   d.strftime('%Y-%m-%d'),
                        'open':   round(float(o), 2),
                        'high':   round(float(h), 2),
                        'low':    round(float(l), 2),
                        'close':  round(float(c), 2),
                        'volume': int(quote.get('volume', [0])[i] or 0),
                    })
                except:
                    continue
            if candles:
                print(f"✅ Yahoo Finance {range_str}: {len(candles)} candles for {ticker}")
                return jsonify({'ticker': ticker, 'source': f'Yahoo-{range_str}', 'candles': candles})
        except Exception as e:
            print(f"Yahoo fallback ({range_str}) failed: {e}")
            continue
    
    return jsonify({'error': f'No data found for {ticker}', 'candles': []}), 404




# ╔══════════════════════════════════════════════════════════╗
# ║  ENDPOINT 2: SSI Intraday Real-time OHLCV                ║
# ╚══════════════════════════════════════════════════════════╝

@app.route('/api/ssi-intraday/<ticker>')
def get_ssi_intraday(ticker):
    """
    Get today's intraday 1-minute OHLCV candles from SSI.
    Used for the real-time moving chart.
    """
    today = datetime.now().strftime('%d/%m/%Y')
    
    # ── SSI IntradayOhlc ──
    try:
        url = (f"{SSI_DATA_BASE}/IntradayOhlc"
               f"?symbol={ticker.upper()}&fromDate={today}&toDate={today}"
               f"&pageIndex=1&pageSize=1000&resolution=1&ascending=true")
        resp = requests.get(url, headers=SSI_HEADERS, timeout=10)
        data = resp.json()
        
        candles = []
        items = data.get('data', [])
        if not isinstance(items, list):
            items = []
        
        for item in items:
            try:
                # SSI intraday time: unix timestamp or HH:MM:SS
                t = item.get('time', item.get('tradingTime', ''))
                if isinstance(t, (int, float)):
                    ts = int(t)
                else:
                    # Parse "HH:MM:SS" → combine with today's date
                    today_dt = datetime.now().date()
                    time_parts = str(t).split(':')
                    if len(time_parts) >= 2:
                        ts = int(datetime(today_dt.year, today_dt.month, today_dt.day,
                                         int(time_parts[0]), int(time_parts[1]),
                                         int(time_parts[2]) if len(time_parts) > 2 else 0).timestamp())
                    else:
                        continue
                
                o = float(item.get('open', 0) or 0)
                h = float(item.get('high', 0) or 0)
                l = float(item.get('low', 0) or 0)
                c = float(item.get('close', 0) or 0)
                v = int(item.get('volume', 0) or 0)
                
                if c > 0:
                    candles.append({'time': ts, 'open': o, 'high': h, 'low': l, 'close': c, 'volume': v})
            except:
                continue
        
        if candles:
            print(f"✅ SSI Intraday: {len(candles)} bars for {ticker}")
            return jsonify({'ticker': ticker, 'source': 'SSI-intraday', 'candles': candles})
    except Exception as e:
        print(f"SSI intraday failed: {e}")
    
    # ── Fallback: Yahoo Finance 1m ──
    try:
        yahoo_ticker = f"{ticker.upper()}.VN"
        resp = yahoo_get(f'/v8/finance/chart/{yahoo_ticker}?interval=1m&range=1d&includePrePost=false')
        data = resp.json()
        result = data.get('chart', {}).get('result', [{}])[0]
        timestamps = result.get('timestamp', [])
        quote = result.get('indicators', {}).get('quote', [{}])[0]
        candles = []
        for i in range(len(timestamps)):
            o = quote.get('open', [None])[i]
            if o is None:
                continue
            candles.append({
                'time':   timestamps[i],
                'open':   round(o, 2),
                'high':   round(quote['high'][i], 2),
                'low':    round(quote['low'][i], 2),
                'close':  round(quote['close'][i], 2),
                'volume': int(quote.get('volume', [0])[i] or 0),
            })
        return jsonify({'ticker': ticker, 'source': 'Yahoo-intraday', 'candles': candles})
    except Exception as e:
        return jsonify({'error': str(e), 'candles': []}), 500


# ╔══════════════════════════════════════════════════════════╗
# ║  ENDPOINT 3: VN News Scraper (CafeF, VnEconomy, DauTu)  ║
# ╚══════════════════════════════════════════════════════════╝

VN_NEWS_SOURCES = [
    {
        'name': 'CafeF',
        'rss': 'https://cafef.vn/thi-truong-chung-khoan.rss',
    },
    {
        'name': 'CafeF Doanh nghiệp',
        'rss': 'https://cafef.vn/doanh-nghiep.rss',
    },
    {
        'name': 'VnEconomy',
        'rss': 'https://vneconomy.vn/chung-khoan.rss',
    },
    {
        'name': 'DauTu Online',
        'rss': 'https://baodautu.vn/chung-khoan.rss',
    },
    {
        'name': 'Vietstock',
        'rss': 'https://vietstock.vn/736/chung-khoan-viet-nam.htm',
    },
    {
        'name': 'NDH',
        'rss': 'https://ndh.vn/thi-truong.rss',
    },
]

def parse_rss_manually(rss_url, source_name, company_name, ticker):
    """Manually parse RSS XML using requests + basic parsing (no feedparser needed)."""
    articles = []
    try:
        resp = requests.get(rss_url, timeout=8,
                           headers={'User-Agent': 'Mozilla/5.0 (compatible; RSS reader)',
                                    'Accept': 'application/rss+xml, application/xml, text/xml'})
        if not resp.ok:
            return []
        
        xml = resp.text
        
        # Extract <item> blocks
        items = re.findall(r'<item>(.*?)</item>', xml, re.DOTALL)
        
        keywords = [ticker.lower(), company_name.lower()]
        if len(company_name) > 4:
            # Add partial match for company names
            keywords.extend(company_name.lower().split())
        
        for item_xml in items[:30]:
            try:
                title_match = re.search(r'<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?</title>', item_xml, re.DOTALL)
                link_match  = re.search(r'<link>([^<]+)</link>', item_xml)
                if not link_match:
                    link_match = re.search(r'<guid[^>]*>([^<]+)</guid>', item_xml)
                desc_match  = re.search(r'<description>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?</description>', item_xml, re.DOTALL)
                date_match  = re.search(r'<pubDate>(.*?)</pubDate>', item_xml)
                
                if not title_match:
                    continue
                
                title = re.sub(r'<[^>]+>', '', title_match.group(1)).strip()
                link  = link_match.group(1).strip() if link_match else '#'
                desc  = re.sub(r'<[^>]+>', '', desc_match.group(1)).strip()[:200] if desc_match else ''
                pub   = date_match.group(1).strip() if date_match else datetime.now().isoformat()
                
                # Relevance filter
                text_lower = (title + ' ' + desc).lower()
                is_relevant = any(kw in text_lower for kw in keywords)
                
                if is_relevant:
                    articles.append({
                        'title': title,
                        'url': link,
                        'source': source_name,
                        'publishedAt': pub,
                        'description': desc,
                    })
            except:
                continue
    except Exception as e:
        print(f"RSS parse error for {source_name}: {e}")
    
    return articles


@app.route('/api/vn-news/<ticker>')
def get_vn_news(ticker):
    """
    Scrape Vietnamese stock news from CafeF, VnEconomy, DauTu, NDH RSS feeds.
    Filters news relevant to the given ticker/company.
    """
    ticker = ticker.upper()
    company_name = VN_MAP.get(ticker, ticker)
    
    all_articles = []
    
    for source in VN_NEWS_SOURCES:
        try:
            articles = parse_rss_manually(source['rss'], source['name'], company_name, ticker)
            all_articles.extend(articles)
            print(f"  📰 {source['name']}: {len(articles)} articles for {ticker}")
        except Exception as e:
            print(f"  ⚠ {source['name']} error: {e}")
    
    # Also try Google News RSS in Vietnamese
    try:
        query = f"{company_name} cổ phiếu {ticker}"
        gn_rss = f"https://news.google.com/rss/search?q={requests.utils.requote_uri(query)}&hl=vi-VN&gl=VN&ceid=VN:vi"
        gn_articles = parse_rss_manually(gn_rss, 'Google News VN', company_name, ticker)
        all_articles.extend(gn_articles[:8])
        print(f"  📰 Google News VN: {len(gn_articles)} articles")
    except Exception as e:
        print(f"  ⚠ Google News VN error: {e}")
    
    # Deduplicate by title similarity
    seen_titles = set()
    unique = []
    for art in all_articles:
        key = art['title'][:60].lower()
        if key not in seen_titles:
            seen_titles.add(key)
            unique.append(art)
    
    # Sort by date (newest first)
    unique.sort(key=lambda x: x.get('publishedAt', ''), reverse=True)
    
    print(f"✅ Total VN news for {ticker}: {len(unique)} unique articles")
    return jsonify({
        'ticker': ticker,
        'company': company_name,
        'articles': unique[:20],
        'count': len(unique),
    })


# ╔══════════════════════════════════════════════════════════╗
# ║  ENDPOINT 4: VN Market Summary (VN-Index, HNX-Index)    ║
# ╚══════════════════════════════════════════════════════════╝

@app.route('/api/vn-market-summary')
def get_vn_market_summary():
    """Get VN-Index and HNX-Index summary from SSI or Yahoo Finance."""
    
    # Try SSI MarketIndex
    try:
        url = f"{SSI_DATA_BASE}/MarketIndex"
        resp = requests.get(url, headers=SSI_HEADERS, timeout=8)
        data = resp.json()
        items = data.get('data', [])
        if isinstance(items, list) and items:
            indices = {}
            for idx in items:
                code = idx.get('indexCode', idx.get('code', ''))
                if code in ('VNINDEX', 'HNX-INDEX', 'HNXINDEX', 'UPCOM'):
                    indices[code] = {
                        'value': float(idx.get('indexValue', idx.get('value', 0))),
                        'change': float(idx.get('change', 0)),
                        'changePct': float(idx.get('percentChange', idx.get('changePercent', 0))),
                        'source': 'SSI',
                    }
            if indices:
                return jsonify({'indices': indices, 'timestamp': int(time.time())})
    except Exception as e:
        print(f"SSI market summary failed: {e}")
    
    # Fallback: Yahoo Finance for VN-Index
    try:
        results = {}
        for sym, name in [('^VNINDEX', 'VNINDEX'), ('^HNXINDEX', 'HNXINDEX')]:
            try:
                resp = yahoo_get(f'/v8/finance/chart/{sym}?interval=1d&range=2d')
                d = resp.json()
                meta = d.get('chart', {}).get('result', [{}])[0].get('meta', {})
                price = meta.get('regularMarketPrice', 0)
                prev  = meta.get('previousClose', price)
                chg   = price - prev
                results[name] = {
                    'value': round(price, 2),
                    'change': round(chg, 2),
                    'changePct': round(chg / prev * 100, 2) if prev else 0,
                    'source': 'Yahoo',
                }
            except:
                pass
        return jsonify({'indices': results, 'timestamp': int(time.time())})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ╔══════════════════════════════════════════════════════════╗
# ║  ENDPOINT 5: Quote / Real-time Price                     ║
# ╚══════════════════════════════════════════════════════════╝

@app.route('/api/quote/<ticker>')
def get_quote(ticker):
    """Get latest quote. Supports VN (.VN) and US stocks."""
    exchange = request.args.get('exchange', 'AUTO')
    yahoo_ticker = f"{ticker}.VN" if exchange in ('HOSE', 'HNX', 'UPCOM') else ticker
    
    try:
        resp = yahoo_get(f'/v8/finance/chart/{yahoo_ticker}?interval=1m&range=1d&includePrePost=false')
        data = resp.json()
        result = data.get('chart', {}).get('result', [{}])[0]
        meta = result.get('meta', {})
        timestamps = result.get('timestamp', [])
        quote = result.get('indicators', {}).get('quote', [{}])[0]
        
        candles = []
        for i in range(len(timestamps)):
            if quote.get('open', [None])[i] is None:
                continue
            candles.append({
                'time': timestamps[i],
                'open':   round(quote['open'][i], 2),
                'high':   round(quote['high'][i], 2),
                'low':    round(quote['low'][i], 2),
                'close':  round(quote['close'][i], 2),
                'volume': int(quote.get('volume', [0])[i] or 0),
            })
        
        return jsonify({
            'ticker': ticker,
            'exchange': exchange,
            'price': meta.get('regularMarketPrice', 0),
            'previousClose': meta.get('previousClose', 0),
            'currency': meta.get('currency', 'VND' if exchange in ('HOSE','HNX','UPCOM') else 'USD'),
            'marketState': meta.get('marketState', 'CLOSED'),
            'candles': candles,
            'timestamp': int(time.time()),
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/intraday/<ticker>')
def get_intraday(ticker):
    """Get intraday 1-minute candles. Tries SSI first, then Yahoo."""
    exchange = request.args.get('exchange', 'AUTO')
    is_vn = exchange in ('HOSE', 'HNX', 'UPCOM')
    
    if is_vn:
        # Use dedicated SSI intraday endpoint (redirect)
        return get_ssi_intraday(ticker)
    
    yahoo_ticker = ticker
    try:
        resp = yahoo_get(f'/v8/finance/chart/{yahoo_ticker}?interval=1m&range=1d&includePrePost=false')
        data = resp.json()
        result = data.get('chart', {}).get('result', [{}])[0]
        timestamps = result.get('timestamp', [])
        quote = result.get('indicators', {}).get('quote', [{}])[0]
        candles = []
        for i in range(len(timestamps)):
            o = quote.get('open', [None])[i]
            if o is None:
                continue
            candles.append({
                'time':   timestamps[i],
                'open':   round(o, 2),
                'high':   round(quote['high'][i], 2),
                'low':    round(quote['low'][i], 2),
                'close':  round(quote['close'][i], 2),
                'volume': int(quote.get('volume', [0])[i] or 0),
            })
        return jsonify({'ticker': ticker, 'candles': candles})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ╔══════════════════════════════════════════════════════════╗
# ║  BOT SYSTEM: Watchlist + Scout + AI Scorer                ║
# ╚══════════════════════════════════════════════════════════╝

# ── In-memory stores ──
WATCHLIST_CONFIG = {
    'tickers': ['FPT', 'VCB', 'MBB', 'HPG', 'VNM'],
    'interval_minutes': 10,
}

WATCHLIST_STORE = {}   # {ticker: [{title, source, time, impactScore, isHighlight}]}
SCOUT_STORE = {
    'macro_news': [],
    'hot_sectors': [],
    'recommendations': [],
    'last_updated': None,
}

# ── Bot status tracker ──
BOT_STATUS = {
    'watchlist': {'running': False, 'last_scan': None, 'scan_count': 0, 'articles_total': 0, 'status': 'Đang khởi động...'},
    'scout':     {'running': False, 'last_scan': None, 'scan_count': 0, 'articles_total': 0, 'status': 'Đang khởi động...'},
    'scorer':    {'running': True,  'last_scan': None, 'scan_count': 0, 'articles_total': 0, 'status': 'Sẵn sàng (on-demand)'},
}

# ── Sector → representative stocks ──
SECTOR_STOCKS = {
    'Ngân hàng':        [{'ticker': 'VCB', 'name': 'Vietcombank'}, {'ticker': 'BID', 'name': 'BIDV'}, {'ticker': 'CTG', 'name': 'VietinBank'}, {'ticker': 'TCB', 'name': 'Techcombank'}, {'ticker': 'MBB', 'name': 'MB Bank'}, {'ticker': 'ACB', 'name': 'ACB'}, {'ticker': 'VPB', 'name': 'VPBank'}, {'ticker': 'STB', 'name': 'Sacombank'}],
    'Bất động sản':     [{'ticker': 'VIC', 'name': 'Vingroup'}, {'ticker': 'VHM', 'name': 'Vinhomes'}, {'ticker': 'NVL', 'name': 'Novaland'}, {'ticker': 'KDH', 'name': 'Khang Điền'}, {'ticker': 'DXG', 'name': 'Đất Xanh'}],
    'Công nghệ':        [{'ticker': 'FPT', 'name': 'FPT'}, {'ticker': 'CMG', 'name': 'CMC Group'}, {'ticker': 'ELC', 'name': 'Elcom'}],
    'Chứng khoán':      [{'ticker': 'SSI', 'name': 'SSI'}, {'ticker': 'VND', 'name': 'VNDirect'}, {'ticker': 'HCM', 'name': 'HSC'}, {'ticker': 'VCI', 'name': 'Vietcap'}],
    'Năng lượng':       [{'ticker': 'GAS', 'name': 'PV Gas'}, {'ticker': 'PLX', 'name': 'Petrolimex'}, {'ticker': 'POW', 'name': 'PV Power'}, {'ticker': 'PPC', 'name': 'Nhiệt điện Phả Lại'}],
    'Tiêu dùng':        [{'ticker': 'VNM', 'name': 'Vinamilk'}, {'ticker': 'SAB', 'name': 'Sabeco'}, {'ticker': 'MSN', 'name': 'Masan'}, {'ticker': 'MWG', 'name': 'Thế Giới Di Động'}, {'ticker': 'PNJ', 'name': 'PNJ'}],
    'Thép & Vật liệu':  [{'ticker': 'HPG', 'name': 'Hòa Phát'}, {'ticker': 'HSG', 'name': 'Hoa Sen'}, {'ticker': 'NKG', 'name': 'Nam Kim'}, {'ticker': 'HT1', 'name': 'Xi măng Hà Tiên'}],
    'Dệt may':          [{'ticker': 'TCM', 'name': 'Dệt may Thành Công'}, {'ticker': 'STK', 'name': 'Sợi Thế Kỷ'}, {'ticker': 'TNG', 'name': 'TNG'}],
}

# ── VN company name map (used for news filtering) ──
VN_MAP_EXTENDED = {
    'FPT': 'FPT', 'VCB': 'Vietcombank', 'MBB': 'MB Bank', 'HPG': 'Hòa Phát',
    'VNM': 'Vinamilk', 'VIC': 'Vingroup', 'VHM': 'Vinhomes', 'TCB': 'Techcombank',
    'BID': 'BIDV', 'CTG': 'VietinBank', 'SSI': 'SSI', 'VND': 'VNDirect',
    'VPB': 'VPBank', 'ACB': 'ACB', 'STB': 'Sacombank', 'GAS': 'PV Gas',
    'SAB': 'Sabeco', 'MSN': 'Masan', 'PLX': 'Petrolimex', 'NVL': 'Novaland',
    'PNJ': 'PNJ', 'DGC': 'Đức Giang', 'HSG': 'Hoa Sen', 'REE': 'REE',
}

MACRO_RSS_SOURCES = [
    {'name': 'CafeF Vĩ mô', 'rss': 'https://cafef.vn/vi-mo-dau-tu.rss'},
    {'name': 'CafeF Thị trường', 'rss': 'https://cafef.vn/thi-truong-chung-khoan.rss'},
    {'name': 'VnEconomy', 'rss': 'https://vneconomy.vn/kinh-te-vi-mo.rss'},
    {'name': 'NDH', 'rss': 'https://ndh.vn/thi-truong.rss'},
]


# ── Background Worker: Watchlist Bot ──
def watchlist_worker():
    """Runs every 10 minutes, scraping news for tracked tickers."""
    while True:
        try:
            BOT_STATUS['watchlist']['running'] = True
            BOT_STATUS['watchlist']['status'] = 'Đang cào dữ liệu...'
            tickers = WATCHLIST_CONFIG.get('tickers', [])
            print(f"\n🤖 [Watchlist Bot] Scanning {len(tickers)} tickers...")
            for ticker in tickers:
                try:
                    company = VN_MAP_EXTENDED.get(ticker, ticker)
                    articles = []
                    for source in VN_NEWS_SOURCES[:4]:
                        arts = parse_rss_manually(source['rss'], source['name'], company, ticker)
                        articles.extend(arts)
                    # Google News
                    try:
                        query = f"{company} cổ phiếu {ticker}"
                        gn_rss = f"https://news.google.com/rss/search?q={requests.utils.requote_uri(query)}&hl=vi-VN&gl=VN&ceid=VN:vi"
                        gn_arts = parse_rss_manually(gn_rss, 'Google News VN', company, ticker)
                        articles.extend(gn_arts[:5])
                    except:
                        pass

                    # Score and store
                    scored = score_sentiment(articles)
                    stored_articles = []
                    seen = set()
                    for art in articles:
                        key = art['title'][:50].lower()
                        if key in seen:
                            continue
                        seen.add(key)
                        text_lower = art['title'].lower()
                        from ai_scorer import HIGH_IMPACT_KEYWORDS
                        is_highlight = any(kw in text_lower for kw in HIGH_IMPACT_KEYWORDS)
                        stored_articles.append({
                            'title': art['title'],
                            'source': art.get('source', ''),
                            'time': art.get('publishedAt', ''),
                            'url': art.get('url', '#'),
                            'isHighlight': is_highlight,
                        })

                    WATCHLIST_STORE[ticker] = {
                        'articles': stored_articles[:15],
                        'sentiment': scored,
                        'last_updated': datetime.now().isoformat(),
                    }
                    print(f"  📰 {ticker}: {len(stored_articles)} articles, sentiment={scored['score']}/10")
                except Exception as e:
                    print(f"  ⚠ {ticker} failed: {e}")

            BOT_STATUS['watchlist']['last_scan'] = datetime.now().isoformat()
            BOT_STATUS['watchlist']['scan_count'] += 1
            BOT_STATUS['watchlist']['articles_total'] = sum(len(v.get('articles', [])) for v in WATCHLIST_STORE.values())
            BOT_STATUS['watchlist']['status'] = f'Hoạt động – {len(tickers)} mã'
            BOT_STATUS['watchlist']['running'] = False
            print(f"✅ [Watchlist Bot] Done. Next scan in {WATCHLIST_CONFIG['interval_minutes']}min\n")
        except Exception as e:
            BOT_STATUS['watchlist']['status'] = f'Lỗi: {str(e)[:50]}'
            BOT_STATUS['watchlist']['running'] = False
            print(f"❌ [Watchlist Bot] Error: {e}")

        time.sleep(WATCHLIST_CONFIG['interval_minutes'] * 60)


# ── Background Worker: Scout Bot ──
def scout_worker():
    """Runs every 30 minutes, scanning macro news + finding top movers."""
    while True:
        try:
            BOT_STATUS['scout']['running'] = True
            BOT_STATUS['scout']['status'] = 'Đang quét thị trường...'
            print(f"\n🔭 [Scout Bot] Scanning macro news + top movers...")

            # 1. Scrape macro news
            macro_articles = []
            for source in MACRO_RSS_SOURCES:
                try:
                    resp = requests.get(source['rss'], timeout=8,
                                        headers={'User-Agent': 'Mozilla/5.0 (compatible; RSS reader)'})
                    if not resp.ok:
                        continue
                    xml = resp.text
                    items = re.findall(r'<item>(.*?)</item>', xml, re.DOTALL)
                    for item_xml in items[:10]:
                        title_m = re.search(r'<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?</title>', item_xml, re.DOTALL)
                        link_m = re.search(r'<link>([^<]+)</link>', item_xml)
                        if title_m:
                            title = re.sub(r'<[^>]+>', '', title_m.group(1)).strip()
                            link = link_m.group(1).strip() if link_m else '#'
                            macro_articles.append({
                                'title': title,
                                'source': source['name'],
                                'url': link,
                            })
                except:
                    pass

            # Deduplicate
            seen = set()
            unique_macro = []
            for art in macro_articles:
                key = art['title'][:50].lower()
                if key not in seen:
                    seen.add(key)
                    unique_macro.append(art)

            # 2. Detect hot sectors
            hot_sectors = detect_sectors(unique_macro)

            # 3. Get top movers from VN market (via Yahoo Finance)
            recommendations = []
            try:
                top_tickers = ['FPT', 'VCB', 'HPG', 'MWG', 'VIC', 'TCB', 'MBB', 'ACB', 'VPB', 'SSI',
                               'VNM', 'GAS', 'SAB', 'MSN', 'PLX', 'NVL', 'STB', 'BID', 'CTG', 'PNJ']
                movers = []
                for t in top_tickers:
                    try:
                        resp = yahoo_get(f'/v8/finance/chart/{t}.VN?range=5d&interval=1d')
                        data = resp.json()
                        result = data.get('chart', {}).get('result', [{}])[0]
                        meta = result.get('meta', {})
                        price = meta.get('regularMarketPrice', 0)
                        prev = meta.get('previousClose', price)
                        if prev and prev > 0:
                            chg_pct = (price - prev) / prev * 100
                            movers.append({'ticker': t, 'price': price, 'change_pct': round(chg_pct, 2)})
                    except:
                        pass
                    time.sleep(0.3)  # Rate limit

                # Sort by absolute change
                movers.sort(key=lambda x: abs(x.get('change_pct', 0)), reverse=True)

                # Top 3 recommendations
                for m in movers[:3]:
                    action = 'MUA' if m['change_pct'] > 0 else 'BÁN'
                    company = VN_MAP_EXTENDED.get(m['ticker'], m['ticker'])
                    reason = f"{company} ({m['ticker']}) biến động {m['change_pct']:+.2f}% "
                    if m['change_pct'] > 2:
                        reason += '– Momentum tăng mạnh, dòng tiền tích cực'
                    elif m['change_pct'] > 0:
                        reason += '– Xu hướng tăng nhẹ, có thể tích lũy'
                    elif m['change_pct'] < -2:
                        reason += '– Giảm mạnh, cân nhắc chốt lỗ hoặc chờ hồi'
                    else:
                        reason += '– Giảm nhẹ, theo dõi thêm'
                    recommendations.append({
                        'ticker': m['ticker'],
                        'company': company,
                        'action': action,
                        'change_pct': m['change_pct'],
                        'price': m['price'],
                        'reason': reason,
                    })
            except Exception as e:
                print(f"  ⚠ Top movers scan failed: {e}")

            SCOUT_STORE['macro_news'] = unique_macro[:20]
            SCOUT_STORE['hot_sectors'] = hot_sectors
            SCOUT_STORE['recommendations'] = recommendations
            SCOUT_STORE['last_updated'] = datetime.now().isoformat()

            sector_str = ', '.join([s['sector'] for s in hot_sectors[:3]]) if hot_sectors else 'N/A'
            print(f"  📊 Macro: {len(unique_macro)} articles, Hot sectors: {sector_str}")
            print(f"  🎯 Recommendations: {[r['ticker'] for r in recommendations]}")
            BOT_STATUS['scout']['last_scan'] = datetime.now().isoformat()
            BOT_STATUS['scout']['scan_count'] += 1
            BOT_STATUS['scout']['articles_total'] = len(unique_macro)
            BOT_STATUS['scout']['status'] = f'Hoạt động – {len(unique_macro)} tin vĩ mô'
            BOT_STATUS['scout']['running'] = False
            print(f"✅ [Scout Bot] Done. Next scan in 30min\n")

        except Exception as e:
            BOT_STATUS['scout']['status'] = f'Lỗi: {str(e)[:50]}'
            BOT_STATUS['scout']['running'] = False
            print(f"❌ [Scout Bot] Error: {e}")

        time.sleep(30 * 60)  # 30 minutes


# ── Bot API Endpoints ──

@app.route('/api/bot/watchlist', methods=['GET'])
def bot_watchlist():
    """Get watchlist news store."""
    return jsonify({
        'config': WATCHLIST_CONFIG,
        'data': WATCHLIST_STORE,
        'timestamp': datetime.now().isoformat(),
    })

@app.route('/api/bot/watchlist/config', methods=['GET', 'POST'])
def bot_watchlist_config():
    """Get or update watchlist tickers."""
    if request.method == 'POST':
        data = request.get_json(force=True)
        tickers = data.get('tickers', [])
        if isinstance(tickers, list) and 1 <= len(tickers) <= 10:
            WATCHLIST_CONFIG['tickers'] = [t.upper() for t in tickers]
            return jsonify({'ok': True, 'tickers': WATCHLIST_CONFIG['tickers']})
        return jsonify({'error': 'Cần 1-10 mã cổ phiếu'}), 400
    return jsonify(WATCHLIST_CONFIG)

@app.route('/api/bot/scout')
def bot_scout():
    """Get scout bot results: macro news + hot sectors + recommendations."""
    return jsonify(SCOUT_STORE)

@app.route('/api/bot/score/<ticker>')
def bot_score(ticker):
    """Get full AI score for a single ticker."""
    ticker = ticker.upper()
    company = VN_MAP_EXTENDED.get(ticker, ticker)

    # Fetch news
    articles = []
    for source in VN_NEWS_SOURCES[:4]:
        try:
            arts = parse_rss_manually(source['rss'], source['name'], company, ticker)
            articles.extend(arts)
        except:
            pass

    # Fetch chart data (last 3 months)
    candles = []
    try:
        yahoo_ticker = f"{ticker}.VN"
        resp = yahoo_get(f'/v8/finance/chart/{yahoo_ticker}?range=3mo&interval=1d')
        data = resp.json()
        result = data.get('chart', {}).get('result', [{}])[0]
        timestamps = result.get('timestamp', [])
        quote = result.get('indicators', {}).get('quote', [{}])[0]
        for i in range(len(timestamps)):
            try:
                o, h, l, c = quote['open'][i], quote['high'][i], quote['low'][i], quote['close'][i]
                if o is None or h is None or l is None or c is None:
                    continue
                candles.append({
                    'open': float(o), 'high': float(h), 'low': float(l), 'close': float(c),
                    'volume': int(quote.get('volume', [0])[i] or 0),
                })
            except:
                continue
    except Exception as e:
        print(f"Chart fetch for scoring failed: {e}")

    # Compute full score
    score = compute_full_score(articles, candles)
    score['ticker'] = ticker
    score['company'] = company
    score['article_count'] = len(articles)
    score['candle_count'] = len(candles)

    return jsonify(score)

@app.route('/api/bot/dashboard')
def bot_dashboard():
    """Combined dashboard: watchlist + scout + scores for all tracked tickers."""
    result = {
        'watchlist': {
            'config': WATCHLIST_CONFIG,
            'data': WATCHLIST_STORE,
        },
        'scout': SCOUT_STORE,
        'timestamp': datetime.now().isoformat(),
    }
    return jsonify(result)

@app.route('/api/bot/status')
def bot_status():
    """Get status of all 3 bots."""
    return jsonify(BOT_STATUS)

@app.route('/api/bot/sector/<sector_name>')
def bot_sector_stocks(sector_name):
    """Get stocks for a sector with real-time prices."""
    # URL decode
    import urllib.parse
    sector_name = urllib.parse.unquote(sector_name)

    stocks = SECTOR_STOCKS.get(sector_name, [])
    if not stocks:
        # Try partial match
        for k, v in SECTOR_STOCKS.items():
            if sector_name.lower() in k.lower() or k.lower() in sector_name.lower():
                stocks = v
                sector_name = k
                break

    if not stocks:
        return jsonify({'error': f'Sector "{sector_name}" không tồn tại', 'available': list(SECTOR_STOCKS.keys())}), 404

    # Fetch live prices for sector stocks
    enriched = []
    for s in stocks:
        ticker = s['ticker']
        entry = {'ticker': ticker, 'name': s['name'], 'price': 0, 'change_pct': 0}
        try:
            resp = yahoo_get(f'/v8/finance/chart/{ticker}.VN?range=2d&interval=1d')
            data = resp.json()
            meta = data.get('chart', {}).get('result', [{}])[0].get('meta', {})
            price = meta.get('regularMarketPrice', 0)
            prev = meta.get('previousClose', price)
            if prev and prev > 0:
                entry['price'] = round(price, 0)
                entry['change_pct'] = round((price - prev) / prev * 100, 2)
        except:
            pass
        enriched.append(entry)
        time.sleep(0.2)

    # Sort by change descending
    enriched.sort(key=lambda x: x['change_pct'], reverse=True)

    # Recommend top picks
    for e in enriched:
        if e['change_pct'] > 1:
            e['signal'] = 'MUA'
            e['signal_emoji'] = '🟢'
        elif e['change_pct'] < -1:
            e['signal'] = 'BÁN'
            e['signal_emoji'] = '🔴'
        else:
            e['signal'] = 'GIỮ'
            e['signal_emoji'] = '🟡'

    return jsonify({
        'sector': sector_name,
        'stocks': enriched,
        'count': len(enriched),
    })

# ── Top 5 Daily Movers cache ──
TOP_MOVERS_CACHE = {'data': None, 'timestamp': None}

@app.route('/api/bot/top-movers')
def bot_top_movers():
    """Get top 5 best-performing VN stocks today."""
    # Cache for 5 minutes
    if TOP_MOVERS_CACHE['data'] and TOP_MOVERS_CACHE['timestamp']:
        elapsed = (datetime.now() - datetime.fromisoformat(TOP_MOVERS_CACHE['timestamp'])).total_seconds()
        if elapsed < 300:
            return jsonify(TOP_MOVERS_CACHE['data'])

    pool = [
        'FPT', 'VCB', 'HPG', 'MWG', 'VIC', 'TCB', 'MBB', 'ACB', 'VPB', 'SSI',
        'VNM', 'GAS', 'SAB', 'MSN', 'PLX', 'NVL', 'STB', 'BID', 'CTG', 'PNJ',
        'VHM', 'VND', 'HCM', 'DGC', 'HSG', 'REE', 'POW', 'KDH', 'DXG', 'GVR',
    ]

    movers = []
    for t in pool:
        try:
            resp = yahoo_get(f'/v8/finance/chart/{t}.VN?range=5d&interval=1d')
            data = resp.json()
            result = data.get('chart', {}).get('result', [{}])[0]
            meta = result.get('meta', {})
            quote = result.get('indicators', {}).get('quote', [{}])[0]

            price = meta.get('regularMarketPrice', 0)
            prev = meta.get('previousClose', price)
            volumes = quote.get('volume', [])
            vol = volumes[-1] if volumes and volumes[-1] else 0

            if prev and prev > 0 and price:
                chg_pct = round((price - prev) / prev * 100, 2)
                company = VN_MAP_EXTENDED.get(t, t)
                movers.append({
                    'ticker': t,
                    'company': company,
                    'price': round(float(price), 0),
                    'change_pct': chg_pct,
                    'volume': int(vol),
                })
        except:
            pass
        time.sleep(0.2)

    # Sort descending by change %
    movers.sort(key=lambda x: x['change_pct'], reverse=True)

    top5 = movers[:5]
    for i, m in enumerate(top5):
        m['rank'] = i + 1
        pct = m['change_pct']
        if pct > 3:
            m['label'] = 'Tăng mạnh 🚀'
            m['label_color'] = '#00d4aa'
        elif pct > 1:
            m['label'] = 'Tăng tốt 📈'
            m['label_color'] = '#00d4aa'
        elif pct > 0:
            m['label'] = 'Tăng nhẹ 🟢'
            m['label_color'] = '#7dcea0'
        elif pct == 0:
            m['label'] = 'Đứng giá ⚪'
            m['label_color'] = '#ffd700'
        else:
            m['label'] = 'Giảm 🔻'
            m['label_color'] = '#ff4757'

    result = {
        'top5': top5,
        'total_scanned': len(movers),
        'date': datetime.now().strftime('%d/%m/%Y'),
        'time': datetime.now().strftime('%H:%M'),
        'market_overview': {
            'gainers': len([m for m in movers if m['change_pct'] > 0]),
            'losers': len([m for m in movers if m['change_pct'] < 0]),
            'unchanged': len([m for m in movers if m['change_pct'] == 0]),
        }
    }

    TOP_MOVERS_CACHE['data'] = result
    TOP_MOVERS_CACHE['timestamp'] = datetime.now().isoformat()

    return jsonify(result)


@app.route('/api/health')
def health():
    deps = {}
    try:
        import feedparser
        deps['feedparser'] = True
    except:
        deps['feedparser'] = False
    try:
        import vnstock
        deps['vnstock'] = True
    except:
        deps['vnstock'] = False
    
    return jsonify({
        'status': 'running',
        'dependencies': deps,
        'time': datetime.now().isoformat(),
        'endpoints': [
            '/api/ssi-chart/<ticker>   – SSI daily OHLCV',
            '/api/ssi-intraday/<ticker> – SSI real-time intraday',
            '/api/vn-news/<ticker>     – VN news scraper',
            '/api/vn-market-summary    – VN-Index, HNX-Index',
            '/api/quote/<ticker>       – Yahoo Finance quote',
        ]
    })


# ── Start background bot threads (works with both gunicorn and direct run) ──
def start_bot_threads():
    print("🤖 Starting Watchlist Bot (every 10 min)...")
    t1 = threading.Thread(target=watchlist_worker, daemon=True)
    t1.start()
    print("🔭 Starting Scout Bot (every 30 min)...")
    t2 = threading.Thread(target=scout_worker, daemon=True)
    t2.start()

# Start bots at module import (works with gunicorn --preload)
start_bot_threads()


if __name__ == '__main__':
    print("🚀 StockSense AI Backend – SSI Edition + AI Bots")
    print("   http://localhost:5000")
    print()
    port = int(os.environ.get('PORT', 5000))
    app.run(debug=True, port=port, threaded=True, use_reloader=False)

