"use client";

import * as React from "react";
import { Building2, ChevronsUpDown } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@app/ui/components/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@app/ui/components/sidebar";

import { CreateOrgDialog } from "@/components/create-org-dialog";
import { OrganizationMenuItems } from "@/components/organization-menu-items";
import { useOrganizationSwitcher } from "@/hooks/use-organization-switcher";

/**
 * Standalone organization switcher for org-wide pages (not project-specific).
 * Fetches its own data and handles all organization switching logic.
 */
export function OrganizationSwitcher() {
  const [createOrgOpen, setCreateOrgOpen] = React.useState(false);
  const { isMobile } = useSidebar();

  const {
    organizations,
    activeOrganization,
    handleOrgChange,
    handleCreateOrg,
  } = useOrganizationSwitcher();

  if (!activeOrganization) {
    return null;
  }

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton
                size="lg"
                className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              >
                <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                  <Building2 className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">
                    {activeOrganization.name}
                  </span>
                  {activeOrganization.plan && (
                    <span className="truncate text-xs">
                      {activeOrganization.plan}
                    </span>
                  )}
                </div>
                <ChevronsUpDown className="ml-auto" />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
              align="start"
              side={isMobile ? "bottom" : "right"}
              sideOffset={4}
            >
              <OrganizationMenuItems
                organizations={organizations}
                activeOrganization={activeOrganization}
                onOrganizationChange={handleOrgChange}
                onCreateOrganization={() => setCreateOrgOpen(true)}
              />
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>

      <CreateOrgDialog
        open={createOrgOpen}
        onOpenChange={setCreateOrgOpen}
        onSubmit={handleCreateOrg}
      />
    </>
  );
}
