"use client";

import type { NavItem } from "@/components/nav-main";
import * as React from "react";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Files,
  FolderKanban,
  LayoutDashboard,
  Settings,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@app/ui/components/sidebar";

import { authClient } from "@/auth/client";
import { NavMain } from "@/components/nav-main";
import { NavUser } from "@/components/nav-user";
import { OrganizationSwitcher } from "@/components/organization-switcher";
import { ProjectSwitcher } from "@/components/project-switcher";
import { useOrganization } from "@/hooks/use-organization";

function getMainNavItems(orgSlug: string): NavItem[] {
  return [
    {
      title: "Projects",
      url: `/${orgSlug}`,
      icon: FolderKanban,
    },
    {
      title: "Settings",
      url: `/${orgSlug}/settings`,
      icon: Settings,
    },
  ];
}

function getProjectNavItems(orgSlug: string, projectId: string): NavItem[] {
  return [
    {
      title: "Dashboard",
      url: `/${orgSlug}/project/${projectId}`,
      icon: LayoutDashboard,
    },
    {
      title: "Files",
      url: `/${orgSlug}/project/${projectId}/files`,
      icon: Files,
    },
    {
      title: "Analytics",
      url: `/${orgSlug}/project/${projectId}/analytics`,
      icon: BarChart3,
    },
    {
      title: "Settings",
      url: `/${orgSlug}/project/${projectId}/settings`,
      icon: Settings,
    },
  ];
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();

  const { data: session } = authClient.useSession();
  const { orgSlug } = useOrganization();

  const projectMatch = /^\/[^/]+\/project\/([^/]+)/.exec(pathname);
  const currentProjectId = projectMatch?.[1];
  const isInProject = !!currentProjectId;

  const navItems = React.useMemo(
    () =>
      isInProject
        ? getProjectNavItems(orgSlug ?? "", currentProjectId)
        : getMainNavItems(orgSlug ?? ""),
    [isInProject, orgSlug, currentProjectId],
  );

  const navLabel = isInProject ? "Project" : "Navigation";

  const handleLogout = async () => {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          window.location.href = "/";
        },
      },
    });
  };

  const user = session?.user
    ? {
        name: session.user.name,
        email: session.user.email,
        avatar: session.user.image ?? undefined,
      }
    : null;

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        {isInProject ? <ProjectSwitcher /> : <OrganizationSwitcher />}
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navItems} label={navLabel} />
      </SidebarContent>
      <SidebarFooter>
        {user && <NavUser user={user} onLogout={handleLogout} />}
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
