"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useConfig } from "@/contexts/config-context";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Youtube, Search } from "lucide-react";

// ---- Types ----
interface YouTubeVideo {
  id: string;
  title: string;
  description: string;
  publishedAt: string;
  thumbnailUrl: string;
  isLiveRecording: boolean;
  alreadyImported: boolean;
}

interface SermonDraft {
  videoId: string;
  title: string;
  date: string;
  speaker: string;
  series: string;
  description: string;
  videoUrl: string;
}

type ModalStep = "select" | "review" | "done";

interface SyncResult {
  videoId: string;
  title: string;
  status: "draft" | "published" | "discarded" | "error";
  path?: string;
  error?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

// ---- Helpers ----
function toSermonDraft(video: YouTubeVideo): SermonDraft {
  const date = new Date(video.publishedAt).toISOString().split("T")[0];
  const description = video.description
    ? video.description.length > 200
      ? (() => {
          const cutPoint = video.description.lastIndexOf(" ", 200);
          return (cutPoint > 0 ? video.description.substring(0, cutPoint) : video.description.substring(0, 200)) + "...";
        })()
      : video.description
    : "";
  return {
    videoId: video.id,
    title: video.title,
    date,
    speaker: "",
    series: "",
    description,
    videoUrl: `https://www.youtube.com/watch?v=${video.id}`,
  };
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric", month: "short", day: "numeric",
  });
}

