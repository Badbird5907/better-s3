"use client";

import { use } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpRight,
  CheckCircle2,
  ChevronRight,
  Clock,
  DownloadIcon,
  FileIcon,
  FolderIcon,
  HardDriveIcon,
  TrendingUpIcon,
  Upload,
  XCircle,
} from "lucide-react";

import { Badge } from "@app/ui/components/badge";
import { Button } from "@app/ui/components/button";
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

interface ProjectPageProps {
  params: Promise<{
    orgSlug: string;
    projectId: string;
  }>;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - new Date(date).getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return "Just now";
}

function getEventIcon(eventType: string) {
  switch (eventType) {
    case "upload_started":
      return Clock;
    case "upload_completed":
      return CheckCircle2;
    case "upload_failed":
      return XCircle;
    case "download":
      return DownloadIcon;
    default:
      return FileIcon;
  }
}

function getEventColor(eventType: string) {
  switch (eventType) {
    case "upload_started":
      return "text-yellow-500";
    case "upload_completed":
      return "text-green-500";
    case "upload_failed":
      return "text-red-500";
    case "download":
      return "text-blue-500";
    default:
      return "text-muted-foreground";
  }
}

function getEventLabel(eventType: string) {
  switch (eventType) {
    case "upload_started":
      return "Upload started";
    case "upload_completed":
      return "Upload completed";
    case "upload_failed":
      return "Upload failed";
    case "download":
      return "Downloaded";
    default:
      return eventType;
  }
}

