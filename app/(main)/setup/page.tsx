import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import YAML from "yaml";
import { getAuth } from "@/lib/auth";
import { db } from "@/db";
import { churchesTable, churchWizardStepsTable } from "@/db/schema";
import { initWizard } from "@/lib/actions/setup";
import { getFileWithSha, getFileDownloadUrl } from "@/lib/github/wizard";
import WizardShell from "@/components/setup/WizardShell";

export default async function SetupPage() {
  const { user } = await getAuth();
  if (!user) return redirect("/auth/login");

  // Super admins don't go through the wizard
  if (user.isSuperAdmin) return redirect("/");

  // Must have a church assignment to be here
  if (!user.churchAssignment) return redirect("/");

  const churchId = user.churchAssignment.churchId;

  const church = await db.query.churchesTable.findFirst({
    where: eq(churchesTable.id, churchId),
  });

  if (!church) return redirect("/");

  // Wizard already completed — send them home
  if (church.status === "active") return redirect("/");

  // First visit: kick off repo creation and stamp wizardStartedAt
  if (church.wizardStartedAt === null) {
    await initWizard(churchId);
  }

  // Load completed steps for this church
  const completedStepRows = await db.query.churchWizardStepsTable.findMany({
    where: eq(churchWizardStepsTable.churchId, churchId),
    columns: { stepKey: true },
  });
  const completedSteps = new Set(completedStepRows.map((r) => r.stepKey));

  // Load current site config to pre-populate completed steps
  let initialConfig: Record<string, unknown> = {};
  try {
    const { content } = await getFileWithSha(church.slug, "src/config/site.config.yaml");
    initialConfig = YAML.parse(content) as Record<string, unknown>;
  } catch {
    // Config not yet written (first visit) — steps will use empty defaults
  }

  // Fetch authenticated download URLs for already-uploaded branding assets
  const [logoUrl, faviconUrl] = await Promise.all([
    completedSteps.has("logo") ? getFileDownloadUrl(church.slug, "public/images/logo.png") : Promise.resolve(null),
    completedSteps.has("favicon") ? getFileDownloadUrl(church.slug, "public/favicon.svg") : Promise.resolve(null),
  ]);

  return (
    <WizardShell
      church={{ id: church.id, displayName: church.displayName, slug: church.slug }}
      completedStepsArray={[...completedSteps]}
      initialConfig={initialConfig}
      initialLogoUrl={logoUrl ?? undefined}
      initialFaviconUrl={faviconUrl ?? undefined}
      userEmail={user.email ?? undefined}
    />
  );
}
