"use client";

import { forwardRef } from "react";
import { EditComponent as LinkEditComponent } from "@/fields/core/link/edit-component";

interface LinkInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

/**
 * Wraps the link field's EditComponent for use in site-config forms.
 * Provides the same combobox with internal page suggestions.
 */
const LinkInput = forwardRef<HTMLInputElement, LinkInputProps>(
  ({ value, onChange, placeholder }, ref) => {
    return (
      <LinkEditComponent
        ref={ref}
        value={value}
        onChange={onChange}
        field={{ options: { placeholder } }}
      />
    );
  }
);

LinkInput.displayName = "LinkInput";

export { LinkInput };
