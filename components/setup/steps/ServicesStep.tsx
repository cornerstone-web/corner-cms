"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveServices } from "@/lib/actions/setup-steps";

interface StepProps {
  church: { id: string; displayName: string; slug: string };
  onComplete: () => void;
  initialServiceTimes?: {
    day: string;
    time: string;
    name?: string;
    label?: string;
  }[];
}

interface ServiceRow {
  id: number;
  day: string;
  time: string;
  label: string;
}

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function makeRow(): ServiceRow {
  return { id: Date.now() + Math.random(), day: "Sunday", time: "", label: "" };
}

export default function ServicesStep({
  church,
  onComplete,
  initialServiceTimes,
}: StepProps) {
  const [rows, setRows] = useState<ServiceRow[]>(() => {
    if (initialServiceTimes && initialServiceTimes.length > 0) {
      return initialServiceTimes.map((s, i) => ({
        id: i,
        day: s.day || "Sunday",
        time: s.time || "",
        label: s.label ?? s.name ?? "",
      }));
    }
    return [makeRow()];
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addRow() {
    setRows((prev) => [...prev, makeRow()]);
  }

  function removeRow(id: number) {
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  function updateRow(
    id: number,
    field: keyof Omit<ServiceRow, "id">,
    value: string,
  ) {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)),
    );
  }

  async function handleSubmit() {
    if (rows.some((r) => !r.time.trim())) {
      setError("Please add a time for each service");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const serviceTimes = rows.map((r) => ({
        day: r.day,
        time: r.time.trim(),
        ...(r.label.trim() ? { label: r.label.trim() } : {}),
      }));
      await saveServices(church.id, church.slug, serviceTimes);
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold">Service Times</h2>
        <p className="text-muted-foreground text-sm">
          When does your congregation meet?
        </p>
      </div>
      <div className="space-y-3">
        {rows.length > 0 && (
          <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-center">
            <Label className="text-xs text-muted-foreground">Day</Label>
            <Label className="text-xs text-muted-foreground">Time</Label>
            <Label className="text-xs text-muted-foreground">
              Label (optional)
            </Label>
            <span />
          </div>
        )}
        {rows.map((row) => (
          <div
            key={row.id}
            className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-center"
          >
            <select
              value={row.day}
              onChange={(e) => updateRow(row.id, "day", e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {DAYS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <Input
              value={row.time}
              onChange={(e) => updateRow(row.id, "time", e.target.value)}
              placeholder="10:00 AM"
            />
            <Input
              value={row.label}
              onChange={(e) => updateRow(row.id, "label", e.target.value)}
              placeholder="Morning Worship"
            />
            <button
              type="button"
              onClick={() => removeRow(row.id)}
              disabled={rows.length === 1}
              className="flex h-9 w-9 items-center justify-center rounded-md border border-input text-muted-foreground hover:text-destructive hover:border-destructive transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-muted-foreground disabled:hover:border-input"
              aria-label="Remove service"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 6h18" />
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
              </svg>
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={addRow}
          className="text-sm text-primary underline-offset-4 hover:underline"
        >
          + Add another service
        </button>
      </div>
      <Button onClick={handleSubmit} disabled={isLoading}>
        {isLoading ? "Saving..." : "Continue →"}
      </Button>
      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  );
}