export default function ProjectPage({ params }: ProjectPageProps) {
  const trpc = useTRPC();
  const { organization } = useOrganization();
  const organizationId = organization?.id ?? "";

  const { projectId, orgSlug } = use(params);

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

  const environmentsQuery = useQuery(
    trpc.environment.list.queryOptions(
      { projectId, organizationId },
      { enabled: !!organizationId && !!projectId },
    ),
  );

  const recentEventsQuery = useQuery(
    trpc.analytics.getRecentEvents.queryOptions(
      { projectId, organizationId, limit: 10 },
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
  const environments = environmentsQuery.data ?? [];
  const recentEvents = recentEventsQuery.data ?? [];

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

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Storage
              </CardTitle>
              <HardDriveIcon className="text-muted-foreground h-4 w-4" />
            </CardHeader>
            <CardContent>
              {analyticsQuery.isLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <>
                  <div className="text-2xl font-bold">
                    {formatBytes(stats?.storage.totalBytes ?? 0)}
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {stats?.storage.fileCount ?? 0} files
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Uploads</CardTitle>
              <TrendingUpIcon className="text-muted-foreground h-4 w-4" />
            </CardHeader>
            <CardContent>
              {analyticsQuery.isLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <>
                  <div className="text-2xl font-bold">
                    {stats?.totals.uploadsCompleted ?? 0}
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {stats?.totals.uploadsFailed ?? 0} failed (30 days)
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Downloads</CardTitle>
              <DownloadIcon className="text-muted-foreground h-4 w-4" />
            </CardHeader>
            <CardContent>
              {analyticsQuery.isLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <>
                  <div className="text-2xl font-bold">
                    {stats?.totals.downloads ?? 0}
                  </div>
                  <p className="text-muted-foreground text-xs">Last 30 days</p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Data Transferred
              </CardTitle>
              <FileIcon className="text-muted-foreground h-4 w-4" />
            </CardHeader>
            <CardContent>
              {analyticsQuery.isLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <>
                  <div className="text-2xl font-bold">
                    {formatBytes(
                      (stats?.totals.bytesUploaded ?? 0) +
                        (stats?.totals.bytesDownloaded ?? 0),
                    )}
                  </div>
                  <p className="text-muted-foreground text-xs">
                    Upload + Download (30 days)
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Second Row - Environments and Activity */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {/* Environments Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Environments</CardTitle>
                <CardDescription>
                  {environments.length} environment
                  {environments.length !== 1 ? "s" : ""} configured
                </CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/${orgSlug}/project/${projectId}/settings`}>
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {environmentsQuery.isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-8 w-full" />
                  ))}
                </div>
              ) : environments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-4 text-center">
                  <FolderIcon className="text-muted-foreground mb-2 h-8 w-8" />
                  <p className="text-muted-foreground text-sm">
                    No environments yet
                  </p>
                  <Button variant="link" size="sm" asChild className="mt-1">
                    <Link href={`/${orgSlug}/project/${projectId}/settings`}>
                      Create one
                    </Link>
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {environments.map((env) => (
                    <div
                      key={env.id}
                      className="flex items-center justify-between rounded-lg border p-2"
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={`h-2 w-2 rounded-full ${
                            env.type === "production"
                              ? "bg-green-500"
                              : env.type === "staging"
                                ? "bg-yellow-500"
                                : "bg-blue-500"
                          }`}
                        />
                        <span className="text-sm font-medium">{env.name}</span>
                      </div>
                      <Badge
                        variant={
                          env.type === "production"
                            ? "default"
                            : env.type === "staging"
                              ? "secondary"
                              : "outline"
                        }
                      >
                        {env.type}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Activity Card */}
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Recent Activity</CardTitle>
                <CardDescription>Latest uploads and downloads</CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/${orgSlug}/project/${projectId}/analytics`}>
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {recentEventsQuery.isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Skeleton className="h-8 w-8 rounded-full" />
                      <div className="flex-1 space-y-1">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/4" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : recentEvents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Upload className="text-muted-foreground mb-2 h-8 w-8" />
                  <p className="text-muted-foreground text-sm">
                    No activity yet
                  </p>
                  <p className="text-muted-foreground text-xs">
                    Upload some files to see activity here
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  {recentEvents.slice(0, 8).map((event) => {
                    const Icon = getEventIcon(event.eventType);
                    const colorClass = getEventColor(event.eventType);
                    const fileKey = event.file?.fileKeys?.[0];
                    const fileName = fileKey?.fileName;
                    const fileKeyId = fileKey?.id;
                    const isClickable = !!fileKeyId;

                    const content = (
                      <div
                        className={`flex items-center gap-3 rounded-lg p-2 text-sm ${
                          isClickable
                            ? "hover:bg-muted/50 cursor-pointer transition-colors"
                            : ""
                        }`}
                      >
                        <div
                          className={`bg-muted flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${colorClass}`}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">
                            {fileName ?? getEventLabel(event.eventType)}
                          </p>
                          <p className="text-muted-foreground truncate text-xs">
                            <span className="mr-2">
                              {getEventLabel(event.eventType)}
                            </span>
                            {event.environment?.name && (
                              <span className="mr-2">
                                {event.environment.name}
                              </span>
                            )}
                            {event.bytes != null && formatBytes(event.bytes)}
                          </p>
                        </div>
                        <span className="text-muted-foreground shrink-0 text-xs whitespace-nowrap">
                          {formatRelativeTime(event.createdAt)}
                        </span>
                        {isClickable && (
                          <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0" />
                        )}
                      </div>
                    );

                    return isClickable ? (
                      <Link
                        key={event.id}
                        href={`/${orgSlug}/project/${projectId}/files/${fileKeyId}`}
                      >
                        {content}
                      </Link>
                    ) : (
                      <div key={event.id}>{content}</div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quick Actions</CardTitle>
            <CardDescription>
              Common tasks for managing your project
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" asChild>
                <Link href={`/${orgSlug}/project/${projectId}/files`}>
                  <FileIcon className="mr-2 h-4 w-4" />
                  Browse Files
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href={`/${orgSlug}/project/${projectId}/analytics`}>
                  <TrendingUpIcon className="mr-2 h-4 w-4" />
                  View Analytics
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href={`/${orgSlug}/project/${projectId}/settings`}>
                  <FolderIcon className="mr-2 h-4 w-4" />
                  Manage Environments
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
