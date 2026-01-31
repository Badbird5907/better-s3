"use client";

import type { NavItem } from "@/components/nav-main";
import type { Organization } from "@/components/organization-switcher";
import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Files,
  FolderKanban,
  LayoutDashboard,
  Settings,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@app/ui/components/sidebar";

import { authClient } from "@/auth/client";
import { CreateOrgDialog } from "@/components/create-org-dialog";
import { NavMain } from "@/components/nav-main";
import { NavUser } from "@/components/nav-user";
import { OrganizationSwitcher } from "@/components/organization-switcher";
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
      title: "Settings",
      url: `/${orgSlug}/project/${projectId}/settings`,
      icon: Settings,
    },
  ];
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const [createOrgOpen, setCreateOrgOpen] = React.useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: session } = authClient.useSession();
  const { data: organizations } = authClient.useListOrganizations();

  const { organization: activeOrganization, orgSlug } = useOrganization();

  const projectMatch = /^\/[^/]+\/project\/([^/]+)/.exec(pathname);
  const currentProjectId = projectMatch?.[1];
  const isInProject = !!currentProjectId;

  const navItems = isInProject
    ? getProjectNavItems(orgSlug ?? "", currentProjectId)
    : getMainNavItems(orgSlug ?? "");

  const navLabel = isInProject ? "Project" : "Navigation";

  const handleOrgChange = async (org: Organization) => {
    await authClient.organization.setActive({ organizationId: org.id });
    await queryClient.invalidateQueries();
    // router.push(`/${org.slug}`);
    window.location.href = `/${org.slug}`;
  };

  const handleCreateOrg = async (data: { name: string; slug: string }) => {
    const result = await authClient.organization.create({
      name: data.name,
      slug: data.slug,
    });
    if (result.data) {
      await queryClient.invalidateQueries();
      router.push(`/${data.slug}`);
    }
  };

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

  const mappedOrganizations: Organization[] =
    organizations?.map(
      (org: {
        id: string;
        name: string;
        slug: string;
        logo?: string | null;
      }) => ({
        id: org.id,
        name: org.name,
        slug: org.slug,
        logo: org.logo ?? undefined,
      }),
    ) ?? [];

  const mappedActiveOrg: Organization | null = activeOrganization
    ? {
        id: activeOrganization.id,
        name: activeOrganization.name,
        slug: activeOrganization.slug,
        logo: activeOrganization.logo ?? undefined,
      }
    : null;

  return (
    <>
      <Sidebar collapsible="icon" {...props}>
        <SidebarHeader>
          <Link
            href={orgSlug ? `/${orgSlug}` : "/"}
            className="hover:text-primary flex items-center justify-center px-2 py-3 text-2xl font-bold tracking-tight transition-colors"
          >
            Better S3
          </Link>
          <OrganizationSwitcher
            organizations={mappedOrganizations}
            activeOrganization={mappedActiveOrg}
            onOrganizationChange={handleOrgChange}
            onCreateOrganization={() => setCreateOrgOpen(true)}
          />
        </SidebarHeader>
        <SidebarContent>
          {isInProject && (
            <SidebarGroup>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="Back to Projects">
                    <Link href={`/${orgSlug}`}>
                      <ArrowLeft />
                      <span>Back to Projects</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroup>
          )}
          <NavMain items={navItems} label={navLabel} />
        </SidebarContent>
        <SidebarFooter>
          {user && <NavUser user={user} onLogout={handleLogout} />}
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <CreateOrgDialog
        open={createOrgOpen}
        onOpenChange={setCreateOrgOpen}
        onSubmit={handleCreateOrg}
      />
    </>
  );
}
