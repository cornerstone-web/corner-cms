import { eq } from "drizzle-orm";
import { db } from "@/db";
import { churchesTable } from "@/db/schema";

/**
 * Fire-and-forget helper — bumps last_cms_edit_at (and updated_at) on the
 * church matching `owner/repo`. Call without `await` so it never blocks a
 * response.
 */
export async function bumpLastCmsEditAt(owner: string, repo: string): Promise<void> {
  const now = new Date();
  await db
    .update(churchesTable)
    .set({ lastCmsEditAt: now, updatedAt: now })
    .where(eq(churchesTable.githubRepoName, `${owner}/${repo}`));
}
