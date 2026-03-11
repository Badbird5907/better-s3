import * as React from "react";

import type {
  AnyFileRouterLike,
  RouteSlug,
  UseUploadOptions,
  UseUploadResult,
} from "../types";

export interface UploadButtonProps<
  TRouter extends AnyFileRouterLike,
  TEndpoint extends RouteSlug<TRouter>,
> extends UseUploadOptions<TRouter, TEndpoint> {
  multiple?: boolean;
  disabled?: boolean;
  input?: unknown;
  requestMetadata?: Record<string, unknown>;
  awaitTimeoutMs?: number;
  children?: React.ReactNode;
  useUpload: (
    options: UseUploadOptions<TRouter, TEndpoint>,
  ) => UseUploadResult<TRouter, TEndpoint>;
}

export function UploadButton<
  TRouter extends AnyFileRouterLike,
  TEndpoint extends RouteSlug<TRouter>,
>(props: UploadButtonProps<TRouter, TEndpoint>) {
  const {
    useUpload,
    endpoint,
    onUploadBegin,
    onUploadProgress,
    onComplete,
    onError,
    onUploadAborted,
    disabled,
    multiple,
    input,
    requestMetadata,
    awaitTimeoutMs,
    children,
  } = props;
  const upload = useUpload({
    endpoint,
    onUploadBegin,
    onUploadProgress,
    onComplete,
    onError,
    onUploadAborted,
  });
  const inputRef = React.useRef<HTMLInputElement>(null);

  return (
    <>
      <input
        ref={inputRef}
        hidden
        type="file"
        multiple={multiple}
        onChange={(event) => {
          const selected = Array.from(event.target.files ?? []);
          if (selected.length === 0) return;
          void upload.uploadFiles(selected, {
            input,
            requestMetadata,
            awaitTimeoutMs,
          });
          event.currentTarget.value = "";
        }}
      />
      <button
        type="button"
        disabled={disabled === true || upload.isUploading}
        onClick={() => inputRef.current?.click()}
      >
        {children ?? "Upload"}
      </button>
    </>
  );
}
