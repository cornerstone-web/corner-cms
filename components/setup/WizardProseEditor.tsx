"use client";

import { useCallback, useRef, useState } from "react";
import { BubbleMenu, EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import Commands from "@/fields/core/rich-text/slash-command/commands";
import suggestion from "@/fields/core/rich-text/slash-command/suggestion";
import { marked } from "marked";
import TurndownService from "turndown";
import { tables, strikethrough } from "joplin-turndown-plugin-gfm";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { InlineLinkPicker } from "@/fields/core/link/inline-link-picker";
import "@/fields/core/rich-text/edit-component.css";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  ChevronsUpDown,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  Link2,
  List,
  ListOrdered,
  Pilcrow,
  Quote,
  RemoveFormatting,
  Strikethrough,
  Underline as UnderlineIcon,
} from "lucide-react";

const turndownService = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
});
turndownService.use([tables, strikethrough]);

function htmlToMarkdown(html: string): string {
  const cleaned = html.replace(/<colgroup>.*?<\/colgroup>/g, "");
  return turndownService.turndown(cleaned);
}

interface WizardProseEditorProps {
  value: string;
  onChange: (markdown: string) => void;
  placeholder?: string;
}

export default function WizardProseEditor({
  value,
  onChange,
  placeholder = "Type '/' for commands…",
}: WizardProseEditorProps) {
  const [isReady, setIsReady] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const bubbleMenuRef = useRef<HTMLDivElement | null>(null);

  const handleChange = useCallback(
    (html: string) => {
      const isEmpty = html === "<p></p>" || html === "";
      onChange(isEmpty ? "" : htmlToMarkdown(html));
    },
    [onChange],
  );

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ dropcursor: { width: 2 } }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { rel: null, target: null },
      }),
      Placeholder.configure({ placeholder }),
      Commands.configure({ suggestion: suggestion(undefined) }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Underline,
    ],
    content: "<p></p>",
    onUpdate: ({ editor }) => handleChange(editor.getHTML()),
    onCreate: async ({ editor }) => {
      if (value) {
        const html = await marked(value);
        editor.commands.setContent(html || "<p></p>");
      }
      setIsReady(true);
    },
  });

  const getBlockIcon = () => {
    if (!editor) return <Pilcrow className="h-4 w-4" />;
    if (editor.isActive("heading", { level: 1 })) return <Heading1 className="h-4 w-4" />;
    if (editor.isActive("heading", { level: 2 })) return <Heading2 className="h-4 w-4" />;
    if (editor.isActive("heading", { level: 3 })) return <Heading3 className="h-4 w-4" />;
    if (editor.isActive("bulletList")) return <List className="h-4 w-4" />;
    if (editor.isActive("orderedList")) return <ListOrdered className="h-4 w-4" />;
    if (editor.isActive("codeBlock")) return <Code className="h-4 w-4" />;
    if (editor.isActive("blockquote")) return <Quote className="h-4 w-4" />;
    return <Pilcrow className="h-4 w-4" />;
  };

  const getAlignIcon = () => {
    if (!editor) return <AlignLeft className="h-4 w-4" />;
    if (editor.isActive({ textAlign: "center" })) return <AlignCenter className="h-4 w-4" />;
    if (editor.isActive({ textAlign: "right" })) return <AlignRight className="h-4 w-4" />;
    if (editor.isActive({ textAlign: "justify" })) return <AlignJustify className="h-4 w-4" />;
    return <AlignLeft className="h-4 w-4" />;
  };

  return (
    <>
      <Skeleton className={cn("rounded-md h-[8.5rem]", isReady ? "hidden" : "")} />
      <div className={!isReady ? "hidden" : ""}>
        {editor && (
          <BubbleMenu editor={editor} tippyOptions={{ duration: 25, animation: "scale", maxWidth: "370px" }}>
            <div
              ref={bubbleMenuRef}
              className="p-1 rounded-md bg-popover border flex gap-x-[1px] items-center focus-visible:outline-none shadow-md"
            >
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="ghost" size="xxs" className="gap-x-1">
                    {getBlockIcon()}
                    <ChevronsUpDown className="w-3 h-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" portalProps={{ container: bubbleMenuRef.current }}>
                  <DropdownMenuItem onClick={() => editor.chain().focus().setParagraph().run()} className="gap-x-1.5">
                    <Pilcrow className="h-4 w-4" /> Text
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => editor.chain().focus().setNode("heading", { level: 1 }).run()} className="gap-x-1.5">
                    <Heading1 className="h-4 w-4" /> Heading 1
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => editor.chain().focus().setNode("heading", { level: 2 }).run()} className="gap-x-1.5">
                    <Heading2 className="h-4 w-4" /> Heading 2
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => editor.chain().focus().setNode("heading", { level: 3 }).run()} className="gap-x-1.5">
                    <Heading3 className="h-4 w-4" /> Heading 3
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => editor.chain().focus().toggleBulletList().run()} className="gap-x-1.5">
                    <List className="h-4 w-4" /> Bulleted list
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => editor.chain().focus().toggleOrderedList().run()} className="gap-x-1.5">
                    <ListOrdered className="h-4 w-4" /> Numbered list
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => editor.chain().focus().setParagraph().toggleBlockquote().run()} className="gap-x-1.5">
                    <Quote className="h-4 w-4" /> Quote
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => editor.chain().focus().toggleCodeBlock().run()} className="gap-x-1.5">
                    <Code className="h-4 w-4" /> Code
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
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
              {(editor.isActive("paragraph") || editor.isActive("heading")) && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" variant="ghost" size="xxs" className="gap-x-1">
                      {getAlignIcon()}
                      <ChevronsUpDown className="w-3 h-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent portalProps={{ container: bubbleMenuRef.current }}>
                    <DropdownMenuItem onClick={() => editor.chain().focus().setTextAlign("left").run()} className="gap-x-1.5">
                      <AlignLeft className="h-4 w-4" /> Align left
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => editor.chain().focus().setTextAlign("right").run()} className="gap-x-1.5">
                      <AlignRight className="h-4 w-4" /> Align right
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => editor.chain().focus().setTextAlign("center").run()} className="gap-x-1.5">
                      <AlignCenter className="h-4 w-4" /> Center
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => editor.chain().focus().setTextAlign("justify").run()} className="gap-x-1.5">
                      <AlignJustify className="h-4 w-4" /> Justify
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              <Button
                type="button" variant="ghost" size="icon-xxs"
                onClick={() => editor.chain().focus().toggleBold().run()}
                className={cn("shrink-0", editor.isActive("bold") ? "bg-muted" : "")}
              >
                <Bold className="h-4 w-4" />
              </Button>
              <Button
                type="button" variant="ghost" size="icon-xxs"
                onClick={() => editor.chain().focus().toggleItalic().run()}
                className={cn("shrink-0", editor.isActive("italic") ? "bg-muted" : "")}
              >
                <Italic className="h-4 w-4" />
              </Button>
              <Button
                type="button" variant="ghost" size="icon-xxs"
                onClick={() => editor.chain().focus().toggleStrike().run()}
                className={cn("shrink-0", editor.isActive("strike") ? "bg-muted" : "")}
              >
                <Strikethrough className="h-4 w-4" />
              </Button>
              <Button
                type="button" variant="ghost" size="icon-xxs"
                onClick={() => editor.chain().focus().toggleUnderline().run()}
                className={cn("shrink-0", editor.isActive("underline") ? "bg-muted" : "")}
              >
                <UnderlineIcon className="h-4 w-4" />
              </Button>
              <Button
                type="button" variant="ghost" size="icon-xxs"
                onClick={() => editor.chain().focus().toggleCode().run()}
                className={cn("shrink-0", editor.isActive("code") ? "bg-muted" : "")}
              >
                <Code className="h-4 w-4" />
              </Button>
              <Button
                type="button" variant="ghost" size="icon-xxs"
                onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
              >
                <RemoveFormatting className="h-4 w-4" />
              </Button>
            </div>
          </BubbleMenu>
        )}
        <div className="[&_.ProseMirror]:text-sm">
          <EditorContent editor={editor} />
        </div>
      </div>
    </>
  );
}
