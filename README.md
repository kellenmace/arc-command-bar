# Arc Command Bar - Google Chrome Extension

- **Author:** Kellen Mace
- **Author URL:** https://kellenmace.com/
- **License:** MIT
- **GitHub URL:** https://github.com/kellenmace/arc-command-bar/

## Description

Arc Command Bar brings an Arc-style command bar to Google Chrome. Use it to quickly switch between open tabs, open websites, search your browsing history, run a web search with your default Chrome search engine, or search directly inside supported sites.

## How To Use

Press cmd/ctrl + shift + K to show or hide the command bar.

For the best experience, we recommend customizing the shortcut to cmd/ctrl + T so that the command bar replaces Chrome's default new tab page. You can do this on Chrome's extension keyboard shortcuts page (`chrome://extensions/shortcuts`).

Once you open the command bar, start typing, then choose a result with the keyboard or mouse. Matching open tabs are prioritized so you can jump back to work you already have open, while URL and search actions make it easy to navigate somewhere new without reaching for the address bar.

Arc Command Bar also includes built-in site search shortcuts for YouTube, Amazon, Wikipedia, X, and Spotify. Type the name of a supported site, press Tab, enter your search, then press Enter to open results for that site.

## Privacy

Arc Command Bar doesn't collect or transmit any data. Tab, history, and favicon data stays on your device and is only used to show results. The command bar runs in an isolated extension frame, so websites can't read its contents or what you type into it. See [PRIVACY.md](PRIVACY.md) for the full privacy policy.

## Packaging For The Chrome Web Store

Run this command to build the zip file to upload to the Chrome Web Store:

```bash
./scripts/package-extension.sh
```

The zip is written to `dist/` and contains only the files the extension needs at runtime. [STORE-LISTING.md](STORE-LISTING.md) has the permission justifications and other text for the store submission form. The source SVGs for the extension icons are in `icons/source/`.
