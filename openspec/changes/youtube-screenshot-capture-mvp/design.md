## Context

This change defines the approved architecture for a standalone, local-first Chrome extension that captures paused YouTube wrestling frames without coupling to the main Name That Match application. The implementation and manual browser validation show that the reliable primary strategy is direct capture from the active `HTMLVideoElement` into a canvas, preserving the video’s original frame content and source resolution while avoiding full-page or visible-tab screenshots.

The approved scope remains intentionally narrow: standard YouTube watch pages only, local file output under `Downloads/NameThatMatch/<videoId>/`, no persistent queue, and no batch review workflow.

## Goals / Non-Goals

**Goals:**
- Capture a paused YouTube frame from a supported watch page using the active video element as the source of truth.
- Preserve source aspect ratio and source resolution where supported, without altering the frame through enhancement steps.
- Record source metadata and pair it with the saved image file using a stable capture ID.
- Save PNG and JSON sidecar files locally under a dedicated folder per video ID.
- Support both a toolbar action and a configurable Chrome command using the same underlying capture operation.
- Provide explicit success and failure feedback and never silently save a full-page or full-tab screenshot.

**Non-Goals:**
- Shorts, embedded players, or YouTube Music support in the MVP.
- Full-screen capture automation.
- Batch review or manifest-based import UI.
- Advanced duplicate detection or hashing.
- Persistent queue management or background collection jobs.
- A database or cloud sync.
- Downloading YouTube videos or bypassing DRM or browser protections.
- Wrestler/event/promotion metadata in the capture extension.
- Automatic cropping, sharpening, upscaling, or any image enhancement.

## Decisions

### 1. Manifest V3 extension with a minimal popup and extensible command registration

The extension uses a standard Manifest V3 design with a toolbar action and a configurable Chrome command. The popup and the keyboard command share the same underlying capture operation so the user experience is consistent regardless of trigger.

**Why this approach**
- Keeps the extension lightweight and easy to maintain without React or a larger UI system.
- Fits the extension lifecycle and security models expected by Chrome.
- Allows a minimal UI while keeping the capture workflow accessible and keyboard-driven.

**Alternatives considered**
- In-page capture controls inside YouTube: rejected because it couples the solution to YouTube DOM layout and user interface churn.
- Full framework UI stack: rejected because it adds unnecessary dependency overhead for a minimal extension.

### 2. Content script owns page-state extraction; service worker owns orchestration

A content script runs on supported YouTube watch pages and reads the current video ID, canonical URL, title, playback timestamp, and the active video element state. It validates the page state and returns structured data to the extension runtime. A background service worker receives the request, validates the message contract, and orchestrates the capture and save steps.

**Why this approach**
- Keeps page-specific logic in the page context and avoids coupling the UI to YouTube internals.
- Keeps the service worker responsible for lifecycle and orchestration, not for direct DOM access.
- Allows a clean separation between metadata discovery, frame capture, and persistence.

**Alternatives considered**
- Putting all logic in the popup: rejected because it would blur page-state validation and lifecycle concerns.
- Direct DOM access from the service worker: rejected because service workers do not own page DOM and this would increase fragility.

### 3. Direct video-element-to-canvas capture is the approved primary capture strategy

The extension captures the current frame by reading the active `HTMLVideoElement` and drawing it to an offscreen canvas using `drawImage(video, ...)`. This is the primary long-term strategy and is the path proven by manual browser validation on both modern widescreen wrestling footage and older 4:3 footage. The capture is accepted only when the page is a supported watch page, the media element is present, and the video is paused.

**Why this approach**
- It targets the actual source frame instead of the browser viewport and avoids copying unrelated page UI into the image.
- It preserves the video’s intrinsic aspect ratio and source resolution where the browser exposes that information.
- It is compatible with the product requirement to capture a clean frame without YouTube controls or browser chrome.
- It is consistent with the extension’s security boundaries and does not rely on hidden full-page capture or viewport cropping.

