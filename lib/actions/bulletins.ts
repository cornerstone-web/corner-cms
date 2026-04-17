"use server";

import { getAuth } from "@/lib/auth";
import {
  getDirectoryAllFileNames,
  getFileDownloadUrl,
} from "@/lib/github/wizard";

const BULLETIN_DIR = "public/bulletins";
const MAX_BULLETINS = 52;

async function assertBulletinAccess(repoName: string) {
  const { user } = await getAuth();
  if (!user) throw new Error("Not authenticated.");
  if (user.isSuperAdmin) return;
  if (!user.siteAssignment) throw new Error("Access denied.");
  const repo = user.siteAssignment.githubRepoName.split("/")[1];
  if (repo !== repoName) throw new Error("Access denied.");
}

export type BulletinCheckResult = {
  conflict: boolean;
  count: number;
  oldest?: { name: string; downloadUrl: string | null };
};

export async function checkBulletinUpload(
  repoName: string,
  date: string,
): Promise<BulletinCheckResult> {
  await assertBulletinAccess(repoName);

  const allFiles = await getDirectoryAllFileNames(repoName, BULLETIN_DIR).catch(() => []);
  const pdfs = allFiles.filter((f) => f.toLowerCase().endsWith(".pdf")).sort();

  const targetName = `${date}.pdf`;
  const conflict = pdfs.includes(targetName);

  if (pdfs.length === 0) {
    return { conflict, count: 0 };
  }

  const oldestName = pdfs[0];
  const downloadUrl = await getFileDownloadUrl(repoName, `${BULLETIN_DIR}/${oldestName}`).catch(() => null);

  return {
    conflict,
    count: pdfs.length,
    oldest: { name: oldestName, downloadUrl },
  };
}
