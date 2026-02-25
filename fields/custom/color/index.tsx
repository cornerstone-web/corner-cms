import { EditComponent } from "./edit-component";
import { z } from "zod";
import type { Field } from "@/types/field";

const label = "Color";

const schema = (field: Field) => {
  const hex = z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Must be a valid hex color (e.g. #374151)");
  return field.required ? hex : z.union([hex, z.literal("")]);
};

export { label, schema, EditComponent };
