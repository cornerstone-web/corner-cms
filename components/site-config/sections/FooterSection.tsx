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
import type { SiteConfigFormValues } from "../schema";

interface FooterSectionProps {
  control: Control<SiteConfigFormValues>;
}

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

      <FooterSectionsList control={control} />
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

              <FooterLinksList control={control} sectionIndex={index} />
            </div>
          )}
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => append({ heading: "", links: [] })}
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
                  <Input className="h-8 text-sm" placeholder="/path" {...field} />
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
