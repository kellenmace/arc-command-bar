# Arc Command Bar - Google Chrome Extension

- **Author:** Kellen Mace
- **Author URL:** https://kellenmace.com/
- **License:** MIT
- **GitHub URL:** https://github.com/kellenmace/arc-command-bar/

## Description

Arc Command Bar brings an Arc-style command bar to Google Chrome. Use it to quickly switch between open tabs, open websites, search your browsing history, run a web search with your default Chrome search engine, or search directly inside supported sites.

The extension is designed for fast keyboard-driven browsing. Open the command bar, start typing, then choose a result with the keyboard or mouse. Matching open tabs are prioritized so you can jump back to work you already have open, while URL and search actions make it easy to navigate somewhere new without reaching for the address bar.

Arc Command Bar also includes built-in site search shortcuts for YouTube, Amazon, Wikipedia, X/Twitter, and Spotify. Type the name of a supported site, press Tab, enter your search, then press Enter to open results for that site.

## How To Use

Press Cmd+Shift+K on macOS or Ctrl+Shift+K on Windows/Linux to show or hide the command bar. The shortcut can be customized from Chrome's extension keyboard shortcuts page.

When the command bar opens, it shows your most recently used open tabs. Type to search across open tabs, browsing history, common websites, and web search actions.

Use the Up and Down arrow keys to move through results, then press Enter to choose the selected result. You can also scroll the result list and click an item directly.

Enter a web address like `example.com` or `https://example.com` and press Enter to open that page in a new tab. Enter a search phrase like `best note taking apps` and press Enter to search with your default Chrome search engine.

To use site search, type `youtube`, `amazon`, `wikipedia`, `x`, `twitter`, or `spotify`, then press Tab. Type your search query and press Enter. If you enter site search mode by mistake, press Backspace while the site-search input is empty to return to normal search mode.

Press Escape or click outside the command bar to close it.

On pages where Chrome doesn't allow extensions to show content, such as the New Tab page, `chrome://` pages, and the Chrome Web Store, the command bar opens as a popup from the toolbar button instead.

## Privacy

Arc Command Bar doesn't collect or transmit any data. Tab, history, and favicon data stays on your device and is only used to show results. The command bar runs in an isolated extension frame, so websites can't read its contents or what you type into it. See [PRIVACY.md](PRIVACY.md) for the full privacy policy.

## Packaging For The Chrome Web Store

Run this command to build the zip file to upload to the Chrome Web Store:

```bash
./scripts/package-extension.sh
```

The zip is written to `dist/` and contains only the files the extension needs at runtime. [STORE-LISTING.md](STORE-LISTING.md) has the permission justifications and other text for the store submission form. The source SVGs for the extension icons are in `icons/source/`.

## FAQ

> How can I customize the keyboard shortcut?

This extension provides a cmd/ctrl + shift + k keyboard shortcut you can use to show/hide the command bar. To customize the keyboard shortcut, go to the Chrome "Keyboard shortcuts" page by navigating to `chrome://extensions/shortcuts` in a browser tab. Find this extension on the list and click the edit button to set your own custom keyboard shortcut. Setting it to cmd/ctrl + t results in this extension's command bar replacing Chrome's default new tab page.
