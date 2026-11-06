# youtube-screenshot-capture Specification

## Purpose
This capability defines the extension behavior for capturing a paused YouTube wrestling moment from a supported watch page, collecting the associated source metadata, and saving a local PNG plus JSON sidecar pair that can be imported into a future Name That Match asset library without coupling the extension to the game application.

## Requirements

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
