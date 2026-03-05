/**
 * Repo access guard — verifies the authenticated user may access [owner]/[repo].
 *
 * Access is granted when:
 *   1. User is a super admin → may access any church repo.
 *   2. User has a church role for the church whose github_repo_name matches
 *      `${owner}/${repo}` (case-insensitive).
 *
 * Throws an error (caught by the caller as a 403) when access is denied.
 */

import { User } from "@/types/user";

export function verifyRepoAccess(user: User, owner: string, repo: string): void {
  if (user.isSuperAdmin) return;

  const assignment = user.churchAssignment;
  if (!assignment) {
    throw new Error(`You do not have access to "${owner}/${repo}".`);
  }

  const expectedRepo = `${owner}/${repo}`.toLowerCase();
  if (assignment.githubRepoName.toLowerCase() !== expectedRepo) {
    throw new Error(`You do not have access to "${owner}/${repo}".`);
  }
}
