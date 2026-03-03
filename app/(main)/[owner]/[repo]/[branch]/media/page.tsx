import Link from "next/link";
import { cn } from "@/lib/utils";
import { MediaView } from "@/components/media/media-view";

const VALID_CATEGORIES = ["images", "video", "audio", "files", "bulletins"] as const;
type MediaCategory = (typeof VALID_CATEGORIES)[number];

const TAB_LABELS: Record<MediaCategory, string> = {
  images: "Images",
  video: "Video",
  audio: "Audio",
  files: "Files",
  bulletins: "Bulletins",
};

export default function Page({
  searchParams,
}: {
  params: { owner: string; repo: string; branch: string };
  searchParams: { category?: string };
}) {
  const category: MediaCategory = VALID_CATEGORIES.includes(
    searchParams.category as MediaCategory
  )
    ? (searchParams.category as MediaCategory)
    : "images";

  return (
    <div className="max-w-screen-xl mx-auto flex-1 flex flex-col h-full">
      <header className="flex items-center mb-6">
        <h1 className="font-semibold text-lg md:text-2xl">Media</h1>
      </header>

      {/* Category tabs */}
      <div className="inline-flex h-10 items-center justify-start rounded-md bg-muted p-1 text-muted-foreground mb-6 w-full sm:w-auto">
        {VALID_CATEGORIES.map((tab) => (
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
        <MediaView category={category} />
      </div>
    </div>
  );
}
