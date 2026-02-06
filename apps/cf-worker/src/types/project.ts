export interface ProjectInfo {
  id: string;
  defaultFileAccess: "public" | "private";
}

export interface FileKeyInfo {
  id: string;
  fileName: string;
  accessKey: string;
  projectId: string;
  environmentId: string;
  isPublic: boolean;
  file: FileInfo;
}

export interface FileInfo {
  id: string;
  hash: string | null;
  mimeType: string;
  size: number;
  adapterKey: string;
}

export interface UploadCallbackData {
  type: "upload-completed" | "upload-failed";
  data:
    | {
        environmentId: string;
        fileKeyId: string;
        fileName: string;
        claimedSize: number;
        claimedHash: string | null;
        claimedMimeType: string | null;
        actualHash: string | null;
        actualMimeType: string;
        actualSize: number;
        adapterKey: string;
        projectId: string;
        isPublic: boolean;
      }
    | {
        environmentId: string;
        fileKeyId: string;
        error?: string;
      };
}

export interface UploadCallbackResponse {
  success: boolean;
  fileKeyId?: string;
  accessKey?: string;
  fileId?: string;
  status?: string;
}

export interface SignatureVerificationRequest {
  keyId: string;
  signature: string;
  payload: {
    type: "upload";
    environmentId: string;
    fileKeyId: string;
    fileName: string;
    size: string;
    keyId: string;
    hash?: string;
    mimeType?: string;
    expiresAt?: string;
    isPublic?: string;
  };
}

export interface SignatureVerificationResponse {
  valid: boolean;
  projectId?: string;
  environmentId?: string;
  fileKeyId?: string;
  fileName?: string;
  size?: number;
  claimedHash?: string | null;
  claimedMimeType?: string | null;
  isPublic?: boolean;
  error?: string;
}
