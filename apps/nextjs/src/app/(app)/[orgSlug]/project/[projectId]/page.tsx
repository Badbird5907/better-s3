"use client";

import { use } from "react";
import { notFound } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

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

export default function ProjectPage({ params }: ProjectPageProps) {
  const trpc = useTRPC();
  const { organization } = useOrganization();
  const organizationId = organization?.id ?? "";

  // Unwrap params
  const { projectId } = use(params);

  const projectQuery = useQuery(
    trpc.project.getById.queryOptions(
      { id: projectId, organizationId },
      { enabled: !!organizationId },
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

        {/* Placeholder content areas */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Files</CardTitle>
              <CardDescription>Storage usage and file count</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-muted/50 flex h-24 items-center justify-center rounded-lg">
                <span className="text-muted-foreground text-sm">
                  Coming soon
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Environments</CardTitle>
              <CardDescription>
                Development, staging, production
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-muted/50 flex h-24 items-center justify-center rounded-lg">
                <span className="text-muted-foreground text-sm">
                  Coming soon
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Activity</CardTitle>
              <CardDescription>Recent uploads and changes</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-muted/50 flex h-24 items-center justify-center rounded-lg">
                <span className="text-muted-foreground text-sm">
                  Coming soon
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
