import * as React from "react";

import {
  awaitCompletion,
  fetchRouterConfig,
  registerUpload,
  uploadFileWithProgress,
} from "./transport";
import type {
  AnyFileRouterLike,
  RouteSlug,
  RouterConfigLike,
  UploadCompletion,
  UseUploadOptions,
  UseUploadResult,
} from "./types";
import { SiloUploadError } from "./types";

interface UseUploadFactoryContext {
  endpointUrl: string;
  fetchImpl: typeof fetch;
  initialRouterConfig?: RouterConfigLike;
}

export function useUploadInternal<
  TRouter extends AnyFileRouterLike,
  TEndpoint extends RouteSlug<TRouter>,
>(
  factoryContext: UseUploadFactoryContext,
  endpointConfigContext: React.Context<RouterConfigLike | null>,
  options: UseUploadOptions<TRouter, TEndpoint>,
): UseUploadResult<TRouter, TEndpoint> {
  const [isUploading, setIsUploading] = React.useState(false);
  const [error, setError] = React.useState<SiloUploadError | null>(null);
  const [result, setResult] = React.useState<
    UploadCompletion<TRouter, TEndpoint>[] | null
  >(null);
  const [progressByFile, setProgressByFile] = React.useState<
    Record<string, number>
  >({});
  const abortRef = React.useRef<AbortController | null>(null);

  const contextRouterConfig = React.useContext(endpointConfigContext);
  const effectiveRouterConfig = contextRouterConfig ?? factoryContext.initialRouterConfig;

  React.useEffect(() => {
    if (effectiveRouterConfig?.[options.endpoint]) return;
    void fetchRouterConfig(factoryContext.endpointUrl, factoryContext.fetchImpl).catch(
      () => {
        // Best-effort warmup. upload path still works without this.
      },
    );
  }, [
    effectiveRouterConfig,
    factoryContext.endpointUrl,
    factoryContext.fetchImpl,
    options.endpoint,
  ]);

  const reset = React.useCallback(() => {
    setError(null);
    setResult(null);
    setProgressByFile({});
    setIsUploading(false);
  }, []);

  const abort = React.useCallback(() => {
    abortRef.current?.abort();
    options.onUploadAborted?.();
  }, [options]);

  const uploadFiles = React.useCallback<UseUploadResult<TRouter, TEndpoint>["uploadFiles"]>(
    async (files, uploadOptions) => {
      if (files.length === 0) return [];
      const abortController = new AbortController();
      abortRef.current = abortController;
      setIsUploading(true);
      setError(null);
      setResult(null);
      setProgressByFile({});

      const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
      let aggregateLoaded = 0;
      const loadedByIndex = new Map<number, number>();

      try {
        files.forEach((file, index) => options.onUploadBegin?.(file, index));

        const registrations = await registerUpload(
          factoryContext.endpointUrl,
          factoryContext.fetchImpl,
          {
            endpoint: options.endpoint,
            input: uploadOptions?.input,
            requestMetadata: uploadOptions?.requestMetadata,
            expiresIn: uploadOptions?.expiresIn,
            protocol: uploadOptions?.protocol,
            files: files.map((file) => ({
              fileName: file.name,
              size: file.size,
              mimeType: file.type || undefined,
            })),
          },
        );

        const completions: UploadCompletion<TRouter, TEndpoint>[] = [];
        for (const [index, file] of files.entries()) {
          const registration = registrations[index];
          if (!registration) {
            throw new SiloUploadError({
              code: "REGISTER_RESPONSE_INVALID",
              message: `Missing registration for file "${file.name}"`,
            });
          }

          await uploadFileWithProgress(
            registration.uploadUrl,
            file,
            (loaded, total) => {
              const previousLoaded = loadedByIndex.get(index) ?? 0;
              loadedByIndex.set(index, loaded);
              aggregateLoaded += loaded - previousLoaded;

              const percent = total > 0 ? (loaded / total) * 100 : 0;
              const aggregatePercent = totalBytes > 0
                ? (aggregateLoaded / totalBytes) * 100
                : 0;

              setProgressByFile((prev) => ({
                ...prev,
                [registration.fileKeyId]: percent,
              }));

              options.onUploadProgress?.({
                file,
                fileIndex: index,
                loaded,
                total,
                percent,
                aggregateLoaded,
                aggregateTotal: totalBytes,
                aggregatePercent,
              });
            },
            abortController.signal,
          );

          const completion = await awaitCompletion(
            factoryContext.endpointUrl,
            factoryContext.fetchImpl,
            registration.fileKeyId,
            uploadOptions?.awaitTimeoutMs,
          );

          completions.push({
            fileKeyId: completion.fileKeyId,
            routeSlug: completion.routeSlug as TEndpoint,
            accessKey: String(registration.accessKey),
            uploadUrl: String(registration.uploadUrl),
            result: completion.onUploadCompleteResult as UploadCompletion<
              TRouter,
              TEndpoint
            >["result"],
          });
        }

        setResult(completions);
        options.onComplete?.(completions);
        setIsUploading(false);
        return completions;
      } catch (cause) {
        const normalized = cause instanceof SiloUploadError
          ? cause
          : new SiloUploadError({
              code: "UPLOAD_FAILED",
              message: cause instanceof Error ? cause.message : "Upload failed",
              cause,
            });
        setError(normalized);
        options.onError?.(normalized);
        setIsUploading(false);
        throw normalized;
      } finally {
        abortRef.current = null;
      }
    },
    [factoryContext, options],
  );

  const uploadFile = React.useCallback<UseUploadResult<TRouter, TEndpoint>["uploadFile"]>(
    async (file, uploadOptions) => {
      const [completion] = await uploadFiles([file], uploadOptions);
      if (!completion) {
        throw new SiloUploadError({
          code: "UPLOAD_FAILED",
          message: "File upload did not produce a completion result",
        });
      }
      return completion;
    },
    [uploadFiles],
  );

  const aggregateLoaded = Object.values(progressByFile).reduce((sum, value) => sum + value, 0);
  const aggregateCount = Math.max(1, Object.keys(progressByFile).length);

  return {
    isIdle: !isUploading,
    isUploading,
    progress: {
      aggregatePercent: aggregateLoaded / aggregateCount,
      aggregateLoaded: 0,
      aggregateTotal: 0,
      byFile: progressByFile,
    },
    error,
    result,
    uploadFiles,
    uploadFile,
    abort,
    reset,
  };
}
