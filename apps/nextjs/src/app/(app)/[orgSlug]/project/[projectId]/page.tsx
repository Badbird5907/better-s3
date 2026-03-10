"use client";

import { use, useMemo } from "react";
import { notFound } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis } from "recharts";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@app/ui/components/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@app/ui/components/chart";
import { Skeleton } from "@app/ui/components/skeleton";

import { useOrganization } from "@/hooks/use-organization";
import { useTRPC } from "@/trpc/react";

interface ProjectPageProps {
  params: Promise<{
    orgSlug: string;
    projectId: string;
  }>;
}

const DEFAULT_ANALYTICS_DAYS = 14;

function getDefaultAnalyticsRange() {
  const end = new Date();
  end.setHours(0, 0, 0, 0);

  const start = new Date(end);
  start.setDate(end.getDate() - (DEFAULT_ANALYTICS_DAYS - 1));

  return { start, end };
}

function formatDateParam(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export default function ProjectPage({ params }: ProjectPageProps) {
  const trpc = useTRPC();
  const { organization } = useOrganization();
  const organizationId = organization?.id ?? "";
  const defaultRange = useMemo(() => getDefaultAnalyticsRange(), []);

  // Unwrap params
  const { projectId } = use(params);

  const projectQuery = useQuery(
    trpc.project.getById.queryOptions(
      { id: projectId, organizationId },
      { enabled: !!organizationId },
    ),
  );
  const analyticsQuery = useQuery(
    trpc.analytics.getProjectStats.queryOptions(
      {
        projectId,
        organizationId,
        startDate: formatDateParam(defaultRange.start),
        endDate: formatDateParam(defaultRange.end),
      },
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
  const chartConfig = {
    uploadsCompleted: { label: "Completed", color: "var(--chart-1)" },
    uploadsFailed: { label: "Failed", color: "var(--chart-2)" },
    downloads: { label: "Downloads", color: "var(--chart-3)" },
    totalBandwidth: { label: "Bandwidth", color: "var(--chart-4)" },
  };
  const dailyData =
    stats?.daily.map((d) => ({
      date: d.date,
      uploadsCompleted: d.uploadsCompleted,
      uploadsFailed: d.uploadsFailed,
      downloads: d.downloads,
      totalBandwidth: d.bytesUploaded + d.bytesDownloaded,
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

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Files</CardTitle>
              <CardDescription>Storage usage and file count</CardDescription>
            </CardHeader>
            <CardContent>
              {analyticsQuery.isLoading ? (
                <Skeleton className="h-[120px] w-full" />
              ) : dailyData.length > 0 ? (
                <div className="space-y-3">
                  <p className="text-muted-foreground text-xs">
                    {stats?.storage.fileCount ?? 0} files ·{" "}
                    {formatBytes(stats?.storage.totalBytes ?? 0)}
                  </p>
                  <ChartContainer config={chartConfig} className="h-[120px] aspect-auto">
                    <AreaChart data={dailyData}>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" />
                      <XAxis
                        dataKey="date"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        className="fill-muted-foreground text-xs"
                        tickFormatter={(value) =>
                          new Date(value as string).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })
                        }
                      />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Area
                        type="monotone"
                        dataKey="totalBandwidth"
                        stroke="var(--color-totalBandwidth)"
                        fill="var(--color-totalBandwidth)"
                        fillOpacity={0.3}
                      />
                    </AreaChart>
                  </ChartContainer>
                </div>
              ) : (
                <div className="flex h-[120px] items-center justify-center">
                  <p className="text-muted-foreground text-sm">No data available</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Upload Health</CardTitle>
              <CardDescription>Completed vs failed uploads</CardDescription>
            </CardHeader>
            <CardContent>
              {analyticsQuery.isLoading ? (
                <Skeleton className="h-[120px] w-full" />
              ) : dailyData.length > 0 ? (
                <ChartContainer config={chartConfig} className="h-[120px] aspect-auto">
                  <BarChart data={dailyData}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      className="fill-muted-foreground text-xs"
                      tickFormatter={(value) =>
                        new Date(value as string).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })
                      }
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="uploadsCompleted" fill="var(--color-uploadsCompleted)" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="uploadsFailed" fill="var(--color-uploadsFailed)" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              ) : (
                <div className="flex h-[120px] items-center justify-center">
                  <p className="text-muted-foreground text-sm">No data available</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Activity</CardTitle>
              <CardDescription>Recent downloads trend</CardDescription>
            </CardHeader>
            <CardContent>
              {analyticsQuery.isLoading ? (
                <Skeleton className="h-[120px] w-full" />
              ) : dailyData.length > 0 ? (
                <div className="space-y-3">
                  <p className="text-muted-foreground text-xs">
                    {stats?.totals.downloads ?? 0} total downloads
                  </p>
                  <ChartContainer config={chartConfig} className="h-[120px] aspect-auto">
                    <AreaChart data={dailyData}>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" />
                      <XAxis
                        dataKey="date"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        className="fill-muted-foreground text-xs"
                        tickFormatter={(value) =>
                          new Date(value as string).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })
                        }
                      />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Area
                        type="monotone"
                        dataKey="downloads"
                        stroke="var(--color-downloads)"
                        fill="var(--color-downloads)"
                        fillOpacity={0.3}
                      />
                    </AreaChart>
                  </ChartContainer>
                </div>
              ) : (
                <div className="flex h-[120px] items-center justify-center">
                  <p className="text-muted-foreground text-sm">No data available</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
