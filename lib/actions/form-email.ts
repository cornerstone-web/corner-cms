"use server";

import { getAuth } from "@/lib/auth";
import { db } from "@/db";
import { churchesTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  initiateContactFormVerification,
  checkContactFormVerification,
  removeContactFormEmail,
} from "./setup-steps";

async function getChurchContext() {
  const { user } = await getAuth();
  if (!user?.churchAssignment) throw new Error("Not authenticated.");
  const { churchId } = user.churchAssignment;
  const church = await db.query.churchesTable.findFirst({
    where: eq(churchesTable.id, churchId),
    columns: { slug: true },
  });
  if (!church) throw new Error("Church not found.");
  return { churchId, slug: church.slug };
}

export async function initiateFormEmail(email: string) {
  const { churchId, slug } = await getChurchContext();
  return initiateContactFormVerification(churchId, slug, email);
}

export async function checkFormEmail(email: string) {
  const { churchId, slug } = await getChurchContext();
  return checkContactFormVerification(churchId, slug, email);
}

export async function removeFormEmail(email: string) {
  const { churchId, slug } = await getChurchContext();
  return removeContactFormEmail(churchId, slug, email);
}
