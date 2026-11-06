## Why

The project needs a reliable way to turn a paused YouTube wrestling moment into a local capture with structured metadata, without introducing a backend or coupling the extension to the main Name That Match application. This change defines the minimal Manifest V3 extension MVP for standard YouTube watch pages only, with explicit safety checks for playback state, direct frame capture reliability, and file-pair integrity.

## What Changes

- Add a standalone Chrome extension for capturing moments from standard YouTube watch pages only.
- Support a minimal popup UI and a configurable Chrome extension command, both of which invoke the same underlying capture operation.
- Require a paused video and a valid active media element before capture proceeds.
- Read source metadata from the active YouTube page: platform, video ID, canonical URL, optional title, and playback timestamp in seconds.
- Capture the current frame directly from the active `HTMLVideoElement` into a canvas and reject any capture that cannot be safely rendered without bypassing browser protections.
- Save each screenshot as a PNG in `Downloads/NameThatMatch/<videoId>/` with one matching JSON metadata sidecar per screenshot.
- Use a unique capture ID to pair image and metadata, allow repeated captures including identical playback timestamps, and keep the workflow local-first without a queue or manifest.
- Provide explicit success and failure feedback without silently falling back to full-page screenshots or bypassing browser protections.
- Keep the extension independently buildable, lightweight, and compatible with the project’s strict TypeScript and Chrome-only constraints.
- Explicitly exclude automatic cropping, sharpening, upscaling, and image enhancement from the MVP.

## Capabilities

### New Capabilities
- `youtube-screenshot-capture`: Defines the extension behavior for capturing a paused YouTube frame on supported watch pages, collecting source metadata, and storing a PNG plus a versioned JSON sidecar pair for local import.

### Modified Capabilities
- None.

## Impact

- Adds a new browser-extension capability with no direct integration into the main Name That Match game.
- Introduces a strict metadata contract and file naming convention for future import flows.
- Requires only the minimal Manifest V3 permissions needed for YouTube metadata reads, keyboard commands, local downloads, and extension state.
- Keeps the architecture intentionally narrow: standard YouTube watch pages only, no Shorts, no embedded players, no Music pages, no batch manifest, and no persistent capture queue.
- Maintains compatibility with older Intel-based Macs running supported Chrome builds while avoiding direct bypass of YouTube protections or browser security boundaries.
- Reinforces the approved direct canvas capture strategy and rejects obsolete visible-tab crop assumptions.
