## Context

This change creates the initial architecture for a standalone, local-first Chrome extension. The repository currently contains only project-level intent and OpenSpec scaffolding; no implementation exists yet. The design must satisfy a greenfield extension requirement while preserving the project’s constraints: strict TypeScript, minimal dependencies, no cloud backend, no React or Tailwind, no database, no direct coupling to the main game app, and no bypass of YouTube security restrictions.

The approved scope is intentionally narrow: standard YouTube watch pages only, local file output under `Downloads/NameThatMatch/<videoId>/`, no persistent queue, and no batch review workflow.

## Goals / Non-Goals

**Goals:**
- Capture a paused YouTube frame from a supported watch page using Chrome’s supported extension APIs.
- Require a measurable, fully visible video region before a capture is accepted.
- Record source metadata and pair it with the saved image file using a stable capture ID.
- Save PNG and JSON sidecar files locally under a dedicated folder per video ID.
- Support both a toolbar action and a configurable Chrome command using the same underlying capture operation.
- Provide explicit success and failure feedback and never silently save a full-tab screenshot.

**Non-Goals:**
- Shorts, embedded players, or YouTube Music support in the MVP.
- Full-screen capture automation.
- Batch review or manifest-based import UI.
- Advanced duplicate detection or hashing.
- Persistent queue management or background collection jobs.
- A database or cloud sync.
- Downloading YouTube videos or bypassing DRM or browser protections.
- Wrestler/event/promotion metadata in the capture extension.

## Decisions

### 1. Manifest V3 extension with a minimal popup and extensible command registration

The extension will use a standard Manifest V3 design with a toolbar action and a configurable Chrome command. The popup and the keyboard command share the same underlying capture operation so the user experience is consistent regardless of trigger.

**Why this approach**
- Keeps the extension lightweight and easy to maintain without React or a larger UI system.
- Fits the extension lifecycle and security models expected by Chrome.
- Allows a minimal UI while keeping the capture workflow accessible and keyboard-driven.

**Alternatives considered**
- In-page capture controls inside YouTube: rejected because it couples the solution to YouTube DOM layout and user interface churn.
- Full framework UI stack: rejected because it adds unnecessary dependency overhead for a minimal extension.

### 2. Content script owns page-state extraction; service worker owns orchestration

A content script runs on supported YouTube watch pages and reads the current video ID, canonical URL, title, playback timestamp, and visible player bounding rectangle. It validates the page state and returns structured data to the extension runtime. A background service worker receives the request, validates the message contract, and orchestrates the capture and save steps.

**Why this approach**
- Keeps page-specific logic in the page context and avoids coupling the UI to YouTube internals.
- Keeps the service worker responsible for lifecycle and orchestration, not for direct DOM access.
- Allows a clean separation between metadata discovery, capture, and persistence.

**Alternatives considered**
- Putting all logic in the popup: rejected because it would blur page-state validation and lifecycle concerns.
- Direct DOM access from the service worker: rejected because service workers do not own page DOM and this would increase fragility.

### 3. Visible-tab capture is the default API, with strict crop validation

The extension captures the active tab image using Chrome’s supported visible-tab capture API and then crops that image to the detected video rectangle. The crop must be validated: the video must be paused, fully visible in the viewport, and measured from a valid rectangle before the operation proceeds.

**Why this approach**
- Direct canvas capture of a cross-origin YouTube frame is not a reliable or supported path for the extension MVP.
- CaptureVisibleTab is the safest supported mechanism for local, user-initiated screenshots.
- The project explicitly requires failing on unreliable player detection instead of silently saving a full-tab screenshot.

**Alternatives considered**
- Direct element capture from the HTML video tag: rejected due to YouTube’s browser security boundary and the fact that the visible tab capture is the supported path.
- Full-tab capture as a hidden fallback: rejected to remain aligned with product constraints and screenshot quality.

### 4. Crop and scaling contract must be driven by actual viewport and image geometry

The crop algorithm must calculate from actual image dimensions and viewport dimensions, not from assumed device pixel ratio or fixed multipliers. Browser zoom, Retina scaling, and letterboxing must be normalized using measured values so the video rectangle can be mapped from page coordinates into captured-image coordinates without distorting the displayed aspect ratio.

**Why this approach**
- Avoids brittle assumptions on DPR and zoom behavior.
- Makes the implementation more reliable on older Intel-based Macs and different Chrome scale settings.
- Preserves the displayed video proportions while including any letterboxing inside the rendered player region.

**Alternatives considered**
- Hardcoded DPR assumptions: rejected because Retina and browser zoom vary and are not reliable across user setups.
- Cropping using a fixed aspect ratio without measured geometry: rejected because it can distort or cut off the player.

### 5. Local file storage via the Downloads API and a strict file-pair contract

The extension will save each PNG and matching JSON sidecar using the Chrome Downloads API under `Downloads/NameThatMatch/<videoId>/`. Each screenshot will have a unique capture ID that is used in both image and metadata filenames. The image and JSON file are considered paired only when the same capture ID is used in both file names and the metadata field values are consistent.

