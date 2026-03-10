"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { saveFirstMinistries } from "@/lib/actions/setup-steps";

interface StepProps {
  church: { id: string; displayName: string; slug: string };
  onComplete: () => void;
}

interface MinistryRow {
  id: number;
  name: string;
  description: string;
  icon: string;
}

const MAX_ROWS = 4;

function makeRow(): MinistryRow {
  return { id: Date.now() + Math.random(), name: "", description: "", icon: "" };
}

export default function FirstMinistryStep({ church, onComplete }: StepProps) {
  const [rows, setRows] = useState<MinistryRow[]>(() => [makeRow()]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addRow() {
    if (rows.length >= MAX_ROWS) return;
    setRows((prev) => [...prev, makeRow()]);
  }

  function removeRow(id: number) {
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  function updateRow(id: number, field: keyof Omit<MinistryRow, "id">, value: string) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  }

  async function handleSubmit() {
    const filled = rows.filter((r) => r.name.trim());
    if (filled.length === 0) { setError("Please add at least one ministry."); return; }
    setIsLoading(true);
    setError(null);
    try {
      await saveFirstMinistries(
        church.id,
        church.slug,
        filled.map((r) => ({
          name: r.name.trim(),
          ...(r.description.trim() ? { description: r.description.trim() } : {}),
          ...(r.icon.trim() ? { icon: r.icon.trim() } : {}),
        })),
      );
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold">Ministries</h2>
        <p className="text-muted-foreground text-sm">
          Add up to {MAX_ROWS} ministries to introduce your church&apos;s programs. You can add more later.
        </p>
      </div>
      <div className="space-y-6">
        {rows.map((row, idx) => (
          <div key={row.id} className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Ministry {idx + 1}</span>
              {rows.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeRow(row.id)}
                  className="flex h-7 w-7 items-center justify-center rounded-md border border-input text-muted-foreground hover:text-destructive hover:border-destructive transition-colors"
                  aria-label="Remove ministry"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                  </svg>
                </button>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Name <span className="text-destructive">*</span></Label>
              <Input
                value={row.name}
                onChange={(e) => updateRow(row.id, "name", e.target.value)}
                placeholder="e.g. Youth Group"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Icon <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Input
                  value={row.icon}
                  onChange={(e) => updateRow(row.id, "icon", e.target.value)}
                  placeholder="e.g. heart, users, music"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Description <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Textarea
                value={row.description}
                onChange={(e) => updateRow(row.id, "description", e.target.value)}
                placeholder="What does this ministry do?"
                rows={2}
              />
            </div>
          </div>
        ))}
        {rows.length < MAX_ROWS && (
          <button
            type="button"
            onClick={addRow}
            className="text-sm text-primary underline-offset-4 hover:underline"
          >
            + Add another ministry
          </button>
        )}
      </div>
      <Button onClick={handleSubmit} disabled={isLoading}>
        {isLoading ? "Saving..." : "Continue →"}
      </Button>
      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  );
}
