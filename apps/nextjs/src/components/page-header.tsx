"use client";

import type { Project } from "@/components/project-switcher";

import { SidebarTrigger } from "@app/ui/components/sidebar";

import { ProjectSwitcher } from "@/components/project-switcher";

interface PageHeaderProps {
  title?: string;
  projects?: Project[];
  currentProject?: Project | null;
  orgSlug?: string;
  children?: React.ReactNode;
}

export function PageHeader({
  title,
  projects,
  currentProject,
  orgSlug,
  children,
}: PageHeaderProps) {
  return (
    <header className="bg-background sticky top-0 z-10 flex h-16 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      {title && (
        <>
          {/* <Separator orientation="vertical" className="mr-2 h-4" /> */}
          <h1 className="text-lg font-semibold">{title}</h1>
        </>
      )}

      {projects && (
        <>
          {/* <Separator orientation="vertical" className="mx-2 h-4" /> */}
          <ProjectSwitcher
            projects={projects}
            currentProject={currentProject}
            orgSlug={orgSlug}
          />
        </>
      )}

      {children && (
        <div className="ml-auto flex items-center gap-2">{children}</div>
      )}
    </header>
  );
}
