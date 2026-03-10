/**
 * Project slug generation and validation utilities
 */

/**
 * Reserved slugs that cannot be used for projects
 */
export const RESERVED_SLUGS = [
  "www",
  "api",
  "admin",
  "internal",
  "health",
  "status",
  "cdn",
  "assets",
  "static",
  "docs",
  "blog",
  "mail",
  "ftp",
  "smtp",
  "imap",
  "pop",
  "webmail",
  "cpanel",
  "whm",
  "secure",
  "ssl",
  "sftp",
  "ssh",
  "git",
  "svn",
  "hg",
] as const;

/**
 * Generate a URL-friendly slug from a project name
 *
 * Format: {sanitized-name}-{8-char-random}
 * Example: "My Project" → "my-project-k9x2m7a4"
 *
 * @param projectName - The project name to generate a slug from
 * @returns A URL-friendly slug
 */
export function generateProjectSlug(projectName: string): string {
  // Sanitize: lowercase, alphanumeric + hyphens only
  const sanitized = projectName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-") // Replace non-alphanumeric with hyphens
    .replace(/^-+|-+$/g, "") // Remove leading/trailing hyphens
    .slice(0, 30); // Keep reasonable length

  // Generate random suffix for uniqueness
  const random = crypto.randomUUID().replace(/-/g, "").slice(0, 8);

  const slug = sanitized ? `${sanitized}-${random}` : random;

  // If first part is reserved, regenerate
  if (isReservedSlug(slug)) {
    return generateProjectSlug(projectName);
  }

  return slug;
}

/**
 * Validate project slug format
 *
 * @param slug - The slug to validate
 * @returns Validation result with optional error message
 */
export function validateProjectSlug(slug: string): {
  valid: boolean;
  error?: string;
} {
  // Check length (min 3, max 63 for DNS)
  if (slug.length < 3) {
    return { valid: false, error: "Slug must be at least 3 characters" };
  }

  if (slug.length > 63) {
    return { valid: false, error: "Slug must be at most 63 characters" };
  }

  // Check format: lowercase alphanumeric + hyphens, start/end with alphanumeric
  if (!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(slug)) {
    return {
      valid: false,
      error:
        "Slug must be lowercase alphanumeric with hyphens, and start/end with alphanumeric",
    };
  }

  // Check for consecutive hyphens
  if (slug.includes("--")) {
    return { valid: false, error: "Slug cannot contain consecutive hyphens" };
  }

  // Check reserved words
  if (isReservedSlug(slug)) {
    const reservedPart = slug.split("-")[0];
    return {
      valid: false,
      error: `Slug cannot start with reserved word: ${reservedPart}`,
    };
  }

  return { valid: true };
}

/**
 * Check if a slug uses a reserved word
 *
 * @param slug - The slug to check
 * @returns True if the slug uses a reserved word
 */
export function isReservedSlug(slug: string): boolean {
  const firstPart = slug.split("-")[0];
  return (RESERVED_SLUGS as readonly string[]).includes(firstPart ?? "");
}

/**
 * Sanitize a string to be URL-friendly
 *
 * @param str - The string to sanitize
 * @returns A URL-friendly string
 */
export function sanitizeForSlug(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/--+/g, "-");
}
