# 📊 StockSense AI – Project Rules & Skills

> Tài liệu tổng hợp kiến trúc, quy tắc và kỹ thuật đã xây dựng trong dự án **StockSense AI**.
> Dùng để tham khảo lại khi cần cập nhật hoặc mở rộng.

---

## 🏗️ Kiến trúc tổng quan

```
stock-predictor/
├── server.py           ← Flask backend (Python) – cổng 5000
├── index.html          ← Giao diện chính
├── css/styles.css      ← Toàn bộ CSS
└── js/
    ├── app.js          ← Logic chính: chart, phân tích, UI
    ├── realtimeData.js ← Real-time polling (SSI + Yahoo Finance)
    ├── vnNewsScraper.js← Bot cào tin tức VN
    ├── predictor.js    ← Thuật toán dự đoán
    ├── sentiment.js    ← Phân tích cảm xúc tin tức
    └── stockData.js    ← Danh sách mã cổ phiếu VN
```

---

## 🚀 Khởi động dự án

```bash
# Cách 1: Dùng file .bat (nhanh nhất)
# Double-click file:
start_server.bat        # Khởi động Flask + mở trình duyệt
stop_server.bat         # Tắt server

# Cách 2: Terminal
cd stock-predictor
python server.py
# Truy cập: http://localhost:5000
```

> ⚠️ **QUAN TRỌNG**: Không dùng `http-server` hay port 8080 nữa!
> Flask bây giờ serve cả frontend lẫn backend từ port **5000**.

---

## 🔌 API Endpoints (Backend)

| Endpoint | Mô tả |
|----------|-------|
| `GET /` | Serve `index.html` |
| `GET /api/ssi-chart/<ticker>?range=6mo&interval=1d` | Dữ liệu nến OHLCV hàng ngày |
| `GET /api/ssi-intraday/<ticker>` | Dữ liệu nến 1 phút realtime |
| `GET /api/vn-news/<ticker>` | Tin tức VN (RSS cào tự động) |
| `GET /api/vn-market-summary` | Tóm tắt thị trường VN-Index |
| `GET /api/health` | Kiểm tra trạng thái server |
| `GET /api/quote/<ticker>?exchange=HOSE` | Giá hiện tại (cho realtime poll) |

---

## 📈 Chart – Quy tắc quan trọng

### Timeframe selector
```
Intraday: 1p | 5p | 15p | 30p | 1G
Daily:    1T | 3T | 6T  | 1N  | 2N | 5N
```

### Tham số `?range=` và `?interval=`

| Nút | range | interval | Dữ liệu |
|-----|-------|----------|---------|
| 1p  | 1d    | 1m       | Hôm nay, nến 1 phút |
| 5p  | 5d    | 5m       | 5 ngày, nến 5 phút |
| 15p | 5d    | 15m      | 5 ngày, nến 15 phút |
| 30p | 1mo   | 30m      | 1 tháng, nến 30 phút |
| 1G  | 1mo   | 60m      | 1 tháng, nến 1 giờ |
| 1T  | 1mo   | 1d       | 1 tháng, nến ngày |
| 6T  | 6mo   | 1d       | 6 tháng (mặc định) |
| 1N  | 1y    | 1d       | 1 năm |
| 5N  | 5y    | 1d       | 5 năm |

### Scale modes
- **Log** 🟣 – Thang logarit: Khoảng cách theo % thay đổi (không phải giá tuyệt đối). Dùng khi xem dài hạn 1N+.
- **Auto** 🟢 – Tự động co dãn trục giá theo vùng đang xem. Hữu ích khi zoom.

---

## 📡 Real-time Chart – Cơ chế

### Khi market mở (9:00–14:30 ICT):
1. **SSI Intraday polling** mỗi 15 giây → cập nhật nến
2. **Live price poll** mỗi 30 giây (`/api/quote`) → cập nhật nến ngày hôm nay

