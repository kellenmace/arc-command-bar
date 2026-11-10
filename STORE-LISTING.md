# Chrome Web Store Submission Notes

Text to paste into the Chrome Web Store Developer Dashboard when submitting the extension.

## Single purpose

Arc Command Bar provides a keyboard-driven command bar for navigating the browser: switching to open tabs, opening URLs, reopening pages from browsing history, and running web or site searches.

## Permission justifications

| Permission | Justification |
|---|---|
| `activeTab` | When the user presses the keyboard shortcut or clicks the toolbar button, the extension needs temporary access to the current tab to show the command bar on that page. |
| `scripting` | Injects the small script that displays the command bar into the current tab, only when the user presses the shortcut or clicks the toolbar button. No script runs on pages otherwise. |
| `tabs` | Reads the titles and URLs of open tabs so the user can search for a tab and switch to it. |
| `history` | Searches the user's browsing history for pages matching what they type, so they can reopen them. |
| `topSites` | Reads Chrome's list of most visited sites to rank the user's frequently visited sites higher in results. |
| `search` | Runs web searches with the user's default search engine when they choose a search result. |
| `favicon` | Shows site icons next to results using Chrome's local favicon cache, so no browsing data is sent to a third-party favicon service. |

## Remote code

No. All code is included in the extension package.

## Data usage

- **Web history:** used locally to show search results. Not collected or transmitted.
- **Website content:** tab titles and URLs are used locally to show search results. Not collected or transmitted.

Certify all three Limited Use statements: the data is not sold, not used for unrelated purposes, and not used for creditworthiness or lending.

## Privacy policy URL

https://github.com/kellenmace/arc-command-bar/blob/main/PRIVACY.md

## Store assets still needed

- At least one screenshot, 1280×800 or 640×400.
- Optional: small promo tile, 440×280.
