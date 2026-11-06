# Tasks

## 1. Confirm MVP scope and product constraints
- Status: Complete
- Confirm the approved scope: standard YouTube watch pages only, no Shorts, no embedded players, no YouTube Music, no batch manifest, and no persistent capture queue.
- Confirm the default save directory as `Downloads/NameThatMatch/<videoId>/`.
- Confirm the required metadata fields, file-pairing rules, and explicit failure behavior for unsupported content and invalid capture states.

## 2. Extension bootstrap and Manifest V3 configuration
- Status: Complete
- Define the extension manifest with a minimal popup, toolbar action, and configurable Chrome command.
- Register the command and document the expected shortcut conflict behavior and the `chrome://extensions/shortcuts` user flow.
- Set the minimal required permissions for YouTube watch-page metadata, active-tab capture, downloads, and command registration.

## 3. UI and command event handling
- Status: Complete
- Implement the popup trigger and keyboard command trigger using the same underlying capture operation.
- Define a request ID and typed message payload for all capture requests and responses.
- Provide clear success and failure messages without exposing unsupported or protected content flows as silent success.

## 4. Content-script metadata and player detection
- Status: Complete
- Restrict the content script to standard `youtube.com/watch` pages only.
- Detect the current video ID, canonical URL, optional title, and playback timestamp in seconds.
- Detect the current media element state and confirm that the video is paused and renderable in the page context.
- Reject unsupported pages, missing video elements, and protected or restricted content with explicit error codes.

## 5. Direct frame capture implementation
- Status: Complete
- Capture the active `HTMLVideoElement` by drawing the current frame onto a canvas using the supported browser DOM API.
- Preserve the source frame’s aspect ratio and source resolution where supported.
- Reject any capture that cannot be rendered safely, including tainted canvas and browser restriction scenarios.
- Explicitly exclude automatic cropping, sharpening, upscaling, and image enhancement from the MVP.

## 6. Save workflow and metadata contract
- Status: Complete
- Generate a unique capture ID for each file pair.
- Create the save directory `Downloads/NameThatMatch/<videoId>/` and write the PNG plus JSON metadata sidecar.
- Ensure both files share the identical capture ID and filename prefix.
- Validate the metadata contract before reporting success.
- Define explicit behavior for duplicate timestamps and repeated captures from the same video.

## 7. Error handling and recovery
- Status: Complete
- Define failure flows for unsupported page, missing video element, video still playing, invalid or missing playback timestamp, tab navigation during capture, image download failure, metadata write failure, tainted canvas failures, and protected content.
- Ensure a capture is never reported as successful unless both files are confirmed saved.
- Define how partial PNG/JSON pairs are detected and recovered without introducing a persistent capture queue.

## 8. Manual validation of the direct capture strategy
- Status: Complete
- Validate the direct frame-capture path on modern widescreen wrestling footage and older 4:3-style footage.
- Confirm the saved frames exclude YouTube controls and browser UI.
- Confirm direct canvas capture is the dependable primary method for the MVP and that the visible-tab crop strategy is abandoned.

## 9. Metadata export and verification
- Status: Complete
- Validate the JSON metadata contract for required and optional fields, timestamp formatting, and image dimensions.
- Verify file-pair consistency and failure handling for incomplete saves.
- Confirm the extension remains compatible with macOS Monterey and older Intel-based Macs and that it does not require a database or backend.

## 10. Test matrix and acceptance validation
- Status: Complete
- Add unit tests for metadata validation, file naming, frame-size logic, request/response contracts, and error codes.
- Add integration tests for successful capture, command-triggered flow, failed download, invalid video states, and partial file-pair handling.
- Add manual browser tests for supported watch pages, keyboard shortcut behavior, and direct media-element capture validation.
- Add accessibility checks for popup controls, focus order, keyboard access, and status messaging.
- Define explicit pass/fail criteria for each scenario before implementation is considered complete.

## 11. Review and handoff
- Status: Complete
- Confirm the MVP is aligned with the approved architecture and constraints.
- Summarize the accepted scope and any deferred enhancements before closing out the change.
- Stop before Milestone 2 and keep the approved architecture focused on direct frame capture only.
- Explicitly identify the remaining manual browser acceptance checks that require real Chrome interaction on macOS.
