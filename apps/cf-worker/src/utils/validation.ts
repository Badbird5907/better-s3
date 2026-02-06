export function parseNonNegativeInt(value: string | undefined): number | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const num = parseInt(value, 10);
  if (isNaN(num) || num < 0) {
    return null;
  }

  return num;
}

export function sanitizeHeaderValue(value: string): string {
  return value.replace(/[\r\n\0]/g, "");
}

export function isValidMetadataKey(key: string): boolean {
  if (!key || key.length === 0) {
    return false;
  }

  if (/[\s,]/.test(key)) {
    return false;
  }

  for (let i = 0; i < key.length; i++) {
    const code = key.charCodeAt(i);
    if (code > 127) {
      return false;
    }
  }

  return true;
}

export function isValidBase64(value: string): boolean {
  if (value === "") {
    return true;
  }

  try {
    const decoded = atob(value);
    return btoa(decoded) === value;
  } catch {
    return false;
  }
}
