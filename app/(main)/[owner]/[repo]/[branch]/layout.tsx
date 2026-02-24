import { readFileSync } from "fs";
import { join } from "path";
import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";
import { getToken } from "@/lib/token";
import { configVersion, parseConfig, normalizeConfig } from "@/lib/config";
import { ConfigProvider } from "@/contexts/config-context";
import { RepoLayout } from "@/components/repo/repo-layout";

// Parse and normalize the baked-in platform config once at module load time.
// This replaces the previous per-request GitHub fetch of .pages.yml from church repos.
const platformConfigYaml = readFileSync(
  join(process.cwd(), "lib/platform-config.yaml"),
  "utf-8"
);
const { document: platformDoc } = parseConfig(platformConfigYaml);
const platformConfigObject = normalizeConfig(platformDoc.toJSON());

export default async function Layout({
  children,
  params: { owner, repo, branch },
}: {
  children: React.ReactNode;
  params: { owner: string; repo: string; branch: string; };
}) {
  const { session, user } = await getAuth();
  if (!session) return redirect("/sign-in");

  const token = await getToken(user, owner, repo);
  if (!token) throw new Error("Token not found");

  const decodedBranch = decodeURIComponent(branch);

  const config = {
    owner: owner.toLowerCase(),
    repo: repo.toLowerCase(),
    branch: decodedBranch,
    sha: "platform",
    version: configVersion ?? "0.0",
    object: platformConfigObject,
  };

  return (
    <ConfigProvider value={config}>
      <RepoLayout>{children}</RepoLayout>
    </ConfigProvider>
  );
}
