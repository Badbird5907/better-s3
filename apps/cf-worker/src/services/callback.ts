import type { Bindings } from "../types/bindings";
import type {
  FileKeyInfo,
  ProjectInfo,
  SignatureVerificationRequest,
  SignatureVerificationResponse,
  UploadCallbackData,
  UploadCallbackResponse,
} from "../types/project";

export async function verifyUploadSignature(
  request: SignatureVerificationRequest,
  env: Bindings,
): Promise<SignatureVerificationResponse> {
  console.log("[callback]", env.NEXTJS_CALLBACK_URL);
  console.log("[callback] Verifying upload signature with:", request);
  const response = await fetch(
    `${env.NEXTJS_CALLBACK_URL}/api/internal/verify-signature`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.CALLBACK_SECRET}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    },
  );

  console.log("[callback] Response:", response);

  if (!response.ok) {
    console.log("[callback] Error response:", response);
    try {
      const error = await response.json();
      console.log("[callback] Error:", error);
      throw new Error(error.error ?? "Signature verification failed");
    } catch {
      throw new Error("Signature verification failed");
    }
  }

  return (await response.json()) as SignatureVerificationResponse;
}

export async function sendUploadCallback(
  data: UploadCallbackData,
  env: Bindings,
): Promise<UploadCallbackResponse> {
  const url = `${env.NEXTJS_CALLBACK_URL}/api/internal/callback`;
  console.log("[callback] Sending upload callback to:", url);
  console.log("[callback] Data:", JSON.stringify(data, null, 2));

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.CALLBACK_SECRET}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    console.log("[callback] Response status:", response.status);

    if (!response.ok) {
      const text = await response.text();
      console.error("[callback] Error response:", text);
      try {
        const error = JSON.parse(text);
        throw new Error(error?.error ?? "Upload callback failed");
      } catch {
        throw new Error(`Upload callback failed: ${text}`);
      }
    }

    const result = (await response.json()) as UploadCallbackResponse;
    console.log("[callback] Success:", result);
    return result;
  } catch (error) {
    console.error("[callback] Fetch error:", error);
    throw error;
  }
}

export async function lookupFileKey(
  accessKey: string,
  projectId: string,
  env: Bindings,
): Promise<FileKeyInfo> {
  const response = await fetch(
    `${env.NEXTJS_CALLBACK_URL}/api/internal/lookup-file-key`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.CALLBACK_SECRET}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ accessKey, projectId }),
    },
  );

  if (!response.ok) {
    try {
      const error: any = await response.json();
      throw new Error(error?.error ?? "File key lookup failed");
    } catch {
      throw new Error("File key lookup failed");
    }
  }

  return (await response.json()) as FileKeyInfo;
}
