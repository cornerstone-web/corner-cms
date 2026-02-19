"use client";

import { useState } from "react";
import { Control, useFieldArray, useWatch } from "react-hook-form";
import {
  ChevronDown,
  ChevronRight,
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
import { Switch } from "@/components/ui/switch";
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

interface NavigationSectionProps {
  control: Control<SiteConfigFormValues>;
}

export function NavigationSection({ control }: NavigationSectionProps) {
  return (
    <div className="space-y-6">
      {/* Navigation style, mobile style, and background */}
      <div className="grid grid-cols-3 gap-4">
        <FormField
          control={control}
          name="navigation.style"
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
                  <SelectItem value="mega">Mega Menu</SelectItem>
                  <SelectItem value="dropdown">Dropdown</SelectItem>
                  <SelectItem value="simple">Simple</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="navigation.mobileStyle"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Mobile Menu</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="drawer">Drawer</SelectItem>
                  <SelectItem value="fullscreen">Full Screen</SelectItem>
                  <SelectItem value="slidedown">Slide Down</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="navigation.background"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Background</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="solid">Solid</SelectItem>
                  <SelectItem value="transparent">Transparent</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      {/* Search toggle */}
      <FormField
        control={control}
        name="search.enabled"
        render={({ field }) => (
          <FormItem className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <FormLabel className="text-base">Site Search</FormLabel>
              <p className="text-sm text-muted-foreground">
                Show search icon in the header
              </p>
            </div>
            <FormControl>
              <Switch
                checked={field.value}
                onCheckedChange={field.onChange}
              />
            </FormControl>
          </FormItem>
        )}
      />

      {/* CTA Button */}
      <div className="space-y-3">
        <FormField
          control={control}
          name="navigation.showCta"
          render={({ field }) => (
            <FormItem className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <FormLabel className="text-base">Call to Action Button</FormLabel>
                <p className="text-sm text-muted-foreground">
                  Show a CTA button in the header
                </p>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />
        <CtaFields control={control} />
      </div>

      {/* Navigation Items */}
      <NavItemsList control={control} />
    </div>
  );
}

function CtaFields({ control }: { control: Control<SiteConfigFormValues> }) {
  const showCta = useWatch({ control, name: "navigation.showCta" });
  return (
    <div className={`grid grid-cols-2 gap-4 ${showCta === false ? "opacity-50 pointer-events-none" : ""}`}>
      <FormField
        control={control}
        name="navigation.cta.label"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Label</FormLabel>
            <FormControl>
              <Input placeholder="Give" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name="navigation.cta.href"
        render={({ field }) => (
          <FormItem>
            <FormLabel>URL</FormLabel>
            <FormControl>
              <LinkInput
                ref={field.ref}
                value={field.value}
                onChange={field.onChange}
                placeholder="/give"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}

function NavItemsList({ control }: { control: Control<SiteConfigFormValues> }) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: "navigation.items",
  });

  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());

  const toggleItem = (index: number) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium">Menu Items</h3>

      {fields.map((field, index) => {
        const isExpanded = expandedItems.has(index);

        return (
          <div key={field.id} className="rounded-lg border">
            {/* Item header */}
            <div className="flex items-center gap-2 p-3">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => toggleItem(index)}
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </Button>

              <NavItemLabel control={control} index={index} />

              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => remove(index)}
              >
                <Trash2 className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>

            {/* Item details */}
            {isExpanded && (
              <div className="px-3 pb-3 space-y-3 border-t pt-3">
                <FormField
                  control={control}
                  name={`navigation.items.${index}.label`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Label</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={control}
                  name={`navigation.items.${index}.href`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>URL (for simple links)</FormLabel>
                      <FormControl>
                        <LinkInput
                          ref={field.ref}
                          value={field.value ?? ""}
                          onChange={field.onChange}
                          placeholder="/events"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Columns */}
                <NavColumnsList control={control} itemIndex={index} />
              </div>
            )}
          </div>
        );
      })}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => append({ label: "", href: "" })}
      >
        <Plus className="h-4 w-4 mr-2" />
        Add Menu Item
      </Button>
    </div>
  );
}

function NavItemLabel({
  control,
  index,
}: {
  control: Control<SiteConfigFormValues>;
  index: number;
}) {
  const label = useWatch({
    control,
    name: `navigation.items.${index}.label`,
  });
  return (
    <span className="flex-1 text-sm font-medium truncate">
      {label || `Item ${index + 1}`}
    </span>
  );
}

function NavColumnsList({
  control,
  itemIndex,
}: {
  control: Control<SiteConfigFormValues>;
  itemIndex: number;
}) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: `navigation.items.${itemIndex}.columns`,
  });

  const [expandedCols, setExpandedCols] = useState<Set<number>>(new Set());

  const toggleCol = (index: number) => {
    setExpandedCols((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  return (
    <div className="space-y-2 ml-4">
      <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        Dropdown Columns
      </h4>

      {fields.map((field, colIndex) => (
        <div key={field.id} className="rounded border bg-muted/30">
          <div className="flex items-center gap-2 p-2">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => toggleCol(colIndex)}
            >
              {expandedCols.has(colIndex) ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
            </Button>
            <NavColumnLabel
              control={control}
              itemIndex={itemIndex}
              colIndex={colIndex}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => remove(colIndex)}
            >
              <Trash2 className="h-3 w-3 text-muted-foreground" />
            </Button>
          </div>

          {expandedCols.has(colIndex) && (
            <div className="px-2 pb-2 space-y-2 border-t pt-2">
              <div className="grid grid-cols-2 gap-2">
                <FormField
                  control={control}
                  name={`navigation.items.${itemIndex}.columns.${colIndex}.heading`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Heading</FormLabel>
                      <FormControl>
                        <Input className="h-8 text-sm" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={control}
                  name={`navigation.items.${itemIndex}.columns.${colIndex}.icon`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Icon</FormLabel>
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

              {/* Links within column */}
              <NavLinksList
                control={control}
                itemIndex={itemIndex}
                colIndex={colIndex}
              />
            </div>
          )}
        </div>
      ))}

      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-xs"
        onClick={() => append({ heading: "", links: [], icon: "" })}
      >
        <Plus className="h-3 w-3 mr-1" />
        Add Column
      </Button>
    </div>
  );
}

function NavColumnLabel({
  control,
  itemIndex,
  colIndex,
}: {
  control: Control<SiteConfigFormValues>;
  itemIndex: number;
  colIndex: number;
}) {
  const heading = useWatch({
    control,
    name: `navigation.items.${itemIndex}.columns.${colIndex}.heading`,
  });
  return (
    <span className="flex-1 text-xs font-medium truncate">
      {heading || `Column ${colIndex + 1}`}
    </span>
  );
}

function NavLinksList({
  control,
  itemIndex,
  colIndex,
}: {
  control: Control<SiteConfigFormValues>;
  itemIndex: number;
  colIndex: number;
}) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: `navigation.items.${itemIndex}.columns.${colIndex}.links`,
  });

  return (
    <div className="space-y-2">
      <h5 className="text-xs font-medium text-muted-foreground">Links</h5>

      {fields.map((field, linkIndex) => (
        <div key={field.id} className="flex items-center gap-2">
          <FormField
            control={control}
            name={`navigation.items.${itemIndex}.columns.${colIndex}.links.${linkIndex}.label`}
            render={({ field }) => (
              <FormItem className="flex-1">
                <FormControl>
                  <Input
                    className="h-7 text-xs"
                    placeholder="Label"
                    {...field}
                  />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name={`navigation.items.${itemIndex}.columns.${colIndex}.links.${linkIndex}.href`}
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
