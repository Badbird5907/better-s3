import { fileTypeFromBuffer } from "file-type";

const MIME_TYPE_EQUIVALENTS: Record<string, string> = {
  // zip variants
  "application/x-zip-compressed": "application/zip",
  "application/x-zip": "application/zip",

  // video variants
  "video/x-matroska": "video/matroska",
  "video/x-msvideo": "video/vnd.avi",
  "video/avi": "video/vnd.avi",
  "video/msvideo": "video/vnd.avi",
  "video/x-quicktime": "video/quicktime",

  // audio variants
  "audio/mp3": "audio/mpeg",
  "audio/x-mp3": "audio/mpeg",
  "audio/x-mpeg": "audio/mpeg",
  "audio/x-wav": "audio/wav",
  "audio/wave": "audio/wav",
  "audio/x-flac": "audio/flac",
  "audio/x-aac": "audio/aac",
  "audio/x-m4a": "audio/mp4",
  "audio/m4a": "audio/mp4",
  "audio/x-ogg": "audio/ogg",

  // image variants
  "image/jpg": "image/jpeg",
  "image/pjpeg": "image/jpeg",
  "image/x-png": "image/png",
  "image/x-ms-bmp": "image/bmp",
  "image/x-bmp": "image/bmp",

  // application variants
  "text/x-json": "application/json",
  "application/x-javascript": "text/javascript",
  "application/javascript": "text/javascript",
  "text/javascript": "application/javascript",
  "application/x-gzip": "application/gzip",
  "application/x-compressed": "application/gzip",
  "application/x-pdf": "application/pdf",
  "application/x-rar": "application/x-rar-compressed",
  "application/rar": "application/x-rar-compressed",
  "application/x-7z": "application/x-7z-compressed",

  // font variants
  "application/x-font-ttf": "font/ttf",
  "application/x-font-otf": "font/otf",
  "application/font-woff": "font/woff",
  "application/font-woff2": "font/woff2",
};

export function normalizeMimeType(mimeType: string): string {
  const lowered = mimeType.toLowerCase().trim();
  return MIME_TYPE_EQUIVALENTS[lowered] ?? lowered;
}

export function areMimeTypesEquivalent(
  mimeType1: string,
  mimeType2: string,
): boolean {
  return normalizeMimeType(mimeType1) === normalizeMimeType(mimeType2);
}

export async function detectMimeType(
  data: ArrayBuffer | Uint8Array,
): Promise<string> {
  try {
    const buffer = data instanceof Uint8Array ? data : new Uint8Array(data);
    const result = await fileTypeFromBuffer(buffer);
    return result?.mime ?? "application/octet-stream";
  } catch (error) {
    console.error("MIME type detection failed:", error);
    return "application/octet-stream";
  }
}

export function getExtensionFromMimeType(mimeType: string): string {
  const mimeToExt: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "image/svg+xml": ".svg",
    "video/mp4": ".mp4",
    "video/webm": ".webm",
    "video/quicktime": ".mov",
    "audio/mpeg": ".mp3",
    "audio/wav": ".wav",
    "audio/ogg": ".ogg",
    "application/pdf": ".pdf",
    "application/zip": ".zip",
    "application/json": ".json",
    "text/plain": ".txt",
    "text/html": ".html",
    "text/css": ".css",
    "text/javascript": ".js",
  };

  return mimeToExt[mimeType] ?? "";
}

export function isAllowedMimeType(
  mimeType: string,
  allowedTypes?: string[],
): boolean {
  if (!allowedTypes || allowedTypes.length === 0) {
    return true;
  }

  // supports wildcards like "image/*"
  return allowedTypes.some((allowed) => {
    if (allowed.endsWith("/*")) {
      const prefix = allowed.slice(0, -2);
      return mimeType.startsWith(prefix + "/");
    }
    return mimeType === allowed;
  });
}
