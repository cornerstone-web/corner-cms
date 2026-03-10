"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { saveStaffMembers } from "@/lib/actions/setup-steps";

interface StepProps {
  church: { id: string; displayName: string; slug: string };
  onComplete: () => void;
}

interface StaffRow {
  id: number;
  name: string;
  title: string;
  bio: string;
  photoPreview: string | null;
  photoBase64: string | null;
  photoExt: string | null;
}

function makeRow(): StaffRow {
  return { id: Date.now() + Math.random(), name: "", title: "", bio: "", photoPreview: null, photoBase64: null, photoExt: null };
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function StaffStep({ church, onComplete }: StepProps) {
  const [rows, setRows] = useState<StaffRow[]>(() => [makeRow(), makeRow()]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addRow() {
    setRows((prev) => [...prev, makeRow()]);
  }

  function removeRow(id: number) {
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  function updateRow(id: number, field: keyof Omit<StaffRow, "id" | "photoPreview" | "photoBase64" | "photoExt">, value: string) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  }

  async function handlePhotoChange(id: number, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;
    const preview = URL.createObjectURL(file);
    const base64 = await fileToBase64(file);
    const ext = file.name.split(".").pop() ?? "jpg";
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, photoPreview: preview, photoBase64: base64, photoExt: ext } : r)),
    );
  }

  async function handleSubmit() {
    const filled = rows.filter((r) => r.name.trim());
    if (filled.length === 0) { setError("Please add at least one staff member."); return; }
    setIsLoading(true);
    setError(null);
    try {
      await saveStaffMembers(
        church.id,
        church.slug,
        filled.map((r) => ({
          name: r.name.trim(),
          ...(r.title.trim() ? { title: r.title.trim() } : {}),
          ...(r.bio.trim() ? { bio: r.bio.trim() } : {}),
          ...(r.photoBase64 ? { photoBase64: r.photoBase64, photoExt: r.photoExt ?? "jpg" } : {}),
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
        <h2 className="text-xl font-semibold">Staff Members</h2>
        <p className="text-muted-foreground text-sm">
          Introduce your team. Add names and photos to create your staff directory.
        </p>
      </div>
      <div className="space-y-5">
        {rows.map((row, idx) => (
          <div key={row.id} className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Staff member {idx + 1}</span>
              {rows.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeRow(row.id)}
                  className="flex h-7 w-7 items-center justify-center rounded-md border border-input text-muted-foreground hover:text-destructive hover:border-destructive transition-colors"
                  aria-label="Remove staff member"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                  </svg>
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Name <span className="text-destructive">*</span></Label>
                <Input
                  value={row.name}
                  onChange={(e) => updateRow(row.id, "name", e.target.value)}
                  placeholder="e.g. John Smith"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Title / Role <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Input
                  value={row.title}
                  onChange={(e) => updateRow(row.id, "title", e.target.value)}
                  placeholder="e.g. Senior Pastor"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Bio <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Textarea
                value={row.bio}
                onChange={(e) => updateRow(row.id, "bio", e.target.value)}
                placeholder="A short bio..."
                rows={2}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Photo <span className="text-muted-foreground text-xs">(optional, square recommended)</span></Label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handlePhotoChange(row.id, e)}
                className="block w-full text-sm text-muted-foreground file:mr-4 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
              />
              {row.photoPreview && (
                <div className="mt-2 w-16 h-16 rounded-lg overflow-hidden border bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={row.photoPreview} alt="Photo preview" className="w-full h-full object-cover" />
                </div>
              )}
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={addRow}
          className="text-sm text-primary underline-offset-4 hover:underline"
        >
          + Add another staff member
        </button>
      </div>
      <Button onClick={handleSubmit} disabled={isLoading}>
        {isLoading ? "Saving..." : "Continue →"}
      </Button>
      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  );
}
