type VideoRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type ContentVideoStateResult =
  | {
      ok: true;
      data: {
        videoId: string;
        canonicalUrl: string;
        title?: string;
        playbackSeconds: number;
        rect: VideoRect;
      };
    }
  | {
      ok: false;
      code: string;
      message: string;
    };

export function chooseCaptureDimensions(
  video: Pick<HTMLVideoElement, 'videoWidth' | 'videoHeight' | 'clientWidth' | 'clientHeight'>
): { width: number; height: number } {
  const width = Number.isFinite(video.videoWidth) && video.videoWidth > 0 ? video.videoWidth : video.clientWidth;
  const height = Number.isFinite(video.videoHeight) && video.videoHeight > 0 ? video.videoHeight : video.clientHeight;

  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error('video dimensions are missing');
  }

  return {
    width: Math.round(width),
    height: Math.round(height)
  };
}

export function capturePlayerFrame(video: HTMLVideoElement): string {
  const { width, height } = chooseCaptureDimensions(video);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Canvas capture is not available in this browser.');
  }

  context.drawImage(video, 0, 0, width, height);
  return canvas.toDataURL('image/png');
}

function getVideoState(): ContentVideoStateResult {
  const url = new URL(window.location.href);
  const isSupportedWatchPage =
    (url.hostname === 'www.youtube.com' || url.hostname === 'youtube.com') && url.pathname === '/watch';

  if (!isSupportedWatchPage) {
    return {
      ok: false,
      code: 'UNSUPPORTED_PAGE',
      message: 'This extension only supports standard YouTube watch pages.'
    };
  }

  const videoId = url.searchParams.get('v');
  if (!videoId) {
    return {
      ok: false,
      code: 'MISSING_VIDEO_ID',
      message: 'The active YouTube page does not include a valid video ID.'
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

  const rect = video.getBoundingClientRect();
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;

  if (rect.width <= 0 || rect.height <= 0) {
    return {
      ok: false,
      code: 'INVALID_VIDEO_BOUNDS',
      message: 'The video rectangle is missing or too small to capture reliably.'
    };
  }

  const isFullyVisible =
    rect.left >= 0 &&
    rect.top >= 0 &&
    rect.right <= viewportWidth &&
    rect.bottom <= viewportHeight;

  if (!isFullyVisible) {
    return {
      ok: false,
      code: 'VIDEO_NOT_VISIBLE',
      message: 'The YouTube player must be fully visible before capture.'
    };
  }

  if (!video.paused) {
    return {
      ok: false,
      code: 'VIDEO_PLAYING',
      message: 'Pause the video before triggering a capture.'
    };
  }

  const playbackSeconds = Number.isFinite(video.currentTime) ? video.currentTime : NaN;
  if (!Number.isFinite(playbackSeconds) || playbackSeconds < 0) {
    return {
      ok: false,
      code: 'INVALID_PLAYBACK_TIME',
      message: 'The video playhead is missing or invalid.'
    };
  }

  const title = document.title && document.title.trim() ? document.title : undefined;

  return {
    ok: true,
    data: {
      videoId,
      canonicalUrl: `https://www.youtube.com/watch?v=${videoId}`,
      title,
      playbackSeconds,
      rect: {
        left: Math.round(rect.left),
        top: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      }
    }
  };
}

if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
    if (!message || typeof message !== 'object' || !('type' in message)) {
      return;
    }

    if (message.type === 'GET_VIDEO_STATE') {
      sendResponse(getVideoState());
      return true;
    }

      if (message.type === 'CAPTURE_VIDEO_FRAME') {
      try {
        const state = getVideoState();
        if (!state.ok) {
          sendResponse(state);
          return true;
        }

        const video = document.querySelector('video');
        if (!video) {
          sendResponse({
            ok: false,
            code: 'MISSING_VIDEO_ELEMENT',
            message: 'A visible YouTube video element was not found on this page.'
          });
          return true;
        }

        const { width, height } = chooseCaptureDimensions(video);
        const dataUrl = capturePlayerFrame(video);

        sendResponse({
          ok: true,
          data: {
            ...state.data,
            dataUrl,
            imageWidth: width,
            imageHeight: height
          }
        });
        return true;
      } catch (error) {
        sendResponse({
          ok: false,
          code: 'CAPTURE_FAILED',
          message: error instanceof Error ? error.message : 'The video frame could not be captured.'
        });
        return true;
      }
    }

    return;
  });
}
