# Tasks

## 1. Confirm MVP scope and product constraints
- Confirm the approved scope: standard YouTube watch pages only, no Shorts, no embedded players, no YouTube Music, no batch manifest, and no persistent capture queue.
- Confirm the default save directory as `Downloads/NameThatMatch/<videoId>/`.
- Confirm the required metadata fields, file-pairing rules, and explicit failure behavior for unreliable crops.

## 2. Extension bootstrap and Manifest V3 configuration
- Define the extension manifest with a minimal popup, toolbar action, and configurable Chrome command.
- Register the command and document the expected shortcut conflict behavior and the `chrome://extensions/shortcuts` user flow.
- Set the minimal required permissions for YouTube watch-page metadata, active-tab capture, downloads, and command registration.

## 3. UI and command event handling
- Implement the popup trigger and keyboard command trigger using the same underlying capture operation.
- Define a request ID and typed message payload for all capture requests and responses.
- Provide clear success and failure messages without exposing unsupported or protected content flows as silent success.

## 4. Content-script metadata and player detection
- Restrict the content script to standard `youtube.com/watch` pages only.
- Detect the current video ID, canonical URL, optional title, and playback timestamp in seconds.
- Detect the visible video-element rectangle and confirm that the video is paused and fully visible in the viewport.
- Reject unsupported pages, missing video elements, and protected or restricted content with explicit error codes.

## 5. Capture and crop implementation
- Capture the visible tab using Chrome’s supported extension API.
- Determine crop geometry from actual image dimensions and viewport dimensions rather than from a fixed DPR assumption.
- Reject any crop that is missing, invalid, out of bounds, or inconsistent with the visible player region.
- Preserve the rendered video aspect ratio and include letterboxing within the player rectangle when present.
- Do not attempt to remove overlays or to silently save a full-tab screenshot when a reliable crop cannot be confirmed.

## 6. Save workflow and metadata contract
- Generate a unique capture ID for each file pair.
- Create the save directory `Downloads/NameThatMatch/<videoId>/` and write the PNG plus JSON metadata sidecar.
- Ensure both files share the identical capture ID and filename prefix.
- Validate the metadata contract before reporting success.
- Define explicit behavior for duplicate timestamps and repeated captures from the same video.

## 7. Error handling and recovery
- Define failure flows for unsupported page, missing video element, video still playing, invalid or missing playback timestamp, tab navigation during capture, invalid crop bounds, image download failure, metadata write failure, and protected content.
- Ensure a capture is never reported as successful unless both files are confirmed saved.
- Define how partial PNG/JSON pairs are detected and recovered without introducing a persistent capture queue.

## 8. First implementation milestone: capture and crop validation on the MacBook
- Validate screenshot capture and crop logic on the actual MacBook Pro under standard Chrome conditions before implementing the complete metadata export flow.
- Verify correct behavior for normal player mode, 100% browser zoom, alternate browser zoom, and Retina scaling.
- Confirm the user experience for toolbar-triggered and command-triggered capture is consistent and follows the same code path.

## 9. Metadata export and verification
- Validate the JSON metadata contract for required and optional fields, timestamp formatting, and image dimensions.
- Verify file-pair consistency and failure handling for incomplete saves.
- Confirm the extension remains compatible with macOS Monterey and older Intel-based Macs and that it does not require a database or backend.

## 10. Test matrix and acceptance validation
- Add unit tests for metadata validation, file naming, crop calculations, request/response contracts, and error codes.
- Add integration tests for successful capture, command-triggered flow, failed download, invalid crop, and partial file-pair handling.
- Add manual browser tests for supported watch pages, keyboard shortcut behavior, browser zoom, player layout, and visible controls.
- Add accessibility checks for popup controls, focus order, keyboard access, and status messaging.
- Define explicit pass/fail criteria for each scenario before implementation is considered complete.

## 11. Review and handoff
- Confirm the MVP is aligned with the approved architecture and constraints.
- Summarize the accepted scope and any deferred enhancements before code changes begin.
- Stop before implementation and wait for explicit approval to proceed.
