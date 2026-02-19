"use client";

import {
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import {
  restrictToVerticalAxis,
  restrictToParentElement,
} from "@dnd-kit/modifiers";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";

export const DND_MODIFIERS = [restrictToVerticalAxis, restrictToParentElement];

export function useSortableSensors() {
  return useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
}

export function SortableItem({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  const {
    attributes,
    isDragging,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      className={isDragging ? "opacity-50 z-50 relative" : "z-10 relative"}
      style={style}
    >
      <div className="flex gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="h-auto w-5 bg-muted/50 self-stretch rounded-md text-muted-foreground cursor-move shrink-0"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </div>
  );
}
