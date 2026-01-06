import { getStats, getTodayKey } from '../../utils/storage.js';

// Color palette
const colors = {
  primary: '#64ffda',
  danger: '#e94560',
  warning: '#ffd93d',
  purple: '#a855f7',
  blue: '#3b82f6',
  orange: '#f97316',
  pink: '#ec4899',
  cyan: '#06b6d4',
  gradient: [
    '#e94560',
    '#f97316',
    '#ffd93d',
    '#64ffda',
    '#3b82f6',
    '#a855f7',
    '#ec4899',
    '#06b6d4',
  ],
};

// DOM Elements
const currentStreakEl = document.getElementById('currentStreak');
const longestStreakEl = document.getElementById('longestStreak');
const todayAttemptsEl = document.getElementById('todayAttempts');
const todayTimeSpentEl = document.getElementById('todayTimeSpent');
const timeSpentSitesEl = document.getElementById('timeSpentSites');

// Chart instances
let topSitesChart = null;
let blockAttemptsChart = null;
let browsingTimeChart = null;

// Cached data
let cachedStats = null;

// Period state for each chart
const chartPeriods = {
  blocks: 'week',
  time: 'week',
};

// Initialize
async function init() {
  // Set Chart.js defaults for dark theme
  if (typeof Chart !== 'undefined') {
    Chart.defaults.color = '#8892b0';
    Chart.defaults.borderColor = 'rgba(255, 255, 255, 0.1)';
  }

  const stats = await getStats();
  cachedStats = stats;
  renderStats(stats);
  setupPeriodSelectors();
}

// Setup period selector buttons
function setupPeriodSelectors() {
  document.querySelectorAll('.period-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const chartType = btn.dataset.chart;
      const period = btn.dataset.period;

      // Update active state for this chart's buttons only
      btn.parentElement
        .querySelectorAll('.period-btn')
        .forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');

      chartPeriods[chartType] = period;
      updateChart(chartType, cachedStats.daily, period);
    });
  });
}

// Format seconds to readable time
function formatTime(seconds) {
  if (!seconds || seconds < 60) return '0m';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

// Format seconds to hours (for charts)
function toHours(seconds) {
  return Math.round(seconds / 360) / 10; // One decimal
}

// Render all statistics
function renderStats(stats) {
  // Streaks
  currentStreakEl.textContent = stats.streaks.current || 0;
  longestStreakEl.textContent = stats.streaks.longest || 0;

  // Today's stats
  const today = getTodayKey();
  const todayStats = stats.daily[today] || {
    blockAttempts: 0,
    sitesAttempted: {},
    timeSpent: {},
  };

  todayAttemptsEl.textContent = todayStats.blockAttempts;

  // Time on blocked sites
  const blockedTimeSeconds = Object.values(todayStats.timeSpent || {}).reduce(
    (a, b) => a + b,
    0
  );

  todayTimeSpentEl.textContent = formatTime(blockedTimeSeconds);

  // Site list
  renderTimeSpentSites(
    todayStats.timeSpent || {},
    timeSpentSitesEl,
    'No time on blocked sites today - great job! 🎉'
  );

  // Charts
  renderTopSitesChart(todayStats.sitesAttempted || {});
  renderBlockAttemptsChart(stats.daily, 'week');
  renderBrowsingTimeChart(stats.daily, 'week');
}

// Update a specific chart
function updateChart(chartType, dailyStats, period) {
  switch (chartType) {
    case 'blocks':
      renderBlockAttemptsChart(dailyStats, period);
      break;
    case 'time':
      renderBrowsingTimeChart(dailyStats, period);
      break;
  }
}

// Get period data
function getPeriodData(dailyStats, period) {
  const data = [];
  const today = new Date();

  if (period === 'week') {
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const key = date.toISOString().split('T')[0];
      const dayStats = dailyStats[key] || {};

      data.push({
        label: date.toLocaleDateString('en-GB', { weekday: 'short' }),
        attempts: dayStats.blockAttempts || 0,
        blockedTime: Object.values(dayStats.timeSpent || {}).reduce(
          (a, b) => a + b,
          0
        ),
      });
    }
  } else if (period === 'month') {
    for (let w = 3; w >= 0; w--) {
      const weekStart = new Date(today);
      const dayOfWeek = weekStart.getDay();
      const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      weekStart.setDate(weekStart.getDate() - daysToMonday - w * 7);

      let attempts = 0,
        blockedTime = 0;

      for (let d = 0; d < 7; d++) {
        const date = new Date(weekStart);
        date.setDate(date.getDate() + d);
        const key = date.toISOString().split('T')[0];
        const dayStats = dailyStats[key] || {};

        attempts += dayStats.blockAttempts || 0;
        blockedTime += Object.values(dayStats.timeSpent || {}).reduce(
          (a, b) => a + b,
          0
        );
      }

      const label =
        w === 0 ? 'This week' : w === 1 ? 'Last week' : `${w + 1}w ago`;
      data.push({ label, attempts, blockedTime });
    }
  } else if (period === 'year') {
    for (let m = 11; m >= 0; m--) {
      const monthDate = new Date(today.getFullYear(), today.getMonth() - m, 1);
      const monthEnd = new Date(
        today.getFullYear(),
        today.getMonth() - m + 1,
        0
      );

      let attempts = 0,
        blockedTime = 0;

      for (let d = 1; d <= monthEnd.getDate(); d++) {
        const date = new Date(monthDate.getFullYear(), monthDate.getMonth(), d);
        const key = date.toISOString().split('T')[0];
        const dayStats = dailyStats[key] || {};

        attempts += dayStats.blockAttempts || 0;
        blockedTime += Object.values(dayStats.timeSpent || {}).reduce(
          (a, b) => a + b,
          0
        );
      }

      data.push({
        label: monthDate.toLocaleDateString('en-GB', { month: 'short' }),
        attempts,
        blockedTime,
      });
    }
  }

  return data;
}

