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

export const PROGRESS_MESSAGES = [
  { min: 0, max: 0, message: 'Start your journey today!' },
  { min: 1, max: 2, message: 'Great start! Keep building momentum.' },
  { min: 3, max: 6, message: "You're building a habit!" },
  { min: 7, max: 13, message: 'One week strong! 💪' },
  { min: 14, max: 29, message: "Two weeks! You're crushing it!" },
  { min: 30, max: 59, message: 'A full month! Incredible discipline!' },
  {
    min: 60,
    max: 89,
    message: 'Two months deep! This is part of who you are now.',
  },
  { min: 90, max: 119, message: 'Three months! Serious consistency 🔥' },
  {
    min: 120,
    max: 179,
    message: 'Four months strong! Most people never get here.',
  },
  { min: 180, max: 239, message: 'Six months! This habit is locked in 🧠' },
  { min: 240, max: 364, message: 'Almost a year! Elite-level commitment.' },
  { min: 365, max: 729, message: 'One full year! Absolute legend status 🏆' },
  {
    min: 730,
    max: Infinity,
    message: "You're unstoppable. This is a lifestyle.",
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
  const found = PROGRESS_MESSAGES.find(
    (p) => streak >= p.min && streak <= p.max,
  );
  return found?.message || 'Keep going!';
}
