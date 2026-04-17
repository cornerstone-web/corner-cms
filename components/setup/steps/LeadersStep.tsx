"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveLeaders } from "@/lib/actions/setup-steps";
import { compressImage } from "@/lib/utils/image-compression";

interface StepProps {
  site: { id: string; displayName: string; slug: string };
  onComplete: () => void;
  initialLeaders?: { name: string; role: string; photoUrl?: string; existingPhotoPath?: string }[];
}

interface PersonRow {
  id: number;
  name: string;
  photoPreview: string | null;
  photoBase64: string | null;
  photoExt: string | null;
  existingPhotoPath: string | null;
}

interface Group {
  id: number;
  title: string;
  people: PersonRow[];
}

function makePerson(): PersonRow {
  return { id: Date.now() + Math.random(), name: "", photoPreview: null, photoBase64: null, photoExt: null, existingPhotoPath: null };
}

function makeGroup(title: string): Group {
  return { id: Date.now() + Math.random(), title, people: [makePerson(), makePerson()] };
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function initGroups(initialLeaders?: StepProps["initialLeaders"]): Group[] {
  if (initialLeaders && initialLeaders.length > 0) {
    // Group by role in order of first appearance
    const roleOrder: string[] = [];
    const byRole = new Map<string, typeof initialLeaders>();
    for (const l of initialLeaders) {
      if (!byRole.has(l.role)) { roleOrder.push(l.role); byRole.set(l.role, []); }
      byRole.get(l.role)!.push(l);
    }
    return roleOrder.map((role, i) => ({
      id: i + 1,
      title: role,
      people: byRole.get(role)!.map(l => ({
        id: Date.now() + Math.random(),
        name: l.name,
        photoPreview: l.photoUrl ?? null,
        photoBase64: null,
        photoExt: null,
        existingPhotoPath: l.existingPhotoPath ?? null,
      })),
    }));
  }
  return [makeGroup("Elder"), makeGroup("Deacon")];
}

export default function LeadersStep({ site, onComplete, initialLeaders }: StepProps) {
  const [groups, setGroups] = useState<Group[]>(() => initGroups(initialLeaders));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateGroupTitle(groupId: number, title: string) {
    setGroups(prev => prev.map(g => g.id === groupId ? { ...g, title } : g));
  }

  function removeGroup(groupId: number) {
    setGroups(prev => prev.filter(g => g.id !== groupId));
  }

  function addPerson(groupId: number) {
    setGroups(prev => prev.map(g => g.id === groupId ? { ...g, people: [...g.people, makePerson()] } : g));
  }

  function removePerson(groupId: number, personId: number) {
    setGroups(prev => prev.map(g =>
      g.id === groupId ? { ...g, people: g.people.filter(p => p.id !== personId) } : g
    ));
  }

  function updatePerson(groupId: number, personId: number, field: "name", value: string) {
    setGroups(prev => prev.map(g =>
      g.id === groupId
        ? { ...g, people: g.people.map(p => p.id === personId ? { ...p, [field]: value } : p) }
        : g
    ));
  }

  async function handlePhotoChange(groupId: number, personId: number, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;
    const compressed = await compressImage(file, "content");
    const preview = URL.createObjectURL(compressed);
    const base64 = await fileToBase64(compressed);
    const ext = compressed.type.split("/")[1] ?? "jpg";
    setGroups(prev => prev.map(g =>
      g.id === groupId
        ? { ...g, people: g.people.map(p => p.id === personId ? { ...p, photoPreview: preview, photoBase64: base64, photoExt: ext } : p) }
        : g
    ));
  }

  async function handleSubmit() {
    const filledGroups = groups.map(g => ({ ...g, people: g.people.filter(p => p.name.trim()) }));
    const firstGroup = filledGroups[0];
    if (!firstGroup || firstGroup.people.length === 0) {
      setError(`Please add at least one ${groups[0]?.title ?? "leader"}.`);
      return;
    }
    if (filledGroups.some(g => !g.title.trim())) {
      setError("Please enter a title for each group.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const flat = filledGroups.flatMap(g =>
        g.people.map(p => ({
          name: p.name.trim(),
          role: g.title.trim(),
          ...(p.photoBase64 ? { photoBase64: p.photoBase64, photoExt: p.photoExt ?? "jpg" } : {}),
          ...(p.existingPhotoPath ? { existingPhotoPath: p.existingPhotoPath } : {}),
        }))
      );
      await saveLeaders(site.id, site.slug, flat);
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold">Church Leadership</h2>
        <p className="text-muted-foreground text-sm">
          Introduce your elders, deacons, and other leaders to {site.displayName}.
        </p>
      </div>

      <div className="space-y-6">
        {groups.map((group, groupIdx) => (
          <div key={group.id} className="rounded-lg border p-4 space-y-4">
            {/* Group header */}
            <div className="flex items-center gap-3">
              <div className="flex-1 space-y-1.5">
                <Label>Group title <span className="text-destructive">*</span></Label>
                <Input
                  value={group.title}
                  onChange={(e) => updateGroupTitle(group.id, e.target.value)}
                  placeholder="e.g. Elder"
                />
              </div>
              {groupIdx > 0 && (
                <button
                  type="button"
                  onClick={() => removeGroup(group.id)}
                  className="mt-6 flex h-9 items-center gap-1.5 rounded-md border border-input px-3 text-sm text-muted-foreground hover:text-destructive hover:border-destructive transition-colors shrink-0"
                >
                  Remove group
                </button>
              )}
            </div>

            {/* People in group */}
            <div className="space-y-3">
              {group.people.map((person, personIdx) => (
                <div key={person.id} className="rounded-md bg-muted/40 p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">{group.title} {personIdx + 1}</span>
                    {group.people.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removePerson(group.id, person.id)}
                        className="flex h-6 w-6 items-center justify-center rounded border border-input text-muted-foreground hover:text-destructive hover:border-destructive transition-colors"
                        aria-label="Remove person"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                        </svg>
                      </button>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Name <span className="text-destructive">*</span></Label>
                    <Input
                      value={person.name}
                      onChange={(e) => updatePerson(group.id, person.id, "name", e.target.value)}
                      placeholder="e.g. James Wilson"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Photo <span className="text-muted-foreground">(optional, square recommended)</span></Label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handlePhotoChange(group.id, person.id, e)}
                      className="block w-full text-sm text-muted-foreground file:mr-4 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
                    />
                    {person.photoPreview && (
                      <div className="mt-1 w-12 h-12 rounded-full overflow-hidden border bg-muted">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={person.photoPreview} alt="Photo preview" className="w-full h-full object-cover" />
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={() => addPerson(group.id)}
                className="text-sm text-primary underline-offset-4 hover:underline"
              >
                + Add another {group.title.toLowerCase() || "person"}
              </button>
            </div>
          </div>
        ))}
      </div>

      <Button onClick={handleSubmit} disabled={isLoading}>
        {isLoading ? "Saving..." : "Continue →"}
      </Button>
      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  );
}
