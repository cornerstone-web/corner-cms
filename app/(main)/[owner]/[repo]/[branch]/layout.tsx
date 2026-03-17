import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";
import { getToken, getInstallationToken } from "@/lib/token";
// NOTE: getToken + getInstallationToken will be simplified in Step 3
import { configVersion, parseConfig, normalizeConfig } from "@/lib/config";
import { getConfig, saveConfig, updateConfig } from "@/lib/utils/config";
import { ConfigProvider } from "@/contexts/config-context";
import { RepoLayout } from "@/components/repo/repo-layout";
import { createOctokitInstance } from "@/lib/utils/octokit";

export default async function Layout(
  props: {
    children: React.ReactNode;
    params: Promise<{ owner: string; repo: string; branch: string; }>;
  }
) {
  const params = await props.params;

  const {
    owner,
    repo,
    branch
  } = params;

  const {
    children
  } = props;

  const { user } = await getAuth();
  if (!user) return redirect("/auth/login");

  const token = await getToken(user, owner, repo);
  if (!token) throw new Error("Token not found");

  const decodedBranch = decodeURIComponent(branch);
  const lowerOwner = owner.toLowerCase();
  const lowerRepo = repo.toLowerCase();

  // Read the church repo's package-lock.json to find the exact installed version
  // of @cornerstone-web/core. This drives which .pages.yml tag we fetch so that
  // the CMS config is always version-matched to the deployed site.
  // Falls back to package.json for new church repos that don't have a committed lock file yet.
  const octokit = createOctokitInstance(token);
  let resolvedVersion: string;
  try {
    const lockfileResponse = await octokit.rest.repos.getContent({
      owner,
      repo,
      path: "package-lock.json",
      ref: decodedBranch,
    });
    if (!("content" in lockfileResponse.data)) throw new Error("no content");
    const lockfile = JSON.parse(
      Buffer.from((lockfileResponse.data as any).content, "base64").toString()
    );
    const coreEntry = lockfile.packages?.["node_modules/@cornerstone-web/core"];
    if (!coreEntry?.version) throw new Error("@cornerstone-web/core not in lockfile");
    resolvedVersion = coreEntry.version;
  } catch {
    // Fallback for repos that don't have a committed lock file yet (e.g. new church repos
    // created from corner-template before CF Pages has run npm install).
    const pkgResponse = await octokit.rest.repos.getContent({
      owner,
      repo,
      path: "package.json",
      ref: decodedBranch,
    });
    if (!("content" in pkgResponse.data)) {
      throw new Error("Neither package-lock.json nor package.json found in this repo.");
    }
    const pkg = JSON.parse(
      Buffer.from((pkgResponse.data as any).content, "base64").toString()
    ) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
    const depVersion =
      pkg.dependencies?.["@cornerstone-web/core"] ??
      pkg.devDependencies?.["@cornerstone-web/core"];
    if (!depVersion) {
      throw new Error("@cornerstone-web/core not found in package.json.");
    }
    // Strip semver range prefix (^, ~, >=, etc.) to get the base version
    resolvedVersion = depVersion.replace(/^[\^~>=<\s]+/, "");
  }

  // Check DB cache. sha stores the resolved package version; version stores the
  // corner-cms configVersion (schema format). Both must match to use the cache.
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
