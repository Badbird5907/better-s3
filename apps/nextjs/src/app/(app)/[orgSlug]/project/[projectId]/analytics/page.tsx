"use client";

import { use } from "react";
import { notFound } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  DownloadIcon,
  FileIcon,
  HardDriveIcon,
  TrendingUpIcon,
} from "lucide-react";

import { Card, CardContent, CardHeader } from "@app/ui/components/card";
import { Skeleton } from "@app/ui/components/skeleton";

import { useOrganization } from "@/hooks/use-organization";
import { useTRPC } from "@/trpc/react";
import { BandwidthUsageChart } from "./bandwidth-usage-chart";
import { formatBytes } from "./chart-utils";
import { DownloadActivityChart } from "./download-activity-chart";
import { StatCard } from "./stat-card";
import { UploadActivityChart } from "./upload-activity-chart";

interface AnalyticsPageProps {
  params: Promise<{
    orgSlug: string;
    projectId: string;
  }>;
}

export default function AnalyticsPage({ params }: AnalyticsPageProps) {
  const trpc = useTRPC();
  const { organization } = useOrganization();
  const organizationId = organization?.id ?? "";

  const { projectId } = use(params);

  const projectQuery = useQuery(
    trpc.project.getById.queryOptions(
      { id: projectId, organizationId },
      { enabled: !!organizationId },
    ),
  );

  const analyticsQuery = useQuery(
    trpc.analytics.getProjectStats.queryOptions(
      { projectId, organizationId },
      { enabled: !!organizationId && !!projectId },
    ),
  );

  if (projectQuery.isLoading || !organizationId) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (projectQuery.error || !projectQuery.data) {
    notFound();
  }

  const stats = analyticsQuery.data;

  const dailyData =
    stats?.daily.map((d) => ({
      date: d.date,
      uploadsCompleted: d.uploadsCompleted,
      uploadsFailed: d.uploadsFailed,
      downloads: d.downloads,
      bytesUploaded: d.bytesUploaded,
      bytesDownloaded: d.bytesDownloaded,
    })) ?? [];

  return (
    <>
      <div className="flex flex-1 flex-col gap-4 p-4">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Storage"
            value={formatBytes(stats?.storage.totalBytes ?? 0)}
            description={`${stats?.storage.fileCount ?? 0} files`}
            icon={HardDriveIcon}
          />
          <StatCard
            title="Uploads"
            value={stats?.totals.uploadsCompleted ?? 0}
            description={`${stats?.totals.uploadsFailed ?? 0} failed`}
            icon={TrendingUpIcon}
          />
          <StatCard
            title="Downloads"
            value={stats?.totals.downloads ?? 0}
            description="Total downloads"
            icon={DownloadIcon}
          />
          <StatCard
            title="Data Transferred"
            value={formatBytes(
              (stats?.totals.bytesUploaded ?? 0) +
                (stats?.totals.bytesDownloaded ?? 0),
            )}
            description="Upload + Download"
            icon={FileIcon}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <UploadActivityChart
            dailyData={dailyData}
            isLoading={analyticsQuery.isLoading}
          />
          <DownloadActivityChart
            dailyData={dailyData}
            isLoading={analyticsQuery.isLoading}
          />
        </div>

        <BandwidthUsageChart
          dailyData={dailyData}
          isLoading={analyticsQuery.isLoading}
        />
      </div>
    </>
  );
}
