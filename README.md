# Smart Suspender - Chrome Extension

A lightweight Chrome extension that suspends inactive tabs to save memory, inspired by The Great Suspender but with simplified logic and modern APIs.

## Features

-   🌙 **Tab Suspension**: Suspend tabs to free up memory
-   ⌨️ **Keyboard Shortcuts**: Quick access with customizable shortcuts
-   🎨 **Beautiful UI**: Modern, responsive interface with Tailwind CSS
-   📊 **Statistics**: Track suspended tabs and memory savings
-   ⚙️ **Customizable Settings**: Configure auto-suspend and ignore rules
-   🔒 **Privacy-Focused**: No tracking, all data stored locally

## Keyboard Shortcuts

-   `Ctrl+Shift+S` - Suspend current tab
-   `Ctrl+Shift+A` - Suspend all other tabs
-   `Ctrl+Shift+U` - Restore all suspended tabs

## Installation

### Install from Source (Developer Mode)

1. **Download the Extension**

    - Clone or download this repository
    - Extract to your preferred location

2. **Enable Developer Mode**

    - Open Chrome and navigate to `chrome://extensions/`
    - Enable "Developer mode" in the top-right corner

3. **Load the Extension**

    - Click "Load unpacked" in the top-left
    - Select the `suspender` folder
    - The extension should now appear in your extensions list

4. **Pin the Extension** (Optional)
    - Click the puzzle piece icon in Chrome's toolbar
    - Pin "Tab Suspender" for easy access

## Usage

### Manual Suspension

1. **Single Tab**: Click the extension icon and select "Suspend Current Tab"
2. **Multiple Tabs**: Use "Suspend All Other Tabs" to suspend everything except the active tab
3. **Restore**: Click "Restore All Tabs" or simply click on a suspended tab

### Automatic Suspension

1. Open the extension options (right-click extension icon → Options)
2. Enable "Auto Suspend" and set your preferred time
3. Configure ignore rules for pinned tabs, audio tabs, or tabs with forms

### Restoring Suspended Tabs

Suspended tabs show a beautiful sleep-themed page. To restore:

-   Click anywhere on the suspended page
-   Click the "Restore Tab" button
-   Press Space or Enter
-   Use the "Restore All Tabs" option in the popup

## Settings

Access settings by right-clicking the extension icon and selecting "Options":

-   **Auto Suspend**: Automatically suspend tabs after inactivity
-   **Ignore Rules**: Skip suspension for pinned tabs, audio tabs, or tabs with forms
-   **Statistics**: View suspended tab count and estimated memory saved

## Technical Details

### Architecture

-   **Manifest V3**: Uses the latest Chrome extension APIs
-   **Service Worker**: Background script for tab management
-   **Content Scripts**: Monitor form interactions and user activity
-   **Local Storage**: All data stored locally using Chrome's storage API

### File Structure

```
suspender/
├── manifest.json          # Extension configuration
├── background.js          # Service worker for tab management
├── popup.html/js          # Extension popup interface
├── options.html/js        # Settings page
├── suspended.html         # Suspended tab page
├── content.js             # Content script for page monitoring
└── icons/                 # Extension icons
```

### Storage

The extension uses Chrome's local storage API to store:

-   Suspended tab data (URL, title, favicon)
-   User settings and preferences
-   No data is sent to external servers

## Privacy

-   **No Tracking**: Zero analytics or data collection
-   **Local Storage**: All data stays on your device
-   **No Network Requests**: Extension works entirely offline
-   **Open Source**: Full source code available for review

## Browser Compatibility

-   **Chrome**: Fully supported (Manifest V3)
-   **Edge**: Should work (Chromium-based)
-   **Other Browsers**: Not tested

## Differences from The Great Suspender

-   **Simplified Logic**: Focused on core suspension functionality
-   **Modern APIs**: Uses Manifest V3 and latest Chrome APIs
-   **Privacy First**: No analytics or tracking code
-   **Cleaner UI**: Modern design with Tailwind CSS
-   **Better Performance**: Optimized for speed and memory usage

## Troubleshooting

### Extension Not Working

1. Check that Developer Mode is enabled
2. Reload the extension in `chrome://extensions/`
3. Check browser console for errors

### Tabs Not Suspending

1. Verify the tab isn't pinned (if ignore pinned is enabled)
2. Check if the tab has audio playing
3. Ensure the tab isn't a chrome:// URL (these can't be suspended)

### Keyboard Shortcuts Not Working

1. Go to `chrome://extensions/shortcuts`
2. Check if shortcuts are properly assigned
3. Resolve any conflicts with other extensions

## Development

### Building the Extension

1. No build process required - it's pure HTML/CSS/JS
2. For production, you might want to:
    - Minify JavaScript files
    - Optimize images
    - Create proper PNG icons from the SVG sources

### Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

For internal architecture & API reference see `DEVELOPERS.md`.

## License

MIT License - see LICENSE file for details

## Credits

-   Inspired by [The Great Suspender](https://github.com/aciidic/thegreatsuspender-notrack)
-   UI styled with [Tailwind CSS](https://tailwindcss.com/)
-   Icons use SVG graphics with gradient backgrounds

---

**Note**: This extension is not affiliated with The Great Suspender project. It's an independent implementation with simplified functionality and modern APIs.
