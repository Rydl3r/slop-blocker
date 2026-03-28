# Slop Blocker

Slop Blocker is a Chrome Extension (Manifest V3) that helps users stay focused by blocking distracting sites, showing a purposeful interruption page, and tracking behavior over time.

This project is designed to be lightweight, privacy-first, and easy to understand in source form (no framework build step).

## Why This Exists

Most blockers are either too permissive or too invasive. Slop Blocker focuses on:

- fast blocking with minimal UI friction
- transparent local-only data storage
- behavior feedback (streaks, time spent, slippages)
- temporary bypasses that are intentionally costly

## Core Features

- Domain, URL wildcard, and regex rule types
- Optional schedule windows per rule (time + days)
- Temporary bypass flow (records slippage and resets streak)
- Daily and historical stats dashboard
- Motivational blocked page with progression state
- One-click global enable/disable toggle

## Product Walkthrough

1. Add rules in the admin page.
2. Background service worker converts active rules into dynamic `declarativeNetRequest` rules.
3. Matching navigation is redirected to the blocked page.
4. Block attempts and blocked-site time are recorded in local storage.
5. Popup and stats pages surface progress and streak milestones.

## Architecture

### Runtime Pieces

- `background/service-worker.js`: rule compilation, alarms, bypass expiry, message router
- `popup/`: compact control surface for quick state and navigation
- `pages/admin/`: full rule CRUD + schedule config
- `pages/blocked/`: interruption UX + bypass confirmation
- `pages/stats/`: progression and behavior analytics
- `content/tracker.js`: time tracking for blocked domains
- `utils/`: storage, pattern matching, constants, and helper utilities

Detailed architecture notes: see `docs/ARCHITECTURE.md`.

### Data Model (stored in `chrome.storage.local`)

- `blockRules`: list of rule objects (`pattern`, `type`, `enabled`, optional `schedule`, `note`)
- `statistics`: daily attempts/time, streaks, slippages, totals
- `settings`: global extension toggles
- `activeBypass`: active temporary bypass domain + expiry

## Tech Stack

- JavaScript (ES Modules)
- Chrome Extension APIs (Manifest V3)
- `declarativeNetRequest` for efficient network-level blocking
- Chart.js for stats visualizations

## Installation (Local / Portfolio Demo)

1. Open `chrome://extensions/`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select this project folder
5. Pin the extension and open the popup

### Optional Icon Generation

If PNG icons are missing, generate them from `assets/icons/icon.svg`:

```bash
cd assets/icons
convert -background none icon.svg -resize 16x16 icon16.png
convert -background none icon.svg -resize 32x32 icon32.png
convert -background none icon.svg -resize 48x48 icon48.png
convert -background none icon.svg -resize 128x128 icon128.png
```

## Local Development

No bundler is required.

1. Edit source files directly.
2. Refresh the extension card in `chrome://extensions/`.
3. Re-open popup/page views to validate behavior.

## Testing Checklist

- Add one rule for each rule type (`domain`, `url`, `regex`).
- Verify block redirect triggers only for matching URLs.
- Confirm scheduled rules activate/deactivate as expected.
- Trigger temporary bypass and verify streak reset + slippage record.
- Check popup, blocked page, and stats page values remain consistent.
- Wait past bypass expiry and verify blocking resumes automatically.

## Privacy

All user data is stored locally via `chrome.storage.local`.

- no external analytics
- no remote database
- no account required

Contribution guide: see `CONTRIBUTING.md`.

## Tradeoffs and Notes

- `onRuleMatchedDebug` availability depends on extension/debug permissions and browser support.
- Rule updates are serialized in the service worker to avoid dynamic rule race conditions.
- Time tracking is domain-based and intentionally coarse, favoring low overhead.

## Roadmap

- Sync support via `chrome.storage.sync`
- Export/import user settings and stats
- Focus session presets (work, study, deep work)
- Better pattern validation UX with inline examples

## License

MIT
