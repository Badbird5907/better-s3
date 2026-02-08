"use client";

import { useQuery } from "@tanstack/react-query";

import { Skeleton } from "@app/ui/components/skeleton";

import { authClient } from "@/auth/client";
import {
  GeneralSettings,
  MembersList,
  PendingInvitations,
} from "@/components/org-settings";
import { useOrganization } from "@/hooks/use-organization";
import { useTRPC } from "@/trpc/react";

export default function OrganizationSettingsPage() {
  const trpc = useTRPC();
  const session = authClient.useSession();
  const { organization: activeOrganization, refetch: refetchOrg } =
    useOrganization();

  const roleQuery = useQuery(
    trpc.organization.getMyRole.queryOptions(
      { organizationId: activeOrganization?.id ?? "" },
      { enabled: !!activeOrganization?.id },
    ),
  );

  const currentUserId = session.data?.user.id;
  const currentUserRole = roleQuery.data?.role;
  const canEdit = ["owner", "admin"].includes(currentUserRole ?? "member");

  if (!activeOrganization || roleQuery.isLoading) {
    return (
      <>
        <div className="flex flex-1 flex-col gap-6 p-4">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </>
    );
  }

  return (
    <>
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
          currentUserId={currentUserId ?? ""}
          currentUserRole={currentUserRole ?? "member"}
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
