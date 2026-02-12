"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

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
import { chartConfig } from "./chart-utils";

interface UploadActivityChartProps {
  dailyData: DailyData[];
  isLoading: boolean;
}

export function UploadActivityChart({
  dailyData,
  isLoading,
}: UploadActivityChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload Activity</CardTitle>
        <CardDescription>
          Completed and failed uploads over the last 30 days
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[200px] w-full" />
        ) : dailyData.length > 0 ? (
          <ChartContainer
            config={chartConfig}
            className="aspect-auto h-[200px]"
          >
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
              <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
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
  );
}
