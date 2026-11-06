import { buildCaptureMetadata } from './metadata.js';
import { saveCapturePair } from './storage.js';

type CaptureRequest = {
  type: 'START_CAPTURE';
  requestId: string;
};

type CropRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type VideoCaptureData = {
  videoId: string;
  canonicalUrl: string;
  title?: string;
  playbackSeconds: number;
  rect: CropRect;
  dataUrl: string;
  imageWidth: number;
  imageHeight: number;
};

type BackgroundVideoStateResult =
  | {
      ok: true;
      data: VideoCaptureData;
    }
  | {
      ok: false;
      code: string;
      message: string;
    };

type CaptureResult =
  | {
      ok: true;
      requestId: string;
      message: string;
      downloadId: number;
    }
  | {
      ok: false;
      requestId: string;
      code: string;
      message: string;
    };

const PAGE_NOT_READY_MESSAGE = 'The YouTube page is not ready yet. Please reload the tab and try again.';
const MAX_READ_VIDEO_STATE_ATTEMPTS = 3;
let captureInProgress = false;

export function setCaptureBadgeState(state: 'idle' | 'in-progress' | 'success' | 'error', message?: string): void {
  if (typeof chrome === 'undefined' || !chrome.action) {
    return;
  }

  if (state === 'idle') {
    chrome.action.setBadgeText({ text: '' });
    if ('setTitle' in chrome.action) {
      chrome.action.setTitle({ title: 'Capture paused frame' });
    }
    return;
  }

  const badgeText = state === 'in-progress' ? '…' : state === 'success' ? 'OK' : '!';
  const badgeColor = state === 'in-progress' ? '#2563eb' : state === 'success' ? '#16a34a' : '#dc2626';

  chrome.action.setBadgeText({ text: badgeText });
  chrome.action.setBadgeBackgroundColor({ color: badgeColor });

  if (message && 'setTitle' in chrome.action) {
    chrome.action.setTitle({ title: message });
  }
}

export async function withCaptureLock<T>(run: () => Promise<T>): Promise<{ ok: true; value: T } | { ok: false; code: 'CAPTURE_IN_PROGRESS'; message: string }> {
  if (captureInProgress) {
    return {
      ok: false,
      code: 'CAPTURE_IN_PROGRESS',
      message: 'A capture is already in progress. Please wait for it to finish.'
    };
  }

  captureInProgress = true;
  setCaptureBadgeState('in-progress', 'Capturing frame…');

  try {
    return {
      ok: true,
      value: await run()
    };
  } catch (error) {
    return {
      ok: false,
      code: 'CAPTURE_IN_PROGRESS',
      message: error instanceof Error ? error.message : 'Capture failed while in progress.'
    };
  } finally {
    captureInProgress = false;
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallbackMessage: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(fallbackMessage)), timeoutMs);
    })
  ]);
}

function isSupportedWatchUrl(url: string | undefined): boolean {
  if (!url) {
    return false;
  }

  try {
    const parsed = new URL(url);
    return (
      (parsed.hostname === 'www.youtube.com' || parsed.hostname === 'youtube.com') &&
      parsed.pathname === '/watch' &&
      Boolean(parsed.searchParams.get('v'))
    );
  } catch {
    return false;
  }
}

export async function readVideoState(tabId: number, attempt = 0): Promise<BackgroundVideoStateResult> {
  if (attempt >= MAX_READ_VIDEO_STATE_ATTEMPTS) {
    return {
      ok: false,
      code: 'PAGE_NOT_READY',
      message: PAGE_NOT_READY_MESSAGE
    };
  }

  try {
    console.log('[capture] readVideoState attempt', attempt, 'tabId', tabId);

    if (typeof chrome !== 'undefined' && chrome.tabs && 'sendMessage' in chrome.tabs) {
      try {
        const response = await withTimeout(
          chrome.tabs.sendMessage(tabId, { type: 'GET_VIDEO_STATE' }),
          2500,
          PAGE_NOT_READY_MESSAGE
        );

        if (response && typeof response === 'object' && 'ok' in response) {
          const payload = response as BackgroundVideoStateResult;
          console.log('[capture] readVideoState resolved via content script', payload);
          return payload;
        }
      } catch (error) {
        console.log('[capture] content script unavailable, retrying with injected read', error);
      }
    }

    if (typeof chrome === 'undefined' || !chrome.scripting || !chrome.scripting.executeScript) {
      return {
        ok: false,
        code: 'PAGE_NOT_READY',
        message: PAGE_NOT_READY_MESSAGE
      };
    }

    const results = await Promise.race([
      chrome.scripting.executeScript({
        target: { tabId },
        world: 'MAIN',
        func: () => {
          const url = new URL(window.location.href);
          const supported =
            (url.hostname === 'www.youtube.com' || url.hostname === 'youtube.com') &&
            url.pathname === '/watch' &&
            Boolean(url.searchParams.get('v'));

          if (!supported) {
            return {
              ok: false,
              code: 'UNSUPPORTED_PAGE',
              message: 'Open a standard YouTube watch page and pause the video before capturing.'
            };
          }

          const video = document.querySelector('video');
          if (!video) {
            return {
              ok: false,
              code: 'MISSING_VIDEO_ELEMENT',
              message: 'A visible YouTube video element was not found on this page.'
            };
          }

          if (!video.paused) {
            return {
              ok: false,
              code: 'VIDEO_PLAYING',
              message: 'Pause the video before triggering a capture.'
            };
          }

          const width = video.videoWidth || video.clientWidth || 0;
          const height = video.videoHeight || video.clientHeight || 0;
          if (!width || !height) {
            return {
              ok: false,
              code: 'INVALID_VIDEO_BOUNDS',
              message: 'The video rectangle is missing or too small to capture reliably.'
            };
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const context = canvas.getContext('2d');
          if (!context) {
            return {
              ok: false,
              code: 'CAPTURE_FAILED',
              message: 'Canvas capture is not available in this browser.'
            };
          }

          context.drawImage(video, 0, 0, width, height);
          console.log('[capture] injected script produced frame', { width, height, currentTime: video.currentTime });

          return {
            ok: true,
            data: {
              videoId: url.searchParams.get('v') || '',
              canonicalUrl: `https://www.youtube.com/watch?v=${url.searchParams.get('v')}`,
              title: document.title && document.title.trim() ? document.title : undefined,
              playbackSeconds: Number.isFinite(video.currentTime) ? video.currentTime : 0,
              rect: {
                left: 0,
                top: 0,
                width,
                height
              },
              dataUrl: canvas.toDataURL('image/png'),
              imageWidth: width,
              imageHeight: height
            }
          };
        }
      }),
      new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(PAGE_NOT_READY_MESSAGE));
        }, 2500 + attempt * 1000);
      })
    ]);

    const [result] = results as Array<{ result: BackgroundVideoStateResult } | undefined>;
    const payload = result?.result as BackgroundVideoStateResult | undefined;

    if (!payload) {
      console.log('[capture] no payload from injected script');
      return {
        ok: false,
        code: 'PAGE_NOT_READY',
        message: PAGE_NOT_READY_MESSAGE
      };
    }

    console.log('[capture] readVideoState resolved', payload);
    return payload;
  } catch (error) {
    console.log('[capture] readVideoState error', error);

    if (attempt < MAX_READ_VIDEO_STATE_ATTEMPTS) {
      return readVideoState(tabId, attempt + 1);
    }

    return {
      ok: false,
      code: 'PAGE_NOT_READY',
      message: error instanceof Error ? error.message : PAGE_NOT_READY_MESSAGE
    };
  }
}

