import { buildDownloadPath, type CaptureMetadata, validateCaptureMetadata } from './metadata.js';

export type DownloadStatus = {
  ok: true;
  pngDownloadId: number;
  jsonDownloadId: number;
  captureId: string;
} | {
  ok: false;
  code: string;
  message: string;
};

export async function waitForDownloadCompletion(downloadId: number): Promise<boolean> {
  const maxAttempts = 25;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const items = await chrome.downloads.search({ id: downloadId });
    const item = items[0];

    if (item?.state === 'complete') {
      return true;
    }

    if (item && ['cancelled', 'interrupted', 'error'].includes(item.state ?? '')) {
      return false;
    }

    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  return false;
}

export async function saveCapturePair(input: {
  videoId: string;
  pngDataUrl: string;
  metadata: CaptureMetadata;
}): Promise<DownloadStatus> {
  if (!validateCaptureMetadata(input.metadata)) {
    return {
      ok: false,
      code: 'INVALID_METADATA',
      message: 'The capture metadata is invalid and cannot be saved.'
    };
  }

  if (!chrome?.downloads?.download || !chrome?.downloads?.search) {
    return {
      ok: false,
      code: 'DOWNLOAD_API_UNAVAILABLE',
      message: 'The Chrome download API is not available in this environment.'
    };
  }

  const pngFilename = buildDownloadPath(input.videoId, input.metadata.captureId, 'png');
  const jsonFilename = buildDownloadPath(input.videoId, input.metadata.captureId, 'json');

  try {
    const pngDownloadId = await chrome.downloads.download({
      url: input.pngDataUrl,
      filename: pngFilename,
      saveAs: false,
      conflictAction: 'uniquify'
    });

    if (typeof pngDownloadId !== 'number') {
      return {
        ok: false,
        code: 'DOWNLOAD_FAILED',
        message: 'The PNG screenshot could not be saved.'
      };
    }

    const pngComplete = await waitForDownloadCompletion(pngDownloadId);
    if (!pngComplete) {
      return {
        ok: false,
        code: 'DOWNLOAD_FAILED',
        message: 'The PNG screenshot did not complete downloading.'
      };
    }

    const metadataJson = `data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(input.metadata, null, 2))}`;
    const jsonDownloadId = await chrome.downloads.download({
      url: metadataJson,
      filename: jsonFilename,
      saveAs: false,
      conflictAction: 'uniquify'
    });

    if (typeof jsonDownloadId !== 'number') {
      return {
        ok: false,
        code: 'METADATA_FAILED',
        message: 'The metadata JSON could not be saved.'
      };
    }

    const jsonComplete = await waitForDownloadCompletion(jsonDownloadId);
    if (!jsonComplete) {
      return {
        ok: false,
        code: 'METADATA_FAILED',
        message: 'The metadata JSON did not complete downloading.'
      };
    }

    return {
      ok: true,
      pngDownloadId,
      jsonDownloadId,
      captureId: input.metadata.captureId
    };
  } catch (error) {
    return {
      ok: false,
      code: 'DOWNLOAD_FAILED',
      message: error instanceof Error ? error.message : 'The file save operation failed.'
    };
  }
}
