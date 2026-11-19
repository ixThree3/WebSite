const MAX_RAW_BYTES = 8 * 1024 * 1024; // 8 MB input limit

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
  if (file.size > MAX_RAW_BYTES) {
    throw new Error('حجم الصورة كبير جداً (الحد الأقصى 8 ميجابايت)');
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
