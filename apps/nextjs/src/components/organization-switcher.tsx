"use client";

import Link from "next/link";
import { Building2, Check, ChevronsUpDown, Plus, Settings } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@app/ui/components/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@app/ui/components/sidebar";

import { env } from "@/env";

export interface Organization {
  id: string;
  name: string;
  slug: string;
  logo?: string;
  plan?: string;
}

interface OrganizationSwitcherProps {
  organizations: Organization[];
  activeOrganization: Organization | null;
  onOrganizationChange?: (org: Organization) => void;
  onCreateOrganization?: () => void;
}

export function OrganizationSwitcher({
  organizations,
  activeOrganization,
  onOrganizationChange,
  onCreateOrganization,
}: OrganizationSwitcherProps) {
  const { isMobile } = useSidebar();
  const canCreateOrg = !env.DISABLE_ORG_CREATION;

  if (!activeOrganization) {
    return null;
  }

  return (
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
            <DropdownMenuLabel className="text-muted-foreground text-xs">
              Organizations
            </DropdownMenuLabel>
            {organizations.map((org) => (
              <DropdownMenuItem
                key={org.id}
                onClick={() => onOrganizationChange?.(org)}
                className="gap-2 p-2"
              >
                <div className="flex size-6 items-center justify-center rounded-md border">
                  <Building2 className="size-3.5 shrink-0" />
                </div>
                <span className="flex-1 truncate">{org.name}</span>
                {org.id === activeOrganization.id && (
                  <Check className="text-primary size-4" />
                )}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild className="gap-2 p-2">
              <Link href={`/${activeOrganization.slug}/settings`}>
                <div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
                  <Settings className="size-3.5" />
                </div>
                <span className="text-muted-foreground font-medium">
                  Organization settings
                </span>
              </Link>
            </DropdownMenuItem>
            {canCreateOrg && (
              <>
                <DropdownMenuItem
                  className="gap-2 p-2"
                  onClick={onCreateOrganization}
                >
                  <div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
                    <Plus className="size-4" />
                  </div>
                  <div className="text-muted-foreground font-medium">
                    Create organization
                  </div>
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
