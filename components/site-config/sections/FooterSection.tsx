"use client";

import { useState } from "react";
import { Control, useFieldArray, useWatch } from "react-hook-form";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
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
import {
  ChevronDown,
  ChevronRight,
  GripVertical,
  Plus,
  Trash2,
} from "lucide-react";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EditComponent as IconPicker } from "@/fields/custom/icon/edit-component";
import { LinkInput } from "../LinkInput";
import type { SiteConfigFormValues } from "../schema";

interface FooterSectionProps {
  control: Control<SiteConfigFormValues>;
}

const SOCIAL_PLATFORMS = [
  { value: "facebook", label: "Facebook" },
  { value: "instagram", label: "Instagram" },
  { value: "youtube", label: "YouTube" },
  { value: "twitter", label: "Twitter / X" },
  { value: "tiktok", label: "TikTok" },
  { value: "custom", label: "Custom" },
];

const DND_MODIFIERS = [restrictToVerticalAxis, restrictToParentElement];

// ---------------------------------------------------------------------------
// SortableItem – shared drag wrapper
// ---------------------------------------------------------------------------

function SortableItem({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  const {
    attributes,
    isDragging,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      className={isDragging ? "opacity-50 z-50 relative" : "z-10 relative"}
      style={style}
    >
      <div className="flex gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="h-auto w-5 bg-muted/50 self-stretch rounded-md text-muted-foreground cursor-move shrink-0"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </div>
  );
}

function useSortableSensors() {
  return useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
}

// ---------------------------------------------------------------------------
// FooterSection – main export
// ---------------------------------------------------------------------------

export function FooterSection({ control }: FooterSectionProps) {
  const variant = useWatch({ control, name: "footer.variant" });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <FormField
          control={control}
          name="footer.variant"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Variant</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="comprehensive">Comprehensive</SelectItem>
                  <SelectItem value="minimal">Minimal</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name="footer.style"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Style</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="centered">Centered</SelectItem>
                  <SelectItem value="left-aligned">Left-Aligned</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <SocialLinksList control={control} />
      {variant !== "minimal" && <FooterSectionsList control={control} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SocialLinksList
// ---------------------------------------------------------------------------

function SocialLinksList({
  control,
}: {
  control: Control<SiteConfigFormValues>;
}) {
  const { fields, append, remove, move } = useFieldArray({
    control,
    name: "footer.socialLinks",
  });

  const sensors = useSortableSensors();

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = fields.findIndex((item) => item.id === active.id);
    const newIndex = fields.findIndex((item) => item.id === over.id);
    move(oldIndex, newIndex);
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium">Social Links</h3>

      <DndContext
        sensors={sensors}
        modifiers={DND_MODIFIERS}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={fields.map((item) => item.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {fields.map((field, index) => (
              <SortableItem key={field.id} id={field.id}>
                <SocialLinkRow
                  control={control}
                  index={index}
                  onRemove={() => remove(index)}
                />
              </SortableItem>
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => append({ platform: "facebook", url: "" })}
      >
        <Plus className="h-4 w-4 mr-2" />
        Add Social Link
      </Button>
    </div>
  );
}

function SocialLinkRow({
  control,
  index,
  onRemove,
}: {
  control: Control<SiteConfigFormValues>;
  index: number;
  onRemove: () => void;
}) {
  const platform = useWatch({
    control,
    name: `footer.socialLinks.${index}.platform`,
  });
  const isCustom = platform === "custom";

  return (
    <div className="rounded-lg border p-3 space-y-2">
      <div className="flex items-center gap-2">
        <FormField
          control={control}
          name={`footer.socialLinks.${index}.platform`}
          render={({ field }) => (
            <FormItem className="w-40">
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {SOCIAL_PLATFORMS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name={`footer.socialLinks.${index}.url`}
          render={({ field }) => (
            <FormItem className="flex-1">
              <FormControl>
                <Input
                  className="h-8 text-sm"
                  type="url"
                  placeholder="https://..."
                  {...field}
                />
              </FormControl>
            </FormItem>
          )}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onRemove}
        >
          <Trash2 className="h-4 w-4 text-muted-foreground" />
        </Button>
      </div>

      {isCustom && (
        <div className="grid grid-cols-2 gap-2">
          <FormField
            control={control}
            name={`footer.socialLinks.${index}.label`}
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Input
                    className="h-8 text-sm"
                    placeholder="Label"
                    {...field}
                    value={field.value ?? ""}
                  />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name={`footer.socialLinks.${index}.icon`}
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <IconPicker
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    field={{ required: false }}
                  />
                </FormControl>
              </FormItem>
            )}
          />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// FooterSectionsList
// ---------------------------------------------------------------------------

function FooterSectionsList({
  control,
}: {
  control: Control<SiteConfigFormValues>;
}) {
  const { fields, append, remove, move } = useFieldArray({
    control,
    name: "footer.sections",
  });

  const [expandedSections, setExpandedSections] = useState<Set<number>>(
    new Set()
  );

  const toggleSection = (index: number) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const sensors = useSortableSensors();

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = fields.findIndex((item) => item.id === active.id);
    const newIndex = fields.findIndex((item) => item.id === over.id);

    // Remap expanded state
    setExpandedSections((prev) => {
      const next = new Set<number>();
      for (const idx of prev) {
        if (idx === oldIndex) {
          next.add(newIndex);
        } else if (oldIndex < newIndex) {
          next.add(idx > oldIndex && idx <= newIndex ? idx - 1 : idx);
        } else {
          next.add(idx >= newIndex && idx < oldIndex ? idx + 1 : idx);
        }
      }
      return next;
    });

    move(oldIndex, newIndex);
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium">Footer Sections</h3>

      <DndContext
        sensors={sensors}
        modifiers={DND_MODIFIERS}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={fields.map((item) => item.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {fields.map((field, index) => (
              <SortableItem key={field.id} id={field.id}>
                <div className="rounded-lg border">
                  <div className="flex items-center gap-2 p-3">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => toggleSection(index)}
                    >
                      {expandedSections.has(index) ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </Button>
                    <FooterSectionLabel control={control} index={index} />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => remove(index)}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>

                  {expandedSections.has(index) && (
                    <div className="px-3 pb-3 space-y-3 border-t pt-3">
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={control}
                          name={`footer.sections.${index}.heading`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Heading</FormLabel>
                              <FormControl>
                                <Input {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={control}
                          name={`footer.sections.${index}.icon`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Icon</FormLabel>
                              <FormControl>
                                <IconPicker
                                  value={field.value ?? ""}
                                  onChange={field.onChange}
                                  field={{ required: false }}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FooterLinksList
                        control={control}
                        sectionIndex={index}
                      />
                    </div>
                  )}
                </div>
              </SortableItem>
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => append({ heading: "", icon: "", links: [] })}
      >
        <Plus className="h-4 w-4 mr-2" />
        Add Section
      </Button>
    </div>
  );
}

function FooterSectionLabel({
  control,
  index,
}: {
  control: Control<SiteConfigFormValues>;
  index: number;
}) {
  const heading = useWatch({
    control,
    name: `footer.sections.${index}.heading`,
  });
  return (
    <span className="flex-1 text-sm font-medium truncate">
      {heading || `Section ${index + 1}`}
    </span>
  );
}

// ---------------------------------------------------------------------------
// FooterLinksList
// ---------------------------------------------------------------------------

function FooterLinksList({
  control,
  sectionIndex,
}: {
  control: Control<SiteConfigFormValues>;
  sectionIndex: number;
}) {
  const { fields, append, remove, move } = useFieldArray({
    control,
    name: `footer.sections.${sectionIndex}.links`,
  });

  const sensors = useSortableSensors();

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = fields.findIndex((item) => item.id === active.id);
    const newIndex = fields.findIndex((item) => item.id === over.id);
    move(oldIndex, newIndex);
  };

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-medium text-muted-foreground">Links</h4>

      <DndContext
        sensors={sensors}
        modifiers={DND_MODIFIERS}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={fields.map((item) => item.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {fields.map((field, linkIndex) => (
              <SortableItem key={field.id} id={field.id}>
                <div className="flex items-center gap-2">
                  <FormField
                    control={control}
                    name={`footer.sections.${sectionIndex}.links.${linkIndex}.label`}
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormControl>
                          <Input
                            className="h-8 text-sm"
                            placeholder="Label"
                            {...field}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={control}
                    name={`footer.sections.${sectionIndex}.links.${linkIndex}.href`}
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormControl>
                          <LinkInput
                            ref={field.ref}
                            value={field.value}
                            onChange={field.onChange}
                            placeholder="/path"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => remove(linkIndex)}
                  >
                    <Trash2 className="h-3 w-3 text-muted-foreground" />
                  </Button>
                </div>
              </SortableItem>
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-xs"
        onClick={() => append({ label: "", href: "" })}
      >
        <Plus className="h-3 w-3 mr-1" />
        Add Link
      </Button>
    </div>
  );
}
