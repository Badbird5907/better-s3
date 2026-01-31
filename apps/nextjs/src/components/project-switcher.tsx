"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Check, ChevronsUpDown, FolderKanban } from "lucide-react";

import { Button } from "@app/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@app/ui/components/dropdown-menu";

export interface Project {
  id: string;
  name: string;
  slug: string;
}

interface ProjectSwitcherProps {
  projects: Project[];
  currentProject?: Project | null;
  orgSlug?: string;
}

export function ProjectSwitcher({
  projects,
  currentProject,
  orgSlug,
}: ProjectSwitcherProps) {
  const params = useParams<{ orgSlug?: string; projectId?: string }>();
  const projectId = params.projectId;
  const resolvedOrgSlug = orgSlug ?? params.orgSlug;

  if (!projectId) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2">
          <FolderKanban className="size-4" />
          <span className="max-w-[150px] truncate">
            {currentProject?.name ?? "Select project"}
          </span>
          <ChevronsUpDown className="size-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel className="text-muted-foreground text-xs">
          Projects
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {projects.map((project) => (
          <DropdownMenuItem key={project.id} asChild>
            <Link
              href={
                resolvedOrgSlug
                  ? `/${resolvedOrgSlug}/project/${project.id}`
                  : `/project/${project.id}`
              }
              className="gap-2"
            >
              <FolderKanban className="size-4" />
              <span className="flex-1 truncate">{project.name}</span>
              {project.id === projectId && <Check className="size-4" />}
            </Link>
          </DropdownMenuItem>
        ))}
        {projects.length === 0 && (
          <DropdownMenuItem disabled>
            <span className="text-muted-foreground">No projects</span>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
