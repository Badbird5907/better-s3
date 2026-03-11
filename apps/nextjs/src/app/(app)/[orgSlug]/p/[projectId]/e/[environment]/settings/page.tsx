"use client";

import ProjectSettingsPage from "@/app/(app)/[orgSlug]/p/[projectId]/settings/page";

type ProjectSettingsPageProps = Parameters<typeof ProjectSettingsPage>[0];

export default function EnvironmentProjectSettingsPage(
  props: ProjectSettingsPageProps,
) {
  return <ProjectSettingsPage {...props} />;
}