**Why this approach**
- Keeps the output local-first, simple, and importable.
- Avoids unnecessary database logic or a cloud backend.
- Allows repeated captures, including identical playback timestamps, without introducing a queue or manifest.

**Alternatives considered**
- IndexedDB or a formal batch manifest: rejected as out of scope for the MVP and unnecessary for this product.
- Saving file pairs outside a dedicated video folder: rejected because it reduces importability and file organization.

### 6. Metadata validation and error contracts are required before any success message is emitted

Every capture lifecycle must validate required fields before the UX reports a successful save. A screenshot is not considered successful until both the PNG and JSON metadata sidecar have been confirmed saved. If either save fails, the operation must be reported as failed and must not be claimed as successful.

**Why this approach**
- Reduces broken file pairs and invalid import states.
- Allows a visible contract for retries and error recovery.
- Avoids silent partial-save states that are difficult to debug later.

**Alternatives considered**
- Reporting success once the screenshot is downloaded but before the JSON save completes: rejected because it violates the file-pair contract and creates broken capture records.

## Architecture and Message Contracts

### Components and responsibilities

- Popup / toolbar UI
  - Shows minimal controls, status, and error messages.
  - Starts the capture flow when the user clicks or presses the shortcut trigger.
  - Does not directly inspect page DOM; it delegates to the content script and service worker.

- Content script
  - Detects supported YouTube watch pages only.
  - Reads the video ID, canonical URL, title, playback timestamp, and visible video rectangle.
  - Validates the paused state and viewport visibility before sending data upward.
  - Rejects unsupported pages and protected or restricted content by returning an error result.

- Background service worker
  - Receives capture requests from the popup or command handler.
  - Validates message contracts and request IDs.
  - Coordinates with the capture/crop module and the download + metadata module.
  - Owns lifecycle handling and error reporting.

- Capture and crop module
  - Uses Chrome’s supported visible-tab capture API.
  - Maps viewport coordinates to captured image coordinates using actual image size and viewport size.
  - Validates crop bounds and rejects invalid or unreliable crop operations.

- Download and metadata module
  - Builds the output file name, directory, and metadata payload.
  - Saves the PNG and JSON sidecar.
  - Confirms both files exist and pairs them through a shared capture ID.

### Message contract

Request:
- requestId: string
- type: "capture-request"
- tabId: number
- platform: "youtube"
- pageUrl: string
- trigger: "toolbar" | "command"

Response states:
- success
- unsupported-page
- video-not-paused
- missing-player-region
- invalid-crop
- download-failed
- metadata-failed
- protected-content
- capture-aborted

The request ID is required for correlation, and every response must include a result code plus a user-visible message.

## Permissions

Required permissions:
- activeTab: needed so the extension can capture the current tab only when the user initiates the action.
- downloads: needed to save the PNG and JSON metadata sidecar to the user’s machine.
- storage: needed only if extension state or last-run metadata is kept in local storage; it is not required for the core save process and should be used minimally.
- scripting: needed to inject a minimal content script on supported YouTube pages.
- commands: needed to register a configurable Chrome command keyboard shortcut.

Host permissions:
- narrow host access only to `https://www.youtube.com/watch` and equivalent watch-page patterns sufficient for the MVP.
- no broader host access is required for the design.

Not required:
- broad `<all_urls>` permission,
- persistent content access beyond user-triggered tabs,
- database or cloud API permissions,
- media bypass or DRM-related access.

## Risks / Trade-offs

- [YouTube layout instability] → Mitigation: rely on measured bounding boxes and reject a capture when the video region cannot be proven reliable.
- [Browser zoom and Retina scaling] → Mitigation: compute crop geometry from the captured image and viewport dimensions instead of assuming a fixed DPR.
- [Player controls and overlays] → Mitigation: the extension must not attempt to remove overlays; it must either crop to the video rectangle or fail clearly when the player is not fully measurable.
- [Service worker lifecycle interruptions] → Mitigation: the service worker must be stateless, correlate requests by requestId, and fail gracefully if the active tab changes or the capture is interrupted.
- [Partial file pairs] → Mitigation: success is only reported after both files are confirmed saved; partial pairs are treated as failures and are recoverable by re-running the capture.
- [Compatibility with older Intel Macs] → Mitigation: avoid heavy UI frameworks and keep the capture path efficient and synchronous where possible.
- [Protected or restricted content] → Mitigation: the extension must stop without bypassing browser restrictions and must show a clear policy-safe error.

## Migration Plan

This is a greenfield project, so no migration is needed. The design intentionally creates an isolated extension repository and a local file protocol that can be imported by a future Match Library without direct coupling to that application.

## Open Questions

- Final default shortcut mapping and how conflicts are handled when a Chrome extension command already exists.
- Whether the extension should expose a user-facing setting for a custom capture directory as a future enhancement rather than in the MVP.
- Whether YouTube watch pages with non-standard player layouts or browser zoom > 100% require an explicit tolerance policy or outright rejection.

These are acceptable as deferrable product decisions because they do not change the MVP capture contract or the rejection policy for unreliable crops.
