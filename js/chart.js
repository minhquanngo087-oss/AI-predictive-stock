/**
 * Chart Visualization Module
 * Uses Chart.js for interactive sentiment charts
 */

let sentimentChart = null;
let distributionChart = null;

/**
 * Create the main sentiment trend chart
 * @param {object} sentimentData - Result from analyzeHeadlines()
 * @param {object} prediction - Result from generatePrediction()
 */
export function createSentimentChart(sentimentData, prediction) {
  const ctx = document.getElementById('sentimentChart');
  if (!ctx) return;

  // Destroy existing chart
  if (sentimentChart) {
    sentimentChart.destroy();
  }

  const scores = sentimentData.scores;
  const labels = scores.map((_, i) => `#${i + 1}`);

  // Color each point based on sentiment
  const pointColors = scores.map(s => {
    if (s > 0.05) return '#00d4aa';
    if (s < -0.05) return '#ff4757';
    return '#8892b0';
  });

  const pointBorderColors = scores.map(s => {
    if (s > 0.05) return '#00ffcc';
    if (s < -0.05) return '#ff6b81';
    return '#a8b2d1';
  });

  sentimentChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Điểm cảm xúc',
          data: scores,
          borderColor: '#4c9be8',
          backgroundColor: 'rgba(76, 155, 232, 0.1)',
          borderWidth: 2,
          pointBackgroundColor: pointColors,
          pointBorderColor: pointBorderColors,
          pointRadius: 6,
          pointHoverRadius: 9,
          fill: true,
          tension: 0.3,
        },
        {
          label: 'Trung bình',
          data: Array(scores.length).fill(sentimentData.mean),
          borderColor: '#ffd700',
          borderWidth: 2,
          borderDash: [8, 4],
          pointRadius: 0,
          fill: false,
        },
        {
          label: 'Ngưỡng tích cực',
          data: Array(scores.length).fill(0.05),
          borderColor: 'rgba(0, 212, 170, 0.3)',
          borderWidth: 1,
          borderDash: [4, 4],
          pointRadius: 0,
          fill: false,
        },
        {
          label: 'Ngưỡng tiêu cực',
          data: Array(scores.length).fill(-0.05),
          borderColor: 'rgba(255, 71, 87, 0.3)',
          borderWidth: 1,
          borderDash: [4, 4],
          pointRadius: 0,
          fill: false,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        intersect: false,
        mode: 'index',
      },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: {
            color: '#8892b0',
            font: { family: "'Inter', sans-serif", size: 11 },
            usePointStyle: true,
            padding: 15,
          }
        },
        tooltip: {
          backgroundColor: 'rgba(10, 14, 23, 0.95)',
          titleColor: '#ccd6f6',
          bodyColor: '#8892b0',
          borderColor: '#1e3a5f',
          borderWidth: 1,
          cornerRadius: 8,
          padding: 12,
          titleFont: { family: "'Inter', sans-serif", weight: 'bold' },
          bodyFont: { family: "'Inter', sans-serif" },
          callbacks: {
            label: function(context) {
              if (context.datasetIndex === 0) {
                const score = context.parsed.y;
                const sentiment = score > 0.05 ? '🟢 Tích cực' : score < -0.05 ? '🔴 Tiêu cực' : '⚪ Trung lập';
                return `${sentiment}: ${score.toFixed(4)}`;
              }
              return `${context.dataset.label}: ${context.parsed.y.toFixed(4)}`;
            }
          }
        }
      },
      scales: {
        x: {
          ticks: { color: '#8892b0', font: { family: "'Inter', sans-serif", size: 10 } },
          grid: { color: 'rgba(136, 146, 176, 0.08)', drawBorder: false },
          title: {
            display: true,
            text: 'Tin tức (mới nhất → cũ nhất)',
            color: '#8892b0',
            font: { family: "'Inter', sans-serif", size: 12 }
          }
        },
        y: {
          ticks: { color: '#8892b0', font: { family: "'Inter', sans-serif", size: 10 } },
          grid: { color: 'rgba(136, 146, 176, 0.08)', drawBorder: false },
          title: {
            display: true,
            text: 'Điểm cảm xúc',
            color: '#8892b0',
            font: { family: "'Inter', sans-serif", size: 12 }
          }
        }
      },
      animation: {
        duration: 1500,
        easing: 'easeInOutQuart',
      }
    }
  });
}

/**
 * Create the sentiment distribution donut chart
 * @param {object} sentimentData - Result from analyzeHeadlines()
 */
export function createDistributionChart(sentimentData) {
  const ctx = document.getElementById('distributionChart');
  if (!ctx) return;

  if (distributionChart) {
    distributionChart.destroy();
  }

  distributionChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Tích cực', 'Tiêu cực', 'Trung lập'],
      datasets: [{
        data: [sentimentData.positiveCount, sentimentData.negativeCount, sentimentData.neutralCount],
        backgroundColor: [
          'rgba(0, 212, 170, 0.8)',
          'rgba(255, 71, 87, 0.8)',
          'rgba(136, 146, 176, 0.5)',
        ],
        borderColor: [
          '#00d4aa',
          '#ff4757',
          '#8892b0',
        ],
        borderWidth: 2,
        hoverOffset: 8,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: '#8892b0',
            font: { family: "'Inter', sans-serif", size: 12 },
            usePointStyle: true,
            padding: 20,
          }
        },
        tooltip: {
          backgroundColor: 'rgba(10, 14, 23, 0.95)',
          titleColor: '#ccd6f6',
          bodyColor: '#8892b0',
          borderColor: '#1e3a5f',
          borderWidth: 1,
          cornerRadius: 8,
          padding: 12,
          callbacks: {
            label: function(context) {
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const pct = ((context.parsed / total) * 100).toFixed(1);
              return `${context.label}: ${context.parsed} (${pct}%)`;
            }
          }
        }
      },
      animation: {
        animateRotate: true,
        duration: 1200,
        easing: 'easeInOutQuart',
      }
    }
  });
}

/**
 * Destroy all chart instances
 */
export function destroyCharts() {
  if (sentimentChart) { sentimentChart.destroy(); sentimentChart = null; }
  if (distributionChart) { distributionChart.destroy(); distributionChart = null; }
}
