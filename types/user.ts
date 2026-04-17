export interface SiteAssignment {
  siteId: string;
  githubRepoName: string;
  slug: string;
  displayName: string;
  cfPagesUrl: string | null;
  isAdmin: boolean;
  scopes: string[];
}

export interface User {
  id: string;
  auth0Id: string;
  email: string;
  name: string;
  isSuperAdmin: boolean;
  siteAssignment: SiteAssignment | null;
}
