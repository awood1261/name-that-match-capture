import { afterEach, describe, expect, it, vi } from 'vitest';
import { chooseCaptureDimensions } from '../src/content';
import { readVideoState, setCaptureBadgeState, withCaptureLock } from '../src/background';
import {
  buildCaptureId,
  buildCaptureMetadata,
  buildDownloadPath,
  validateCaptureMetadata
} from '../src/metadata';
import { saveCapturePair } from '../src/storage';

type CropRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

function ensureVisibleRect(rect: CropRect, viewportWidth: number, viewportHeight: number): CropRect {
  if (rect.width <= 0 || rect.height <= 0) {
    throw new Error('invalid rect');
  }

  const fullyVisible =
    rect.left >= 0 &&
    rect.top >= 0 &&
    rect.left + rect.width <= viewportWidth &&
    rect.top + rect.height <= viewportHeight;

  if (!fullyVisible) {
    throw new Error('video not fully visible');
  }

  return rect;
}

describe('capture geometry validation', () => {
  it('accepts a fully visible player box', () => {
    const rect = ensureVisibleRect({ left: 20, top: 30, width: 640, height: 360 }, 1280, 720);
    expect(rect.width).toBe(640);
    expect(rect.height).toBe(360);
  });

  it('rejects a rect that is not fully contained in the viewport', () => {
    expect(() => ensureVisibleRect({ left: 10, top: 30, width: 1280, height: 360 }, 1280, 720)).toThrow(
      'video not fully visible'
    );
  });

  it('rejects empty or invalid dimensions', () => {
    expect(() => ensureVisibleRect({ left: 0, top: 0, width: 0, height: 200 }, 1280, 720)).toThrow(
      'invalid rect'
    );
  });
});

