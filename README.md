# 📈 StockSense AI – Dự Đoán Cổ Phiếu Bằng Tin Tức

Ứng dụng web phân tích cổ phiếu Việt Nam theo thời gian thực, sử dụng AI để chấm điểm sentiment từ tin tức và kỹ thuật.

![Python](https://img.shields.io/badge/Python-3.11-blue?logo=python)
![Flask](https://img.shields.io/badge/Flask-3.1-green?logo=flask)
![License](https://img.shields.io/badge/License-MIT-yellow)

## ✨ Tính năng chính

- **📊 Biểu đồ Real-time** – Nến 1p/5p/15p/30p/1G/1D/1W/1T đến 5N, hỗ trợ Log/Auto scale
- **🤖 AI Bot System** – 3 bot tự động:
  - **Watchlist Bot** – Cào tin tức RSS cho danh sách cổ phiếu theo dõi (mỗi 10 phút)
  - **Scout Bot** – Quét tin vĩ mô, phát hiện ngành hot (mỗi 30 phút)
  - **AI Scoring Engine** – Chấm điểm Sentiment + Technical + Momentum (1-10)
- **🏆 Top 5 Daily** – Tổng kết 5 cổ phiếu hoạt động tốt nhất trong ngày
- **📰 Tin tức VN** – Cào tin từ CafeF, VnEconomy, NDH, Google News
- **📈 Chỉ báo kỹ thuật** – SMA, EMA, RSI, MACD, Bollinger Bands, VWAP
- **🔍 Phân tích ngành** – Bấm vào badge ngành để xem cổ phiếu gợi ý

## 🛠️ Công nghệ

| Layer | Stack |
|-------|-------|
| **Backend** | Python, Flask, Gunicorn |
| **Frontend** | HTML5, CSS3, JavaScript (ES Modules) |
| **Chart** | Lightweight Charts (TradingView) |
| **Data** | Yahoo Finance API, SSI API, RSS Feeds |
| **Deploy** | Render (Free Tier) |

## 🚀 Cài đặt local

```bash
# Clone repo
git clone https://github.com/minhquanngo087-oss/AI-predictive-stock.git
cd AI-predictive-stock

# Cài thư viện
pip install -r requirements.txt

# Chạy server
python server.py
```

Mở trình duyệt: **http://localhost:5000**

## 🌐 Deploy lên Render

1. Push code lên GitHub
2. Vào [render.com](https://render.com) → New Web Service
3. Connect repo → chọn Python runtime
4. Build: `pip install -r requirements.txt`
5. Start: `gunicorn server:app --bind 0.0.0.0:$PORT --workers 2 --threads 4 --timeout 120 --preload`

## 📁 Cấu trúc dự án

```
stock-predictor/
├── server.py           # Flask backend + API endpoints
├── ai_scorer.py        # AI Scoring Engine (Sentiment/Technical/Momentum)
├── index.html          # Trang chính
├── requirements.txt    # Python dependencies
├── render.yaml         # Render deploy config
├── css/
│   └── styles.css      # Toàn bộ CSS
├── js/
│   ├── app.js          # Main app + chart rendering
│   ├── botDashboard.js # Bot dashboard UI
│   ├── realtimeData.js # Real-time data fetching
│   └── ...
└── data/
    └── afinn.js        # Sentiment dictionary
```

## 📸 Screenshots

> _Thêm screenshot tại đây_

## ⚠️ Disclaimer

Dự đoán dựa trên phân tích cảm xúc tin tức và chỉ mang tính **tham khảo**.
Không nên coi đây là lời khuyên đầu tư. Luôn tìm hiểu kỹ trước khi quyết định đầu tư.

## 📄 License

MIT License © 2026
