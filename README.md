# Slop Blocker

A Chrome extension to help you stay focused by blocking distracting websites.

## Features

- 🚫 **Block Websites** - Block entire domains or specific URL patterns
- 📊 **Statistics** - Track block attempts and maintain streaks
- 💪 **Motivational Quotes** - See inspiring quotes when you try to access blocked sites
- 🎯 **Quick Presets** - One-click blocking for popular social media sites
- 🔄 **Toggle On/Off** - Easily enable or disable blocking

## Installation

### Developer Mode (Local Installation)

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle in the top-right corner)
3. Click **Load unpacked**
4. Select the `slop-blocker` folder
5. The extension icon should appear in your toolbar

### Generate Icons

Before loading the extension, you need to generate PNG icons from the SVG:

```bash
# If you have ImageMagick installed:
cd assets/icons
convert -background none icon.svg -resize 16x16 icon16.png
convert -background none icon.svg -resize 32x32 icon32.png
convert -background none icon.svg -resize 48x48 icon48.png
convert -background none icon.svg -resize 128x128 icon128.png
```

Or you can create simple placeholder PNGs manually.

## Usage

### Adding Blocked Sites

1. Click the extension icon in your toolbar
2. Click "Settings" to open the admin panel
3. Enter a website domain (e.g., `twitter.com`) and click "Add Rule"
4. Or use the quick presets to block popular sites with one click

### Viewing Statistics

1. Click the extension icon
2. Click "Statistics" to see your progress
3. Track your daily block attempts and day streak

### Blocking Types

- **Domain** - Blocks the entire website (e.g., `twitter.com` blocks all of Twitter)
- **URL Pattern** - Block specific paths with wildcards (e.g., `youtube.com/shorts/*`)
- **Regex** - Advanced pattern matching for power users

## Project Structure

```
slop-blocker/
├── manifest.json           # Extension configuration
├── background/
│   └── service-worker.js   # Handles blocking logic
├── popup/
│   ├── popup.html          # Quick access popup
│   ├── popup.css
│   └── popup.js
├── pages/
│   ├── blocked/            # Block page with quote
│   ├── admin/              # Settings panel
│   └── stats/              # Statistics dashboard
├── utils/
│   ├── storage.js          # Chrome storage wrapper
│   ├── patterns.js         # URL matching logic
│   └── quotes.js           # Motivational quotes
└── assets/
    └── icons/
```

## Development

This extension uses Manifest V3 and ES modules. No build step required - just edit the files and reload the extension.

### Testing Changes

1. Make your changes
2. Go to `chrome://extensions/`
3. Click the refresh icon on the Slop Blocker card
4. Test your changes

## Future Improvements

- [ ] Scheduled blocking (work hours vs. evenings)
- [ ] Focus sessions / Nuclear mode
- [ ] Password protection
- [ ] Data export/import
- [ ] Chrome sync across devices
- [ ] Time limits instead of full blocks
- [ ] Partial page blocking (e.g., YouTube feed)

## License

MIT
