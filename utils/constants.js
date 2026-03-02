// Shared constants and configuration

// Motivational tips displayed on blocked page
export const TIPS = [
  'Take 3 deep breaths before deciding what to do next.',
  "What's one small task you could accomplish right now?",
  'Stand up and stretch for 30 seconds - your body will thank you.',
  'Consider: Is there something more meaningful you could be doing?',
  'Remember your goals. Every moment is a choice.',
  'Try the 2-minute rule: If something takes less than 2 minutes, do it now.',
  'Your future self is watching. Make them proud.',
  "Progress, not perfection. What's one step forward you can take?",
  'Boredom is often a sign you need to challenge yourself.',
  'The urge will pass. Give it 5 minutes.',
  "What would you do if you weren't afraid of failing?",
  'Focus on what you can control right now.',
  'Remember why you started this journey.',
  'Small consistent actions lead to big changes over time.',
  'Take a moment to visualize your success.',
  'Celebrate small wins - they add up!',
  'Ask yourself: Is this activity aligned with my values?',
  'Try the Pomodoro technique: 25 minutes focused work, 5 minutes break.',
  'Disconnect to reconnect - take a short walk outside.',
  "Reflect on your progress so far. You're doing great!",
  'Pause and check in: how are you actually feeling right now?',
  'Momentum beats motivation. Just start.',
  'Lower the bar — showing up imperfectly still counts.',
  'What would “good enough” look like here?',
  'Put your phone down for the next 10 minutes.',
  'Energy follows action. Move first, motivation comes later.',
  'This moment is temporary. Your goals are bigger.',
  'Ask: What would the best version of me do next?',
  'Break it down until it feels almost too easy.',
  'You don’t need to finish — you just need to begin.',
  'Notice distractions without judging yourself.',
  'Choose progress over comfort, just this once.',
  'If you quit now, you’ll be back here later. Keep going.',
  'Even 1% better today is a win.',
  'Slow progress is still progress.',
  'Trust the process, especially when it feels boring.',
  'Future you will thank you for this small effort.',
  'You’ve handled harder things than this.',
  'Set a 10-minute timer and reassess when it ends.',
  'Act like this matters — because it does.',
];

export const PROGRESS_STAGES = [
  {
    min: 0,
    max: 0,
    title: 'Boot Sequence',
    badge: '🌱',
    message: 'Start your journey today!',
    accent: '#64ffda',
  },
  {
    min: 1,
    max: 2,
    title: 'Momentum Spark',
    badge: '⚡',
    message: 'Great start! Keep building momentum.',
    accent: '#4ade80',
  },
  {
    min: 3,
    max: 6,
    title: 'Habit Draft',
    badge: '🛠️',
    message: "You're building a habit.",
    accent: '#22d3ee',
  },
  {
    min: 7,
    max: 13,
    title: 'Week Warrior',
    badge: '🔥',
    message: 'One week strong.',
    accent: '#38bdf8',
  },
  {
    min: 14,
    max: 29,
    title: 'Focus Builder',
    badge: '🧱',
    message: "Two weeks in. You're stacking wins.",
    accent: '#818cf8',
  },
  {
    min: 30,
    max: 44,
    title: 'Month I Complete',
    badge: '🏁',
    message: 'A full month. You made this real.',
    accent: '#a78bfa',
  },
  {
    min: 45,
    max: 59,
    title: 'Month II Grind',
    badge: '⛰️',
    message: 'You pushed past the novelty phase.',
    accent: '#c084fc',
  },
  {
    min: 60,
    max: 89,
    title: 'Deep Work Mode',
    badge: '🧠',
    message: 'Two months deep. This is who you are now.',
    accent: '#f472b6',
  },
  {
    min: 90,
    max: 119,
    title: 'Quarter Locked',
    badge: '🏆',
    message: 'Three months. Serious consistency.',
    accent: '#fb7185',
  },
  {
    min: 120,
    max: 179,
    title: 'System Operator',
    badge: '⚙️',
    message: 'Four to six months. Your system is working.',
    accent: '#f97316',
  },
  {
    min: 180,
    max: 239,
    title: 'Relapse Resistant',
    badge: '🛡️',
    message: 'Half-year discipline. Most people never get here.',
    accent: '#f59e0b',
  },
  {
    min: 240,
    max: 364,
    title: 'Elite Cadence',
    badge: '👑',
    message: 'Approaching one year. Elite-level commitment.',
    accent: '#eab308',
  },
  {
    min: 365,
    max: 729,
    title: 'One-Year Legend',
    badge: '🚀',
    message: 'A full year complete. Absolute legend.',
    accent: '#84cc16',
  },
  {
    min: 730,
    max: Infinity,
    title: 'Lifestyle Master',
    badge: '🌌',
    message: 'You are maintaining this as a lifestyle.',
    accent: '#14b8a6',
  },
];

// Chart color palette
export const CHART_COLORS = {
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

/**
 * Get a random tip
 */
export function getRandomTip() {
  return TIPS[Math.floor(Math.random() * TIPS.length)];
}

/**
 * Get progress message based on streak
 */
export function getProgressMessage(streak) {
  const found = PROGRESS_STAGES.find(
    (p) => streak >= p.min && streak <= p.max,
  );
  return found?.message || 'Keep going!';
}

/**
 * Get rich progression state for streak visuals.
 */
export function getProgressState(streak) {
  const safeStreak = Math.max(0, Number(streak) || 0);
  const stageIndex = PROGRESS_STAGES.findIndex(
    (stage) => safeStreak >= stage.min && safeStreak <= stage.max,
  );
  const stage = PROGRESS_STAGES[Math.max(stageIndex, 0)];
  const nextStage = PROGRESS_STAGES[stageIndex + 1];

  let progress = 0;
  let nextMilestone = null;

  if (Number.isFinite(stage.max) && stage.max > stage.min) {
    progress = (safeStreak - stage.min) / (stage.max - stage.min);
    nextMilestone = nextStage?.min ?? null;
  } else if (Number.isFinite(stage.max)) {
    nextMilestone = nextStage?.min ?? null;
  } else if (stage.max === Infinity) {
    const cycleSize = 30;
    const cycleOffset = (safeStreak - stage.min + cycleSize) % cycleSize;
    progress = cycleOffset / cycleSize;
    nextMilestone = safeStreak + (cycleSize - cycleOffset || cycleSize);
  }

  return {
    streak: safeStreak,
    title: stage.title,
    badge: stage.badge,
    message: stage.message,
    accent: stage.accent,
    progress: Math.max(0, Math.min(1, progress)),
    nextMilestone,
    daysToNext:
      nextMilestone == null ? null : Math.max(0, nextMilestone - safeStreak),
  };
}
