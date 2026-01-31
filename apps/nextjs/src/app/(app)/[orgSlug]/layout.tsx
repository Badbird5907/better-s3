import { notFound, redirect } from "next/navigation";

import { and, eq } from "@app/db";
import { db } from "@app/db/client";
import { members, organizations } from "@app/db/schema";

import { auth, getSession } from "@/auth/server";

interface OrgLayoutProps {
  children: React.ReactNode;
  params: Promise<{
    orgSlug: string;
  }>;
}

export default async function OrgLayout({ children, params }: OrgLayoutProps) {
  const { orgSlug } = await params;
  const session = await getSession();

  if (!session?.user) {
    redirect("/login");
  }

  const org = await db.query.organizations.findFirst({
    where: eq(organizations.slug, orgSlug),
  });

  if (!org) {
    notFound();
  }

  const membership = await db.query.members.findFirst({
    where: and(
      eq(members.organizationId, org.id),
      eq(members.userId, session.user.id),
    ),
  });

  if (!membership) {
    redirect("/");
  }

  if (session.session.activeOrganizationId !== org.id) {
    await auth.api.setActiveOrganization({
      body: { organizationId: org.id },
    });
  }

  return <>{children}</>;
}
