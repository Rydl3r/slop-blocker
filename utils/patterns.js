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
 * Parse time string (HH:MM) to minutes since midnight
 */
function parseTimeToMinutes(timeStr) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Check if a time is within a range (handles overnight schedules)
 */
function isTimeInRange(currentMinutes, startMinutes, endMinutes) {
  // Overnight schedule (e.g., 22:00 to 06:00)
  if (startMinutes > endMinutes) {
    return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
  }
  return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
}

/**
 * Check if current time is within the scheduled blocking hours
 * @param {Object} rule - The block rule with optional schedule
 * @returns {boolean} - Whether blocking should be active now
 */
export function isWithinSchedule(rule) {
  const schedule = rule.schedule;

  // No schedule = always active
  if (!schedule?.enabled) return true;

  const now = new Date();

  // Check day of week
  const hasDays = schedule.days?.length > 0;
  if (hasDays && !schedule.days.includes(now.getDay())) {
    return false;
  }

  // Check time range
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = parseTimeToMinutes(schedule.startTime || '00:00');
  const endMinutes = parseTimeToMinutes(schedule.endTime || '23:59');

  return isTimeInRange(currentMinutes, startMinutes, endMinutes);
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
