"use client";

import { Control, useFieldArray } from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";
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
  const { fields, append, remove } = useFieldArray({
    control,
    name: "serviceTimes",
  });

  return (
    <div className="space-y-4">
      {fields.map((field, index) => (
        <div
          key={field.id}
          className="flex items-start gap-3 rounded-lg border p-4"
        >
          <div className="flex-1 grid grid-cols-3 gap-3">
            <FormField
              control={control}
              name={`serviceTimes.${index}.day`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className={index > 0 ? "sr-only" : undefined}>
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
                  <FormLabel className={index > 0 ? "sr-only" : undefined}>
                    Time
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="10:00 AM" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={control}
              name={`serviceTimes.${index}.name`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className={index > 0 ? "sr-only" : undefined}>
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
      ))}

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
