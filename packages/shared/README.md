# @app/shared

Shared utilities and functions used across the Better S3 application.

## Signed URL Generation

This package provides cryptographically secure signed URL generation and verification for file upload and download operations through the Cloudflare Worker.

### Features

- **HMAC-SHA256 Signing**: Uses Web Crypto API for secure, timing-attack resistant signatures
- **Expiration Support**: URLs automatically expire after a configurable duration (default: 1 hour)
- **Type-Safe**: Full TypeScript support with strict type checking
- **Cross-Platform**: Works in Node.js 15+, browsers, and Cloudflare Workers
- **Upload & Download URLs**: Separate functions for different operation types

### Usage

#### Generating a Signed Upload URL

```typescript
import { generateSignedUploadUrl } from '@app/shared';

const uploadUrl = await generateSignedUploadUrl(
  'https://your-worker.workers.dev',
  {
    projectId: 'proj_123',
    environmentId: 'env_456',
    fileKeyId: 'fk_789',
    uploadIntentId: 'ui_abc',
    hash: 'sha256_hash_of_file',
    mimeType: 'image/png',
    size: 1024000,
    expiresIn: 3600, // optional, defaults to 1 hour
  },
  process.env.SIGNING_SECRET!
);

// Returns: https://your-worker.workers.dev/upload/fk_789?type=upload&projectId=proj_123&...&signature=abc123...
```

#### Generating a Signed Download URL

```typescript
import { generateSignedDownloadUrl } from '@app/shared';

const downloadUrl = await generateSignedDownloadUrl(
  'https://your-worker.workers.dev',
  {
    fileKeyId: 'fk_789',
    accessKey: 'ak_xyz',
    fileName: 'my-image.png', // optional
    expiresIn: 7200, // 2 hours
  },
  process.env.SIGNING_SECRET!
);

// Returns: https://your-worker.workers.dev/download/fk_789?type=download&fileKeyId=fk_789&...&signature=def456...
```

#### Verifying a Signed URL (in Cloudflare Worker)

```typescript
import { 
  verifySignedUrl, 
  extractUploadParams, 
  extractDownloadParams 
} from '@app/shared';

// In your Cloudflare Worker
app.post('/upload/:fileKeyId', async (c) => {
  const url = c.req.url;
  
  try {
    // Verify the URL signature and expiration
    const parsed = await verifySignedUrl(url, c.env.SIGNING_SECRET);
    
    // Extract typed parameters
    const params = extractUploadParams(parsed);
    
    // Now you can safely use the parameters
    console.log(params.projectId, params.fileKeyId, params.size);
    
    // Process the upload...
    
  } catch (error) {
    return c.json({ error: error.message }, 401);
  }
});

app.get('/download/:fileKeyId', async (c) => {
  const url = c.req.url;
  
  try {
    const parsed = await verifySignedUrl(url, c.env.SIGNING_SECRET);
    const params = extractDownloadParams(parsed);
    
    // Process the download...
    
  } catch (error) {
    return c.json({ error: error.message }, 401);
  }
});
```

### API Reference

#### `generateSignedUploadUrl(baseUrl, params, signingSecret)`

Generates a signed URL for file upload operations.

**Parameters:**
- `baseUrl` (string): The base URL of your Cloudflare Worker
- `params` (SignedUploadUrlParams):
  - `projectId`: Project identifier
  - `environmentId`: Environment identifier
  - `fileKeyId`: File key identifier
  - `uploadIntentId`: Upload intent identifier
  - `hash`: SHA-256 hash of the file
  - `mimeType`: MIME type of the file
  - `size`: File size in bytes
  - `expiresIn?`: Optional expiration time in seconds (default: 3600)
- `signingSecret` (string): Secret key for HMAC signing

**Returns:** Promise<string> - The signed URL

#### `generateSignedDownloadUrl(baseUrl, params, signingSecret)`

Generates a signed URL for file download operations.

**Parameters:**
- `baseUrl` (string): The base URL of your Cloudflare Worker
- `params` (SignedDownloadUrlParams):
  - `fileKeyId`: File key identifier
  - `accessKey`: Access key for the file
  - `fileName?`: Optional filename for Content-Disposition header
  - `expiresIn?`: Optional expiration time in seconds (default: 3600)
- `signingSecret` (string): Secret key for HMAC signing

**Returns:** Promise<string> - The signed URL

#### `verifySignedUrl(url, signingSecret)`

Verifies a signed URL's signature and expiration.

**Parameters:**
- `url` (string): The full signed URL to verify
- `signingSecret` (string): Secret key used for signing

**Returns:** Promise<ParsedSignedUrl> - Parsed URL data including type, params, and expiration

**Throws:**
- Error if signature is missing or invalid
- Error if URL has expired
- Error if required parameters are missing

#### `extractUploadParams(parsed)`

Extracts and validates upload parameters from a verified signed URL.

**Parameters:**
- `parsed` (ParsedSignedUrl): Result from `verifySignedUrl()`

**Returns:** Omit<SignedUploadUrlParams, 'expiresIn'>

**Throws:** Error if not an upload URL or if required parameters are missing

#### `extractDownloadParams(parsed)`

Extracts and validates download parameters from a verified signed URL.

**Parameters:**
- `parsed` (ParsedSignedUrl): Result from `verifySignedUrl()`

**Returns:** Omit<SignedDownloadUrlParams, 'expiresIn'>

**Throws:** Error if not a download URL or if required parameters are missing

### Security Considerations

1. **Keep Signing Secret Secure**: Never expose your signing secret in client-side code or public repositories
2. **Use Environment Variables**: Store the signing secret in environment variables
3. **Short Expiration Times**: Use short expiration times (1-2 hours) for temporary access
4. **HTTPS Only**: Always serve signed URLs over HTTPS
5. **Timing Attack Protection**: The implementation uses timing-safe comparison for signature verification

### Environment Configuration

Make sure to set the `SIGNING_SECRET` environment variable in:

1. **Next.js App** (`.env`):
```env
SIGNING_SECRET=your-secure-random-secret-here
```

2. **Cloudflare Worker** (`wrangler.toml`):
```toml
[vars]
SIGNING_SECRET = "your-secure-random-secret-here"
```

Generate a secure random secret:
```bash
openssl rand -hex 32
```
