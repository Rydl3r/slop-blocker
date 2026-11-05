// URL pattern matching utilities
//
// Every rule compiles to ONE regex source string. The same string is used by
// the service worker for declarativeNetRequest (RE2) and for the JS fallback
// checks, so both layers always agree on what is blocked.

const SCHEME_RE = /^[a-z][a-z0-9+.-]*:\/\//i;

function escapeRegex(text) {
  return text.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeDomain(pattern) {
  return pattern
    .trim()
    .toLowerCase()
    .replace(SCHEME_RE, '')
    .replace(/[/?#].*$/, '')
    .replace(/^\*\./, '')
    .replace(/^www\./, '');
}

/**
 * Build a regex source that matches the WHOLE url (anchored ^...$), so that
 * declarativeNetRequest's `\0` substitution captures the full original URL.
 * Returns null when the rule cannot be compiled.
 */
export function ruleToRegexSource(rule) {
  const pattern = (rule.pattern || '').trim();
  if (!pattern) return null;

  switch (rule.type) {
    case 'regex':
      // `^.*(?:P).*$` behaves like an unanchored search for P, in JS and RE2.
      return `^.*(?:${pattern}).*$`;

    case 'url': {
      // Glob pattern: scheme and leading "www." are optional, subdomains match,
      // `*` is a wildcard, pattern matches as a prefix.
      const body = pattern.replace(SCHEME_RE, '').replace(/^www\./i, '');
      const cut = body.search(/[/?#]/);
      const host = cut === -1 ? body : body.slice(0, cut);
      const rest = cut === -1 ? '' : body.slice(cut);
      const glob = (part) => part.split('*').map(escapeRegex).join('.*');
      return `^https?://(?:[^/?#]*\\.)?${glob(host)}(?::[0-9]+)?${glob(rest)}.*$`;
    }

    case 'domain':
    default: {
      const domain = normalizeDomain(pattern);
      if (!domain) return null;
      return `^https?://(?:[^/?#]*\\.)?${escapeRegex(domain)}(?::[0-9]+)?(?:[/?#].*)?$`;
    }
  }
}

const compiledCache = new Map();

/** Compile a rule to a JS RegExp (cached). Returns null if invalid. */
export function compileRule(rule) {
  const source = ruleToRegexSource(rule);
  if (!source) return null;
  if (compiledCache.has(source)) return compiledCache.get(source);
  let re = null;
  try {
    re = new RegExp(source, 'i');
  } catch {
    re = null;
  }
  compiledCache.set(source, re);
  return re;
}

/**
 * Check if a URL matches a block rule (ignores schedule).
 */
export function matchesRule(url, rule) {
  if (!rule || rule.enabled === false) return false;
  if (!/^https?:/i.test(url || '')) return false;
  const re = compileRule(rule);
  return re ? re.test(url) : false;
}

/**
 * Parse time string (HH:MM) to minutes since midnight
 */
function parseTimeToMinutes(timeStr, fallback) {
  const [hours, minutes] = String(timeStr || fallback)
    .split(':')
    .map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return parseTimeToMinutes(fallback, '00:00');
  }
  return hours * 60 + minutes;
}

/**
 * Check if current time is within the scheduled blocking hours
 * @param {Object} rule - The block rule with optional schedule
 * @param {Date} [now]
 * @returns {boolean} - Whether blocking should be active now
 */
export function isWithinSchedule(rule, now = new Date()) {
  const schedule = rule.schedule;

  // No schedule = always active
  if (!schedule?.enabled) return true;

  const days = schedule.days?.length > 0 ? schedule.days : null;
  const dayOk = (d) => !days || days.includes(d);

  const current = now.getHours() * 60 + now.getMinutes();
  const start = parseTimeToMinutes(schedule.startTime, '00:00');
  const end = parseTimeToMinutes(schedule.endTime, '23:59');
  const today = now.getDay();
  const yesterday = (today + 6) % 7;

  if (start <= end) {
    return dayOk(today) && current >= start && current <= end;
  }

  // Overnight schedule (e.g. 22:00 - 06:00): the evening part belongs to
  // today, the early-morning part belongs to the previous day.
  if (current >= start) return dayOk(today);
  if (current <= end) return dayOk(yesterday);
  return false;
}

/**
 * Extract domain from URL
 */
export function extractDomain(url) {
  try {
    return new URL(url).hostname;
  } catch {
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
    case 'domain': {
      const domainRegex =
        /^(\*\.)?[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*$/;
      if (!domainRegex.test(normalizeDomain(pattern))) {
        return { valid: false, error: 'Invalid domain format' };
      }
      break;
    }

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
