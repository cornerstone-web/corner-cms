"use client";

import React, { useState, useMemo } from "react";
import { useFormContext, useFieldArray } from "react-hook-form";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  restrictToVerticalAxis,
  restrictToParentElement,
} from "@dnd-kit/modifiers";
import { CSS } from "@dnd-kit/utilities";
import { Field } from "@/types/field";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, GripVertical, Plus, Settings2, Trash2 } from "lucide-react";
import { initializeState } from "@/lib/schema";
import { BlockPickerModal } from "./block-picker-modal";
import { useConfig } from "@/contexts/config-context";
import { useSiteFeatures } from "@/hooks/use-site-features";

// ─── Types ────────────────────────────────────────────────────────────────────

type DrillFrame =
  | { kind: "page-settings" }
  | { kind: "fields"; label: string; fields: Field[]; parentName: string };

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Fields that should be shown as drill-down rows rather than rendered inline */
function isDrillField(f: Field): boolean {
  if (f.hidden) return false;
  return (f.type === "object" || f.type === "block") && !!f.list;
}

function getBlockSummary(block: any, blockKey: string): string {
  if (!block) return "";
  const val = Object.entries(block)
    .filter(([k, v]) => k !== blockKey && typeof v === "string" && (v as string).length > 0)
    .map(([, v]) => String(v))
    .find(Boolean) ?? "";
  return val.slice(0, 60);
}

function formatBlockType(type: string): string {
  return type.replace(/_/g, " ").replace(/-/g, " ");
}

// ─── SortableBlockRow ─────────────────────────────────────────────────────────

function SortableBlockRow({ id, label, onRemove }: { id: string; label: string; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex items-center gap-3 px-2 py-3 border-b last:border-b-0",
        isDragging && "opacity-50 bg-muted",
      )}
    >
      <button type="button" className="p-1 cursor-grab touch-none text-muted-foreground" {...attributes} {...listeners}>
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="text-sm capitalize flex-1">{label}</span>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <button type="button" className="p-1 text-muted-foreground hover:text-destructive transition-colors">
            <Trash2 className="h-4 w-4" />
          </button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove block?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the <span className="font-medium capitalize">{label}</span> block. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onRemove}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── ObjectListDrillSection ───────────────────────────────────────────────────
// Renders an object-list or block-list field as a labeled section of tappable rows.

