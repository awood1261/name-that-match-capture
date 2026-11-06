import { describe, expect, it } from 'vitest';
import { chooseCaptureDimensions } from '../src/content';

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
