import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getAuth } from "@/lib/auth";
import { db } from "@/db";
import { churchesTable, churchWizardStepsTable } from "@/db/schema";
import { initWizard } from "@/lib/actions/setup";

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

  return (
    <div>
      Wizard coming soon
    </div>
  );
}
