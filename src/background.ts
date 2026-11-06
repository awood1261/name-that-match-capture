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

async function readVideoState(tabId: number, attempt = 0): Promise<BackgroundVideoStateResult> {
  return await new Promise<BackgroundVideoStateResult>((resolve) => {
    chrome.tabs.sendMessage(tabId, { type: 'CAPTURE_VIDEO_FRAME' }, (response) => {
      if (chrome.runtime.lastError) {
        if (attempt < 4) {
          setTimeout(() => {
            resolve(readVideoState(tabId, attempt + 1));
          }, 250 * (attempt + 1));
          return;
        }

        resolve(fallbackCaptureFromPage(tabId));
        return;
      }

      if (!response) {
        if (attempt < 4) {
          setTimeout(() => {
            resolve(readVideoState(tabId, attempt + 1));
          }, 250 * (attempt + 1));
          return;
        }

        resolve(fallbackCaptureFromPage(tabId));
        return;
      }

      resolve(response as BackgroundVideoStateResult);
    });
  });
}

async function fallbackCaptureFromPage(tabId: number): Promise<BackgroundVideoStateResult> {
  try {
    const results = await chrome.scripting.executeScript({
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
            dataUrl: canvas.toDataURL('image/png')
          }
        };
      }
    });

    const [result] = results;
    const payload = result?.result as BackgroundVideoStateResult | undefined;

    if (!payload) {
      return {
        ok: false,
        code: 'NO_CONTENT_SCRIPT',
        message: 'The YouTube page is not ready yet. Please reload the tab and try again.'
      };
    }

    return payload;
  } catch (error) {
    return {
      ok: false,
      code: 'NO_CONTENT_SCRIPT',
      message: error instanceof Error ? error.message : 'The YouTube page is not ready yet. Please reload the tab and try again.'
    };
  }
}

async function captureFromActiveTab(request: CaptureRequest): Promise<CaptureResult> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab?.id) {
    return {
      ok: false,
      requestId: request.requestId,
      code: 'NO_ACTIVE_TAB',
      message: 'No active tab is available to capture.'
    };
  }

  if (!isSupportedWatchUrl(tab.url)) {
    return {
      ok: false,
      requestId: request.requestId,
      code: 'UNSUPPORTED_PAGE',
      message: 'Open a standard YouTube watch page and pause the video before capturing.'
    };
  }

  const response = await readVideoState(tab.id);

  if (!response || !response.ok) {
    return {
      ok: false,
      requestId: request.requestId,
      code: response?.code ?? 'UNSUPPORTED_PAGE',
      message: response?.message ?? 'Open a supported YouTube watch page and pause the video.'
    };
  }

  const safeFilename = `NameThatMatch/${response.data.videoId}/${response.data.videoId}-${Date.now()}.png`;
  const downloadId = await chrome.downloads.download({
    url: response.data.dataUrl,
    filename: safeFilename,
    saveAs: false,
    conflictAction: 'uniquify'
  });

  if (!downloadId) {
    return {
      ok: false,
      requestId: request.requestId,
      code: 'DOWNLOAD_FAILED',
      message: 'The capture image was created, but the download could not be saved.'
    };
  }

  return {
    ok: true,
    requestId: request.requestId,
    message: `Saved screenshot for ${response.data.videoId}.`,
    downloadId
  };
}

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
