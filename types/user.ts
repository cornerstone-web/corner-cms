export interface ChurchAssignment {
  churchId: string;
  githubRepoName: string;
  slug: string;
  displayName: string;
  cfPagesUrl: string | null;
  role: "church_admin" | "editor";
}

export interface User {
  id: string;
  auth0Id: string;
  email: string;
  name: string;
  isSuperAdmin: boolean;
  churchAssignment: ChurchAssignment | null;
}