describe('URL validation', () => {
  it('accepts a standard YouTube watch URL', () => {
    const url = new URL('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    expect(url.hostname).toBe('www.youtube.com');
    expect(url.pathname).toBe('/watch');
    expect(url.searchParams.get('v')).toBe('dQw4w9WgXcQ');
  });

  it('rejects non-watch URLs', () => {
    const url = new URL('https://www.youtube.com/shorts/dQw4w9WgXcQ');
    expect(url.pathname.startsWith('/shorts')).toBe(true);
  });
});

describe('frame capture sizing', () => {
  it('prefers the actual video resolution over the viewport size', () => {
    const dims = chooseCaptureDimensions({
      videoWidth: 1280,
      videoHeight: 720,
      clientWidth: 400,
      clientHeight: 225
    });

    expect(dims.width).toBe(1280);
    expect(dims.height).toBe(720);
  });

  it('rejects a missing video size', () => {
    expect(() => chooseCaptureDimensions({ videoWidth: 0, videoHeight: 0, clientWidth: 0, clientHeight: 0 })).toThrow(
      'video dimensions are missing'
    );
  });
});

describe('metadata generation', () => {
  it('generates valid capture metadata with the approved schema', () => {
    const metadata = buildCaptureMetadata({
      videoId: 'dQw4w9WgXcQ',
      canonicalUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      title: 'Example wrestling footage',
      playbackSeconds: 482.25,
      imageWidth: 1280,
      imageHeight: 720,
      captureId: '20261105T153025Z-5f4c8c87a1',
      captureAt: new Date('2026-11-05T15:30:25.000Z')
    });

    expect(validateCaptureMetadata(metadata)).toBe(true);
    expect(metadata.schemaVersion).toBe(1);
    expect(metadata.captureId).toBe('20261105T153025Z-5f4c8c87a1');
    expect(metadata.source.platform).toBe('youtube');
    expect(metadata.capture.method).toBe('video-frame-capture');
    expect(metadata.image.filename).toBe('20261105T153025Z-5f4c8c87a1.png');
    expect(metadata.image.width).toBe(1280);
    expect(metadata.image.height).toBe(720);
  });

  it('rejects invalid or missing metadata fields', () => {
    expect(
      validateCaptureMetadata({
        schemaVersion: 1,
        captureId: '',
        source: {
          platform: 'youtube',
          videoId: '',
          canonicalUrl: 'not-a-url',
          title: 42
        },
        capture: {
          playbackSeconds: Number.NaN,
          capturedAt: 'not-a-date',
          method: 'video-frame-capture'
        },
        image: {
          filename: 'capture.png',
          width: 0,
          height: 720,
          format: 'jpg'
        }
      })
    ).toBe(false);
  });

  it('creates unique capture IDs for repeated saves', () => {
    const first = buildCaptureId();
    const second = buildCaptureId();

    expect(first).not.toBe(second);
    expect(first).toMatch(/^\d{8}T\d{6}Z-[a-f0-9]+$/);
    expect(second).toMatch(/^\d{8}T\d{6}Z-[a-f0-9]+$/);
  });

  it('keeps PNG and JSON filenames paired to the same capture ID', () => {
    const pngPath = buildDownloadPath('dQw4w9WgXcQ', '20261105T153025Z-5f4c8c87a1', 'png');
    const jsonPath = buildDownloadPath('dQw4w9WgXcQ', '20261105T153025Z-5f4c8c87a1', 'json');

    expect(pngPath).toBe('NameThatMatch/dQw4w9WgXcQ/20261105T153025Z-5f4c8c87a1.png');
    expect(jsonPath).toBe('NameThatMatch/dQw4w9WgXcQ/20261105T153025Z-5f4c8c87a1.json');
    expect(pngPath).not.toBe(jsonPath);
  });

  it('generates a new capture ID even when the video and playhead match', () => {
    const first = buildCaptureMetadata({
      videoId: 'dQw4w9WgXcQ',
      canonicalUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      title: 'Example',
      playbackSeconds: 123,
      imageWidth: 1920,
      imageHeight: 1080,
      captureAt: new Date('2026-11-05T15:30:25.000Z')
    });

    const second = buildCaptureMetadata({
      videoId: 'dQw4w9WgXcQ',
      canonicalUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      title: 'Example',
      playbackSeconds: 123,
      imageWidth: 1920,
      imageHeight: 1080,
      captureAt: new Date('2026-11-05T15:30:25.000Z')
    });

    expect(first.captureId).not.toBe(second.captureId);
    expect(first.image.filename).toBe(`${first.captureId}.png`);
    expect(second.image.filename).toBe(`${second.captureId}.png`);
  });
});

describe('background page-read guardrails', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('falls back to the injected page read when the content-script message hangs', async () => {
    const sendMessage = vi.fn().mockImplementation(() => new Promise(() => undefined));
    const executeScript = vi.fn().mockResolvedValue([
      {
        result: {
          ok: true,
          data: {
            videoId: 'dQw4w9WgXcQ',
            canonicalUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
            title: 'Example',
            playbackSeconds: 12,
            rect: { left: 0, top: 0, width: 640, height: 360 },
            dataUrl: 'data:image/png;base64,abcd',
            imageWidth: 640,
            imageHeight: 360
          }
        }
      }
    ]);

    vi.stubGlobal('chrome', {
      tabs: {
        sendMessage
      },
      scripting: {
        executeScript
      }
    });

    const result = await readVideoState(42, 0);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('expected the fallback injected read to succeed');
    }

    expect(result.data.videoId).toBe('dQw4w9WgXcQ');
    expect(executeScript).toHaveBeenCalledTimes(1);
  });

  it('returns a clear timeout result instead of hanging forever when the YouTube page never responds', async () => {
    const sendMessage = vi.fn().mockImplementation(() => new Promise(() => undefined));
    const executeScript = vi.fn().mockImplementation(() => new Promise(() => undefined));

    vi.stubGlobal('chrome', {
      tabs: {
        sendMessage
      },
      scripting: {
        executeScript
      }
    });

    const result = await readVideoState(42, 3);

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('expected a page-not-ready failure');
    }

    expect(result.code).toBe('PAGE_NOT_READY');
    expect(result.message).toContain('YouTube page is not ready');
    expect(executeScript).toHaveBeenCalledTimes(0);
  });
});

