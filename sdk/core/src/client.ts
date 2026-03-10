export interface BetterS3ClientConfig {
  apiBaseUrl: string;
  apiKey?: string;
}

export interface BetterS3Client {
  getApiBaseUrl(): string;
  getApiKey(): string | undefined;
}

export function createBetterS3Client(config: BetterS3ClientConfig): BetterS3Client {
  const apiBaseUrl = config.apiBaseUrl.replace(/\/+$/, "");

  return {
    getApiBaseUrl: () => apiBaseUrl,
    getApiKey: () => config.apiKey,
  };
}
