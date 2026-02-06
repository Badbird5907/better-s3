"use client";

import { use } from "react";
import { notFound, useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { Skeleton } from "@app/ui/components/skeleton";

import { PageHeader } from "@/components/page-header";
import {
  ApiKeysList,
  ProjectGeneralSettings,
} from "@/components/project-settings";
import { useOrganization } from "@/hooks/use-organization";
import { useTRPC } from "@/trpc/react";

interface ProjectSettingsPageProps {
  params: Promise<{
    orgSlug: string;
    projectId: string;
  }>;
}

export default function ProjectSettingsPage({
  params,
}: ProjectSettingsPageProps) {
  const trpc = useTRPC();
  const routeParams = useParams<{ orgSlug: string }>();
  const orgSlug = routeParams.orgSlug;
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

  const projectsQuery = useQuery(
    trpc.project.list.queryOptions(
      { organizationId },
      { enabled: !!organizationId },
    ),
  );

  if (projectQuery.isLoading || !organizationId) {
    return (
      <>
        <PageHeader title="Project Settings" />
        <div className="flex flex-1 flex-col gap-6 p-4">
          <Skeleton className="h-64 w-full" />
        </div>
      </>
    );
  }

  if (projectQuery.error || !projectQuery.data) {
    notFound();
  }

  const project = projectQuery.data;
  const projects = projectsQuery.data ?? [];

  return (
    <>
      <PageHeader
        title="Project Settings"
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

      <div className="flex flex-1 flex-col gap-6 p-4">
        <ProjectGeneralSettings
          project={{
            id: project.id,
            name: project.name,
            slug: project.slug,
            defaultFileAccess: project.defaultFileAccess,
          }}
          organizationId={organizationId}
        />
        <ApiKeysList projectId={projectId} organizationId={organizationId} />
      </div>
    </>
  );
}
