export const CAPTURE_SCHEMA_VERSION = 1;
export const CAPTURE_METHOD = 'video-frame-capture';

export type CaptureMetadata = {
  schemaVersion: number;
  captureId: string;
  source: {
    platform: 'youtube';
    videoId: string;
    canonicalUrl: string;
    title?: string;
  };
  capture: {
    playbackSeconds: number;
    capturedAt: string;
    method: string;
  };
  image: {
    filename: string;
    width: number;
    height: number;
    format: 'png';
  };
};

type MetadataInput = {
  videoId: string;
  canonicalUrl: string;
  title?: string;
  playbackSeconds: number;
  imageWidth: number;
  imageHeight: number;
  captureId?: string;
  captureAt?: Date;
  captureMethod?: string;
};

function isValidYoutubeWatchUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return (
      (parsed.hostname === 'www.youtube.com' || parsed.hostname === 'youtube.com') &&
      parsed.pathname === '/watch' &&
      Boolean(parsed.searchParams.get('v'))
    );
  } catch {
    return false;
  }
}

export function buildCaptureId(): string {
  const timestamp = new Date();
  const prefix = timestamp
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');
  const suffix = Math.random().toString(16).slice(2, 12);
  return `${prefix}-${suffix}`;
}

export function buildDownloadPath(videoId: string, captureId: string, extension: 'png' | 'json'): string {
  return `NameThatMatch/${videoId}/${captureId}.${extension}`;
}

export function buildCaptureMetadata(input: MetadataInput): CaptureMetadata {
  if (!input.videoId || !input.videoId.trim()) {
    throw new Error('videoId is required');
  }

  if (!isValidYoutubeWatchUrl(input.canonicalUrl)) {
    throw new Error('canonicalUrl must be a valid YouTube watch URL');
  }

  if (!Number.isFinite(input.playbackSeconds) || input.playbackSeconds < 0) {
    throw new Error('playbackSeconds must be a finite, non-negative number');
  }

  if (!Number.isInteger(input.imageWidth) || input.imageWidth <= 0) {
    throw new Error('imageWidth must be a positive integer');
  }

  if (!Number.isInteger(input.imageHeight) || input.imageHeight <= 0) {
    throw new Error('imageHeight must be a positive integer');
  }

  const captureId = input.captureId ?? buildCaptureId();
  const createdAt = input.captureAt ?? new Date();

  const metadata: CaptureMetadata = {
    schemaVersion: CAPTURE_SCHEMA_VERSION,
    captureId,
    source: {
      platform: 'youtube',
      videoId: input.videoId,
      canonicalUrl: input.canonicalUrl,
      ...(input.title ? { title: input.title } : {})
    },
    capture: {
      playbackSeconds: input.playbackSeconds,
      capturedAt: createdAt.toISOString(),
      method: input.captureMethod ?? CAPTURE_METHOD
    },
    image: {
      filename: `${captureId}.png`,
      width: input.imageWidth,
      height: input.imageHeight,
      format: 'png'
    }
  };

  if (!validateCaptureMetadata(metadata)) {
    throw new Error('generated metadata does not match the approved capture schema');
  }

  return metadata;
}

export function validateCaptureMetadata(metadata: unknown): metadata is CaptureMetadata {
  if (!metadata || typeof metadata !== 'object') {
    return false;
  }

  const candidate = metadata as Record<string, unknown>;

  if (candidate.schemaVersion !== CAPTURE_SCHEMA_VERSION) {
    return false;
  }

  if (typeof candidate.captureId !== 'string' || !candidate.captureId.trim()) {
    return false;
  }

  if (!candidate.source || typeof candidate.source !== 'object') {
    return false;
  }

  const source = candidate.source as Record<string, unknown>;
  if (source.platform !== 'youtube') {
    return false;
  }

  if (typeof source.videoId !== 'string' || !source.videoId.trim()) {
    return false;
  }

  if (typeof source.canonicalUrl !== 'string' || !isValidYoutubeWatchUrl(source.canonicalUrl)) {
    return false;
  }

  if (source.title !== undefined && (typeof source.title !== 'string' || !source.title.trim())) {
    return false;
  }

  if (!candidate.capture || typeof candidate.capture !== 'object') {
    return false;
  }

  const capture = candidate.capture as Record<string, unknown>;
  if (typeof capture.playbackSeconds !== 'number' || !Number.isFinite(capture.playbackSeconds) || capture.playbackSeconds < 0) {
    return false;
  }

  if (typeof capture.capturedAt !== 'string') {
    return false;
  }

  const capturedAt = new Date(capture.capturedAt);
  if (Number.isNaN(capturedAt.getTime())) {
    return false;
  }

  if (capture.method !== CAPTURE_METHOD) {
    return false;
  }

  if (!candidate.image || typeof candidate.image !== 'object') {
    return false;
  }

  const image = candidate.image as Record<string, unknown>;
  if (typeof image.filename !== 'string' || !image.filename.endsWith('.png') || !image.filename.startsWith(candidate.captureId as string)) {
    return false;
  }

  if (!Number.isInteger(image.width) || Number(image.width) <= 0) {
    return false;
  }

  if (!Number.isInteger(image.height) || Number(image.height) <= 0) {
    return false;
  }

  if (image.format !== 'png') {
    return false;
  }

  return true;
}
