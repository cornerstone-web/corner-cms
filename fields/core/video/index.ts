import { z } from "zod";
import type { Field } from "@/types/field";
import { EditComponent } from "./edit-component";
import { ViewComponent } from "./view-component";

export const label = "Video";

export function schema(field: Field) {
  const base = z.string();
  if (field.required) return base.min(1, "Video is required");
  return base.optional();
}

export function read(value: any) {
  return value ?? null;
}

export function write(value: any) {
  return value ?? null;
}

export function defaultValue() {
  return "";
}

export function getAllowedExtensions(field: Field) {
  if (field.options?.extensions) return field.options.extensions as string[];
  return ["mp4", "webm", "mov"];
}

export { EditComponent, ViewComponent };
