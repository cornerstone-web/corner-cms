"use client";

import { useState } from "react";
import { Control, useFieldArray, useWatch } from "react-hook-form";
import { ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react";
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

export function FooterSection({ control }: FooterSectionProps) {
  return (
    <div className="space-y-6">
      <FormField
        control={control}
        name="footer.style"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Footer Style</FormLabel>
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

      <SocialLinksList control={control} />
      <FooterSectionsList control={control} />
    </div>
  );
}

function SocialLinksList({
  control,
}: {
  control: Control<SiteConfigFormValues>;
}) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: "footer.socialLinks",
  });

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium">Social Links</h3>

      {fields.map((field, index) => (
        <SocialLinkRow key={field.id} control={control} index={index} onRemove={() => remove(index)} />
      ))}

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
  const platform = useWatch({ control, name: `footer.socialLinks.${index}.platform` });
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
                <Input className="h-8 text-sm" type="url" placeholder="https://..." {...field} />
              </FormControl>
            </FormItem>
          )}
        />
        <Button type="button" variant="ghost" size="icon-sm" onClick={onRemove}>
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
                  <Input className="h-8 text-sm" placeholder="Label" {...field} value={field.value ?? ""} />
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

function FooterSectionsList({
  control,
}: {
  control: Control<SiteConfigFormValues>;
}) {
  const { fields, append, remove } = useFieldArray({
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

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium">Footer Sections</h3>

      {fields.map((field, index) => (
        <div key={field.id} className="rounded-lg border">
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

              <FooterLinksList control={control} sectionIndex={index} />
            </div>
          )}
        </div>
      ))}

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

function FooterLinksList({
  control,
  sectionIndex,
}: {
  control: Control<SiteConfigFormValues>;
  sectionIndex: number;
}) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: `footer.sections.${sectionIndex}.links`,
  });

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-medium text-muted-foreground">Links</h4>

      {fields.map((field, linkIndex) => (
        <div key={field.id} className="flex items-center gap-2">
          <FormField
            control={control}
            name={`footer.sections.${sectionIndex}.links.${linkIndex}.label`}
            render={({ field }) => (
              <FormItem className="flex-1">
                <FormControl>
                  <Input className="h-8 text-sm" placeholder="Label" {...field} />
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
      ))}

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
