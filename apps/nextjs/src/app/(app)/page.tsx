import { redirect } from "next/navigation";

import { eq } from "@silo-storage/db";
import { db } from "@silo-storage/db/client";
import { organizations } from "@silo-storage/db/schema";

import { getSession } from "@/auth/server";

export default async function RootPage() {
  const session = await getSession();

  if (!session?.user) {
    redirect("/login");
  }

  const activeOrgId = session.session.activeOrganizationId;

  if (activeOrgId) {
    const org = await db.query.organizations.findFirst({
      where: eq(organizations.id, activeOrgId),
      columns: { slug: true },
    });

    if (org) {
      redirect(`/${org.slug}`);
    }
  }

  redirect("/login");
}
