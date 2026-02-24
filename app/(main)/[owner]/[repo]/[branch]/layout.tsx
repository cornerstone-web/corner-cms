import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";
import { getToken, getInstallationToken } from "@/lib/token";
import { configVersion, parseConfig, normalizeConfig } from "@/lib/config";
import { getConfig, saveConfig, updateConfig } from "@/lib/utils/config";
import { ConfigProvider } from "@/contexts/config-context";
import { RepoLayout } from "@/components/repo/repo-layout";
import { createOctokitInstance } from "@/lib/utils/octokit";

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
  const lowerOwner = owner.toLowerCase();
  const lowerRepo = repo.toLowerCase();

  // Read the church repo's package-lock.json to find the exact installed version
  // of @cornerstone-web/core. This drives which .pages.yml tag we fetch so that
  // the CMS config is always version-matched to the deployed site.
  const octokit = createOctokitInstance(token);
  const lockfileResponse = await octokit.rest.repos.getContent({
    owner,
    repo,
    path: "package-lock.json",
    ref: decodedBranch,
  });

  if (!("content" in lockfileResponse.data)) {
    throw new Error("package-lock.json not found. Ensure it is committed to the church repo.");
  }

  const lockfile = JSON.parse(
    Buffer.from((lockfileResponse.data as any).content, "base64").toString()
  );
  const coreEntry = lockfile.packages?.["node_modules/@cornerstone-web/core"];
  if (!coreEntry?.version) {
    throw new Error(
      "@cornerstone-web/core not found in package-lock.json. Run npm install and commit the lock file."
    );
  }
  const resolvedVersion: string = coreEntry.version; // e.g. "0.1.2"

  // Check DB cache. sha stores the resolved package version; version stores the
  // pages-cms configVersion (schema format). Both must match to use the cache.
  const cachedConfig = await getConfig(lowerOwner, lowerRepo, decodedBranch);

  let config;
  if (
    cachedConfig &&
    cachedConfig.sha === resolvedVersion &&
    cachedConfig.version === (configVersion ?? "0.0")
  ) {
    config = cachedConfig;
  } else {
    // Cache miss — fetch .pages.yml from cornerstone-web/cornerstone-core at the
    // matching git tag (v{version}). Uses the GitHub App installation token for
    // cornerstone-web org (requires the App to be installed on that org).
    const coreToken = await getInstallationToken("cornerstone-web", "cornerstone-core");
    const coreOctokit = createOctokitInstance(coreToken);

    const configResponse = await coreOctokit.rest.repos.getContent({
      owner: "cornerstone-web",
      repo: "cornerstone-core",
      path: ".pages.yml",
      ref: `v${resolvedVersion}`,
    });

    if (!("content" in configResponse.data)) {
      throw new Error(
        `Could not fetch .pages.yml from cornerstone-core at v${resolvedVersion}. ` +
        `Ensure git tag v${resolvedVersion} exists on that repo.`
      );
    }

    const configYaml = Buffer.from(
      (configResponse.data as any).content,
      "base64"
    ).toString();
    const { document } = parseConfig(configYaml);
    const configObject = normalizeConfig(document.toJSON());

    config = {
      owner: lowerOwner,
      repo: lowerRepo,
      branch: decodedBranch,
      sha: resolvedVersion,
      version: configVersion ?? "0.0",
      object: configObject,
    };

    if (!cachedConfig) {
      await saveConfig(config);
    } else {
      await updateConfig(config);
    }
  }

  return (
    <ConfigProvider value={config}>
      <RepoLayout>{children}</RepoLayout>
    </ConfigProvider>
  );
}
