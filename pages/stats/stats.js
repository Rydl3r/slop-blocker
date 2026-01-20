import { getStats } from '../../utils/storage.js';
import { escapeHtml, formatTime, getTodayKey } from '../../utils/helpers.js';
import { CHART_COLORS } from '../../utils/constants.js';

// Use shared color palette
const colors = CHART_COLORS;

// Common chart options
const baseChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
};

const defaultScales = {
  y: {
    beginAtZero: true,
    ticks: { stepSize: 1 },
    grid: { color: 'rgba(255,255,255,0.05)' },
  },
  x: {
    grid: { display: false },
  },
};

// DOM Elements
const currentStreakEl = document.getElementById('currentStreak');
const longestStreakEl = document.getElementById('longestStreak');
const todayAttemptsEl = document.getElementById('todayAttempts');
const todayTimeSpentEl = document.getElementById('todayTimeSpent');
const timeSpentSitesEl = document.getElementById('timeSpentSites');
const slippagesListEl = document.getElementById('slippagesList');

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
    0,
  );

  todayTimeSpentEl.textContent = formatTime(blockedTimeSeconds);

  // Site list
  renderTimeSpentSites(
    todayStats.timeSpent || {},
    timeSpentSitesEl,
    'No time on blocked sites today - great job! 🎉',
  );

  // Slippages history
  renderSlippages(stats.slippages || []);

  // Charts
  renderTopSitesChart(todayStats.sitesAttempted || {});
  renderBlockAttemptsChart(stats.daily, 'week');
  renderBrowsingTimeChart(stats.daily, 'week');
}

// Update a specific chart
const chartRenderers = {
  blocks: renderBlockAttemptsChart,
  time: renderBrowsingTimeChart,
};

function updateChart(chartType, dailyStats, period) {
  chartRenderers[chartType]?.(dailyStats, period);
}

// Helper: Sum stats for a date key
function sumDayStats(dailyStats, dateKey) {
  const dayStats = dailyStats[dateKey] || {};
  return {
    attempts: dayStats.blockAttempts || 0,
    blockedTime: Object.values(dayStats.timeSpent || {}).reduce(
      (a, b) => a + b,
      0,
    ),
  };
}

// Helper: Aggregate stats over a date range
function aggregateRange(dailyStats, dates) {
  return dates.reduce(
    (acc, date) => {
      const key = date.toISOString().split('T')[0];
      const stats = sumDayStats(dailyStats, key);
      acc.attempts += stats.attempts;
      acc.blockedTime += stats.blockedTime;
      return acc;
    },
    { attempts: 0, blockedTime: 0 },
  );
}

// Helper: Generate array of dates
function getDatesInRange(startDate, count) {
  return Array.from({ length: count }, (_, i) => {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    return date;
  });
}

// Get period data
function getPeriodData(dailyStats, period) {
  const today = new Date();

  if (period === 'week') {
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(today);
      date.setDate(date.getDate() - (6 - i));
      const stats = sumDayStats(dailyStats, date.toISOString().split('T')[0]);
      return {
        label: date.toLocaleDateString('en-GB', { weekday: 'short' }),
        ...stats,
      };
    });
  }

  if (period === 'month') {
    const dayOfWeek = today.getDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

    return Array.from({ length: 4 }, (_, i) => {
      const w = 3 - i;
      const weekStart = new Date(today);
      weekStart.setDate(weekStart.getDate() - daysToMonday - w * 7);
      const dates = getDatesInRange(weekStart, 7);
      const stats = aggregateRange(dailyStats, dates);
      const label =
        w === 0 ? 'This week' : w === 1 ? 'Last week' : `${w + 1}w ago`;
      return { label, ...stats };
    });
  }

  if (period === 'year') {
    return Array.from({ length: 12 }, (_, i) => {
      const m = 11 - i;
      const monthDate = new Date(today.getFullYear(), today.getMonth() - m, 1);
      const monthEnd = new Date(
        today.getFullYear(),
        today.getMonth() - m + 1,
        0,
      );
      const dates = getDatesInRange(monthDate, monthEnd.getDate());
      const stats = aggregateRange(dailyStats, dates);
      return {
        label: monthDate.toLocaleDateString('en-GB', { month: 'short' }),
        ...stats,
      };
    });
  }

  return [];
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
      ...baseChartOptions,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context) =>
              ` ${context.raw} ${context.raw === 1 ? 'attempt' : 'attempts'}`,
          },
        },
      },
      scales: defaultScales,
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
      ...baseChartOptions,
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
  `,
    )
    .join('');
}

// Render slippages history
function renderSlippages(slippages) {
  if (!slippagesListEl) return;

  if (!slippages || slippages.length === 0) {
    slippagesListEl.innerHTML =
      '<p class="empty-state">No slippages recorded - keep it up! 💪</p>';
    return;
  }

  // Sort by timestamp, most recent first
  const sortedSlippages = [...slippages].sort(
    (a, b) => b.timestamp - a.timestamp,
  );

  slippagesListEl.innerHTML = sortedSlippages
    .map((slip) => {
      const date = new Date(slip.timestamp);
      const formattedDate = date.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
      const formattedTime = date.toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
      });
      const streakText =
        slip.streakBroken > 0
          ? `${slip.streakBroken} day${slip.streakBroken === 1 ? '' : 's'} lost`
          : 'Fresh start';

      return `
        <div class="slippage-item">
          <div class="slippage-info">
            <span class="slippage-domain">${escapeHtml(slip.domain)}</span>
            <span class="slippage-time">${formattedDate} at ${formattedTime}</span>
          </div>
          <span class="slippage-streak">🔥 ${streakText}</span>
        </div>
      `;
    })
    .join('');
}

// Initialize on load
init();
