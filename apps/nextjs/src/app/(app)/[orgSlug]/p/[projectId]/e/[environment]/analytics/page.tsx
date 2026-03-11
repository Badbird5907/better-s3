"use client";

import AnalyticsPage from "@/app/(app)/[orgSlug]/p/[projectId]/analytics/page";

type AnalyticsPageProps = Parameters<typeof AnalyticsPage>[0];

export default function EnvironmentAnalyticsPage(props: AnalyticsPageProps) {
  return <AnalyticsPage {...props} />;
}
