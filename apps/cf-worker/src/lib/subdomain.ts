export function extractProjectSlug(
  hostname: string,
  workerDomain: string,
): string | null {
  const host = hostname.split(":")[0] ?? hostname;
  const domain = workerDomain.split(":")[0] ?? workerDomain;

  if (!host.endsWith(domain)) {
    return null;
  }

  const subdomain = host.slice(0, -(domain.length + 1));

  if (!subdomain) {
    return null;
  }

  return subdomain;
}

export function isValidSlug(slug: string): boolean {
  // must be 3-63 characters
  if (slug.length < 3 || slug.length > 63) {
    return false;
  }

  // lowercase alphanumeric + hyphens, start/end with alphanumeric
  return /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(slug);
}
