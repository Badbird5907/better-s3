export interface Bindings {
  R2_BUCKET: R2Bucket;
  TUS_METADATA: KVNamespace;
  TUS_EXPIRATION: KVNamespace;

  WORKER_DOMAIN: string;
  NEXTJS_CALLBACK_URL: string;
  CALLBACK_SECRET: string;
  SIGNING_SECRET: string;
  TUS_MAX_SIZE: string;
  TUS_EXPIRATION_HOURS: string;
}

export interface Variables {
  projectSlug: string | null;
  projectId: string;
  defaultFileAccess: "public" | "private";
}
