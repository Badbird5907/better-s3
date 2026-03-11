"use client";

import * as React from "react";
import * as tus from "tus-js-client";

import { Button } from "@/components/ui/button";

type RegisteredFile = {
  fileKeyId: string;
  accessKey: string;
  uploadUrl: string;
  fileName: string;
  size: number;
  mimeType?: string;
};

type RegisterResponse = {
  ok: boolean;
  files?: RegisteredFile[];
  error?: {
    code?: string;
    message?: string;
  };
};

type CompletionResponse = {
  ok: boolean;
  pending?: boolean;
  completion?: {
    fileKeyId: string;
    routeSlug: string;
    onUploadCompleteResult?: {
      uploadedBy?: string;
      fileName?: string;
      mimeType?: string;
      size?: number;
    };
  };
  error?: {
    code?: string;
    message?: string;
  };
};

type UploadState =
  | "idle"
  | "preparing"
  | "uploading"
  | "paused"
  | "finalizing"
  | "success"
  | "error";

export function TusUploadDemo() {
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [state, setState] = React.useState<UploadState>("idle");
  const [progressPercent, setProgressPercent] = React.useState(0);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [lastAccessKey, setLastAccessKey] = React.useState<string | null>(null);
  const [lastFileKeyId, setLastFileKeyId] = React.useState<string | null>(null);

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const uploadRef = React.useRef<tus.Upload | null>(null);
  const activeUploadIdRef = React.useRef<string | null>(null);
  const committedBytesRef = React.useRef(0);

  React.useEffect(() => {
    return () => {
      const upload = uploadRef.current;
      if (upload) {
        void upload.abort();
      }
    };
  }, []);

  async function registerUpload(file: File): Promise<RegisteredFile> {
    const response = await fetch("/api/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "register",
        endpoint: "imageUploader",
        files: [
          {
            fileName: file.name,
            size: file.size,
            mimeType: file.type || undefined,
          },
        ],
      }),
    });

    const data = (await response.json().catch(() => null)) as RegisterResponse | null;
    const firstFile = data?.files?.[0];
    if (!response.ok || !data?.ok || !firstFile) {
      throw new Error(data?.error?.message ?? "Failed to register upload.");
    }

    return firstFile;
  }

  async function awaitCompletion(fileKeyId: string) {
    const deadlineMs = Date.now() + 5 * 60_000;
    let retryDelayMs = 1_000;

    while (Date.now() < deadlineMs) {
      if (activeUploadIdRef.current !== fileKeyId) {
        return;
      }

      const response = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "await-completion",
          fileKeyId,
          timeoutMs: 30_000,
        }),
      });

      const data = (await response.json().catch(() => null)) as CompletionResponse | null;
      if (!response.ok || !data?.ok) {
        throw new Error(data?.error?.message ?? "Failed to await upload completion.");
      }

      if (data.completion) {
        return;
      }

      if (!data.pending) {
        throw new Error("Upload completed but callback is still pending.");
      }

      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
      retryDelayMs = Math.min(retryDelayMs + 500, 5_000);
    }

    throw new Error(
      "Upload finished, but server callback is still pending. Please wait and refresh the file list.",
    );
  }

  async function startUpload() {
    const file = selectedFile;
    if (!file) return;

    setErrorMessage(null);
    setProgressPercent(0);
    setLastAccessKey(null);
    setLastFileKeyId(null);
    committedBytesRef.current = 0;
    setState("preparing");

    try {
      const registration = await registerUpload(file);
      activeUploadIdRef.current = registration.fileKeyId;
      setLastAccessKey(registration.accessKey);
      setLastFileKeyId(registration.fileKeyId);

      const upload = new tus.Upload(file, {
        endpoint: registration.uploadUrl,
        uploadSize: file.size,
        // Use finite chunks so pause/resume can continue from last committed offset.
        chunkSize: 8 * 1024 * 1024,
        retryDelays: [0, 1000, 3000, 5000],
        metadata: {
          filename: file.name,
          filetype: file.type || "application/octet-stream",
        },
        removeFingerprintOnSuccess: true,
        onError: (error) => {
          if (activeUploadIdRef.current !== registration.fileKeyId) return;
          setState("error");
          setErrorMessage(error.message ?? "Upload failed.");
        },
        onProgress: (uploaded, total) => {
          if (activeUploadIdRef.current !== registration.fileKeyId) return;
          const effectiveUploaded = Math.max(uploaded, committedBytesRef.current);
          const percent = total > 0 ? Math.round((effectiveUploaded / total) * 100) : 0;
          setProgressPercent(percent);
        },
        onChunkComplete: (_chunkSize, bytesAccepted, bytesTotal) => {
          if (activeUploadIdRef.current !== registration.fileKeyId) return;
          committedBytesRef.current = bytesAccepted;
          const percent = bytesTotal > 0 ? Math.round((bytesAccepted / bytesTotal) * 100) : 0;
          setProgressPercent(percent);
        },
        onSuccess: () => {
          if (activeUploadIdRef.current !== registration.fileKeyId) return;
          committedBytesRef.current = file.size;
          setState("finalizing");
          void awaitCompletion(registration.fileKeyId)
            .then(() => {
              if (activeUploadIdRef.current !== registration.fileKeyId) return;
              setProgressPercent(100);
              setState("success");
            })
            .catch((error: unknown) => {
              if (activeUploadIdRef.current !== registration.fileKeyId) return;
              setState("error");
              setErrorMessage(
                error instanceof Error
                  ? error.message
                  : "Upload succeeded but completion failed.",
              );
            });
        },
      });

      uploadRef.current = upload;
      setState("uploading");
      upload.start();
    } catch (error) {
      setState("error");
      setErrorMessage(
        error instanceof Error ? error.message : "Could not initialize upload.",
      );
    }
  }

  async function pauseUpload() {
    const upload = uploadRef.current;
    if (!upload || state !== "uploading") return;
    await upload.abort();
    setState("paused");
  }

  function resumeUpload() {
    const upload = uploadRef.current;
    if (!upload || state !== "paused") return;
    setErrorMessage(null);
    setState("uploading");
    upload.start();
  }

  async function cancelUpload() {
    const upload = uploadRef.current;
    if (!upload) return;

    // `abort(true)` asks the server to terminate the upload when supported.
    await (upload as tus.Upload & { abort: (shouldTerminate?: boolean) => Promise<void> })
      .abort(true)
      .catch(() => undefined);

    uploadRef.current = null;
    activeUploadIdRef.current = null;
    setState("idle");
    setProgressPercent(0);
    committedBytesRef.current = 0;
    setErrorMessage(null);
    setLastAccessKey(null);
    setLastFileKeyId(null);
  }

  function resetDemo() {
    void cancelUpload();
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  const hasFile = !!selectedFile;
  const canStart = hasFile && (state === "idle" || state === "error");
  const canPause = state === "uploading";
  const canResume = state === "paused";
  const canCancel = state === "uploading" || state === "paused";
  const canReset = hasFile || state !== "idle" || progressPercent > 0 || !!errorMessage;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0] ?? null;
            setSelectedFile(file);
            setState("idle");
            setProgressPercent(0);
            setErrorMessage(null);
            setLastAccessKey(null);
            setLastFileKeyId(null);
          }}
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={
            state === "uploading" ||
            state === "paused" ||
            state === "preparing" ||
            state === "finalizing"
          }
        >
          Choose file
        </Button>
        <p className="text-sm text-muted-foreground">
          {selectedFile
            ? `${selectedFile.name} (${Math.max(1, Math.round(selectedFile.size / 1024))} KB)`
            : "No file selected"}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            void startUpload();
          }}
          disabled={!canStart}
        >
          Start upload
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            void pauseUpload();
          }}
          disabled={!canPause}
        >
          Pause
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={resumeUpload}
          disabled={!canResume}
        >
          Resume
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            void cancelUpload();
          }}
          disabled={!canCancel}
        >
          Cancel
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={resetDemo}
          disabled={!canReset}
        >
          Reset
        </Button>
      </div>

      <div className="space-y-2 rounded-md border p-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Status</span>
          <span className="font-medium">{state}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-foreground transition-all"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <p className="text-sm text-muted-foreground">Progress: {progressPercent}%</p>
      </div>

      {lastFileKeyId ? (
        <p className="text-xs text-muted-foreground">File Key ID: {lastFileKeyId}</p>
      ) : null}
      {lastAccessKey ? (
        <p className="text-xs text-muted-foreground">Access Key: {lastAccessKey}</p>
      ) : null}
      {errorMessage ? <p className="text-sm text-red-500">Error: {errorMessage}</p> : null}
    </div>
  );
}
