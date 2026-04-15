import { redirect } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { getAuth } from "@/lib/auth";
import { isAdminUser, hasMediaAccess } from "@/lib/utils/access-control";
import { MediaView } from "@/components/media/media-view";
import { getFileWithSha, getDirectoryFileNames } from "@/lib/github/wizard";
import YAML from "yaml";

const VALID_CATEGORIES = ["images", "video", "audio", "files", "bulletins"] as const;
type MediaCategory = (typeof VALID_CATEGORIES)[number];

const TAB_LABELS: Record<MediaCategory, string> = {
  images: "Images",
  video: "Video",
  audio: "Audio",
  files: "Files",
  bulletins: "Bulletins",
};

async function shouldShowBulletins(repo: string): Promise<boolean> {
  try {
    const { content } = await getFileWithSha(repo, "src/config/site.config.yaml");
    const siteConfig = YAML.parse(content) as { features?: Record<string, boolean> };
    // If bulletins is not explicitly false, show the tab
    if (siteConfig.features?.bulletins !== false) return true;
    // Bulletins is disabled — only show the tab if files already exist
    const files = await getDirectoryFileNames(repo, "public/bulletins").catch(() => []);
    return files.length > 0;
  } catch {
    return true; // Can't determine — show by default
  }
}

export default async function Page(
  props: {
    params: Promise<{ owner: string; repo: string; branch: string }>;
    searchParams: Promise<{ category?: string }>;
  }
) {
  const [params, searchParams, { user }] = await Promise.all([props.params, props.searchParams, getAuth()]);

  if (!user) return redirect("/auth/login");
  if (!hasMediaAccess(user)) {
    redirect(`/${params.owner}/${params.repo}/${encodeURIComponent(params.branch)}`);
  }

  const showBulletins = await shouldShowBulletins(params.repo);

  const visibleCategories: MediaCategory[] = (showBulletins ? [...VALID_CATEGORIES] : VALID_CATEGORIES.filter(c => c !== "bulletins"))
    .filter(c => isAdminUser(user) || (user.churchAssignment?.scopes ?? []).includes(`media:${c}`));

  // If no allowed categories remain, redirect (shouldn't happen — page guard above already checks)
  if (visibleCategories.length === 0) {
    redirect(`/${params.owner}/${params.repo}/${encodeURIComponent(params.branch)}`);
  }

  const requestedCategory = searchParams.category as MediaCategory;
  const category: MediaCategory = visibleCategories.includes(requestedCategory)
    ? requestedCategory
    : visibleCategories[0];

  return (
    <div className="max-w-screen-xl mx-auto flex-1 flex flex-col h-full">
      <header className="flex items-center mb-6">
        <h1 className="font-semibold text-lg md:text-2xl">Media</h1>
      </header>

      {/* Category tabs */}
      <div className="inline-flex h-10 items-center justify-start rounded-md bg-muted p-1 text-muted-foreground mb-6 w-full sm:w-auto">
        {visibleCategories.map((tab) => (
          <Link
            key={tab}
            href={`?category=${tab}`}
            className={cn(
              "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              category === tab
                ? "bg-background text-foreground shadow-sm"
                : "hover:bg-background/50 hover:text-foreground"
            )}
          >
            {TAB_LABELS[tab]}
          </Link>
        ))}
      </div>

      {/* Media content for the active category */}
      <div className="flex flex-col relative flex-1">
        <MediaView key={category} category={category} />
      </div>
    </div>
  );
}
