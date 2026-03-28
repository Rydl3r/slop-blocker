# Contributing

Thanks for your interest in improving Slop Blocker.

## Development Setup

1. Clone the repository.
2. Open the project in VS Code.
3. Load it as an unpacked extension in `chrome://extensions/`.
4. After every change, refresh the extension card in Chrome.

## Project Conventions

- Use ES modules and keep files framework-free.
- Prefer small focused functions over large monoliths.
- Keep comments concise and only for non-obvious behavior.
- Preserve existing naming and formatting style in each file.

## Functional Expectations

When adding or changing behavior:

- preserve local-first privacy (no remote telemetry)
- avoid expensive background loops
- keep blocking updates deterministic and race-safe
- ensure stats remain backward compatible with existing storage data

## Manual Validation

Please validate at least the following:

- add/edit/delete a rule
- confirm blocked redirect works for each rule type
- test schedule enabled and disabled states
- test temporary bypass and automatic expiry
- verify popup and stats values after blocked attempts

## Pull Request Guidelines

- explain the user impact and reasoning
- include before/after screenshots for UI changes when possible
- call out any permission or manifest changes explicitly
- keep PRs scoped; split unrelated changes into separate PRs
