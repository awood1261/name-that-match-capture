# Name That Match Capture

A lightweight Chrome extension for capturing paused YouTube frames and saving them locally with matching JSON metadata for use in Name That Match workflows.

## Project purpose

This project creates a local-first tool for capturing still frames from standard YouTube watch pages without a backend, cloud sync, or browser UI capture. The extension is intended for private use in collecting wrestling footage screenshots and their source metadata.

## Supported environment

- Chrome Manifest V3
- Standard YouTube watch pages only
- macOS Monterey 12.7.6 and later-compatible Chrome builds
- Intel MacBook Pro development environment
- Local file output only

Unsupported in the MVP:

- YouTube Shorts
- Embedded players
- YouTube Music or non-watch pages
- Any workflow that bypasses browser security protections
- Any cloud-based storage or analytics

## Architecture

The final approved architecture uses the active YouTube media element as the source of truth. The extension validates that the page is a supported watch page, confirms the video is paused, captures the active frame directly into a canvas, and saves:

- a PNG screenshot
- a matching JSON metadata file

Both files share the same capture ID and are placed under:

- Downloads/NameThatMatch/<videoId>/

## Development setup

Requirements:

- Node.js 20.19.6 or compatible npm 10.x
- Google Chrome with extension developer mode enabled
- macOS or another supported desktop OS for local testing

Install dependencies:

```bash
npm install
```

Run checks:

```bash
npm test
npm run typecheck
npm run build
```

OpenSpec validation:

```bash
npx openspec validate youtube-screenshot-capture-mvp --type change --no-interactive
```

## Load the unpacked extension in Chrome

1. Open Chrome.
2. Visit chrome://extensions.
3. Enable Developer mode.
4. Choose Load unpacked.
5. Select the project folder containing the built extension output or the source project if the build has already been generated.
6. Confirm the extension loads without errors.

## How to capture a screenshot

1. Open a standard YouTube watch page.
2. Pause the video.
3. Click the extension action button or use the keyboard shortcut.
4. The extension captures the current frame from the active video element and saves it locally.
5. It reports success only after both the PNG and JSON files have been saved successfully.

## Keyboard shortcut

- macOS: Command+Ctrl+Y
- Windows/Linux: Ctrl+Shift+Y

The default binding intentionally avoids Command+Shift+Y because that shortcut is often consumed by system or screen-capture utilities such as Screeny.

If needed, users can customize the shortcut in Chrome at:

- chrome://extensions/shortcuts

## Save location and file pair behavior

Each saved capture is stored in a video-specific folder:

- Downloads/NameThatMatch/<videoId>/

The saved files are named with the same capture ID stem, for example:

- 20261105T153025Z-5f4c8c87a1.png
- 20261105T153025Z-5f4c8c87a1.json

The extension generates a new capture ID for each capture, even if the video and timestamp match an earlier save.

## Privacy and local-only behavior

- No cloud services are used.
- No telemetry or analytics are collected by the extension.
- No database, queue, or internet-based sync is required.
- Files are saved only to the user’s local Downloads directory.
- The extension does not bypass DRM, access restrictions, or browser security boundaries.

## Known limitations

- Only standard YouTube watch pages are supported.
- Video capture is rejected unless the player is paused.
- The extension cannot capture protected or restricted media content.
- If the tab changes or the video is unavailable, the capture fails safely.
- A partial PNG/JSON pair is treated as a failure and is not reported as success.

## Troubleshooting

Common issues:

- Capture fails because the page is not a standard watch page.
  - Open a normal YouTube watch URL with a valid video ID.
- Capture fails with “Pause the video before triggering a capture.”
  - Pause the video and retry.
- Capture hangs or the page is not ready.
  - Reload the tab and try again.
- PNG or metadata file did not download.
  - Check Chrome download permissions and confirm the default Downloads directory is available.
- The shortcut does not fire.
  - Confirm the extension is enabled and the shortcut was not overridden by another app or Chrome command.

## Maintenance notes

This project intentionally keeps the implementation narrow and reliable:

- no React
- no Tailwind
- no cloud services
- no batch export system
- no persistent queue
- no automatic cropping or enhancement of source video frames

## Content and copyright

Captured wrestling footage may be protected by copyright. Users are responsible for ensuring they have the necessary rights or permissions for the intended use.

The extension does not bypass DRM, access controls, or content restrictions.

## License

Private project. No open-source license has been assigned.