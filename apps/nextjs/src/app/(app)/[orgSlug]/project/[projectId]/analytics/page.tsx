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
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";

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
import { StatCard } from "./stat-card";

interface AnalyticsPageProps {
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

  const chartConfig = {
    uploadsCompleted: { label: "Completed", color: "var(--chart-1)" },
    uploadsFailed: { label: "Failed", color: "var(--chart-2)" },
    downloads: { label: "Downloads", color: "var(--chart-3)" },
    bytesUploaded: { label: "Uploaded", color: "var(--chart-1)" },
    bytesDownloaded: { label: "Downloaded", color: "var(--chart-3)" },
  };

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
          <Card>
            <CardHeader>
              <CardTitle>Upload Activity</CardTitle>
              <CardDescription>
                Completed and failed uploads over the last 30 days
              </CardDescription>
            </CardHeader>
            <CardContent>
              {analyticsQuery.isLoading ? (
                <Skeleton className="h-[200px] w-full" />
              ) : dailyData.length > 0 ? (
                <ChartContainer config={chartConfig} className="h-[200px] aspect-auto">
                  <BarChart data={dailyData}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      className="stroke-border"
                    />
                    <XAxis
                      dataKey="date"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      className="fill-muted-foreground text-xs"
                      tickFormatter={(value) => {
                        const date = new Date(value as string);
                        return date.toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        });
                      }}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      className="fill-muted-foreground text-xs"
                    />
                    <ChartTooltip
                      cursor={false}
                      content={
                        <ChartTooltipContent />
                      }
                    />
                    <Bar
                      dataKey="uploadsCompleted"
                      fill="var(--color-uploadsCompleted)"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="uploadsFailed"
                      fill="var(--color-uploadsFailed)"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ChartContainer>
              ) : (
                <div className="flex h-[200px] items-center justify-center">
                  <p className="text-muted-foreground">No data available</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Download Activity</CardTitle>
              <CardDescription>
                File downloads over the last 30 days
              </CardDescription>
            </CardHeader>
            <CardContent>
              {analyticsQuery.isLoading ? (
                <Skeleton className="h-[200px] w-full" />
              ) : dailyData.length > 0 ? (
                <ChartContainer config={chartConfig} className="h-[200px] aspect-auto">
                  <AreaChart data={dailyData}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      className="stroke-border"
                    />
                    <XAxis
                      dataKey="date"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      className="fill-muted-foreground text-xs"
                      tickFormatter={(value) => {
                        const date = new Date(value as string);
                        return date.toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        });
                      }}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      className="fill-muted-foreground text-xs"
                    />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent />
                      }
                    />
                    <Area
                      type="monotone"
                      dataKey="downloads"
                      stroke="var(--color-downloads)"
                      fill="var(--color-downloads)"
                      fillOpacity={0.3}
                    />
                  </AreaChart>
                </ChartContainer>
              ) : (
                <div className="flex h-[200px] items-center justify-center">
                  <p className="text-muted-foreground">No data available</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Bandwidth Usage</CardTitle>
            <CardDescription>
              Data uploaded and downloaded over the last 30 days
            </CardDescription>
          </CardHeader>
          <CardContent>
            {analyticsQuery.isLoading ? (
              <Skeleton className="h-[200px] w-full" />
            ) : dailyData.length > 0 ? (
              <ChartContainer config={chartConfig} className="h-[400px] aspect-auto">
                <AreaChart data={dailyData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    className="stroke-border"
                  />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    className="fill-muted-foreground text-xs"
                    tickFormatter={(value) => {
                      const date = new Date(value as string);
                      return date.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      });
                    }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    className="fill-muted-foreground text-xs"
                    tickFormatter={(value) => formatBytes(value as number)}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent />
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="bytesUploaded"
                    stroke="var(--color-bytesUploaded)"
                    fill="var(--color-bytesUploaded)"
                    fillOpacity={0.3}
                    stackId="1"
                  />
                  <Area
                    type="monotone"
                    dataKey="bytesDownloaded"
                    stroke="var(--color-bytesDownloaded)"
                    fill="var(--color-bytesDownloaded)"
                    fillOpacity={0.3}
                    stackId="1"
                  />
                </AreaChart>
              </ChartContainer>
            ) : (
              <div className="flex h-[200px] items-center justify-center">
                <p className="text-muted-foreground">No data available</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
