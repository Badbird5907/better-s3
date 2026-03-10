export type { BetterS3Client, BetterS3ClientConfig } from "./client";
export { createBetterS3Client } from "./client";
export {
  deriveSigningSecret,
  generateSignedDownloadUrl,
  generateSignedUploadUrl,
  hashString,
  verifySignedUrl,
} from "@app/shared/signing";
