import { Field } from "@/types/field";
import { EditComponent } from "./edit-component";
import { ViewComponent } from "./view-component";
import { marked } from "marked";
import TurndownService from "turndown";
import { z } from "zod";

const read = (value: any) => {
  if (!value) return value;
  return marked.parseInline(value) as string;
};

const write = (value: any) => {
  if (!value) return '';

  const turndownService = new TurndownService();

  // Preserve <u> tags — markdown has no underline syntax
  turndownService.addRule("underline", {
    filter: ["u"],
    replacement: (content: string) => `<u>${content}</u>`,
  });

  return turndownService.turndown(value);
};

const schema = (field: Field) => {
  let zodSchema = z.string();
  if (field.required) zodSchema = zodSchema.min(1, "This field is required");
  return zodSchema;
};

const label = "Inline Rich Text";

export { label, schema, EditComponent, ViewComponent, write, read };
