"use client";

import { forwardRef, useRef, useState } from "react";
import { BubbleMenu, EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import "./edit-component.css";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  Bold,
  Italic,
  Link2,
  RemoveFormatting,
  Underline as UnderlineIcon,
} from "lucide-react";
import { InlineLinkPicker } from "@/fields/core/link/inline-link-picker";

const EditComponent = forwardRef((props: any, ref) => {
  const { value, field, onChange } = props;

  const bubbleMenuRef = useRef<HTMLDivElement | null>(null);
  const [isContentReady, setContentReady] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
        blockquote: false,
        codeBlock: false,
        horizontalRule: false,
        code: false,
        dropcursor: false,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          rel: null,
          target: null,
        },
      }),
      Placeholder.configure({
        placeholder: field.placeholder || "Enter text…",
      }),
      Underline,
    ],
    content: "<p></p>",
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    onCreate: ({ editor }) => {
      if (value) {
        editor.commands.setContent(value);
      }
      setContentReady(true);
    },
  });

  return (
    <div className="inline-rich-text">
      <Skeleton className={cn("rounded-md h-[2.75rem]", isContentReady ? "hidden" : "")} />
      <div className={!isContentReady ? "hidden" : ""}>
        {editor && (
          <BubbleMenu editor={editor} tippyOptions={{ duration: 25, animation: "scale", maxWidth: "370px" }}>
            <div className="p-1 rounded-md bg-popover border flex gap-x-[1px] items-center focus-visible:outline-none shadow-md" ref={bubbleMenuRef}>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xxs"
                    className={cn("shrink-0", editor.isActive("link") ? "bg-muted" : "")}
                    onClick={() => setLinkUrl(editor.isActive("link") ? editor.getAttributes("link").href : "")}
                  >
                    <Link2 className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-1 w-auto">
                  <InlineLinkPicker
                    value={linkUrl}
                    onChange={setLinkUrl}
                    onApply={() =>
                      linkUrl
                        ? editor.chain().focus().extendMarkRange("link").setLink({ href: linkUrl }).run()
                        : editor.chain().focus().extendMarkRange("link").unsetLink().run()
                    }
                    onRemove={() => editor.chain().focus().extendMarkRange("link").unsetLink().run()}
                  />
                </PopoverContent>
              </Popover>
              <Button
                type="button"
                variant="ghost"
                size="icon-xxs"
                onClick={() => editor.chain().focus().toggleBold().run()}
                className={cn("shrink-0", editor.isActive("bold") ? "bg-muted" : "")}
              >
                <Bold className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-xxs"
                onClick={() => editor.chain().focus().toggleItalic().run()}
                className={cn("shrink-0", editor.isActive("italic") ? "bg-muted" : "")}
              >
                <Italic className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-xxs"
                onClick={() => editor.chain().focus().toggleUnderline().run()}
                className={cn("shrink-0", editor.isActive("underline") ? "bg-muted" : "")}
              >
                <UnderlineIcon className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-xxs"
                onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
                className="shrink-0"
              >
                <RemoveFormatting className="h-4 w-4" />
              </Button>
            </div>
          </BubbleMenu>
        )}
        <EditorContent editor={editor} />
      </div>
    </div>
  );
});

export { EditComponent };
