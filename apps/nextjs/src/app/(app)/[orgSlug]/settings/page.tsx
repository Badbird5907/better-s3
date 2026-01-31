"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";

import { Skeleton } from "@app/ui/components/skeleton";

import { authClient } from "@/auth/client";
import {
  GeneralSettings,
  InviteMemberDialog,
  MembersList,
  PendingInvitations,
} from "@/components/org-settings";
import { PageHeader } from "@/components/page-header";
import { useOrganization } from "@/hooks/use-organization";
import { useTRPC } from "@/trpc/react";

export default function OrganizationSettingsPage() {
  const trpc = useTRPC();
  const { data: session } = authClient.useSession();
  const { organization: activeOrganization, refetch: refetchOrg } =
    useOrganization();

  const roleQuery = useQuery(
    trpc.organization.getMyRole.queryOptions(
      { organizationId: activeOrganization?.id ?? "" },
      { enabled: !!activeOrganization?.id },
    ),
  );

  const currentUserId = session?.user?.id ?? "";
  const currentUserRole = roleQuery.data?.role ?? "member";
  const canEdit = ["owner", "admin"].includes(currentUserRole);

  if (!activeOrganization || roleQuery.isLoading) {
    return (
      <>
        <PageHeader title="Organization Settings" />
        <div className="flex flex-1 flex-col gap-6 p-4">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Organization Settings">
        {canEdit && (
          <InviteMemberDialog
            organizationId={activeOrganization.id}
            onInvited={() => refetchOrg()}
          />
        )}
      </PageHeader>

      <div className="flex flex-1 flex-col gap-6 p-4">
        <GeneralSettings
          organization={{
            id: activeOrganization.id,
            name: activeOrganization.name,
            slug: activeOrganization.slug,
            logo: activeOrganization.logo,
          }}
          canEdit={canEdit}
          onUpdate={() => refetchOrg()}
        />

        <MembersList
          organizationId={activeOrganization.id}
          currentUserId={currentUserId}
          currentUserRole={currentUserRole}
          canEdit={canEdit}
        />

        {canEdit && (
          <PendingInvitations
            organizationId={activeOrganization.id}
            canEdit={canEdit}
          />
        )}
      </div>
    </>
  );
}
