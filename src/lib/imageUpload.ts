import {
  buildDeviceFingerprint,
  getOrCreateDeviceToken,
  getStoredSessionToken,
} from './device.ts';
import {
  MAX_IMAGE_UPLOAD_BYTES,
  validateUploadMedia,
} from '../shared/presenceStatus.ts';
import type { MediaKind } from '../shared/types.ts';

/**
 * Reads an image selected from the user's device and compresses large raster
 * images cleanly via Canvas into a lightweight Data URL suitable for instant chat/wall upload.
 */
export async function readImageFileAsDataUrl(
  file: File,
  maxDimension = 1024,
  quality = 0.82
): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('الرجاء اختيار ملف صورة صالح فقط');
  }
  if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
    throw new Error('حجم الصورة كبير جداً (الحد الأقصى 10 ميجابايت)');
  }

  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('تعذر قراءة ملف الصورة'));
    };
    reader.onerror = () => reject(new Error('تعذر قراءة ملف الصورة'));
    reader.readAsDataURL(file);
  });

  // Preserve small GIFs directly so animated GIFs keep animating
  if (file.type === 'image/gif' && rawDataUrl.length < 950_000) {
    return rawDataUrl;
  }

  // Compress/resize raster images on canvas to stay snappy
  return await new Promise<string>((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          const ratio = Math.min(maxDimension / width, maxDimension / height);
          width = Math.max(1, Math.round(width * ratio));
          height = Math.max(1, Math.round(height * ratio));
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(rawDataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const out = canvas.toDataURL('image/jpeg', quality);
        resolve(out.length < rawDataUrl.length ? out : rawDataUrl);
      } catch {
        resolve(rawDataUrl);
      }
    };
    img.onerror = () => resolve(rawDataUrl);
    img.src = rawDataUrl;
  });
}

/**
 * Validates and uploads either an image or a video (max 30MB).
 * Videos are streamed directly to `/api/media/upload` so large MP4/WebM files stay fast.
 */
export async function uploadChatMediaFile(
  file: File
): Promise<{ url: string; mediaType: MediaKind }> {
  const check = validateUploadMedia({
    type: file.type,
    size: file.size,
    name: file.name,
  });
  if (!check.ok) {
    throw new Error(check.error);
  }

  if (check.kind === 'image') {
    const dataUrl = await readImageFileAsDataUrl(file, 1024, 0.82);
    return { url: dataUrl, mediaType: 'image' };
  }

  const headers = new Headers();
  headers.set('Content-Type', file.type || 'video/mp4');
  headers.set('x-file-name', encodeURIComponent(file.name || 'video.mp4'));
  const sessionToken = getStoredSessionToken();
  if (sessionToken) {
    headers.set('x-session-token', sessionToken);
  }
  headers.set('x-device-token', getOrCreateDeviceToken());
  headers.set('x-device-fp', buildDeviceFingerprint());

  const res = await fetch('/api/media/upload', {
    method: 'POST',
    headers,
    body: file,
  });
  const data = (await res.json().catch(() => ({}))) as {
    url?: string;
    mediaType?: MediaKind;
    error?: string;
  };
  if (!res.ok || !data.url) {
    throw new Error(data.error || 'تعذر رفع ملف الفيديو');
  }
  return { url: data.url, mediaType: data.mediaType ?? 'video' };
}
