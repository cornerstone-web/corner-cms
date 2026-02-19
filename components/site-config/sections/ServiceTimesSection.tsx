"use client";

import { Control, useFieldArray } from "react-hook-form";
import {
  DndContext,
  closestCenter,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Plus, Trash2 } from "lucide-react";
import {
  DND_MODIFIERS,
  SortableItem,
  useSortableSensors,
} from "../dnd-helpers";
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

interface ServiceTimesSectionProps {
  control: Control<SiteConfigFormValues>;
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

export function ServiceTimesSection({ control }: ServiceTimesSectionProps) {
  const { fields, append, remove, move } = useFieldArray({
    control,
    name: "serviceTimes",
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
    <div className="space-y-4">
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
                <div className="flex items-start gap-3 rounded-lg border p-4">
                  <div className="flex-1 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <FormField
                        control={control}
                        name={`serviceTimes.${index}.day`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel
                              className={index > 0 ? "sr-only" : undefined}
                            >
                              Day
                            </FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              value={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Day" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {DAYS.map((day) => (
                                  <SelectItem key={day} value={day}>
                                    {day}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={control}
                        name={`serviceTimes.${index}.time`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel
                              className={index > 0 ? "sr-only" : undefined}
                            >
                              Time
                            </FormLabel>
                            <FormControl>
                              <Input placeholder="10:00 AM" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={control}
                      name={`serviceTimes.${index}.name`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel
                            className={index > 0 ? "sr-only" : undefined}
                          >
                            Name
                          </FormLabel>
                          <FormControl>
                            <Input placeholder="Sunday Worship" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="mt-8 first:mt-0"
                    onClick={() => remove(index)}
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
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
        onClick={() => append({ day: "Sunday", time: "", name: "" })}
      >
        <Plus className="h-4 w-4 mr-2" />
        Add Service Time
      </Button>
    </div>
  );
}
