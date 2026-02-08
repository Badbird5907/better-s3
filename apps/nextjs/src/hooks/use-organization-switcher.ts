"use client";

import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";

import { authClient } from "@/auth/client";
import { useOrganization } from "@/hooks/use-organization";

export interface Organization {
  id: string;
  name: string;
  slug: string;
  logo?: string;
  plan?: string;
}

export function useOrganizationSwitcher() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { organization, orgSlug } = useOrganization();
  const { data: organizations } = authClient.useListOrganizations();

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

  const activeOrganization: Organization | null = organization
    ? {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        logo: organization.logo ?? undefined,
      }
    : null;

  const handleOrgChange = (org: Organization) => {
    void (async () => {
      await authClient.organization.setActive({ organizationId: org.id });
      await queryClient.invalidateQueries();
    })().then(() => {
      window.location.assign(`/${org.slug}`);
    });
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

  return {
    organizations: mappedOrganizations,
    activeOrganization,
    orgSlug,
    handleOrgChange,
    handleCreateOrg,
  };
}