// ---- Main Component ----
export function YouTubeSyncModal({ open, onOpenChange, onSuccess }: Props) {
  const { config } = useConfig();
  const router = useRouter();

  const [step, setStep] = useState<ModalStep>("select");
  const [videos, setVideos] = useState<YouTubeVideo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [unconfigured, setUnconfigured] = useState(false);
  const [search, setSearch] = useState("");
  const [livestreamsOnly, setLivestreamsOnly] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Review step state
  const [reviewQueue, setReviewQueue] = useState<SermonDraft[]>([]);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [currentDraft, setCurrentDraft] = useState<SermonDraft | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [results, setResults] = useState<SyncResult[]>([]);

  const apiBase = config
    ? `/api/${config.owner}/${config.repo}/${encodeURIComponent(config.branch)}`
    : "";

  // Fetch videos when opening
  const fetchVideos = useCallback(async (lsOnly: boolean) => {
    if (!apiBase) return;
    setIsLoading(true);
    setUnconfigured(false);
    try {
      const res = await fetch(
        `${apiBase}/youtube-videos${lsOnly ? "?livestreamsOnly=true" : ""}`
      );
      const json = await res.json();
      if (json.status === "unconfigured") {
        setUnconfigured(true);
        setVideos([]);
      } else {
        setVideos(json.data?.videos ?? []);
      }
    } catch {
      toast.error("Failed to fetch YouTube videos");
    } finally {
      setIsLoading(false);
    }
  }, [apiBase]);

  useEffect(() => {
    if (!open || !config) return;
    setStep("select");
    setSelected(new Set());
    setResults([]);
    setSearch("");
    setLivestreamsOnly(false);
    fetchVideos(false);
  }, [open, fetchVideos]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleLivestreams = (checked: boolean) => {
    setLivestreamsOnly(checked);
    setSelected(new Set());
    fetchVideos(checked);
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const startReview = () => {
    const queue = videos
      .filter((v) => selected.has(v.id))
      .map(toSermonDraft);
    setReviewQueue(queue);
    setReviewIndex(0);
    setCurrentDraft(queue[0] ?? null);
    setStep("review");
  };

  const filteredVideos = videos.filter((v) =>
    v.title.toLowerCase().includes(search.toLowerCase())
  );

  const advanceReview = (result: SyncResult) => {
    setResults((prev) => [...prev, result]);
    const next = reviewIndex + 1;
    if (next >= reviewQueue.length) {
      setStep("done");
      onSuccess();
    } else {
      setReviewIndex(next);
      setCurrentDraft(reviewQueue[next]);
    }
  };

  const handleDiscard = () => {
    if (!currentDraft) return;
    advanceReview({ videoId: currentDraft.videoId, title: currentDraft.title, status: "discarded" });
  };

  const handleSave = async (draft: boolean) => {
    if (!currentDraft || isSaving) return;
    setIsSaving(true);
    try {
      const res = await fetch(`${apiBase}/youtube-sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...currentDraft, draft }),
      });
      const json = await res.json();
      if (json.status === "success") {
        advanceReview({
          videoId: currentDraft.videoId,
          title: currentDraft.title,
          status: draft ? "draft" : "published",
          path: json.data.path,
        });
      } else {
        toast.error(json.message ?? "Failed to create sermon");
        advanceReview({
          videoId: currentDraft.videoId,
          title: currentDraft.title,
          status: "error",
          error: json.message,
        });
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error";
      toast.error("Failed to create sermon");
      advanceReview({
        videoId: currentDraft.videoId,
        title: currentDraft.title,
        status: "error",
        error: message,
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!config) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        {step === "select" && (
          <SelectStep
            videos={filteredVideos}
            isLoading={isLoading}
            unconfigured={unconfigured}
            search={search}
            setSearch={setSearch}
            livestreamsOnly={livestreamsOnly}
            toggleLivestreams={toggleLivestreams}
            selected={selected}
            toggleSelect={toggleSelect}
            onContinue={startReview}
            settingsUrl={`/${config.owner}/${config.repo}/${encodeURIComponent(config.branch)}/site-config`}
          />
        )}
        {step === "review" && currentDraft && (
          <ReviewStep
            draft={currentDraft}
            setDraft={setCurrentDraft}
            index={reviewIndex}
            total={reviewQueue.length}
            isSaving={isSaving}
            onDiscard={handleDiscard}
            onSaveDraft={() => handleSave(true)}
            onPublish={() => handleSave(false)}
          />
        )}
        {step === "done" && (
          <DoneStep
            results={results}
            onClose={() => onOpenChange(false)}
            onNavigate={(path) => {
              onOpenChange(false);
              router.push(`/${config.owner}/${config.repo}/${encodeURIComponent(config.branch)}/collection/sermons/edit/${encodeURIComponent(path)}`);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---- SelectStep ----
interface SelectStepProps {
  videos: YouTubeVideo[];
  isLoading: boolean;
  unconfigured: boolean;
  search: string;
  setSearch: (s: string) => void;
  livestreamsOnly: boolean;
  toggleLivestreams: (v: boolean) => void;
  selected: Set<string>;
  toggleSelect: (id: string) => void;
  onContinue: () => void;
  settingsUrl: string;
}

function SelectStep({
  videos, isLoading, unconfigured, search, setSearch,
  livestreamsOnly, toggleLivestreams, selected, toggleSelect, onContinue, settingsUrl,
}: SelectStepProps) {
  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Youtube className="w-5 h-5 text-red-500" />
          Import from YouTube
        </DialogTitle>
      </DialogHeader>

      {unconfigured ? (
        <div className="py-8 text-center space-y-3">
          <p className="text-sm text-muted-foreground">
            YouTube integration is not configured. Add your API key and channel ID in Site Settings.
          </p>
          <Link href={settingsUrl} className="text-sm underline text-primary">
            Go to Site Settings →
          </Link>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                className="pl-9 h-9"
                placeholder="Filter videos..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <label className="flex items-center gap-2 text-sm whitespace-nowrap cursor-pointer">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-input accent-primary cursor-pointer"
                checked={livestreamsOnly}
                onChange={(e) => toggleLivestreams(e.target.checked)}
              />
              Live streams only
            </label>
          </div>

          <div className="overflow-y-auto max-h-[420px] space-y-2 pr-1">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-md" />
              ))
            ) : videos.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No videos found.</p>
            ) : (
              videos.map((video) => (
                <label
                  key={video.id}
                  className={`flex items-start gap-3 p-3 rounded-md border transition-colors ${
                    video.alreadyImported
                      ? "opacity-50 cursor-default"
                      : selected.has(video.id)
                      ? "border-primary bg-primary/5 cursor-pointer"
                      : "hover:bg-muted/50 cursor-pointer"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-input accent-primary cursor-pointer disabled:cursor-not-allowed"
                    checked={selected.has(video.id)}
                    disabled={video.alreadyImported}
                    onChange={() => !video.alreadyImported && toggleSelect(video.id)}
                  />
                  {video.thumbnailUrl && (
                    <img
                      src={video.thumbnailUrl}
                      alt=""
                      className="w-20 h-12 object-cover rounded shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium leading-snug truncate">{video.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatDate(video.publishedAt)}
                      {video.isLiveRecording && <span className="ml-2 text-red-500">● Live</span>}
                      {video.alreadyImported && (
                        <Badge variant="secondary" className="ml-2 text-[10px] py-0">Already imported</Badge>
                      )}
                    </p>
                  </div>
                </label>
              ))
            )}
          </div>

          <div className="flex justify-between items-center pt-2 border-t">
            <span className="text-sm text-muted-foreground">
              {selected.size} selected
            </span>
            <Button size="sm" disabled={selected.size === 0} onClick={onContinue}>
              Review Selected ({selected.size})
            </Button>
          </div>
        </>
      )}
    </>
  );
}

// ---- ReviewStep ----
interface ReviewStepProps {
  draft: SermonDraft;
  setDraft: (d: SermonDraft) => void;
  index: number;
  total: number;
  isSaving: boolean;
  onDiscard: () => void;
  onSaveDraft: () => void;
  onPublish: () => void;
}

function ReviewStep({ draft, setDraft, index, total, isSaving, onDiscard, onSaveDraft, onPublish }: ReviewStepProps) {
  const field = (key: keyof SermonDraft) => (value: string) =>
    setDraft({ ...draft, [key]: value });

  return (
    <>
      <DialogHeader>
        <DialogTitle>Review Sermon {index + 1} of {total}</DialogTitle>
        <p className="text-sm text-muted-foreground">
          Edit the fields below before saving.
        </p>
      </DialogHeader>

      <div className="space-y-4 overflow-y-auto max-h-[500px] pr-1">
        <div className="rounded-md border overflow-hidden aspect-video bg-black">
          <iframe
            src={`https://www.youtube.com/embed/${draft.videoId}`}
            title={`YouTube preview: ${draft.title}`}
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 space-y-1">
            <Label>Title</Label>
            <Input value={draft.title} onChange={(e) => field("title")(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Date</Label>
            <Input type="date" value={draft.date} onChange={(e) => field("date")(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Speaker</Label>
            <Input placeholder="Speaker name" value={draft.speaker} onChange={(e) => field("speaker")(e.target.value)} />
          </div>
          <div className="col-span-2 space-y-1">
            <Label>Series <span className="text-muted-foreground">(optional)</span></Label>
            <Input placeholder="Series slug or name" value={draft.series} onChange={(e) => field("series")(e.target.value)} />
          </div>
          <div className="col-span-2 space-y-1">
            <Label>Description</Label>
            <Textarea
              rows={3}
              value={draft.description}
              onChange={(e) => field("description")(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center pt-2 border-t gap-2">
        <Button variant="ghost" size="sm" onClick={onDiscard} disabled={isSaving}>
          Discard
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onSaveDraft} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save as Draft"}
          </Button>
          <Button size="sm" onClick={onPublish} disabled={isSaving}>
            {isSaving ? "Publishing..." : "Publish"}
          </Button>
        </div>
      </div>
    </>
  );
}

// ---- DoneStep ----
interface DoneStepProps {
  results: SyncResult[];
  onClose: () => void;
  onNavigate: (path: string) => void;
}

function DoneStep({ results, onClose, onNavigate }: DoneStepProps) {
  const created = results.filter((r) => r.status === "draft" || r.status === "published");
  const discarded = results.filter((r) => r.status === "discarded");
  const errors = results.filter((r) => r.status === "error");

  return (
    <>
      <DialogHeader>
        <DialogTitle>Import Complete</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        {created.map((r) => (
          <div key={r.videoId} className="flex items-center justify-between gap-2 text-sm">
            <span className="truncate">{r.title}</span>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant={r.status === "published" ? "default" : "secondary"}>
                {r.status === "published" ? "Published" : "Draft"}
              </Badge>
              {r.path && (
                <button
                  className="text-xs underline text-primary"
                  onClick={() => onNavigate(r.path!)}
                >
                  Open →
                </button>
              )}
            </div>
          </div>
        ))}
        {discarded.length > 0 && (
          <p className="text-xs text-muted-foreground">{discarded.length} discarded</p>
        )}
        {errors.map((r) => (
          <p key={r.videoId} className="text-xs text-destructive">
            Failed: {r.title} — {r.error}
          </p>
        ))}
      </div>
      <div className="flex justify-end pt-2 border-t">
        <Button size="sm" onClick={onClose}>Done</Button>
      </div>
    </>
  );
}
