import {
  getRules,
  addRule,
  deleteRule,
  updateRule,
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
const enableSchedule = document.getElementById('enableSchedule');
const scheduleOptions = document.getElementById('scheduleOptions');
const startTimeInput = document.getElementById('startTime');
const endTimeInput = document.getElementById('endTime');

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
    <div class="rule-item" data-id="${rule.id}">
      <div class="rule-info">
        <div class="rule-pattern">${escapeHtml(rule.pattern)}</div>
        <div class="rule-meta">
          <span class="rule-type">${getTypeLabel(rule.type)}</span>
          ${
            rule.schedule?.enabled
              ? `<span class="rule-schedule">⏰ ${rule.schedule.startTime} - ${rule.schedule.endTime} (${formatDays(rule.schedule.days)})</span>`
              : '<span class="rule-schedule-none">Always active</span>'
          }
        </div>
      </div>
      <div class="rule-actions">
        <button class="btn btn-small btn-edit edit-rule">Edit</button>
        <button class="btn btn-small btn-danger delete-rule">Delete</button>
      </div>
    </div>
  `,
    )
    .join('');

  // Add event listeners to rule items
  rulesList.querySelectorAll('.rule-item').forEach((item) => {
    const id = item.dataset.id;

    item.querySelector('.edit-rule').addEventListener('click', async () => {
      const rules = await getRules();
      const rule = rules.find((r) => r.id === id);
      if (rule) {
        openEditModal(rule);
      }
    });

    item.querySelector('.delete-rule').addEventListener('click', async () => {
      if (confirm('Are you sure you want to delete this rule?')) {
        await deleteRule(id);
        await loadRules();
        notifyBackgroundUpdate();
      }
    });
  });
}

// Format days array to readable string
function formatDays(days) {
  if (!days || days.length === 0) return 'No days';
  if (days.length === 7) return 'Every day';

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const weekdays = [1, 2, 3, 4, 5];
  const weekend = [0, 6];

  if (
    weekdays.every((d) => days.includes(d)) &&
    !days.includes(0) &&
    !days.includes(6)
  ) {
    return 'Weekdays';
  }
  if (weekend.every((d) => days.includes(d)) && days.length === 2) {
    return 'Weekends';
  }

  return days.map((d) => dayNames[d]).join(', ');
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

  // Schedule toggle
  enableSchedule.addEventListener('change', () => {
    scheduleOptions.classList.toggle('hidden', !enableSchedule.checked);
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

    // Build rule object
    const ruleData = { pattern, type };

    // Add schedule if enabled
    if (enableSchedule.checked) {
      const selectedDays = Array.from(
        document.querySelectorAll('input[name="days"]:checked'),
      ).map((cb) => parseInt(cb.value));

      ruleData.schedule = {
        enabled: true,
        startTime: startTimeInput.value,
        endTime: endTimeInput.value,
        days: selectedDays,
      };
    }

    // Add the rule
    await addRule(ruleData);

    // Clear form and reload
    patternInput.value = '';
    enableSchedule.checked = false;
    scheduleOptions.classList.add('hidden');
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

// Edit Modal Functions
let currentEditId = null;

function openEditModal(rule) {
  currentEditId = rule.id;

  // Populate form fields
  document.getElementById('editPattern').value = rule.pattern;
  document.getElementById('editRuleType').value = rule.type;

  const editEnableSchedule = document.getElementById('editEnableSchedule');
  const editScheduleOptions = document.getElementById('editScheduleOptions');

  if (rule.schedule?.enabled) {
    editEnableSchedule.checked = true;
    editScheduleOptions.classList.remove('hidden');
    document.getElementById('editStartTime').value =
      rule.schedule.startTime || '09:00';
    document.getElementById('editEndTime').value =
      rule.schedule.endTime || '18:00';

    // Set days
    document
      .querySelectorAll('#editScheduleOptions input[name="editDays"]')
      .forEach((cb) => {
        cb.checked = rule.schedule.days?.includes(parseInt(cb.value)) || false;
      });
  } else {
    editEnableSchedule.checked = false;
    editScheduleOptions.classList.add('hidden');
    // Reset to defaults
    document.getElementById('editStartTime').value = '09:00';
    document.getElementById('editEndTime').value = '18:00';
    document
      .querySelectorAll('#editScheduleOptions input[name="editDays"]')
      .forEach((cb, i) => {
        cb.checked = [1, 2, 3, 4, 5].includes(parseInt(cb.value)); // Default: weekdays
      });
  }

  // Show modal
  document.getElementById('editModal').classList.add('active');
  document.getElementById('editError').classList.add('hidden');
}

function closeEditModal() {
  currentEditId = null;
  document.getElementById('editModal').classList.remove('active');
}

async function saveEditedRule() {
  const pattern = document.getElementById('editPattern').value.trim();
  const type = document.getElementById('editRuleType').value;
  const editEnableSchedule = document.getElementById('editEnableSchedule');

  // Validate pattern
  const validation = validatePattern(pattern, type);
  if (!validation.valid) {
    document.getElementById('editError').textContent = validation.error;
    document.getElementById('editError').classList.remove('hidden');
    return;
  }

  // Check for duplicates (excluding current rule)
  const rules = await getRules();
  if (
    rules.some(
      (r) =>
        r.id !== currentEditId &&
        r.pattern.toLowerCase() === pattern.toLowerCase(),
    )
  ) {
    document.getElementById('editError').textContent =
      'This pattern is already blocked';
    document.getElementById('editError').classList.remove('hidden');
    return;
  }

  // Build update object
  const updates = { pattern, type };

  if (editEnableSchedule.checked) {
    const selectedDays = Array.from(
      document.querySelectorAll(
        '#editScheduleOptions input[name="editDays"]:checked',
      ),
    ).map((cb) => parseInt(cb.value));

    updates.schedule = {
      enabled: true,
      startTime: document.getElementById('editStartTime').value,
      endTime: document.getElementById('editEndTime').value,
      days: selectedDays,
    };
  } else {
    updates.schedule = null;
  }

  // Update the rule
  await updateRule(currentEditId, updates);

  closeEditModal();
  await loadRules();
  notifyBackgroundUpdate();
}

// Setup edit modal event listeners
function setupEditModalListeners() {
  // Close button
  document
    .getElementById('closeEditModal')
    .addEventListener('click', closeEditModal);

  // Cancel button
  document
    .getElementById('cancelEdit')
    .addEventListener('click', closeEditModal);

  // Save button
  document.getElementById('saveEdit').addEventListener('click', saveEditedRule);

  // Schedule toggle
  document
    .getElementById('editEnableSchedule')
    .addEventListener('change', (e) => {
      document
        .getElementById('editScheduleOptions')
        .classList.toggle('hidden', !e.target.checked);
    });

  // Close on backdrop click
  document.getElementById('editModal').addEventListener('click', (e) => {
    if (e.target.id === 'editModal') {
      closeEditModal();
    }
  });

  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (
      e.key === 'Escape' &&
      document.getElementById('editModal').classList.contains('active')
    ) {
      closeEditModal();
    }
  });
}

// Initialize on load
init();
setupEditModalListeners();
