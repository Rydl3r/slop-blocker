// URL pattern matching utilities

/**
 * Check if a URL matches a block rule
 * @param {string} url - The URL to check
 * @param {Object} rule - The block rule
 * @returns {boolean} - Whether the URL matches
 */
export function matchesRule(url, rule) {
  if (!rule.enabled) return false;

  try {
    const urlObj = new URL(url);

    switch (rule.type) {
      case 'domain':
        return matchesDomain(urlObj, rule.pattern);
      case 'url':
        return matchesUrlPattern(url, rule.pattern);
      case 'regex':
        return matchesRegex(url, rule.pattern);
      default:
        return matchesDomain(urlObj, rule.pattern);
    }
  } catch (e) {
    console.error('Error matching rule:', e);
    return false;
  }
}

/**
 * Check if URL matches a domain pattern
 * Supports: example.com, *.example.com, subdomain.example.com
 */
function matchesDomain(urlObj, pattern) {
  const hostname = urlObj.hostname.toLowerCase();
  const normalizedPattern = pattern.toLowerCase().replace(/^www\./, '');
  const normalizedHostname = hostname.replace(/^www\./, '');

  // Exact match
  if (normalizedHostname === normalizedPattern) {
    return true;
  }

  // Wildcard subdomain match (*.example.com)
  if (pattern.startsWith('*.')) {
    const baseDomain = normalizedPattern.slice(2);
    return (
      normalizedHostname === baseDomain ||
      normalizedHostname.endsWith('.' + baseDomain)
    );
  }

  // Also match subdomains by default
  if (normalizedHostname.endsWith('.' + normalizedPattern)) {
    return true;
  }

  return false;
}

/**
 * Check if URL matches a URL pattern
 * Supports wildcards: *
 */
function matchesUrlPattern(url, pattern) {
  // Convert pattern to regex
  const regexPattern = pattern
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&') // Escape special chars except *
    .replace(/\*/g, '.*'); // Convert * to .*

  const regex = new RegExp(`^${regexPattern}`, 'i');
  return regex.test(url);
}

/**
 * Check if URL matches a regex pattern
 */
function matchesRegex(url, pattern) {
  try {
    const regex = new RegExp(pattern, 'i');
    return regex.test(url);
  } catch (e) {
    console.error('Invalid regex pattern:', pattern);
    return false;
  }
}

/**
 * Check if current time is within the scheduled blocking hours
 * @param {Object} rule - The block rule with optional schedule
 * @returns {boolean} - Whether blocking should be active now
 */
export function isWithinSchedule(rule) {
  // If no schedule is set, always block
  if (!rule.schedule || !rule.schedule.enabled) {
    return true;
  }

  const now = new Date();
  const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTimeMinutes = currentHour * 60 + currentMinute;

  // Check if current day is in the active days
  if (rule.schedule.days && rule.schedule.days.length > 0) {
    if (!rule.schedule.days.includes(currentDay)) {
      return false;
    }
  }

  // Parse start and end times
  const startTime = parseTimeToMinutes(rule.schedule.startTime || '00:00');
  const endTime = parseTimeToMinutes(rule.schedule.endTime || '23:59');

  // Handle overnight schedules (e.g., 22:00 to 06:00)
  if (startTime > endTime) {
    return currentTimeMinutes >= startTime || currentTimeMinutes <= endTime;
  }

  return currentTimeMinutes >= startTime && currentTimeMinutes <= endTime;
}

/**
 * Parse time string (HH:MM) to minutes since midnight
 */
function parseTimeToMinutes(timeStr) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Extract domain from URL
 */
export function extractDomain(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch (e) {
    return url;
  }
}

/**
 * Validate a pattern
 * @returns {Object} - { valid: boolean, error?: string }
 */
export function validatePattern(pattern, type) {
  if (!pattern || pattern.trim() === '') {
    return { valid: false, error: 'Pattern cannot be empty' };
  }

  switch (type) {
    case 'domain':
      // Basic domain validation
      const domainRegex =
        /^(\*\.)?[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*$/;
      if (!domainRegex.test(pattern)) {
        return { valid: false, error: 'Invalid domain format' };
      }
      break;

    case 'regex':
      try {
        new RegExp(pattern);
      } catch (e) {
        return { valid: false, error: 'Invalid regex: ' + e.message };
      }
      break;
  }

  return { valid: true };
}

/**
 * Convert a simple domain to a declarativeNetRequest rule
 */
export function toDeclarativeNetRequestRule(rule, priority = 1) {
  const urlFilter =
    rule.type === 'domain'
      ? `||${rule.pattern.replace(/^\*\./, '')}`
      : rule.pattern;

  return {
    id: hashStringToInt(rule.id),
    priority: priority,
    action: {
      type: 'redirect',
      redirect: {
        extensionPath: '/pages/blocked/blocked.html',
      },
    },
    condition: {
      urlFilter: urlFilter,
      resourceTypes: ['main_frame'],
    },
  };
}

/**
 * Convert string ID to integer for declarativeNetRequest
 */
function hashStringToInt(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}
