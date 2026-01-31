"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { FolderKanban, Plus, ArrowRight } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@app/ui/components/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@app/ui/components/card";
import { Skeleton } from "@app/ui/components/skeleton";

import { CreateProjectDialog } from "@/components/create-project-dialog";
import { PageHeader } from "@/components/page-header";
import { useOrganization } from "@/hooks/use-organization";
import { useTRPC } from "@/trpc/react";

export default function ProjectsPage() {
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
  const trpc = useTRPC();
  const params = useParams<{ orgSlug: string }>();
  const orgSlug = params.orgSlug;
  const { organization } = useOrganization();
  const organizationId = organization?.id ?? "";

  const projectsQuery = useQuery(
    trpc.project.list.queryOptions(
      { organizationId },
      { enabled: !!organizationId },
    ),
  );

  const createProjectMutation = useMutation(
    trpc.project.create.mutationOptions({
      onSuccess: () => {
        projectsQuery.refetch();
        toast.success("Project created successfully");
      },
      onError: (error) => {
        toast.error(error.message || "Failed to create project");
      },
    }),
  );

  const handleCreateProject = async (data: { name: string }) => {
    await createProjectMutation.mutateAsync({ ...data, organizationId });
  };

  return (
    <>
      <PageHeader title="Projects">
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="mr-2 size-4" />
          New Project
        </Button>
      </PageHeader>

      <div className="flex flex-1 flex-col gap-6 p-6">
        {projectsQuery.isLoading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="overflow-hidden">
                <CardHeader className="pb-4">
                  <Skeleton className="h-8 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-1/2" />
                </CardHeader>
                <div className="px-6 pb-4">
                  <Skeleton className="h-12 w-full" />
                </div>
              </Card>
            ))}
          </div>
        ) : projectsQuery.data?.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-6 py-20">
            <div className="bg-gradient-to-br from-primary/10 to-primary/5 flex size-20 items-center justify-center rounded-2xl">
              <FolderKanban className="text-primary size-10" />
            </div>
            <div className="text-center max-w-sm">
              <h3 className="text-2xl font-bold mb-2">No projects yet</h3>
              <p className="text-muted-foreground text-base mb-6">
                Create your first project to start managing your S3 storage and files
              </p>
            </div>
            <Button size="lg" onClick={() => setCreateDialogOpen(true)}>
              <Plus className="mr-2 size-5" />
              Create Your First Project
            </Button>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {projectsQuery.data?.map((project) => (
              <Link key={project.id} href={`/${orgSlug}/project/${project.id}`}>
                <Card className="group overflow-hidden cursor-pointer transition-all duration-300 hover:shadow-lg hover:border-primary/50 h-full flex flex-col">
                  <CardHeader className="pb-4 flex-1">
                    <div className="flex items-start justify-between mb-4">
                      <div className="bg-gradient-to-br from-primary/20 to-primary/10 group-hover:from-primary/30 group-hover:to-primary/20 flex size-12 items-center justify-center rounded-xl transition-colors">
                        <FolderKanban className="text-primary size-6" />
                      </div>
                      <ArrowRight className="text-muted-foreground group-hover:text-primary size-5 transition-colors opacity-0 group-hover:opacity-100" />
                    </div>
                    <CardTitle className="text-lg group-hover:text-primary transition-colors">
                      {project.name}
                    </CardTitle>
                    <CardDescription className="text-sm">
                      {project.slug}
                    </CardDescription>
                  </CardHeader>
                  <div className="px-6 pb-4 pt-2 border-t">
                    <div className="text-xs text-muted-foreground">
                      Click to view project
                    </div>
                  </div>
                </Card>
              </Link>
            ))}

            {/* Create new project card */}
            <Card
              className="group overflow-hidden cursor-pointer border-dashed transition-all duration-300 hover:border-primary/50 hover:shadow-lg h-full flex flex-col items-center justify-center min-h-[200px]"
              onClick={() => setCreateDialogOpen(true)}
            >
              <div className="flex flex-col items-center gap-3 text-center">
                <div className="bg-muted group-hover:bg-primary/10 flex size-12 items-center justify-center rounded-xl transition-colors">
                  <Plus className="text-muted-foreground group-hover:text-primary size-6 transition-colors" />
                </div>
                <div>
                  <p className="font-semibold group-hover:text-primary transition-colors">
                    New Project
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Create a new project
                  </p>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>

      <CreateProjectDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSubmit={handleCreateProject}
        isLoading={createProjectMutation.isPending}
      />
    </>
  );
}