// Top Sites Pie Chart
function renderTopSitesChart(sitesAttempted) {
  const ctx = document.getElementById('topSitesChart');

  if (topSitesChart) {
    topSitesChart.destroy();
  }

  const sites = Object.entries(sitesAttempted)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  const hasData = sites.length > 0;

  topSitesChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: hasData ? sites.map((s) => s[0]) : ['No blocks yet'],
      datasets: [
        {
          data: hasData ? sites.map((s) => s[1]) : [1],
          backgroundColor: hasData
            ? colors.gradient.slice(0, sites.length)
            : ['rgba(255,255,255,0.1)'],
          borderWidth: 0,
          hoverOffset: 10,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '50%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            padding: 15,
            usePointStyle: true,
            pointStyle: 'circle',
            font: { size: 11 },
          },
        },
        tooltip: {
          callbacks: {
            label: (context) => {
              if (!hasData) return 'No blocked attempts today';
              return ` ${context.raw} ${
                context.raw === 1 ? 'block' : 'blocks'
              }`;
            },
          },
        },
      },
    },
  });
}

// Block Attempts Bar Chart
function renderBlockAttemptsChart(dailyStats, period) {
  const ctx = document.getElementById('blockAttemptsChart');
  const data = getPeriodData(dailyStats, period);

  if (blockAttemptsChart) {
    blockAttemptsChart.destroy();
  }

  blockAttemptsChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.map((d) => d.label),
      datasets: [
        {
          label: 'Block Attempts',
          data: data.map((d) => d.attempts),
          backgroundColor: createGradient(ctx, colors.danger, colors.orange),
          borderRadius: 8,
          borderSkipped: false,
          hoverBackgroundColor: colors.danger,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context) =>
              ` ${context.raw} ${context.raw === 1 ? 'attempt' : 'attempts'}`,
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { stepSize: 1 },
          grid: { color: 'rgba(255,255,255,0.05)' },
        },
        x: {
          grid: { display: false },
        },
      },
    },
  });
}

// Blocked Time Line Chart
function renderBrowsingTimeChart(dailyStats, period) {
  const ctx = document.getElementById('browsingTimeChart');
  const data = getPeriodData(dailyStats, period);

  if (browsingTimeChart) {
    browsingTimeChart.destroy();
  }

  browsingTimeChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.map((d) => d.label),
      datasets: [
        {
          label: 'Time on Blocked Sites',
          data: data.map((d) => toHours(d.blockedTime)),
          borderColor: colors.danger,
          backgroundColor: 'rgba(233, 69, 96, 0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: colors.danger,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        intersect: false,
        mode: 'index',
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context) => ` ${context.raw}h`,
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Hours',
          },
          grid: { color: 'rgba(255,255,255,0.05)' },
        },
        x: {
          grid: { display: false },
        },
      },
    },
  });
}

// Create gradient for bars
function createGradient(ctx, color1, color2) {
  const canvas = ctx.canvas || ctx;
  const chartCtx = canvas.getContext('2d');
  const gradient = chartCtx.createLinearGradient(0, 0, 0, 300);
  gradient.addColorStop(0, color1);
  gradient.addColorStop(1, color2);
  return gradient;
}

// Render time spent by site (list)
function renderTimeSpentSites(timeSpent, container, emptyMessage) {
  const sites = Object.entries(timeSpent)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  if (sites.length === 0) {
    container.innerHTML = `<p class="empty-state">${emptyMessage}</p>`;
    return;
  }

  container.innerHTML = sites
    .map(
      ([site, seconds]) => `
    <div class="site-row">
      <span class="site-name">${escapeHtml(site)}</span>
      <span class="site-count time">${formatTime(seconds)}</span>
    </div>
  `
    )
    .join('');
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Initialize on load
init();
