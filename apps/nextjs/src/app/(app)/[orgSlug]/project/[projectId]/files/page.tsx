"use client";

import * as React from "react";
import { use } from "react";
import { notFound, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Clock,
  Copy,
  ExternalLink,
  File,
  FileArchive,
  FileAudio,
  FileCode,
  FileImage,
  FileText,
  FileVideo,
  HardDrive,
  Loader2,
  MoreHorizontal,
  Search,
  Trash2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@app/ui/components/badge";
import { Button } from "@app/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@app/ui/components/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@app/ui/components/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@app/ui/components/dropdown-menu";
import { Input } from "@app/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@app/ui/components/select";
import { Skeleton } from "@app/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@app/ui/components/table";

import { getDownloadUrl } from "@/actions/file";
import { useOrganization } from "@/hooks/use-organization";
import { useTRPC } from "@/trpc/react";
import { UploadDialog } from "@/components/upload-dialog";

interface FilesPageProps {
  params: Promise<{
    orgSlug: string;
    projectId: string;
  }>;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function getFileIcon(mimeType: string | null) {
  if (!mimeType) return File;
  const type = mimeType.split("/")[0];
  switch (type) {
    case "image":
      return FileImage;
    case "video":
      return FileVideo;
    case "audio":
      return FileAudio;
    case "text":
      return FileText;
    case "application":
      if (
        mimeType.includes("zip") ||
        mimeType.includes("tar") ||
        mimeType.includes("rar")
      ) {
        return FileArchive;
      }
      if (
        mimeType.includes("json") ||
        mimeType.includes("javascript") ||
        mimeType.includes("xml")
      ) {
        return FileCode;
      }
      return File;
    default:
      return File;
  }
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

function copyToClipboard(text: string, label = "Copied") {
  void navigator.clipboard.writeText(text).then(() => {
    toast.success(`${label} to clipboard`);
  });
}

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

interface SearchInputProps {
  value: string;
  onDebouncedChange: (value: string) => void;
  placeholder?: string;
}

const SearchInput = React.memo(function SearchInput({
  value,
  onDebouncedChange,
  placeholder = "Search...",
}: SearchInputProps) {
  const [localValue, setLocalValue] = React.useState(value);

  React.useEffect(() => {
    setLocalValue(value);
  }, [value]);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (localValue !== value) {
        onDebouncedChange(localValue);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [localValue, value, onDebouncedChange]);

  return (
    <div className="relative max-w-sm min-w-[200px] flex-1">
      <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
      <Input
        placeholder={placeholder}
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        className="pl-9"
      />
    </div>
  );
});

export default function FilesPage({ params }: FilesPageProps) {
  const trpc = useTRPC();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { projectId, orgSlug } = use(params);
  const { organization } = useOrganization();
  const organizationId = organization?.id ?? "";

  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(20);
  const [search, setSearch] = React.useState("");
  const [mimeTypeFilter, setMimeTypeFilter] = React.useState<
    string | undefined
  >();
  const [environmentFilter, setEnvironmentFilter] = React.useState<
    string | undefined
  >();
  const [statusFilter, setStatusFilter] = React.useState<
    "all" | "pending" | "completed" | "failed"
  >("all");
  const [sortBy, setSortBy] = React.useState<
    "createdAt" | "size" | "mimeType" | "fileName"
  >("createdAt");
  const [sortOrder, setSortOrder] = React.useState<"asc" | "desc">("desc");
  const [deleteFileId, setDeleteFileId] = React.useState<string | null>(null);
  const [loadingUrlId, setLoadingUrlId] = React.useState<string | null>(null);

  const handleSearchChange = React.useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  React.useEffect(() => {
    setPage(1);
  }, [
    mimeTypeFilter,
    environmentFilter,
    statusFilter,
    sortBy,
    sortOrder,
    pageSize,
  ]);

  const projectQuery = useQuery(
    trpc.project.getById.queryOptions(
      { id: projectId, organizationId },
      { enabled: !!organizationId },
    ),
  );

  const fileKeysQuery = useQuery(
    trpc.fileKey.list.queryOptions(
      {
        organizationId,
        projectId,
        page,
        pageSize,
        search: search || undefined,
        mimeType: mimeTypeFilter,
        environmentId: environmentFilter,
        status: statusFilter,
        sortBy,
        sortOrder,
      },
      { enabled: !!organizationId },
    ),
  );

  const filterOptionsQuery = useQuery(
    trpc.fileKey.getFilterOptions.queryOptions(
      { organizationId, projectId },
      { enabled: !!organizationId },
    ),
  );

  const statsQuery = useQuery(
    trpc.fileKey.getStats.queryOptions(
      { organizationId, projectId },
      { enabled: !!organizationId },
    ),
  );

  const deleteMutation = useMutation(
    trpc.fileKey.delete.mutationOptions({
      onSuccess: () => {
        toast.success("File deleted");
        setDeleteFileId(null);
        void queryClient.invalidateQueries({
          queryKey: trpc.fileKey.list.queryKey(),
        });
        void queryClient.invalidateQueries({
          queryKey: trpc.fileKey.getStats.queryKey(),
        });
      },
      onError: (error: { message?: string }) => {
        toast.error(error.message ?? "Failed to delete file");
      },
    }),
  );

  const handleOpenFile = async (fileKeyId: string) => {
    setLoadingUrlId(fileKeyId);
    try {
      const result = await getDownloadUrl({
        fileKeyId,
        projectId,
        organizationId,
      });
      if (result) {
        window.open(result.url, "_blank");
      } else {
        toast.error("Failed to get download URL");
      }
    } catch {
      toast.error("Failed to get download URL");
    } finally {
      setLoadingUrlId(null);
    }
  };

  const handleDelete = () => {
    if (deleteFileId) {
      deleteMutation.mutate({
        id: deleteFileId,
        projectId,
        organizationId,
      });
    }
  };

  if (projectQuery.isLoading || !organizationId) {
    return (
      <>
        <div className="flex flex-1 flex-col gap-4 p-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </>
    );
  }

  if (projectQuery.error || !projectQuery.data) {
    notFound();
  }

  const fileKeys = fileKeysQuery.data?.fileKeys ?? [];
  const pagination = fileKeysQuery.data?.pagination;
  const filterOptions = filterOptionsQuery.data;
  const stats = statsQuery.data;

  const hasActiveFilters =
    (mimeTypeFilter ?? environmentFilter ?? statusFilter !== "all") || search;

  const clearFilters = () => {
    setSearch("");
    setMimeTypeFilter(undefined);
    setEnvironmentFilter(undefined);
    setStatusFilter("all");
  };

  return (
    <>
      <div className="flex flex-1 flex-col gap-4 p-4">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total</CardTitle>
              <File className="text-muted-foreground h-4 w-4" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {statsQuery.isLoading ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  (stats?.total.toLocaleString() ?? 0)
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {statsQuery.isLoading ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  (stats?.completed.toLocaleString() ?? 0)
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <Clock className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {statsQuery.isLoading ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  (stats?.pending.toLocaleString() ?? 0)
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Failed</CardTitle>
              <XCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {statsQuery.isLoading ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  (stats?.failed.toLocaleString() ?? 0)
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Storage</CardTitle>
              <HardDrive className="text-muted-foreground h-4 w-4" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {statsQuery.isLoading ? (
                  <Skeleton className="h-8 w-20" />
                ) : (
                  formatFileSize(stats?.totalSize ?? 0)
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <SearchInput
                  value={search}
                  onDebouncedChange={handleSearchChange}
                  placeholder="Search by filename..."
                />

                <Select
                  value={statusFilter}
                  onValueChange={(v) =>
                    setStatusFilter(v as typeof statusFilter)
                  }
                >
                  <SelectTrigger className="w-[130px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  value={environmentFilter ?? "all"}
                  onValueChange={(v) =>
                    setEnvironmentFilter(v === "all" ? undefined : v)
                  }
                >
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Environment" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Environments</SelectItem>
                    {filterOptions?.environments.map((env) => (
                      <SelectItem key={env.id} value={env.id}>
                        {env.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={mimeTypeFilter ?? "all"}
                  onValueChange={(v) =>
                    setMimeTypeFilter(v === "all" ? undefined : v)
                  }
                >
                  <SelectTrigger className="w-[130px]">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {filterOptions?.mimeTypeCategories.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={`${sortBy}-${sortOrder}`}
                  onValueChange={(v) => {
                    const [field, order] = v.split("-") as [
                      typeof sortBy,
                      typeof sortOrder,
                    ];
                    setSortBy(field);
                    setSortOrder(order);
                  }}
                >
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Sort" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="createdAt-desc">Newest First</SelectItem>
                    <SelectItem value="createdAt-asc">Oldest First</SelectItem>
                    <SelectItem value="fileName-asc">Name A-Z</SelectItem>
                    <SelectItem value="fileName-desc">Name Z-A</SelectItem>
                    <SelectItem value="size-desc">Largest First</SelectItem>
                    <SelectItem value="size-asc">Smallest First</SelectItem>
                  </SelectContent>
                </Select>

                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" onClick={clearFilters}>
                    Clear filters
                  </Button>
                )}

                <div className="ml-auto">
                  <UploadDialog
                    projectId={projectId}
                    environments={
                      filterOptions?.environments.map((env) => ({
                        id: env.id,
                        name: env.name,
                        type: env.type,
                      })) ?? []
                    }
                    onUploadComplete={() => {
                      void fileKeysQuery.refetch();
                      void statsQuery.refetch();
                    }}
                  />
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            {fileKeysQuery.isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : fileKeys.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <File className="text-muted-foreground mb-4 h-12 w-12" />
                <h3 className="text-lg font-semibold">No files found</h3>
                <p className="text-muted-foreground text-sm">
                  {hasActiveFilters
                    ? "Try adjusting your filters"
                    : "Upload some files to get started"}
                </p>
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[35%]">File</TableHead>
                      <TableHead className="w-[100px]">Status</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead>Environment</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fileKeys.map((fk) => {
                      const FileIcon = getFileIcon(fk.mimeType);
                      const isCompleted = fk.status === "completed";
                      return (
                        <TableRow
                          key={fk.id}
                          className="cursor-pointer"
                          onClick={() =>
                            router.push(
                              `/${orgSlug}/project/${projectId}/files/${fk.id}`,
                            )
                          }
                        >
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="bg-muted flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
                                <FileIcon className="text-muted-foreground h-5 w-5" />
                              </div>
                              <div className="flex min-w-0 flex-col">
                                <span className="truncate font-medium">
                                  {fk.fileName}
                                </span>
                                {fk.hash && (
                                  <span className="text-muted-foreground truncate font-mono text-xs">
                                    {fk.hash.slice(0, 16)}...
                                  </span>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {fk.status === "completed" ? (
                              <Badge
                                variant="default"
                                className="bg-green-500/10 text-green-600 hover:bg-green-500/20"
                              >
                                <CheckCircle2 className="mr-1 h-3 w-3" />
                                Done
                              </Badge>
                            ) : fk.status === "pending" ? (
                              <Badge
                                variant="secondary"
                                className="bg-yellow-500/10 text-yellow-600 hover:bg-yellow-500/20"
                              >
                                <Clock className="mr-1 h-3 w-3" />
                                Pending
                              </Badge>
                            ) : (
                              <Badge
                                variant="destructive"
                                className="bg-red-500/10 text-red-600 hover:bg-red-500/20"
                              >
                                <XCircle className="mr-1 h-3 w-3" />
                                Failed
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {fk.mimeType ? (
                              <Badge variant="outline">{fk.mimeType}</Badge>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>{formatFileSize(fk.size)}</TableCell>
                          <TableCell>
                            {fk.environment ? (
                              <Badge
                                variant={
                                  fk.environment.type === "production"
                                    ? "default"
                                    : fk.environment.type === "staging"
                                      ? "secondary"
                                      : "outline"
                                }
                              >
                                {fk.environment.name}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {formatDate(fk.createdAt)}
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {loadingUrlId === fk.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <MoreHorizontal className="h-4 w-4" />
                                  )}
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent
                                align="end"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => handleOpenFile(fk.id)}
                                  disabled={!isCompleted}
                                >
                                  <ExternalLink className="mr-2 h-4 w-4" />
                                  Open File
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() =>
                                    copyToClipboard(
                                      fk.accessKey,
                                      "Access key copied",
                                    )
                                  }
                                >
                                  <Copy className="mr-2 h-4 w-4" />
                                  Copy Access Key
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => setDeleteFileId(fk.id)}
                                  className="text-red-600"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>

                {pagination && (
                  <div className="flex items-center justify-between border-t pt-4">
                    <div className="text-muted-foreground flex items-center gap-2 text-sm">
                      <span>Rows:</span>
                      <Select
                        value={pageSize.toString()}
                        onValueChange={(value) => setPageSize(Number(value))}
                      >
                        <SelectTrigger className="h-8 w-[70px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PAGE_SIZE_OPTIONS.map((size) => (
                            <SelectItem key={size} value={size.toString()}>
                              {size}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="text-muted-foreground text-sm">
                      {pagination.page} / {pagination.totalPages} (
                      {pagination.totalCount})
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="icon-sm"
                        onClick={() => setPage(1)}
                        disabled={!pagination.hasPreviousPage}
                      >
                        <ChevronsLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon-sm"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={!pagination.hasPreviousPage}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon-sm"
                        onClick={() => setPage((p) => p + 1)}
                        disabled={!pagination.hasNextPage}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon-sm"
                        onClick={() => setPage(pagination.totalPages)}
                        disabled={!pagination.hasNextPage}
                      >
                        <ChevronsRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={deleteFileId !== null}
        onOpenChange={(open) => !open && setDeleteFileId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete File</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this file? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteFileId(null)}
              disabled={deleteMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
