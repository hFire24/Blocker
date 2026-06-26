# Website Blocker

A Manifest V3 Chrome extension for blocking distracting websites and search terms, tracking blocking activity, and redirecting attention toward more useful tasks.

## Features

- Block websites and search keywords with regular-expression based rules.
- Enable or disable individual rules from the options page.
- Star frequently changed rules so they appear in the popup.
- Use easy mode for ordinary blocks or hard mode for blocks that require extra friction before disabling or unblocking.
- Temporarily unblock sites and automatically reblock them later.
- Show a blocked page with optional reason prompts, confirmation prompts, time selection, block counts, unblock counts, productive links, habit goals, and optional scripture reading.
- Track daily block and unblock counts in the Analytics tab.
- Save blocked URLs and unblock reasons according to user settings.
- Manage daily habit goals with optional URLs.
- Maintain a list of productive URLs shown after choosing to remain focused.
- Import and export extension data as JSON.

## Installation

1. Download or clone this repository.
2. Open Chrome and go to `chrome://extensions`.
3. Enable `Developer mode`.
4. Click `Load unpacked`.
5. Select this project folder.
6. Pin the extension from the Chrome toolbar if you want quick access.

## Main Screens

- `popup.html` / `popup.js`: Quick blocker controls, starred rules, habit tracker shortcut, and reblock actions.
- `options.html` / `options.js`: Rule management, blocker settings, analytics, saved URLs, habit goals, productive URLs, and import/export.
- `blocked.html` / `blocked.js`: The page shown when a rule blocks navigation.
- `challenge.html` / `challenge.js`: Extra challenge flow for disabling hard-mode blocking.
- `background.js`: Service worker for navigation checks, declarative net request rules, alarms, reblocking, and daily resets.
- `quotes.js`: Quote data used by challenge flows.

## Permissions

This extension requests these Chrome permissions:

- `tabs` and `webNavigation`: Detect the active tab and blocked navigations.
- `declarativeNetRequest`: Redirect blocked main-frame requests to the extension blocked page.
- `storage`: Save rules, settings, analytics, habits, productive links, and local blocking history.
- `alarms`: Reblock temporarily unblocked sites after a delay.
- `notifications`: Notify when a temporarily unblocked site is reblocked, if enabled.
- `<all_urls>` host access: Let the blocker match user-defined rules across websites.

## Privacy Notes

Data is stored in Chrome extension storage. The extension does not include a server component.

Some optional features can store sensitive data, including blocked URLs, matching rule names, unblock reasons, habit goals, and productive URLs. Saved URLs older than 30 days are deleted automatically, and the Saved URLs page includes a delete-all action.

Exported JSON files may contain personal browsing and habit data. Review exported files before sharing them.

## Development Notes

This project is plain HTML, CSS, and JavaScript. No build step is required for local development. After editing files, reload the extension from `chrome://extensions` to test changes.
