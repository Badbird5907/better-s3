"use client";

import FilesPage from "@/app/(app)/[orgSlug]/p/[projectId]/files/page";

type FilesPageProps = Parameters<typeof FilesPage>[0];

export default function EnvironmentFilesPage(props: FilesPageProps) {
  return <FilesPage {...props} />;
}
