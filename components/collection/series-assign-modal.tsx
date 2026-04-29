"use client";

import { useEffect, useState } from "react";
import { useConfig } from "@/contexts/config-context";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { BookOpen, Search } from "lucide-react";

interface UnassignedSermon {
  path: string;
  title: string;
  date: string;
  speaker: string;
}

interface AssignResult {
  path: string;
  title: string;
  status: "success" | "error";
  error?: string;
}

type ModalStep = "select" | "confirm" | "done";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

function formatDate(dateStr: string) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export function SeriesAssignModal({ open, onOpenChange, onSuccess }: Props) {
  const { config } = useConfig();

  const [step, setStep] = useState<ModalStep>("select");
  const [availableSeries, setAvailableSeries] = useState<string[]>([]);
  const [sermons, setSermons] = useState<UnassignedSermon[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedSeries, setSelectedSeries] = useState("");
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [isAssigning, setIsAssigning] = useState(false);
  const [results, setResults] = useState<AssignResult[]>([]);

  const apiBase = config
    ? `/api/${config.owner}/${config.repo}/${encodeURIComponent(config.branch)}`
    : "";

  useEffect(() => {
    if (!open || !apiBase) return;
    setStep("select");
    setSelectedSeries("");
    setSelectedPaths(new Set());
    setSearch("");
    setResults([]);
    setIsLoading(true);

    Promise.all([
      fetch(`${apiBase}/series-options`).then((r) => r.json()),
      fetch(`${apiBase}/sermons-without-series`).then((r) => r.json()),
    ])
      .then(([seriesJson, sermonsJson]) => {
        setAvailableSeries(seriesJson.data?.titles ?? []);
        setSermons(sermonsJson.data?.sermons ?? []);
      })
      .catch(() => toast.error("Failed to load data"))
      .finally(() => setIsLoading(false));
  }, [open, apiBase]);

  const filteredSermons = sermons.filter((s) =>
    s.title.toLowerCase().includes(search.toLowerCase()) ||
    s.speaker.toLowerCase().includes(search.toLowerCase())
  );

  const allFilteredSelected =
    filteredSermons.length > 0 &&
    filteredSermons.every((s) => selectedPaths.has(s.path));

  const toggleAll = () => {
    if (allFilteredSelected) {
      setSelectedPaths((prev) => {
        const next = new Set(prev);
        filteredSermons.forEach((s) => next.delete(s.path));
        return next;
      });
    } else {
      setSelectedPaths((prev) => {
        const next = new Set(prev);
        filteredSermons.forEach((s) => next.add(s.path));
        return next;
      });
    }
  };

  const toggleSermon = (path: string) => {
    setSelectedPaths((prev) => {
      const next = new Set(prev);
      next.has(path) ? next.delete(path) : next.add(path);
      return next;
    });
  };

  const handleConfirm = async () => {
    if (!selectedSeries || selectedPaths.size === 0 || isAssigning) return;
    setIsAssigning(true);
    try {
      const paths = Array.from(selectedPaths);
      const res = await fetch(`${apiBase}/sermon-series-assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ series: selectedSeries, paths }),
      });
      const json = await res.json();

      const pathToTitle = new Map(sermons.map((s) => [s.path, s.title]));
      const assignResults: AssignResult[] = (json.data?.results ?? []).map((r: any) => ({
        path: r.path,
        title: pathToTitle.get(r.path) ?? r.path.split("/").pop() ?? r.path,
        status: r.status,
        error: r.error,
      }));
      setResults(assignResults);
      setStep("done");

      const updated = assignResults.filter((r) => r.status === "success").length;
      if (updated > 0) onSuccess();
    } catch {
      toast.error("Failed to assign series");
    } finally {
      setIsAssigning(false);
    }
  };

  const selectedSermons = sermons.filter((s) => selectedPaths.has(s.path));

  if (!config) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        {step === "select" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <BookOpen className="w-5 h-5" />
                Assign Series to Sermons
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-1">
              <p className="text-sm font-medium">Assign to series</p>
              <Select value={selectedSeries} onValueChange={setSelectedSeries} disabled={isLoading}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a series…" />
                </SelectTrigger>
                <SelectContent>
                  {availableSeries.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    className="pl-9 h-9"
                    placeholder="Filter sermons…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <button
                  type="button"
                  className="text-xs text-primary underline whitespace-nowrap shrink-0"
                  onClick={toggleAll}
                  disabled={isLoading || filteredSermons.length === 0}
                >
                  {allFilteredSelected ? "Deselect all" : "Select all"}
                </button>
              </div>

              <div className="overflow-y-auto max-h-[380px] space-y-1 pr-1">
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full rounded-md" />
                  ))
                ) : filteredSermons.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    {sermons.length === 0
                      ? "All sermons already have a series assigned."
                      : "No sermons match your filter."}
                  </p>
                ) : (
                  filteredSermons.map((sermon) => (
                    <label
                      key={sermon.path}
                      className={`flex items-center gap-3 p-3 rounded-md border cursor-pointer transition-colors ${
                        selectedPaths.has(sermon.path)
                          ? "border-primary bg-primary/5"
                          : "hover:bg-muted/50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4 shrink-0 rounded border-input accent-primary cursor-pointer"
                        checked={selectedPaths.has(sermon.path)}
                        onChange={() => toggleSermon(sermon.path)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium leading-snug truncate">{sermon.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {sermon.date && formatDate(sermon.date)}
                          {sermon.speaker && (
                            <span className="ml-2">{sermon.speaker}</span>
                          )}
                        </p>
                      </div>
                    </label>
                  ))
                )}
              </div>
            </div>

            <div className="flex justify-between items-center pt-2 border-t">
              <span className="text-sm text-muted-foreground">
                {selectedPaths.size} selected
              </span>
              <Button
                size="sm"
                disabled={!selectedSeries || selectedPaths.size === 0}
                onClick={() => setStep("confirm")}
              >
                Review Assignment ({selectedPaths.size})
              </Button>
            </div>
          </>
        )}

        {step === "confirm" && (
          <>
            <DialogHeader>
              <DialogTitle>Confirm Assignment</DialogTitle>
            </DialogHeader>

            <div className="space-y-3">
              <p className="text-sm">
                Assign{" "}
                <span className="font-semibold">&ldquo;{selectedSeries}&rdquo;</span>{" "}
                as the series for {selectedSermons.length} sermon
                {selectedSermons.length !== 1 ? "s" : ""}:
              </p>
              <div className="overflow-y-auto max-h-[320px] space-y-1 rounded-md border p-2">
                {selectedSermons.map((s) => (
                  <div key={s.path} className="flex items-center justify-between gap-2 py-1 px-1 text-sm">
                    <span className="truncate">{s.title}</span>
                    {s.date && (
                      <span className="text-xs text-muted-foreground shrink-0">{formatDate(s.date)}</span>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                This will overwrite any existing series value on the selected sermons.
              </p>
            </div>

            <div className="flex justify-between items-center pt-2 border-t gap-2">
              <Button variant="ghost" size="sm" onClick={() => setStep("select")} disabled={isAssigning}>
                Back
              </Button>
              <Button size="sm" onClick={handleConfirm} disabled={isAssigning}>
                {isAssigning
                  ? "Assigning…"
                  : `Assign to ${selectedPaths.size} Sermon${selectedPaths.size !== 1 ? "s" : ""}`}
              </Button>
            </div>
          </>
        )}

        {step === "done" && (
          <>
            <DialogHeader>
              <DialogTitle>Assignment Complete</DialogTitle>
            </DialogHeader>

            <div className="space-y-2 overflow-y-auto max-h-[360px]">
              {results.map((r) => (
                <div key={r.path} className="flex items-center justify-between gap-2 text-sm py-1">
                  <span className="truncate">{r.title}</span>
                  {r.status === "success" ? (
                    <Badge variant="secondary" className="shrink-0">Updated</Badge>
                  ) : (
                    <Badge variant="destructive" className="shrink-0">Failed</Badge>
                  )}
                </div>
              ))}
              {results.some((r) => r.status === "error") && (
                <p className="text-xs text-destructive pt-1">
                  Some sermons could not be updated. You can retry by reopening this tool.
                </p>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t">
              <Button size="sm" onClick={() => onOpenChange(false)}>Done</Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
