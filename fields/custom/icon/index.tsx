import { z } from "zod";
import { Field } from "@/types/field";
import { EditComponent } from "./edit-component";

const schema = (field: Field) => {
  return field.required
    ? z.string().min(1, "An icon is required")
    : z.string().optional();
};

const label = "Icon";

export { label, schema, EditComponent };
