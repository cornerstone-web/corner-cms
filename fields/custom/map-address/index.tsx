import { EditComponent } from "./edit-component";
import { z } from "zod";
import type { Field } from "@/types/field";

const label = "Map Address";

const schema = (_field: Field) => z.string();

export { label, schema, EditComponent };
