"use client";

import { use } from "react";
import { notFound } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { Skeleton } from "@app/ui/components/skeleton";

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
        <div className="flex flex-1 flex-col gap-6 p-4">
          <Skeleton className="h-64 w-full" />
        </div>
      </>
    );
  }

  if (projectQuery.error || !projectQuery.data) {
    notFound();
  }

  return (
    <>
      <div className="flex flex-1 flex-col gap-6 p-4">
        <ProjectGeneralSettings
          project={{
            id: projectQuery.data.id,
            name: projectQuery.data.name,
            slug: projectQuery.data.slug,
            defaultFileAccess: projectQuery.data.defaultFileAccess,
          }}
          organizationId={organizationId}
        />
        <ApiKeysList projectId={projectId} organizationId={organizationId} />
      </div>
    </>
  );
}
