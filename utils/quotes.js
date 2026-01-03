// Motivational quotes for the block page

export const quotes = [
  {
    text: 'The secret of getting ahead is getting started.',
    author: 'Mark Twain',
  },
  {
    text: "It's not that we have a short time to live, but that we waste a lot of it.",
    author: 'Seneca',
  },
  {
    text: "The bad news is time flies. The good news is you're the pilot.",
    author: 'Michael Altshuler',
  },
  {
    text: 'Focus on being productive instead of busy.',
    author: 'Tim Ferriss',
  },
  {
    text: 'Until we can manage time, we can manage nothing else.',
    author: 'Peter Drucker',
  },
  {
    text: 'You will never find time for anything. If you want time you must make it.',
    author: 'Charles Buxton',
  },
  {
    text: "The key is not to prioritize what's on your schedule, but to schedule your priorities.",
    author: 'Stephen Covey',
  },
  {
    text: 'Discipline is choosing between what you want now and what you want most.',
    author: 'Abraham Lincoln',
  },
  {
    text: 'Your future is created by what you do today, not tomorrow.',
    author: 'Robert Kiyosaki',
  },
  {
    text: 'The only way to do great work is to love what you do.',
    author: 'Steve Jobs',
  },
  {
    text: "Don't count the days, make the days count.",
    author: 'Muhammad Ali',
  },
  {
    text: 'Time is what we want most, but what we use worst.',
    author: 'William Penn',
  },
  {
    text: 'Lost time is never found again.',
    author: 'Benjamin Franklin',
  },
  {
    text: 'The way to get started is to quit talking and begin doing.',
    author: 'Walt Disney',
  },
  {
    text: "You don't have to be great to start, but you have to start to be great.",
    author: 'Zig Ziglar',
  },
  {
    text: 'Action is the foundational key to all success.',
    author: 'Pablo Picasso',
  },
  {
    text: 'Either you run the day or the day runs you.',
    author: 'Jim Rohn',
  },
  {
    text: 'Absorb what is useful, discard what is not, add what is uniquely your own.',
    author: 'Bruce Lee',
  },
  {
    text: 'The greatest glory in living lies not in never falling, but in rising every time we fall.',
    author: 'Nelson Mandela',
  },
  {
    text: "Your time is limited, don't waste it living someone else's life.",
    author: 'Steve Jobs',
  },
  {
    text: 'Success is not final, failure is not fatal: it is the courage to continue that counts.',
    author: 'Winston Churchill',
  },
  {
    text: 'The only person you are destined to become is the person you decide to be.',
    author: 'Ralph Waldo Emerson',
  },
  {
    text: 'What you do today can improve all your tomorrows.',
    author: 'Ralph Marston',
  },
  {
    text: 'Small daily improvements are the key to staggering long-term results.',
    author: 'Robin Sharma',
  },
  {
    text: 'The best time to plant a tree was 20 years ago. The second best time is now.',
    author: 'Chinese Proverb',
  },
  {
    text: 'We are what we repeatedly do. Excellence, then, is not an act, but a habit.',
    author: 'Aristotle',
  },
  {
    text: 'Motivation is what gets you started. Habit is what keeps you going.',
    author: 'Jim Ryun',
  },
  {
    text: "Don't watch the clock; do what it does. Keep going.",
    author: 'Sam Levenson',
  },
  {
    text: 'The difference between ordinary and extraordinary is that little extra.',
    author: 'Jimmy Johnson',
  },
  {
    text: "Opportunities don't happen. You create them.",
    author: 'Chris Grosser',
  },
  {
    text: 'Do something today that your future self will thank you for.',
    author: 'Sean Patrick Flanery',
  },
  {
    text: 'Great things are not done by impulse, but by a series of small things brought together.',
    author: 'Vincent Van Gogh',
  },
  {
    text: 'The mind is everything. What you think you become.',
    author: 'Buddha',
  },
  {
    text: "Believe you can and you're halfway there.",
    author: 'Theodore Roosevelt',
  },
  {
    text: "The harder you work for something, the greater you'll feel when you achieve it.",
    author: 'Anonymous',
  },
  {
    text: 'Dream big and dare to fail.',
    author: 'Norman Vaughan',
  },
  {
    text: 'It does not matter how slowly you go as long as you do not stop.',
    author: 'Confucius',
  },
  {
    text: 'A journey of a thousand miles begins with a single step.',
    author: 'Lao Tzu',
  },
  {
    text: 'The only limit to our realization of tomorrow is our doubts of today.',
    author: 'Franklin D. Roosevelt',
  },
  {
    text: "You miss 100% of the shots you don't take.",
    author: 'Wayne Gretzky',
  },
  {
    text: 'Quality is not an act, it is a habit.',
    author: 'Aristotle',
  },
  {
    text: 'The best revenge is massive success.',
    author: 'Frank Sinatra',
  },
  {
    text: 'If you want to lift yourself up, lift up someone else.',
    author: 'Booker T. Washington',
  },
  {
    text: 'Life is 10% what happens to us and 90% how we react to it.',
    author: 'Charles R. Swindoll',
  },
  {
    text: 'In the middle of every difficulty lies opportunity.',
    author: 'Albert Einstein',
  },
  {
    text: "Everything you've ever wanted is on the other side of fear.",
    author: 'George Addair',
  },
  {
    text: 'Start where you are. Use what you have. Do what you can.',
    author: 'Arthur Ashe',
  },
  {
    text: "Don't let yesterday take up too much of today.",
    author: 'Will Rogers',
  },
  {
    text: 'You are never too old to set another goal or to dream a new dream.',
    author: 'C.S. Lewis',
  },
  {
    text: 'The future belongs to those who believe in the beauty of their dreams.',
    author: 'Eleanor Roosevelt',
  },
  {
    text: "It always seems impossible until it's done.",
    author: 'Nelson Mandela',
  },
  {
    text: 'Strive not to be a success, but rather to be of value.',
    author: 'Albert Einstein',
  },
  {
    text: 'Keep your face always toward the sunshine—and shadows will fall behind you.',
    author: 'Walt Whitman',
  },
  {
    text: 'What lies behind us and what lies before us are tiny matters compared to what lies within us.',
    author: 'Ralph Waldo Emerson',
  },
];

export function getRandomQuote() {
  const index = Math.floor(Math.random() * quotes.length);
  return quotes[index];
}
