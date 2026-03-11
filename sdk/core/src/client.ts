import { createSiloCore } from "./upload";
import type { UploadCore, UploadCoreConfig } from "./upload";

export interface SiloClientConfig {
  apiBaseUrl: string;
  apiKey?: string;
}

export type SiloClientUploadConfig = Omit<UploadCoreConfig, "apiBaseUrl" | "apiKey"> & {
  apiBaseUrl?: string;
  apiKey?: string;
};

export interface SiloClient {
  getApiBaseUrl(): string;
  getApiKey(): string | undefined;
  createSiloCore(config: SiloClientUploadConfig): UploadCore;
}

export function createSiloClient(config: SiloClientConfig): SiloClient {
  const apiBaseUrl = config.apiBaseUrl.replace(/\/+$/, "");

  return {
    getApiBaseUrl: () => apiBaseUrl,
    getApiKey: () => config.apiKey,
    createSiloCore: (uploadConfig) => {
      const apiKey = uploadConfig.apiKey ?? config.apiKey;
      if (!apiKey) {
        throw new Error(
          "Missing apiKey. Provide one in createSiloClient(...) or createSiloCore(...).",
        );
      }

      return createSiloCore({
        ...uploadConfig,
        apiBaseUrl: uploadConfig.apiBaseUrl ?? apiBaseUrl,
        apiKey,
      });
    },
  };
}