### Khi market đóng:
- Chỉ **Live price poll** mỗi 30 giây → giá after-hours

### Timestamp convention:
- **Daily** (1d): `time` là string `'YYYY-MM-DD'`
- **Intraday** (1m/5m…): `time` là Unix timestamp (số nguyên, giây)

---

## 🤖 Bot cào tin tức VN

Nguồn RSS được cào tự động mỗi 5 phút:
- CafeF: `cafef.vn/thi-truong-chung-khoan.rss`
- VnEconomy: `vneconomy.vn/chung-khoan.rss`
- Báo Đầu Tư: `baodautu.vn/chung-khoan.rss`
- Google News VN: RSS theo tên công ty

Bot lọc bài viết theo tên công ty của mã cổ phiếu (mapping trong `vnNewsScraper.js`).

---

## 🧠 Data flow (Luồng dữ liệu)

```
Frontend (app.js)
    ↓ fetch /api/ssi-chart/FPT?range=6mo&interval=1d
Flask (server.py)
    ├── Strategy 1: SSI DailyOhlc API  (nếu được)
    └── Strategy 2: Yahoo Finance .VN  (fallback)
        └── yahoo_get() dùng Googlebot User-Agent (bypass anti-scraping)
```

> ⚠️ **Không bao giờ** gọi Yahoo Finance trực tiếp từ frontend!
> CORS sẽ block. Luôn dùng qua `/api/ssi-chart/` backend.

---

## 🎨 Màu sắc nến VN (theo quy định HOSE)

| Màu | Ý nghĩa |
|-----|---------|
| 🟢 Xanh lá | Tăng (đóng > mở) |
| 🔴 Đỏ | Giảm (đóng < mở) |
| 🟡 Vàng | Đứng giá (TC – tham chiếu) |
| 🟣 Tím | Trần (ceiling +7% HOSE / +10% HNX) |
| 🔵 Xanh dương | Sàn (floor -7% HOSE) |

---

## 📰 Sentiment Analysis

Tin tức → VADER sentiment → Score (-1 đến +1) → Tín hiệu:
- **> 0.6**: MUA MẠNH 🚀
- **0.2 đến 0.6**: MUA ⬆️
- **-0.2 đến 0.2**: GIỮ ⏸️
- **-0.6 đến -0.2**: BÁN ⬇️
- **< -0.6**: BÁN MẠNH 🔻

---

## 🛠️ Quy tắc phát triển (Rules)

1. **Flask serve cả frontend và backend** từ cùng 1 port (5000) → Không CORS
2. **Không dùng Yahoo Finance từ frontend** → luôn qua backend proxy
3. **Không dùng vnstock library** (không ổn định) → dùng requests trực tiếp
4. **Yahoo Finance dùng Googlebot UA** để bypass anti-bot:
   ```python
   headers = {'User-Agent': 'Googlebot/2.1 (+http://www.google.com/bot.html)'}
   ```
5. **Intraday time = Unix timestamp** (số) / **Daily time = YYYY-MM-DD** (string)
6. **live poll mỗi 30 giây** từ `/api/quote` để cập nhật nến ngày hôm nay kể cả khi market đóng
7. **start_server.bat** chỉ start Flask (không cần http-server port 8080 nữa)

---

## 📦 Dependencies (Python)

```bash
pip install flask flask-cors requests feedparser
```

Không cần: `vnstock`, `selenium`, `playwright`, `yfinance`

---

## 🔍 Debug tips

```bash
# Test API từ terminal
python -c "
import sys; sys.path.insert(0, 'stock-predictor')
from server import app
with app.test_client() as c:
    r = c.get('/api/ssi-chart/FPT')
    print(r.json['source'], len(r.json['candles']), 'candles')
"

# Xem log khi server chạy
python server.py
# Console sẽ in: ✅ SSI DailyOhlc: 124 candles for FPT (6mo)
# Hoặc:         ✅ Yahoo Finance 6mo: 124 candles for FPT
```