export async function captureFromActiveTab(request: CaptureRequest): Promise<CaptureResult> {
  const lockResult = await withCaptureLock(async () => {
    console.log('[capture] captureFromActiveTab start', request.requestId);
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab?.id) {
      return {
        ok: false,
        requestId: request.requestId,
        code: 'NO_ACTIVE_TAB',
        message: 'No active tab is available to capture.'
      } satisfies CaptureResult;
    }

    if (!isSupportedWatchUrl(tab.url)) {
      return {
        ok: false,
        requestId: request.requestId,
        code: 'UNSUPPORTED_PAGE',
        message: 'Open a standard YouTube watch page and pause the video before capturing.'
      } satisfies CaptureResult;
    }

    console.log('[capture] active tab', tab.id, tab.url);
    const response = await readVideoState(tab.id);

    if (!response || !response.ok) {
      return {
        ok: false,
        requestId: request.requestId,
        code: response?.code ?? 'UNSUPPORTED_PAGE',
        message: response?.message ?? 'Open a supported YouTube watch page and pause the video.'
      } satisfies CaptureResult;
    }

    console.log('[capture] building metadata for', response.data.videoId);
    const metadata = buildCaptureMetadata({
      videoId: response.data.videoId,
      canonicalUrl: response.data.canonicalUrl,
      title: response.data.title,
      playbackSeconds: response.data.playbackSeconds,
      imageWidth: response.data.imageWidth ?? response.data.rect.width,
      imageHeight: response.data.imageHeight ?? response.data.rect.height
    });

    console.log('[capture] saving capture pair');
    const downloadResult = await saveCapturePair({
      videoId: response.data.videoId,
      pngDataUrl: response.data.dataUrl,
      metadata
    });

    if (!downloadResult.ok) {
      console.log('[capture] save failed', downloadResult);
      return {
        ok: false,
        requestId: request.requestId,
        code: downloadResult.code,
        message: downloadResult.message
      } satisfies CaptureResult;
    }

    console.log('[capture] save succeeded', downloadResult);
    return {
      ok: true,
      requestId: request.requestId,
      message: `Saved screenshot for ${response.data.videoId}.`,
      downloadId: downloadResult.pngDownloadId
    } satisfies CaptureResult;
  });

  if (!lockResult.ok) {
    setCaptureBadgeState('error', lockResult.message);
    return {
      ok: false,
      requestId: request.requestId,
      code: lockResult.code,
      message: lockResult.message
    } satisfies CaptureResult;
  }

  const result = lockResult.value;
  setCaptureBadgeState(result.ok ? 'success' : 'error', result.message);
  return result;
}

if (typeof chrome !== 'undefined' && chrome.commands && chrome.commands.onCommand) {
  chrome.commands.onCommand.addListener(async (command) => {
    if (command !== 'capture-video') {
      return;
    }

    const result = await captureFromActiveTab({
      type: 'START_CAPTURE',
      requestId: `command-${Date.now()}`
    });

    if (!result.ok) {
      console.error(result.message);
    }
  });
}

if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
    if (!message || typeof message !== 'object' || !('type' in message) || message.type !== 'START_CAPTURE') {
      return;
    }

    void captureFromActiveTab(message as CaptureRequest)
      .then((result) => sendResponse(result))
      .catch((error: Error) => {
        sendResponse({
          ok: false,
          requestId: (message as CaptureRequest).requestId ?? 'unknown',
          code: 'UNKNOWN_ERROR',
          message: error.message || 'An unexpected capture error occurred.'
        });
      });

    return true;
  });
}
