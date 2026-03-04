"use client";

import { forwardRef } from "react";
import { MediaFileEditComponent, type ComponentProps } from "../media/edit-component";

const EditComponent = forwardRef((props: ComponentProps, ref: React.Ref<HTMLInputElement>) => (
  <MediaFileEditComponent
    {...props}
    ref={ref}
    mediaFieldConfig={{
      type: "video",
      hint: "Recommended: MP4 or WebM, under 30MB, 15–30 seconds for background loops.",
    }}
  />
));

EditComponent.displayName = "EditComponent";

export { EditComponent };
