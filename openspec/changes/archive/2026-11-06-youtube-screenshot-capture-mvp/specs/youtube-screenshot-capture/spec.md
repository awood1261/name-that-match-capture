## Purpose

This capability defines the extension behavior for capturing a paused YouTube wrestling moment from a supported watch page, collecting the associated source metadata, and saving a local PNG plus JSON sidecar pair that can be imported into a future Name That Match asset library without coupling the extension to the game application.

## Metadata Contract

The metadata file SHALL be JSON with a versioned root object containing `schemaVersion` and `captureId`.

### Root object

```json
{
  "schemaVersion": 1,
  "captureId": "20261105T153025Z-5f4c8c87a1"
}
```

Required root fields:
- `schemaVersion`: integer, required, MUST be the current supported schema version for the capture extension.
- `captureId`: string, required, MUST be unique for each saved capture and MUST be used in both the PNG and JSON filenames.

### `source` object

Required fields:
- `platform`: string, required, MUST be `youtube`.
- `videoId`: string, required, MUST be the YouTube video ID from the watch URL.
- `canonicalUrl`: string, required, MUST be the canonical `https://www.youtube.com/watch?v=<videoId>` URL or equivalent supported URL pattern.
- `title`: string, optional, MAY be omitted when YouTube title metadata is unavailable.

Example:

```json
"source": {
  "platform": "youtube",
  "videoId": "dQw4w9WgXcQ",
  "canonicalUrl": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "title": "Example wrestling footage"
}
```

### `capture` object

Required fields:
- `playbackSeconds`: number, required, MUST be a finite numeric value representing the playback position at capture time.
- `capturedAt`: string, required, MUST use ISO 8601 UTC format, e.g. `2026-11-05T15:30:25.000Z`.
- `method`: string, required, MUST be `video-frame-capture` or `video-frame-capture-fallback` only if the approved fallback is explicitly enabled in implementation.

Example:

```json
"capture": {
  "playbackSeconds": 482.25,
  "capturedAt": "2026-11-05T15:30:25.000Z",
  "method": "video-frame-capture"
}
```

### `image` object

Required fields:
- `filename`: string, required, MUST be the PNG file name, using the capture ID and a `.png` suffix.
- `width`: integer, required, MUST be the pixel width of the saved PNG.
- `height`: integer, required, MUST be the pixel height of the saved PNG.
- `format`: string, required, MUST be `png`.

Example:

```json
"image": {
  "filename": "20261105T153025Z-5f4c8c87a1.png",
  "width": 1280,
  "height": 720,
  "format": "png"
}
```

### Validation rules

- `schemaVersion` MUST be a positive integer and MUST be validated before any success message is displayed.
- `captureId` MUST be unique within the output directory and MUST be reused consistently across the PNG and JSON file names.
- `playbackSeconds` MUST be finite and non-negative. Values with NaN or Infinity are invalid.
- `capturedAt` MUST be a valid ISO 8601 UTC timestamp and MUST be written in UTC.
- `filename` MUST match the saved PNG name exactly, including extension.
- `width` and `height` MUST be positive integers greater than zero.
- `canonicalUrl` MUST be a valid URL string and MUST match the active watch page URL pattern for standard YouTube watch pages.
- `title` MUST be omitted or a string; it MUST NOT be numeric or structurally malformed.
- The JSON sidecar MUST be written only after the PNG save is confirmed and MUST be rejected if a required field is absent or malformed.

### Filename and pairing requirements

- The PNG file and JSON sidecar MUST be saved under `Downloads/NameThatMatch/<videoId>/`.
- The file names MUST share the same capture ID prefix.
- Example pair:
  - `Downloads/NameThatMatch/dQw4w9WgXcQ/20261105T153025Z-5f4c8c87a1.png`
  - `Downloads/NameThatMatch/dQw4w9WgXcQ/20261105T153025Z-5f4c8c87a1.json`
- The capture ID MUST be unique for each screenshot, including repeated captures from the same video and repeated identical playback timestamps.
- The extension MUST NOT implement advanced duplicate detection in the MVP.

### Valid and invalid examples

Valid example:

```json
{
  "schemaVersion": 1,
  "captureId": "20261105T153025Z-5f4c8c87a1",
  "source": {
    "platform": "youtube",
    "videoId": "dQw4w9WgXcQ",
    "canonicalUrl": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "title": "Example wrestling footage"
  },
  "capture": {
    "playbackSeconds": 482.25,
    "capturedAt": "2026-11-05T15:30:25.000Z",
    "method": "video-frame-capture"
  },
  "image": {
    "filename": "20261105T153025Z-5f4c8c87a1.png",
    "width": 1280,
    "height": 720,
    "format": "png"
  }
}
```

Invalid example:

```json
{
  "schemaVersion": 1,
  "captureId": "",
  "source": {
    "platform": "youtube",
    "videoId": "",
    "canonicalUrl": "not-a-url",
    "title": 42
  },
  "capture": {
    "playbackSeconds": NaN,
    "capturedAt": "not-a-date",
    "method": "video-frame-capture"
  },
  "image": {
    "filename": "capture.png",
    "width": 0,
    "height": 720,
    "format": "jpg"
  }
}
```

## ADDED Requirements

### Requirement: Capture a paused YouTube frame from a supported watch page
The extension MUST allow a user to trigger a capture from a supported YouTube watch page while the video is paused at a desired moment. The capture workflow MUST read the active tab URL and the current playhead state, and it MUST reject or fail clearly when the page is not a supported watch page or when the video is still playing.

