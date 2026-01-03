import {
  getRules,
  addRule,
  deleteRule,
  toggleRule,
  getSettings,
  saveSettings,
} from '../../utils/storage.js';
import { validatePattern } from '../../utils/patterns.js';

// DOM Elements
const globalToggle = document.getElementById('globalToggle');
const addRuleForm = document.getElementById('addRuleForm');
const patternInput = document.getElementById('pattern');
const ruleTypeSelect = document.getElementById('ruleType');
const rulesList = document.getElementById('rulesList');
const formError = document.getElementById('formError');

// Initialize
async function init() {
  await loadSettings();
  await loadRules();
  setupEventListeners();
}

// Load settings
async function loadSettings() {
  const settings = await getSettings();
  globalToggle.checked = settings.enabled;
}

// Load and render rules
async function loadRules() {
  const rules = await getRules();
  renderRules(rules);
}

// Render rules list
function renderRules(rules) {
  if (rules.length === 0) {
    rulesList.innerHTML =
      '<p class="empty-state">No sites blocked yet. Add your first rule above!</p>';
    return;
  }

  rulesList.innerHTML = rules
    .map(
      (rule) => `
    <div class="rule-item ${rule.enabled ? '' : 'disabled'}" data-id="${
        rule.id
      }">
      <div class="rule-info">
        <div class="rule-pattern">${escapeHtml(rule.pattern)}</div>
        <div class="rule-type">${getTypeLabel(rule.type)}</div>
      </div>
      <div class="rule-actions">
        <label class="switch" style="transform: scale(0.7);">
          <input type="checkbox" class="rule-toggle" ${
            rule.enabled ? 'checked' : ''
          }>
          <span class="slider"></span>
        </label>
        <button class="btn btn-small btn-danger delete-rule">Delete</button>
      </div>
    </div>
  `
    )
    .join('');

  // Add event listeners to rule items
  rulesList.querySelectorAll('.rule-item').forEach((item) => {
    const id = item.dataset.id;

    item.querySelector('.rule-toggle').addEventListener('change', async () => {
      await toggleRule(id);
      await loadRules();
      notifyBackgroundUpdate();
    });

    item.querySelector('.delete-rule').addEventListener('click', async () => {
      await deleteRule(id);
      await loadRules();
      notifyBackgroundUpdate();
    });
  });
}

// Get human-readable type label
function getTypeLabel(type) {
  switch (type) {
    case 'domain':
      return 'Entire domain';
    case 'url':
      return 'URL pattern';
    case 'regex':
      return 'Regular expression';
    default:
      return type;
  }
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Setup event listeners
function setupEventListeners() {
  // Global toggle
  globalToggle.addEventListener('change', async () => {
    const settings = await getSettings();
    settings.enabled = globalToggle.checked;
    await saveSettings(settings);
    notifyBackgroundUpdate();
  });

  // Add rule form
  addRuleForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const pattern = patternInput.value.trim();
    const type = ruleTypeSelect.value;

    // Validate pattern
    const validation = validatePattern(pattern, type);
    if (!validation.valid) {
      showError(validation.error);
      return;
    }

    // Check for duplicates
    const rules = await getRules();
    if (rules.some((r) => r.pattern.toLowerCase() === pattern.toLowerCase())) {
      showError('This pattern is already blocked');
      return;
    }

    // Add the rule
    await addRule({ pattern, type });

    // Clear form and reload
    patternInput.value = '';
    hideError();
    await loadRules();
    notifyBackgroundUpdate();
  });
}

// Show form error
function showError(message) {
  formError.textContent = message;
  formError.classList.remove('hidden');
}

// Hide form error
function hideError() {
  formError.classList.add('hidden');
}

// Notify background script to update rules
function notifyBackgroundUpdate() {
  chrome.runtime.sendMessage({ type: 'UPDATE_RULES' });
}

// Initialize on load
init();
