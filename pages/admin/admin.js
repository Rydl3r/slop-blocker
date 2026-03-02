import {
  getRules,
  addRule,
  deleteRule,
  updateRule,
  getSettings,
  saveSettings,
} from '../../utils/storage.js';
import { validatePattern } from '../../utils/patterns.js';
import {
  escapeHtml,
  formatDays,
  getRuleTypeLabel,
} from '../../utils/helpers.js';

// DOM Elements
const globalToggle = document.getElementById('globalToggle');
const addRuleForm = document.getElementById('addRuleForm');
const patternInput = document.getElementById('pattern');
const ruleTypeSelect = document.getElementById('ruleType');
const ruleNoteInput = document.getElementById('ruleNote');
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
          <span class="rule-type">${getRuleTypeLabel(rule.type)}</span>
          ${
            rule.schedule?.enabled
              ? `<span class="rule-schedule">⏰ ${rule.schedule.startTime} - ${rule.schedule.endTime} (${formatDays(rule.schedule.days)})</span>`
              : '<span class="rule-schedule-none">Always active</span>'
          }
        </div>
        ${
          rule.note?.trim()
            ? `<div class="rule-note">${escapeHtml(rule.note)}</div>`
            : ''
        }
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
      if (rule) openEditModal(rule);
    });

    item.querySelector('.delete-rule').addEventListener('click', async () => {
      if (!confirm('Are you sure you want to delete this rule?')) return;
      await deleteRule(id);
      await loadRules();
      notifyBackgroundUpdate();
    });
  });
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
    const ruleData = { pattern, type, note: ruleNoteInput.value.trim() };

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
    ruleNoteInput.value = '';
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

// Default schedule values
const DEFAULT_SCHEDULE = {
  startTime: '09:00',
  endTime: '18:00',
  days: [1, 2, 3, 4, 5], // Weekdays
};

// Helper: Populate schedule form fields
function populateScheduleForm(schedule, prefix = 'edit') {
  const hasSchedule = schedule?.enabled;
  const scheduleData = hasSchedule ? schedule : DEFAULT_SCHEDULE;

  document.getElementById(`${prefix}EnableSchedule`).checked = hasSchedule;
  document
    .getElementById(`${prefix}ScheduleOptions`)
    .classList.toggle('hidden', !hasSchedule);
  document.getElementById(`${prefix}StartTime`).value = scheduleData.startTime;
  document.getElementById(`${prefix}EndTime`).value = scheduleData.endTime;

  const activeDays = hasSchedule ? schedule.days || [] : DEFAULT_SCHEDULE.days;
  document
    .querySelectorAll(`#${prefix}ScheduleOptions input[name="${prefix}Days"]`)
    .forEach((cb) => {
      cb.checked = activeDays.includes(parseInt(cb.value));
    });
}

// Helper: Get schedule from form
function getScheduleFromForm(prefix = 'edit') {
  const enabled = document.getElementById(`${prefix}EnableSchedule`).checked;
  if (!enabled) return null;

  const selectedDays = Array.from(
    document.querySelectorAll(
      `#${prefix}ScheduleOptions input[name="${prefix}Days"]:checked`,
    ),
  ).map((cb) => parseInt(cb.value));

  return {
    enabled: true,
    startTime: document.getElementById(`${prefix}StartTime`).value,
    endTime: document.getElementById(`${prefix}EndTime`).value,
    days: selectedDays,
  };
}

// Helper: Show edit error
function showEditError(message) {
  const errorEl = document.getElementById('editError');
  errorEl.textContent = message;
  errorEl.classList.remove('hidden');
}

function openEditModal(rule) {
  currentEditId = rule.id;

  document.getElementById('editPattern').value = rule.pattern;
  document.getElementById('editRuleType').value = rule.type;
  document.getElementById('editRuleNote').value = rule.note || '';
  populateScheduleForm(rule.schedule);

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
  const note = document.getElementById('editRuleNote').value.trim();

  // Validate pattern
  const validation = validatePattern(pattern, type);
  if (!validation.valid) {
    showEditError(validation.error);
    return;
  }

  // Check for duplicates (excluding current rule)
  const rules = await getRules();
  const isDuplicate = rules.some(
    (r) =>
      r.id !== currentEditId &&
      r.pattern.toLowerCase() === pattern.toLowerCase(),
  );

  if (isDuplicate) {
    showEditError('This pattern is already blocked');
    return;
  }

  // Build and save update
  const updates = {
    pattern,
    type,
    note,
    schedule: getScheduleFromForm(),
  };

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
