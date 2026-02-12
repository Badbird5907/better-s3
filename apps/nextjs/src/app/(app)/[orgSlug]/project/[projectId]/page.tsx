"use client";

import { use } from "react";
import { notFound } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircleIcon,
  CheckCircle2Icon,
  ClockIcon,
  DownloadIcon,
  FileIcon,
  HardDriveIcon,
  UploadIcon,
  XCircleIcon,
} from "lucide-react";

import { Badge } from "@app/ui/components/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@app/ui/components/card";
import { Skeleton } from "@app/ui/components/skeleton";

import { useOrganization } from "@/hooks/use-organization";
import { useTRPC } from "@/trpc/react";
import { formatBytes } from "./analytics/chart-utils";
import { DownloadActivityChart } from "./analytics/download-activity-chart";
import { UploadActivityChart } from "./analytics/upload-activity-chart";

interface ProjectPageProps {
  params: Promise<{
    orgSlug: string;
    projectId: string;
  }>;
}

const eventTypeConfig = {
  upload_started: {
    label: "Upload started",
    icon: UploadIcon,
    color: "text-blue-500",
  },
  upload_completed: {
    label: "Upload completed",
    icon: CheckCircle2Icon,
    color: "text-green-500",
  },
  upload_failed: {
    label: "Upload failed",
    icon: XCircleIcon,
    color: "text-red-500",
  },
  download: {
    label: "Downloaded",
    icon: DownloadIcon,
    color: "text-purple-500",
  },
} as const;

const environmentTypeBadgeVariant: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  production: "default",
  staging: "secondary",
  development: "outline",
};

export default function ProjectPage({ params }: ProjectPageProps) {
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

  const fileStatsQuery = useQuery(
    trpc.fileKey.getStats.queryOptions(
      { projectId, organizationId },
      { enabled: !!organizationId && !!projectId },
    ),
  );

  const filterOptionsQuery = useQuery(
    trpc.fileKey.getFilterOptions.queryOptions(
      { projectId, organizationId },
      { enabled: !!organizationId && !!projectId },
    ),
  );

  const recentEventsQuery = useQuery(
    trpc.analytics.getRecentEvents.queryOptions(
      { projectId, organizationId, limit: 8 },
      { enabled: !!organizationId && !!projectId },
    ),
  );

  if (projectQuery.isLoading || !organizationId) {
    return (
      <>
        <div className="flex flex-1 flex-col gap-4 p-4">
          <Card>
            <CardHeader>
              <Skeleton className="h-8 w-1/3" />
              <Skeleton className="h-4 w-1/4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-24 w-full" />
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  if (projectQuery.error || !projectQuery.data) {
    notFound();
  }

  const project = projectQuery.data;
  const stats = analyticsQuery.data;
  const fileStats = fileStatsQuery.data;
  const environments = filterOptionsQuery.data?.environments ?? [];
  const recentEvents = recentEventsQuery.data ?? [];

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
        <Card>
          <CardHeader>
            <CardTitle>Project Dashboard</CardTitle>
            <CardDescription>
              Overview of your project: {project.name}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-muted-foreground">
              <p>Project ID: {project.id}</p>
              <p>Slug: {project.slug}</p>
              <p>Created: {new Date(project.createdAt).toLocaleDateString()}</p>
            </div>
          </CardContent>
        </Card>

        {/* Charts */}
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

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {/* Files Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Files</CardTitle>
              <CardDescription>Storage usage and file count</CardDescription>
            </CardHeader>
            <CardContent>
              {fileStatsQuery.isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ) : fileStats ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <HardDriveIcon className="text-muted-foreground h-4 w-4" />
                      <span className="text-sm">Total Storage</span>
                    </div>
                    <span className="text-sm font-medium">
                      {formatBytes(fileStats.totalSize)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2Icon className="h-4 w-4 text-green-500" />
                      <span className="text-sm">Completed</span>
                    </div>
                    <span className="text-sm font-medium">
                      {fileStats.completed}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ClockIcon className="h-4 w-4 text-yellow-500" />
                      <span className="text-sm">Pending</span>
                    </div>
                    <span className="text-sm font-medium">
                      {fileStats.pending}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <XCircleIcon className="h-4 w-4 text-red-500" />
                      <span className="text-sm">Failed</span>
                    </div>
                    <span className="text-sm font-medium">
                      {fileStats.failed}
                    </span>
                  </div>
                  <div className="border-t pt-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileIcon className="text-muted-foreground h-4 w-4" />
                        <span className="text-sm font-medium">Total</span>
                      </div>
                      <span className="text-sm font-bold">
                        {fileStats.total}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex h-24 items-center justify-center">
                  <p className="text-muted-foreground text-sm">
                    No data available
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Environments Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Environments</CardTitle>
              <CardDescription>
                Development, staging, production
              </CardDescription>
            </CardHeader>
            <CardContent>
              {filterOptionsQuery.isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              ) : environments.length > 0 ? (
                <div className="space-y-3">
                  {environments.map((env) => (
                    <div
                      key={env.id}
                      className="flex items-center justify-between"
                    >
                      <span className="text-sm">{env.name}</span>
                      <Badge
                        variant={
                          environmentTypeBadgeVariant[env.type] ?? "outline"
                        }
                      >
                        {env.type}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex h-24 items-center justify-center">
                  <p className="text-muted-foreground text-sm">
                    No environments configured
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Activity Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Activity</CardTitle>
              <CardDescription>Recent uploads and changes</CardDescription>
            </CardHeader>
            <CardContent>
              {recentEventsQuery.isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                </div>
              ) : recentEvents.length > 0 ? (
                <div className="space-y-3">
                  {recentEvents.map((event) => {
                    const config =
                      eventTypeConfig[
                        event.eventType as keyof typeof eventTypeConfig
                      ];
                    if (!config) return null;
                    const Icon = config.icon;
                    return (
                      <div key={event.id} className="flex items-start gap-2">
                        <Icon
                          className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${config.color}`}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm">
                            {config.label}
                            {event.environment
                              ? ` in ${event.environment.name}`
                              : ""}
                          </p>
                          <p className="text-muted-foreground text-xs">
                            {new Date(event.createdAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex h-24 items-center justify-center">
                  <p className="text-muted-foreground text-sm">
                    No recent activity
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