**Alternatives considered**
- Visible-tab capture with a manual crop: rejected after validation because it could include the surrounding page and is less reliable for real YouTube player layouts.
- Hidden full-page screenshot fallback: rejected because it stores unrelated UI and violates the screenshot purity requirement.
- Direct image enhancement or post-processing: rejected because the MVP must not sharpen, upscale, crop, or otherwise alter the source frame.

### 4. Frame extraction must preserve intrinsic source geometry and avoid enhancement

The capture algorithm must preserve the original video aspect ratio and source resolution where supported. The extension must render the current frame from the live `video` element onto a canvas without changing image size, without automatic cropping, and without any sharpening, upscaling, or visual enhancement.

**Why this approach**
- Preserves the match moment faithfully for later analysis and import.
- Keeps the MVP deterministic and easy to reason about.
- Avoids hidden diffs in stored frames that would be difficult to explain or audit.

**Alternatives considered**
- Fixed-size resizing to a target dimension: rejected because it changes the image’s source information.
- Auto-cropping to the ring or a guessed region: rejected because this is not in scope for the MVP and can remove legitimate content.
- Post-processing filters: rejected because they are not required and may distort the frame.

### 5. Local file storage via the Downloads API and a strict file-pair contract

The extension saves each PNG and matching JSON sidecar using the Chrome Downloads API under `Downloads/NameThatMatch/<videoId>/`. Each screenshot has a unique capture ID that is used in both image and metadata filenames. The image and JSON file are considered paired only when the same capture ID is used in both file names and the metadata field values are consistent.

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
  - Reads the video ID, canonical URL, title, playback timestamp, and the active media element state.
  - Validates the paused state and media availability before sending data upward.
  - Rejects unsupported pages and protected or restricted content by returning an error result.

- Background service worker
  - Receives capture requests from the popup or command handler.
  - Validates message contracts and request IDs.
  - Coordinates with the capture module and the download + metadata module.
  - Owns lifecycle handling and error reporting.

- Capture module
  - Reads the active `HTMLVideoElement` from the page and renders its current image into a canvas using the browser-supported DOM API.
  - Preserves the video’s source geometry and avoids enhancement or automatic trim.
  - Rejects invalid frames, tainted canvas situations, missing media elements, and protection-related errors.

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
- missing-video-element
- invalid-video-state
- capture-failed
- tainted-canvas
- protected-content
- download-failed
- metadata-failed
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

- [Cross-origin or protected content] → Mitigation: reject the capture when the media or browser environment prevents a safe frame render, and report a clear error without bypassing security restrictions.
- [Canvas tainting] → Mitigation: fail clearly for unrenderable or tainted canvases; do not attempt to circumvent browser security boundaries.
- [Missing or inconsistent media element state] → Mitigation: validate the presence of a paused `video` element before accepting the capture.
- [Player controls or overlays] → Mitigation: because the source frame comes from the media element itself, the extension should not rely on removing UI overlays; any unsupported or non-renderable source must fail explicitly.
- [Service worker lifecycle interruptions] → Mitigation: the service worker must be stateless, correlate requests by requestId, and fail gracefully if the active tab changes or the capture is interrupted.
- [Partial file pairs] → Mitigation: success is only reported after both files are confirmed saved; partial pairs are treated as failures and are recoverable by re-running the capture.
- [Compatibility with older Intel Macs] → Mitigation: avoid heavy UI frameworks and keep the capture path efficient and synchronous where possible.
- [Protected or restricted content] → Mitigation: the extension must stop without bypassing browser restrictions and must show a clear policy-safe error.

## Migration Plan

This is a greenfield project, so no migration is needed. The design intentionally creates an isolated extension repository and a local file protocol that can be imported by a future Match Library without direct coupling to that application.

## Open Questions

- Final default shortcut mapping and how conflicts are handled when a Chrome extension command already exists.
- Whether the extension should expose a user-facing setting for a custom capture directory as a future enhancement rather than in the MVP.
- Whether any future page-specific or browser-specific media layout exceptions need explicit error handling as part of continued verification.

These are acceptable as deferrable product decisions because they do not change the MVP capture contract, the security constraints, or the requirement to preserve the source frame without enhancement.
