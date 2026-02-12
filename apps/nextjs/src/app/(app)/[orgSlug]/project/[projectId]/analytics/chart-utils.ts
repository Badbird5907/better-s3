export interface DailyData {
  date: string;
  uploadsCompleted: number;
  uploadsFailed: number;
  downloads: number;
  bytesUploaded: number;
  bytesDownloaded: number;
}

export const chartConfig = {
  uploadsCompleted: { label: "Completed", color: "var(--chart-1)" },
  uploadsFailed: { label: "Failed", color: "var(--chart-2)" },
  downloads: { label: "Downloads", color: "var(--chart-3)" },
  bytesUploaded: { label: "Uploaded", color: "var(--chart-1)" },
  bytesDownloaded: { label: "Downloaded", color: "var(--chart-3)" },
} as const;

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}
