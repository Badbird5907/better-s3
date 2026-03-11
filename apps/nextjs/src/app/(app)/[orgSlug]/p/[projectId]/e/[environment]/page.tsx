"use client";

import ProjectPage from "@/app/(app)/[orgSlug]/p/[projectId]/page";

type ProjectPageProps = Parameters<typeof ProjectPage>[0];

export default function EnvironmentProjectPage(props: ProjectPageProps) {
  return <ProjectPage {...props} />;
}
