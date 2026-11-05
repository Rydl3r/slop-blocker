# Slop Blocker Architecture

This document explains how Slop Blocker is structured and how data moves through the extension.

## Goals

- Block distracting sites with low runtime overhead
- Keep all user data local to the browser
- Make behavior understandable from source

## High-Level Flow

1. User creates rules in the admin page.
2. Rules are stored in `chrome.storage.local`.
3. Background service worker compiles every active rule to one regex (`utils/patterns.js`) and installs it as a dynamic `declarativeNetRequest` redirect. The blocked page receives the original URL in its hash (`blocked.html#<url>`).
4. Matching top-level navigations are redirected to the blocked page.
5. A second enforcement layer (tab watcher in the service worker + `content/tracker.js`) uses the same regex to catch what DNR can't see: SPA navigations, back/forward-cache restores, tabs already open when a rule/schedule/bypass changes, and regexes RE2 can't compile.
6. Block attempts and time are recorded and shown in popup/stats.

## Runtime Components

### Background Service Worker

File: `background/service-worker.js`

Responsibilities:

- message router for popup/pages/content scripts
- dynamic rule generation and refresh
- periodic alarm for schedule updates and bypass expiration checks
- temporary bypass handling

Key design choice:

- dynamic rule updates are serialized via a queue to prevent race conditions when multiple updates happen in quick succession

### Admin Page

File: `pages/admin/admin.js`

Responsibilities:

- CRUD for blocking rules
- schedule setup per rule
- validation and duplicate prevention
- sync request to background after updates

### Blocked Page

File: `pages/blocked/blocked.js`

Responsibilities:

- show interruption UI and motivation content
- record block attempts (with anti-double-counting guard)
- allow temporary bypass with explicit confirmation

### Popup

File: `popup/popup.js`

Responsibilities:

- quick global toggle
- current streak and daily attempt summary
- links to admin and stats pages

### Stats Page

File: `pages/stats/stats.js`

Responsibilities:

- visualize trends via Chart.js
- render progression state and milestone indicators
- show slippages and domain-level time spend

### Utility Modules

Files:

- `utils/storage.js`
- `utils/patterns.js`
- `utils/helpers.js`
- `utils/constants.js`

Responsibilities:

- storage wrappers and normalized defaults
- URL/domain/regex matching and schedule evaluation
- shared formatting helpers and progression logic

## Data Model

Stored in `chrome.storage.local`:

### `blockRules`

Array of rule objects:

- `id`: unique id
- `pattern`: domain/url/regex pattern string
- `type`: `domain` | `url` | `regex`
- `enabled`: rule on/off
- `schedule`: optional `{ enabled, startTime, endTime, days[] }`
- `note`: optional user note
- `createdAt`: unix timestamp

### `statistics`

Object:

- `daily[YYYY-MM-DD]`: per-day attempts/sites/time
- `streaks`: `current`, `longest`, `lastIncrementDate`
- `totalBlockAttempts`
- `timeSpent`: total seconds by domain
- `slippages`: list of bypass events with timestamp and broken streak

### `settings`

Object:

- `enabled`: global blocking toggle
- `showMotivation`: blocked-page option flag

### `activeBypass`

Object or `null`:

- `domain`, `url`: what was bypassed
- `ruleIds`: rules suspended during the bypass
- `expiry` timestamp

## Permissions and APIs

Primary APIs:

- `declarativeNetRequest`
- `storage`
- `tabs`
- `alarms`
- `webNavigation`
- `runtime`

Note:

- `onRuleMatchedDebug` may have environment-specific behavior depending on browser/channel.

## Reliability Notes

- The service worker listens to `chrome.storage.onChanged`; any change to rules, settings or bypass resyncs DNR and sweeps open tabs. UI pages only write storage.
- DNR updates are a single atomic call. If the batch fails, rules are installed one by one; any rule DNR rejects is enforced via `webNavigation` instead.
- A 1-minute alarm resyncs schedules and sweeps tabs; a one-shot alarm ends a bypass on time.
- Stats mutations are serialized to avoid lost updates.
- Day keys use local time, not UTC.

## Privacy

Slop Blocker does not transmit user data to external services.
All data remains in local extension storage.
