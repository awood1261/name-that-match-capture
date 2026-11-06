# Name That Match — Capture

A lightweight Google Chrome extension for capturing wrestling match screenshots from YouTube and organizing them for use in **Name That Match**, a professional wrestling trivia game.

## Project Overview

Name That Match challenges contestants to identify professional wrestling matches using screenshots from match footage.

The Capture extension is a companion tool designed to streamline the process of collecting screenshots and their associated metadata.

The extension will be developed independently of the main game application.

## Planned Features

- Capture screenshots from YouTube videos.
- Automatically record the YouTube video ID, URL, and playback timestamp.
- Save screenshots locally with unique filenames.
- Associate screenshots with their source footage.
- Export structured metadata for the Name That Match library.
- Support batch screenshot collection and subsequent review.
- Operate without requiring a cloud backend.

Features are subject to validation and approval through OpenSpec.

## Technology

**Planned stack:**
- TypeScript (strict mode)
- Google Chrome Extensions (Manifest V3)
- Standard CSS / CSS Modules where appropriate
- Node.js for development tooling
- OpenSpec for specification-driven development

The final build tooling and architecture will be determined during exploration.

## Development Workflow

All meaningful features and architectural changes follow OpenSpec:

1. **Explore** — Investigate requirements, APIs, constraints, and existing code.
2. **Specify** — Document requirements and acceptance criteria.
3. **Design** — Define architecture, data contracts, and component responsibilities.
4. **Plan** — Break implementation into small, verifiable tasks.
5. **Implement** — Follow the approved specification.
6. **Verify** — Run tests and validate behavior.
7. **Archive** — Archive completed OpenSpec changes.

Avoid implementing features before their specifications are approved.

## Design Principles

- Lightweight and compatible with older Intel-based MacBooks.
- Minimal Chrome permissions.
- Local-first screenshot and metadata storage.
- No unnecessary external services or subscriptions.
- No Tailwind CSS or utility-first CSS frameworks.
- Clear separation between capture, metadata, storage, and UI.
- Reliable error handling and recoverable capture failures.
- No bypassing of browser security restrictions or protected video content.

## Relationship to Name That Match

The extension will eventually produce image assets and structured metadata that can be imported into the main Name That Match application.

The integration contract will be defined through OpenSpec to avoid tightly coupling the two repositories.

## Usage

To capture a paused frame from a YouTube watch page:

1. Load the extension in Chrome using Developer mode and the unpacked project folder.
2. Open a standard YouTube watch page and pause the video.
3. Use the extension popup button or the keyboard shortcut.

### Keyboard shortcut

- macOS: `Command+Control+Y`
- Windows/Linux: `Ctrl+Shift+Y`

This shortcut is intentionally set away from the common `Command+Shift+Y` combination because that binding is frequently consumed by screen-capture utilities such as Screeny.

## Project Status

**Phase: Initial setup / architectural exploration**

The Chrome extension has not yet been implemented.

## Content and Copyright

Captured wrestling footage may be protected by copyright. Users are responsible for ensuring they have appropriate rights or permissions for their intended use.

The extension will not bypass DRM, access controls, or other content protections.

## License

Private project. No open-source license has been assigned.