describe('capture concurrency and feedback', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('rejects overlapping capture requests while a capture is in progress', async () => {
    const first = withCaptureLock(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return { ok: true, message: 'saved' };
    });

    const second = withCaptureLock(async () => {
      return { ok: true, message: 'not reached' };
    });

    const [firstResult, secondResult] = await Promise.all([first, second]);

    expect(firstResult.ok).toBe(true);
    expect(secondResult.ok).toBe(false);
    if (secondResult.ok) {
      throw new Error('expected the second capture to be blocked');
    }
    expect(secondResult.code).toBe('CAPTURE_IN_PROGRESS');
  });

  it('updates the extension badge for progress and success states', () => {
    const setBadgeText = vi.fn();
    const setBadgeBackgroundColor = vi.fn();
    const setTitle = vi.fn();

    vi.stubGlobal('chrome', {
      action: {
        setBadgeText,
        setBadgeBackgroundColor,
        setTitle
      }
    });

    setCaptureBadgeState('in-progress', 'Capturing frame…');
    setCaptureBadgeState('success', 'Saved screenshot');

    expect(setBadgeText).toHaveBeenNthCalledWith(1, { text: '…' });
    expect(setBadgeText).toHaveBeenNthCalledWith(2, { text: 'OK' });
    expect(setTitle).toHaveBeenNthCalledWith(2, { title: 'Saved screenshot' });
  });
});

describe('download pair persistence', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('saves the PNG and JSON pair only after both downloads complete', async () => {
    const download = vi.fn().mockResolvedValueOnce(101).mockResolvedValueOnce(202);
    const search = vi.fn().mockResolvedValueOnce([{ state: 'complete' }]).mockResolvedValueOnce([{ state: 'complete' }]);

    vi.stubGlobal('chrome', {
      downloads: {
        download,
        search
      }
    });

    const metadata = buildCaptureMetadata({
      videoId: 'dQw4w9WgXcQ',
      canonicalUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      title: 'Playback test',
      playbackSeconds: 42,
      imageWidth: 1280,
      imageHeight: 720,
      captureAt: new Date('2026-11-05T15:30:25.000Z')
    });

    const result = await saveCapturePair({
      videoId: 'dQw4w9WgXcQ',
      pngDataUrl: 'data:image/png;base64,abc123',
      metadata
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('expected successful pair save');
    }

    expect(download).toHaveBeenCalledTimes(2);
    expect(result.captureId).toBe(metadata.captureId);
  });

  it('fails when a PNG download is interrupted', async () => {
    const download = vi.fn().mockResolvedValueOnce(101).mockResolvedValueOnce(202);
    const search = vi.fn().mockResolvedValueOnce([{ state: 'interrupted' }]);

    vi.stubGlobal('chrome', {
      downloads: {
        download,
        search
      }
    });

    const metadata = buildCaptureMetadata({
      videoId: 'dQw4w9WgXcQ',
      canonicalUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      title: 'Failure case',
      playbackSeconds: 11,
      imageWidth: 640,
      imageHeight: 360,
      captureAt: new Date('2026-11-05T15:30:25.000Z')
    });

    const result = await saveCapturePair({
      videoId: 'dQw4w9WgXcQ',
      pngDataUrl: 'data:image/png;base64,abc123',
      metadata
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('expected failed PNG download');
    }
    expect(result.code).toBe('DOWNLOAD_FAILED');
  });

  it('fails when the metadata JSON download does not complete', async () => {
    const download = vi.fn().mockResolvedValueOnce(101).mockResolvedValueOnce(202);
    const search = vi.fn().mockResolvedValueOnce([{ state: 'complete' }]).mockResolvedValueOnce([{ state: 'interrupted' }]);

    vi.stubGlobal('chrome', {
      downloads: {
        download,
        search
      }
    });

    const metadata = buildCaptureMetadata({
      videoId: 'dQw4w9WgXcQ',
      canonicalUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      title: 'Metadata failure',
      playbackSeconds: 77,
      imageWidth: 320,
      imageHeight: 180,
      captureAt: new Date('2026-11-05T15:30:25.000Z')
    });

    const result = await saveCapturePair({
      videoId: 'dQw4w9WgXcQ',
      pngDataUrl: 'data:image/png;base64,abc123',
      metadata
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('expected failed metadata download');
    }
    expect(result.code).toBe('METADATA_FAILED');
  });
});