#### Scenario: Capture from a standard watch page
- **WHEN** a user opens a supported `youtube.com/watch` page and pauses at a meaningful moment
- **THEN** the extension SHALL allow capture from the toolbar or keyboard shortcut and SHALL collect the active tab state needed for metadata and image capture

#### Scenario: Capture request from an unsupported page
- **WHEN** a user triggers capture while the active tab is not a supported YouTube watch page
- **THEN** the extension SHALL show a clear error message and SHALL NOT continue with a capture flow

#### Scenario: Video is still playing
- **WHEN** the user triggers capture while the YouTube video is still playing
- **THEN** the extension SHALL reject the request and SHALL require the user to pause before retrying

### Requirement: Directly render the current video frame to a canvas
The extension MUST locate the active `HTMLVideoElement` on a supported YouTube watch page and render the current frame into a canvas using a browser-supported DOM API. A capture MUST be rejected when the video media element is missing, not paused, unavailable, or cannot be rendered into a safe canvas without violating browser security boundaries.

#### Scenario: Valid direct frame extraction
- **WHEN** the YouTube video element is present, paused, and renderable in the page context
- **THEN** the extension SHALL draw the current frame to a canvas and continue with the save flow

#### Scenario: Missing or invalid video element state
- **WHEN** the video element cannot be found or cannot be rendered into a canvas safely
- **THEN** the extension SHALL fail the capture and SHALL NOT silently save a full-page or full-tab screenshot

#### Scenario: Browser security restriction or tainted canvas
- **WHEN** a browser security boundary prevents safe canvas rendering from the media element
- **THEN** the extension SHALL fail with a clear error and SHALL NOT bypass protections or attempt to bypass DRM or cross-origin restrictions

### Requirement: Preserve source geometry and avoid enhancement
The extension MUST preserve the original frame geometry and source resolution where supported. The direct canvas capture MUST NOT apply automatic cropping, sharpening, upscaling, or any other image enhancement, and MUST preserve the original aspect ratio of the source frame.

#### Scenario: Source aspect ratio is preserved
- **WHEN** the active video is presented in standard widescreen or older 4:3 format
- **THEN** the extension SHALL save the frame without resizing or altering the original display proportions beyond the source resolution exposed by the browser

#### Scenario: Enhancement is explicitly excluded
- **WHEN** a capture would require automatic crop, sharpen, or upscale logic
- **THEN** the extension SHALL reject the enhancement request and SHALL preserve the source frame as captured

### Requirement: Collect and validate source metadata
The extension MUST collect the YouTube video ID, canonical URL, source title when available, playback timestamp in seconds, and capture timestamp in UTC. The metadata MUST be validated at runtime before saving so required fields and value formats are verified.

#### Scenario: Valid metadata capture
- **WHEN** the extension reads a supported YouTube page with a valid video ID and playback position
- **THEN** it SHALL record the video ID, canonical URL, title, timestamp, and capture time as structured metadata

#### Scenario: Invalid or incomplete metadata
- **WHEN** the extension cannot determine a required field such as the video ID or playback timestamp
- **THEN** it SHALL fail the capture flow and SHALL NOT save an incomplete metadata file

### Requirement: Save a paired PNG and JSON sidecar under the video-specific output directory
The extension MUST save a screenshot as a PNG and MUST create a matching JSON metadata sidecar using the same capture ID and the same file prefix. Both files MUST be stored under `Downloads/NameThatMatch/<videoId>/`, and the extension MUST report success only after both files are confirmed saved.

#### Scenario: Successful save with paired output
- **WHEN** a valid capture is created
- **THEN** the extension SHALL save the PNG and metadata JSON to the same video-specific folder using the same capture ID and SHALL confirm both files exist before reporting success

#### Scenario: Partial file pair
- **WHEN** the PNG is saved but the JSON sidecar is missing or invalid, or vice versa
- **THEN** the extension SHALL treat the capture as failed and SHALL surface a clear error without claiming success

### Requirement: Allow repeated captures without a persistent queue
The extension MUST support repeated captures from the same YouTube video in a single session, including repeated identical playback timestamps, without requiring the extension to be restarted or without implementing a persistent queue or batch manifest.

#### Scenario: Repeated capture from the same video
- **WHEN** a user captures multiple moments from the same YouTube video in one session
- **THEN** the extension SHALL save each screenshot as a distinct file pair while preserving the source video grouping and without requiring a reload of the extension

#### Scenario: Repeated identical playback timestamp
- **WHEN** the user captures the same playback position more than once
- **THEN** the extension SHALL still save a new file pair using a unique capture ID and SHALL NOT reject the action under the MVP rules

### Requirement: Enforce safety and compatibility constraints
The extension MUST respect the MVP constraints: standard YouTube watch pages only, no Shorts or embedded players, no YouTube Music, no DRM bypass, no downloaded video content, no database, no cloud backend, and no silent fallback to full-page screenshots when the media frame cannot be safely rendered.

#### Scenario: Restricted or unsupported content
- **WHEN** YouTube content is protected, restricted, or otherwise not available to the browser extension for direct frame capture
- **THEN** the extension SHALL stop without bypassing browser or DRM protections and SHALL show a clear user-facing error

#### Scenario: Unsupported page type
- **WHEN** the user attempts the action on a non-supported page such as Shorts, embedded player pages, or YouTube Music
- **THEN** the extension SHALL reject the request and SHALL specify the unsupported page type in the error result

## Notes

This capability intentionally excludes wrestler, event, promotion, challenge difficulty, batch review interfaces, and database-backed storage. It focuses on the local, browser-safe, repeatable capture workflow required for the initial MVP.
