// Shared utility functions for UI components

/**
 * Escape HTML to prevent XSS attacks
 */
export function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Format seconds to readable time string
 * @param {number} seconds - Time in seconds
 * @param {boolean} showSeconds - Whether to show seconds for short times
 * @returns {string} Formatted time string
 */
export function formatTime(seconds, showSeconds = true) {
  if (!seconds || seconds === 0) return showSeconds ? '0s' : '0m';
  if (seconds < 60) return showSeconds ? `${Math.floor(seconds)}s` : '0m';
  if (seconds < 3600) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return showSeconds && secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  }
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

/**
 * Format array of day numbers to readable string
 * @param {number[]} days - Array of day numbers (0=Sun, 6=Sat)
 * @returns {string} Formatted days string
 */
export function formatDays(days) {
  if (!days || days.length === 0) return 'No days';
  if (days.length === 7) return 'Every day';

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const weekdays = [1, 2, 3, 4, 5];
  const weekend = [0, 6];

  const sortedDays = [...days].sort((a, b) => a - b);

  if (
    weekdays.every((d) => sortedDays.includes(d)) &&
    sortedDays.length === 5
  ) {
    return 'Weekdays';
  }
  if (weekend.every((d) => sortedDays.includes(d)) && sortedDays.length === 2) {
    return 'Weekends';
  }

  return sortedDays.map((d) => dayNames[d]).join(', ');
}

/**
 * Get human-readable label for rule type
 * @param {string} type - Rule type (domain, url, regex)
 * @returns {string} Human-readable label
 */
export function getRuleTypeLabel(type) {
  const labels = {
    domain: 'Entire domain',
    url: 'URL pattern',
    regex: 'Regular expression',
  };
  return labels[type] || type;
}

/**
 * Generate a unique ID
 * @returns {string} Unique identifier
 */
export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * Get today's date as YYYY-MM-DD string
 * @returns {string} Today's date key
 */
export function getTodayKey() {
  return new Date().toISOString().split('T')[0];
}

/**
 * Debounce a function
 * @param {Function} fn - Function to debounce
 * @param {number} delay - Delay in milliseconds
 * @returns {Function} Debounced function
 */
export function debounce(fn, delay) {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}
