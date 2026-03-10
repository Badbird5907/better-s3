import { generateSignedUploadUrl, SignedUploadUrlParams } from "@silo/shared/signing";

export interface SiloClientConfig {
  apiBaseUrl: string;
  apiKey?: string;
}

export interface SiloClient {
  getApiBaseUrl(): string;
  getApiKey(): string | undefined;
}

export function createSiloClient(config: SiloClientConfig): SiloClient {
  const apiBaseUrl = config.apiBaseUrl.replace(/\/+$/, "");

  return {
    getApiBaseUrl: () => apiBaseUrl,
    getApiKey: () => config.apiKey,

  };
}
