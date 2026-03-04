"use client";

import { forwardRef } from "react";
import { MediaFileEditComponent, type ComponentProps } from "../media/edit-component";

const AudioEditComponent = forwardRef((props: ComponentProps, ref: React.Ref<HTMLInputElement>) => (
  <MediaFileEditComponent
    {...props}
    ref={ref}
    mediaFieldConfig={{
      type: "audio",
      hint: "Recommended: MP3 or M4A, under 100MB.",
    }}
  />
));

AudioEditComponent.displayName = "AudioEditComponent";

export { AudioEditComponent as EditComponent };