function ObjectListDrillSection({
  field,
  parentName,
  onDrillPush,
}: {
  field: Field;
  parentName: string;
  onDrillPush: (frame: DrillFrame) => void;
}) {
  const { watch } = useFormContext();
  const fullPath = parentName ? `${parentName}.${field.name}` : field.name;
  const items: any[] = watch(fullPath) ?? [];

  const getItemLabel = (item: any, index: number): string => {
    if (field.type === "block") {
      const blockKey = (field as any).blockKey || "_block";
      return formatBlockType(String(item?.[blockKey] ?? "Block"));
    }
    // For object lists, use the first non-empty string value as a label
    const firstString = Object.values(item ?? {}).find(
      (v) => typeof v === "string" && (v as string).length > 0,
    );
    return firstString ? String(firstString).slice(0, 30) : `Item ${index + 1}`;
  };

  const getItemFields = (item: any): Field[] => {
    if (field.type === "block") {
      const blockKey = (field as any).blockKey || "_block";
      const blockType = item?.[blockKey];
      const blockDef = ((field as any).blocks ?? []).find((b: Field) => b.name === blockType);
      return (blockDef as any)?.fields ?? [];
    }
    return (field as any).fields ?? [];
  };

  return (
    <div className="grid gap-2">
      <div className="text-sm font-medium">{(field as any).label || field.name}</div>
      {items.length === 0 ? (
        <div className="text-sm text-muted-foreground py-1">No items</div>
      ) : (
        <div className="border rounded-lg divide-y overflow-hidden">
          {items.map((item, index) => {
            const label = getItemLabel(item, index);
            const itemFields = getItemFields(item);
            const itemParentName = `${fullPath}.${index}`;
            return (
              <button
                key={index}
                type="button"
                className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/50 transition-colors"
                onClick={() =>
                  onDrillPush({ kind: "fields", label, fields: itemFields, parentName: itemParentName })
                }
              >
                <span className="flex-1 text-sm capitalize">{label}</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── DrillContent ─────────────────────────────────────────────────────────────
// Splits a field list into regular fields (rendered inline) and drill-worthy
// fields (object-list / block-list), which become tappable section rows.

function DrillContent({
  fields,
  parentName,
  renderFields,
  onDrillPush,
}: {
  fields: Field[];
  parentName: string;
  renderFields: (fields: Field[], parentName?: string) => React.ReactNode[];
  onDrillPush: (frame: DrillFrame) => void;
}) {
  const regularFields = fields.filter((f) => !isDrillField(f));
  const drillableFields = fields.filter((f) => isDrillField(f));

  return (
    <div className="p-4 grid items-start gap-6">
      {regularFields.length > 0 && renderFields(regularFields, parentName)}
      {drillableFields.map((field) => (
        <ObjectListDrillSection
          key={field.name}
          field={field}
          parentName={parentName}
          onDrillPush={onDrillPush}
        />
      ))}
    </div>
  );
}

// ─── NarrowFormLayout ─────────────────────────────────────────────────────────

interface NarrowFormLayoutProps {
  fields: Field[];
  renderFields: (fields: Field[], parentName?: string) => React.ReactNode[];
  isTemplateMode: boolean;
  filePath?: React.ReactNode;
  pageSettings?: React.ReactNode;
}

export function NarrowFormLayout({
  fields,
  renderFields,
  isTemplateMode,
  filePath,
  pageSettings,
}: NarrowFormLayoutProps) {
  const { watch, setValue } = useFormContext();

  // ── Find the block field ──────────────────────────────────────────────────
  const blockField = useMemo(
    () => fields.find((f) => f.type === "block" && f.list) ?? null,
    [fields],
  );
  const blockFieldName = blockField?.name ?? "";
  const blockKey = (blockField as any)?.blockKey || "_block";

  // ── Tabs + drill stack ────────────────────────────────────────────────────
  const [tab, setTab] = useState<"list" | "edit">("list");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isReordering, setIsReordering] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [drillStack, setDrillStack] = useState<DrillFrame[]>([]);

  const handleTabChange = (t: "list" | "edit") => {
    setTab(t);
    setDrillStack([]);
  };

  const pushDrill = (frame: DrillFrame) => setDrillStack((s) => [...s, frame]);
  const popDrill = () => setDrillStack((s) => s.slice(0, -1));

  // ── Form values ───────────────────────────────────────────────────────────
  const blocksValue: any[] = watch(blockFieldName) ?? [];

  const { fields: arrayFields, move, append, remove } = useFieldArray({ name: blockFieldName });

  // ── DnD ──────────────────────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const modifiers = [restrictToVerticalAxis, restrictToParentElement];

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = arrayFields.findIndex((f) => f.id === active.id);
    const newIndex = arrayFields.findIndex((f) => f.id === over.id);
    move(oldIndex, newIndex);
    setValue(blockFieldName, arrayMove(blocksValue, oldIndex, newIndex));
    if (selectedIndex === oldIndex) setSelectedIndex(newIndex);
  };

  // ── Available blocks (respects feature flags) ─────────────────────────────
  const { config: repoConfig } = useConfig();
  const { features } = useSiteFeatures();
  const availableBlocks: Field[] = useMemo(() => {
    const blocks: Field[] = (blockField as any)?.blocks ?? [];
    if (!repoConfig?.object?.components) return blocks;
    return blocks.filter((blockDef) => {
      const componentName =
        blockDef.name
          .split("-")
          .map((part, i) => (i === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)))
          .join("") + "Block";
      const componentDef = repoConfig.object.components?.[componentName];
      const deps: Array<{ name: string }> = componentDef?.collections || [];
      return deps.every((dep) => features[dep.name] !== false);
    });
  }, [blockField, repoConfig, features]);

  // ── Selected block definition ─────────────────────────────────────────────
  const selectedBlock = blocksValue[selectedIndex] ?? null;
  const selectedBlockType = selectedBlock?.[blockKey];
  const selectedBlockDef = useMemo(() => {
    if (!selectedBlockType) return null;
    return (
      ((blockField as any)?.blocks ?? []).find((b: Field) => b.name === selectedBlockType) ?? null
    );
  }, [blockField, selectedBlockType]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const handleSelectBlock = (index: number) => {
    setSelectedIndex(index);
    handleTabChange("edit");
  };

  const handleAddBlock = (blockName: string) => {
    const blockDef = ((blockField as any)?.blocks ?? []).find((b: Field) => b.name === blockName);
    if (!blockDef) return;
    const initialState: Record<string, any> = { [blockKey]: blockName };
    if ((blockDef as any).fields) {
      Object.assign(initialState, initializeState((blockDef as any).fields, {}));
    }
    append(initialState);
    setSelectedIndex(blocksValue.length);
    handleTabChange("edit");
    setPickerOpen(false);
  };

  // ── Non-block fields ──────────────────────────────────────────────────────
  const nonBlockFields = fields.filter((f) => f !== blockField && !f.hidden);
  const hasPageSettings = !!filePath || !!pageSettings || nonBlockFields.length > 0;

  // ── No block field → plain scrollable form ────────────────────────────────
  if (!blockField) {
    return (
      <div className="p-4 grid items-start gap-6">
        {filePath && <div className="space-y-2 overflow-hidden">{filePath}</div>}
        {pageSettings}
        {renderFields(fields)}
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DRILL FRAME (overrides tabs when active)
  // ─────────────────────────────────────────────────────────────────────────
  const topFrame = drillStack.length > 0 ? drillStack[drillStack.length - 1] : null;

  if (topFrame) {
    const frameLabel =
      topFrame.kind === "page-settings" ? "Page Settings" : topFrame.label;

    return (
      <div className="flex flex-col h-full">
        {/* Drill header */}
        <div className="flex items-center gap-2 px-3 py-2 border-b bg-background shrink-0">
          <Button type="button" variant="ghost" size="icon-sm" onClick={popDrill}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="flex-1 text-sm font-medium capitalize truncate">{frameLabel}</span>
        </div>

        {/* Drill content */}
        <div className="flex-1 overflow-y-auto">
          {topFrame.kind === "page-settings" ? (
            <div className="p-4 grid gap-4">
              {filePath && <div className="space-y-2 overflow-hidden">{filePath}</div>}
              {pageSettings}
              {nonBlockFields.length > 0 && renderFields(nonBlockFields)}
            </div>
          ) : (
            <DrillContent
              fields={topFrame.fields}
              parentName={topFrame.parentName}
              renderFields={renderFields}
              onDrillPush={pushDrill}
            />
          )}
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // NORMAL RENDER (List / Edit tabs)
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex border-b shrink-0 bg-background">
        {(["list", "edit"] as const).map((t) => (
          <button
            key={t}
            type="button"
            className={cn(
              "flex-1 py-2.5 text-sm font-medium transition-colors capitalize",
              tab === t
                ? "border-b-2 border-primary text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
            onClick={() => handleTabChange(t)}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ── LIST TAB ───────────────────────────────────────────────────────── */}
      {tab === "list" && (
        <div className="flex flex-col h-full overflow-hidden">
          {/* Sub-header */}
          <div className="flex items-center justify-between px-4 py-2 border-b bg-background shrink-0">
            <span className="text-sm font-medium text-muted-foreground">
              {(blockField as any).label || "Page Blocks"}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setIsReordering((v) => !v)}
            >
              {isReordering ? "Done" : "Reorder"}
            </Button>
          </div>

          {/* Block rows */}
          <div className="flex-1 overflow-y-auto">
            {blocksValue.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground text-sm gap-2 px-6 text-center">
                <p>No blocks yet. Add one below.</p>
              </div>
            ) : isReordering ? (
              <DndContext
                sensors={sensors}
                modifiers={modifiers}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext items={arrayFields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
                  {arrayFields.map((arrayField, index) => {
                    const block = blocksValue[index];
                    const typeName = block?.[blockKey] ?? "Block";
                    return (
                      <SortableBlockRow
                        key={arrayField.id}
                        id={arrayField.id}
                        label={formatBlockType(String(typeName))}
                        onRemove={() => {
                          remove(index);
                          if (selectedIndex >= index) setSelectedIndex((i) => Math.max(0, i - 1));
                        }}
                      />
                    );
                  })}
                </SortableContext>
              </DndContext>
            ) : (
              <div className="divide-y">
                {arrayFields.map((arrayField, index) => {
                  const block = blocksValue[index];
                  const typeName = block?.[blockKey] ?? "Block";
                  const summary = getBlockSummary(block, blockKey);
                  return (
                    <button
                      key={arrayField.id}
                      type="button"
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors",
                        selectedIndex === index && tab === "list" && "bg-muted/30",
                      )}
                      onClick={() => handleSelectBlock(index)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium capitalize">
                          {formatBlockType(String(typeName))}
                        </div>
                        {summary && (
                          <div className="text-xs text-muted-foreground truncate mt-0.5">
                            {summary}
                          </div>
                        )}
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer: add block + page settings drill-down row */}
          {!isReordering && (
            <div className="border-t shrink-0">
              <div className="p-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full gap-x-2"
                  onClick={() => setPickerOpen(true)}
                >
                  <Plus className="h-4 w-4" />
                  Add block
                </Button>
              </div>

              {hasPageSettings && (
                <div className="border-t">
                  <button
                    type="button"
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                    onClick={() => pushDrill({ kind: "page-settings" })}
                  >
                    <Settings2 className="h-3.5 w-3.5" />
                    <span className="flex-1 text-left">Page Settings</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}

          <BlockPickerModal
            open={pickerOpen}
            onOpenChange={setPickerOpen}
            availableBlocks={availableBlocks}
            onSelect={handleAddBlock}
          />
        </div>
      )}

      {/* ── EDIT TAB ───────────────────────────────────────────────────────── */}
      {tab === "edit" && (
        <div className="flex flex-col h-full overflow-hidden">
          {/* Block navigator */}
          {blocksValue.length > 0 && (
            <div className="flex items-center gap-1 px-2 py-1.5 border-b bg-background shrink-0">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={selectedIndex === 0}
                onClick={() => setSelectedIndex((i) => i - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="flex-1 text-center text-sm capitalize truncate px-1">
                {formatBlockType(String(selectedBlock?.[blockKey] ?? "Block"))}
                {blocksValue.length > 1 && (
                  <span className="text-xs text-muted-foreground/60 ml-1.5">
                    ({selectedIndex + 1}/{blocksValue.length})
                  </span>
                )}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={selectedIndex >= blocksValue.length - 1}
                onClick={() => setSelectedIndex((i) => i + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Fields — drill-worthy fields (columns, nested block lists) become tappable rows */}
          <div className="flex-1 overflow-y-auto">
            {blocksValue.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm gap-3 p-6 text-center">
                <p>No blocks yet.</p>
                <Button type="button" variant="outline" size="sm" onClick={() => handleTabChange("list")}>
                  Go to List to add blocks
                </Button>
              </div>
            ) : selectedBlockDef ? (
              <DrillContent
                fields={(selectedBlockDef as any).fields ?? []}
                parentName={`${blockFieldName}.${selectedIndex}`}
                renderFields={renderFields}
                onDrillPush={pushDrill}
              />
            ) : (
              <div className="p-4 text-sm text-muted-foreground">
                Unknown block type. Go to List to re-select.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
