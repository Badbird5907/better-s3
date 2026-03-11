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
  "application/x-javascript": "application/javascript",
  "text/javascript": "application/javascript",
  "application/x-gzip": "application/gzip",
  "application/x-compressed": "application/gzip",
  "application/x-pdf": "application/pdf",
  "application/x-rar": "application/x-rar-compressed",
  "application/rar": "application/x-rar-compressed",
  "application/x-7z": "application/x-7z-compressed",
  "text/xml": "application/xml",

  // font variants
  "application/x-font-ttf": "font/ttf",
  "application/x-font-otf": "font/otf",
  "application/font-woff": "font/woff",
  "application/font-woff2": "font/woff2",
};

function stripMimeParameters(mimeType: string): string {
  return mimeType.split(";")[0]?.trim().toLowerCase() ?? "";
}

function isGenericXmlMimeType(mimeType: string): boolean {
  return mimeType === "application/xml" || mimeType === "text/xml";
}

export function normalizeMimeType(mimeType: string): string {
  const lowered = stripMimeParameters(mimeType);
  return MIME_TYPE_EQUIVALENTS[lowered] ?? lowered;
}

export function areMimeTypesEquivalent(
  mimeType1: string,
  mimeType2: string,
): boolean {
  const normalizedMimeType1 = normalizeMimeType(mimeType1);
  const normalizedMimeType2 = normalizeMimeType(mimeType2);

  if (normalizedMimeType1 === normalizedMimeType2) {
    return true;
  }

  // Some detectors return generic XML for SVG or other XML-based assets.
  // Accept generic XML for SVG to avoid false negatives on valid uploads.
  if (
    (normalizedMimeType1 === "image/svg+xml" &&
      isGenericXmlMimeType(normalizedMimeType2)) ||
    (normalizedMimeType2 === "image/svg+xml" &&
      isGenericXmlMimeType(normalizedMimeType1))
  ) {
    return true;
  }

  return false;
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

  const normalizedMimeType = normalizeMimeType(mimeType);

  // supports wildcards like "image/*"
  return allowedTypes.some((allowed) => {
    const normalizedAllowedType = normalizeMimeType(allowed);

    if (normalizedAllowedType.endsWith("/*")) {
      const prefix = normalizedAllowedType.slice(0, -2);
      return normalizedMimeType.startsWith(prefix + "/");
    }

    return areMimeTypesEquivalent(normalizedMimeType, normalizedAllowedType);
  });
}
