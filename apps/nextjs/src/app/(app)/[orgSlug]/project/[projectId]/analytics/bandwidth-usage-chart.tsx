"use client";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

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

import type { DailyData } from "./chart-utils";
import { chartConfig, formatBytes } from "./chart-utils";

interface BandwidthUsageChartProps {
  dailyData: DailyData[];
  isLoading: boolean;
}

export function BandwidthUsageChart({
  dailyData,
  isLoading,
}: BandwidthUsageChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Bandwidth Usage</CardTitle>
        <CardDescription>
          Data uploaded and downloaded over the last 30 days
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[200px] w-full" />
        ) : dailyData.length > 0 ? (
          <ChartContainer
            config={chartConfig}
            className="aspect-auto h-[400px]"
          >
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
              <ChartTooltip content={<ChartTooltipContent />} />
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
  );
}
