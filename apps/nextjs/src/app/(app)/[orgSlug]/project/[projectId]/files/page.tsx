"use client";

import * as React from "react";
import { use } from "react";
import { notFound } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  File,
  FileArchive,
  FileAudio,
  FileCode,
  FileImage,
  FileText,
  FileVideo,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";

import { Badge } from "@app/ui/components/badge";
import { Button } from "@app/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@app/ui/components/card";
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

import { PageHeader } from "@/components/page-header";
import { useOrganization } from "@/hooks/use-organization";
import { useTRPC } from "@/trpc/react";

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

function getFileIcon(mimeType: string) {
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

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];
const SORT_OPTIONS = [
  { value: "createdAt", label: "Date Created" },
  { value: "size", label: "File Size" },
  { value: "mimeType", label: "File Type" },
] as const;

export default function FilesPage({ params }: FilesPageProps) {
  const trpc = useTRPC();
  const { projectId, orgSlug } = use(params);
  const { organization } = useOrganization();
  const organizationId = organization?.id ?? "";

  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(20);
  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [mimeTypeFilter, setMimeTypeFilter] = React.useState<
    string | undefined
  >();
  const [environmentFilter, setEnvironmentFilter] = React.useState<
    string | undefined
  >();
  const [sortBy, setSortBy] = React.useState<"createdAt" | "size" | "mimeType">(
    "createdAt",
  );
  const [sortOrder, setSortOrder] = React.useState<"asc" | "desc">("desc");
  const [showFilters, setShowFilters] = React.useState(false);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  React.useEffect(() => {
    setPage(1);
  }, [mimeTypeFilter, environmentFilter, sortBy, sortOrder, pageSize]);

  const projectQuery = useQuery(
    trpc.project.getById.queryOptions(
      { id: projectId, organizationId },
      { enabled: !!organizationId },
    ),
  );

  const projectsQuery = useQuery(
    trpc.project.list.queryOptions(
      { organizationId },
      { enabled: !!organizationId },
    ),
  );

  const filesQuery = useQuery(
    trpc.file.list.queryOptions(
      {
        projectId,
        organizationId,
        page,
        pageSize,
        search: debouncedSearch || undefined,
        mimeType: mimeTypeFilter,
        environmentId: environmentFilter,
        sortBy,
        sortOrder,
      },
      { enabled: !!organizationId },
    ),
  );

  const filterOptionsQuery = useQuery(
    trpc.file.getFilterOptions.queryOptions(
      { projectId, organizationId },
      { enabled: !!organizationId },
    ),
  );

  const statsQuery = useQuery(
    trpc.file.getStats.queryOptions(
      { projectId, organizationId },
      { enabled: !!organizationId },
    ),
  );

  if (projectQuery.isLoading || !organizationId) {
    return (
      <>
        <PageHeader title="Loading..." />
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

  const project = projectQuery.data;
  const projects = projectsQuery.data ?? [];
  const files = filesQuery.data?.files ?? [];
  const pagination = filesQuery.data?.pagination;
  const filterOptions = filterOptionsQuery.data;
  const stats = statsQuery.data;

  const hasActiveFilters =
    mimeTypeFilter ?? environmentFilter ?? debouncedSearch;

  const clearFilters = () => {
    setSearch("");
    setDebouncedSearch("");
    setMimeTypeFilter(undefined);
    setEnvironmentFilter(undefined);
    setSortBy("createdAt");
    setSortOrder("desc");
  };

  return (
    <>
      <PageHeader
        title={undefined}
        projects={projects.map((p) => ({
          id: p.id,
          name: p.name,
          slug: p.slug,
        }))}
        currentProject={{
          id: project.id,
          name: project.name,
          slug: project.slug,
        }}
        orgSlug={orgSlug}
      />

      <div className="flex flex-1 flex-col gap-4 p-4">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Files</CardTitle>
              <File className="text-muted-foreground h-4 w-4" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {statsQuery.isLoading ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  (stats?.totalFiles.toLocaleString() ?? 0)
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Size</CardTitle>
              <FileArchive className="text-muted-foreground h-4 w-4" />
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

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Environments
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {filterOptionsQuery.isLoading ? (
                  <Skeleton className="h-8 w-8" />
                ) : (
                  (filterOptions?.environments.length ?? 0)
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">File Types</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {filterOptionsQuery.isLoading ? (
                  <Skeleton className="h-8 w-8" />
                ) : (
                  (filterOptions?.mimeTypeCategories.length ?? 0)
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-1 items-center gap-2">
                <div className="relative flex-1 sm:max-w-sm">
                  <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                  <Input
                    placeholder="Search files..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowFilters(!showFilters)}
                  className={showFilters ? "bg-accent" : ""}
                >
                  <SlidersHorizontal className="mr-2 h-4 w-4" />
                  Filters
                  {hasActiveFilters && (
                    <Badge variant="secondary" className="ml-2">
                      {
                        [
                          mimeTypeFilter,
                          environmentFilter,
                          debouncedSearch,
                        ].filter(Boolean).length
                      }
                    </Badge>
                  )}
                </Button>
                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" onClick={clearFilters}>
                    <X className="mr-2 h-4 w-4" />
                    Clear
                  </Button>
                )}
              </div>
            </div>

            {showFilters && (
              <div className="mt-4 grid gap-4 border-t pt-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">File Type</label>
                  <Select
                    value={mimeTypeFilter ?? ""}
                    onValueChange={(value) =>
                      setMimeTypeFilter(value || undefined)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All types" />
                    </SelectTrigger>
                    <SelectContent>
                      {filterOptions?.mimeTypeCategories
                        .filter((type): type is string => type !== undefined)
                        .map((type) => (
                          <SelectItem key={type} value={type}>
                            {type.charAt(0).toUpperCase() + type.slice(1)}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Environment</label>
                  <Select
                    value={environmentFilter ?? ""}
                    onValueChange={(value) =>
                      setEnvironmentFilter(value || undefined)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All environments" />
                    </SelectTrigger>
                    <SelectContent>
                      {filterOptions?.environments.map((env) => (
                        <SelectItem key={env.id} value={env.id}>
                          {env.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Sort By</label>
                  <Select
                    value={sortBy}
                    onValueChange={(value) => setSortBy(value as typeof sortBy)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SORT_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Order</label>
                  <Select
                    value={sortOrder}
                    onValueChange={(value) =>
                      setSortOrder(value as "asc" | "desc")
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="desc">Newest First</SelectItem>
                      <SelectItem value="asc">Oldest First</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </CardHeader>

          <CardContent>
            {filesQuery.isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : files.length === 0 ? (
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
                      <TableHead className="w-[40%]">File</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead>Environment</TableHead>
                      <TableHead>Keys</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {files.map((file) => {
                      const FileIcon = getFileIcon(file.mimeType);
                      return (
                        <TableRow key={file.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="bg-muted flex h-10 w-10 items-center justify-center rounded-lg">
                                <FileIcon className="text-muted-foreground h-5 w-5" />
                              </div>
                              <div className="flex flex-col">
                                <span className="font-medium">{file.id}</span>
                                <span className="text-muted-foreground font-mono text-xs">
                                  {file.hash.slice(0, 16)}...
                                </span>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{file.mimeType}</Badge>
                          </TableCell>
                          <TableCell>{formatFileSize(file.size)}</TableCell>
                          <TableCell>
                            {file.environment ? (
                              <Badge
                                variant={
                                  file.environment.type === "production"
                                    ? "default"
                                    : file.environment.type === "staging"
                                      ? "secondary"
                                      : "outline"
                                }
                              >
                                {file.environment.name}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">
                              {file.fileKeyCount}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {formatDate(file.createdAt)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>

                {pagination && (
                  <div className="flex items-center justify-between border-t pt-4">
                    <div className="text-muted-foreground flex items-center gap-2 text-sm">
                      <span>Rows per page:</span>
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
                      Page {pagination.page} of {pagination.totalPages} (
                      {pagination.totalCount} total)
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
    </>
  );
}
