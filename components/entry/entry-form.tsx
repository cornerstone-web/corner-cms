"use client";

import React, {
  useState,
  useMemo,
  useEffect,
  useRef,
  forwardRef,
  useCallback,
} from "react";
import slugify from "slugify";
import { getFileName, normalizePath } from "@/lib/utils/file";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useForm,
  useFieldArray,
  useFormState,
  useFormContext,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { editComponents } from "@/fields/registry";
import {
  initializeState,
  getDefaultValue,
  generateZodSchema,
  sanitizeObject,
} from "@/lib/schema";
import { Field } from "@/types/field";
import { useConfig } from "@/contexts/config-context";
import { useSiteFeatures } from "@/hooks/use-site-features";
import { BlockPickerModal } from "./block-picker-modal";
import { EntryHistoryBlock, EntryHistoryDropdown } from "./entry-history";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  restrictToVerticalAxis,
  restrictToParentElement,
} from "@dnd-kit/modifiers";
import { CSS } from "@dnd-kit/utilities";
import {
  ChevronLeft,
  Copy,
  GripVertical,
  Loader,
  Plus,
  Trash2,
  Ellipsis,
  ChevronRight,
  Dot,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import { interpolate } from "@/lib/schema";
import { BlockPreview } from "./block-preview";
import { PagePreview } from "./page-preview";
import {
  transformImagePaths,
  ExpandedPreviewModal,
  IFrameWrapper,
  PreviewToolbar,
} from "./preview/shared";

const SortableItem = ({
  id,
  type,
  children,
}: {
  id: string;
  type: string;
  children: React.ReactNode;
}) => {
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
      className={cn(
        "flex gap-x-2 items-center",
        isDragging ? "opacity-50 z-50" : "z-10",
      )}
      style={style}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="h-auto w-5 bg-muted/50 self-stretch rounded-md text-muted-foreground cursor-move"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </Button>
      {children}
    </div>
  );
};

// Context for block list controls (scroll/expand from preview)
interface BlockListControls {
  selectBlock: (index: number) => void;
}

const BlockListControlsContext = React.createContext<{
  register: (fieldName: string, controls: BlockListControls) => void;
  unregister: (fieldName: string) => void;
} | null>(null);

const ListField = ({
  field,
  fieldName,
  renderFields,
  isTemplateMode = false,
}: {
  field: Field;
  fieldName: string;
  renderFields: Function;
  isTemplateMode?: boolean;
}) => {
  const isCollapsible = !!(
    field.list &&
    !(typeof field.list === "object" && field.list?.collapsible === false)
  );

  const { setValue, watch } = useFormContext();
  const {
    fields: arrayFields,
    append,
    remove,
    move,
    insert,
  } = useFieldArray({
    name: fieldName,
  });
  const fieldValues = watch(fieldName);

  // Use an index-to-state map with a ref to survive re-renders
  const openStatesRef = useRef<boolean[]>([]);
  const [, forceUpdate] = useState({});

  // Refs for scrolling to blocks
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Register with parent for preview navigation (only for block fields)
  const blockListControls = React.useContext(BlockListControlsContext);

  useEffect(() => {
    if (field.type === "block" && blockListControls) {
      blockListControls.register(fieldName, {
        selectBlock: (index: number) => {
          // Collapse all, expand selected
          openStatesRef.current = openStatesRef.current.map(
            (_, i) => i === index,
          );
          forceUpdate({});
          // Scroll to the block after a brief delay for DOM update
          setTimeout(() => {
            itemRefs.current[index]?.scrollIntoView({
              behavior: "smooth",
              block: "nearest",
            });
          }, 50);
        },
      });
      return () => blockListControls.unregister(fieldName);
    }
  }, [field.type, fieldName, blockListControls]);

  useEffect(() => {
    if (openStatesRef.current.length === 0 && arrayFields.length > 0) {
      // For block fields, default to collapsed (except first block is expanded)
      // For other fields, check the explicit collapsible.collapsed config
      const defaultCollapsed =
        field.type === "block" ||
        (isCollapsible &&
          typeof field.list === "object" &&
          field.list.collapsible &&
          typeof field.list.collapsible === "object" &&
          field.list.collapsible.collapsed);

      if (field.type === "block") {
        // First block expanded, rest collapsed
        openStatesRef.current = arrayFields.map((_, index) => index === 0);
      } else {
        openStatesRef.current = Array(arrayFields.length).fill(
          !defaultCollapsed,
        );
      }
      forceUpdate({});
    }
  }, [arrayFields, field.list, field.type, isCollapsible]);

  const toggleOpen = (index: number) => {
    if (index >= 0 && index < openStatesRef.current.length) {
      openStatesRef.current[index] = !openStatesRef.current[index];
      forceUpdate({});
    }
  };

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (active.id !== over.id) {
      const oldIndex = arrayFields.findIndex((item) => item.id === active.id);
      const newIndex = arrayFields.findIndex((item) => item.id === over.id);

      // Reorder the open states array the same way as the items
      const newOpenStates = [...openStatesRef.current];
      const [movedState] = newOpenStates.splice(oldIndex, 1);
      newOpenStates.splice(newIndex, 0, movedState);
      openStatesRef.current = newOpenStates;

      // Perform the move
      move(oldIndex, newIndex);

      // Update form values
      const updatedValues = arrayMove(fieldValues, oldIndex, newIndex);
      setValue(fieldName, updatedValues);

      // Force update to reflect the reordered open states
      forceUpdate({});
    }
  };

  const addItem = () => {
    append(
      field.type === "object"
        ? initializeState(field.fields, {})
        : getDefaultValue(field),
    );
    openStatesRef.current.push(true);
    forceUpdate({});
  };

  const removeItem = (index: number) => {
    remove(index);
    openStatesRef.current.splice(index, 1);
    forceUpdate({});
  };

  const duplicateItem = (index: number) => {
    const itemToDuplicate = fieldValues[index];
    // Deep clone the item to avoid reference issues
    const duplicatedItem = JSON.parse(JSON.stringify(itemToDuplicate));
    insert(index + 1, duplicatedItem);
    // Insert open state for the new item (start expanded)
    openStatesRef.current.splice(index + 1, 0, true);
    forceUpdate({});
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const modifiers = [restrictToVerticalAxis, restrictToParentElement];

  const toggleAll = (collapsed: boolean) => {
    openStatesRef.current = Array(openStatesRef.current.length).fill(
      !collapsed,
    );
    forceUpdate({});
  };

  // We don't render <FormMessage/> in ListField, because it's already rendered in the individual fields
  return (
    <FormField
      name={fieldName}
      render={({ field: formField, fieldState: { error } }) => (
        <FormItem>
          <div className="flex items-center h-5 gap-x-2">
            {field.label !== false && (
              <FormLabel className="text-sm font-medium">
                {field.label || field.name}
              </FormLabel>
            )}
            {field.required && (
              <span className="inline-flex items-center rounded-full bg-muted border px-2 h-5 text-xs font-medium">
                Required
              </span>
            )}

            {isCollapsible && arrayFields.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    type="button"
                    size="icon-xs"
                    className="h-5 w-5 text-muted-foreground hover:text-foreground bg-transparent"
                  >
                    <Ellipsis className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => toggleAll(true)}>
                    Collapse all
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => toggleAll(false)}>
                    Expand all
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
          <div className="space-y-2">
            <DndContext
              sensors={sensors}
              modifiers={modifiers}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={arrayFields.map((item) => item.id)}
                strategy={verticalListSortingStrategy}
              >
                {arrayFields.map((arrayField, index) => (
                  <SortableItem
                    key={arrayField.id}
                    id={arrayField.id}
                    type={field.type}
                  >
                    <div
                      className="grid gap-6 flex-1"
                      ref={(el) => {
                        itemRefs.current[index] = el;
                      }}
                    >
                      <SingleField
                        field={field}
                        fieldName={`${fieldName}.${index}`}
                        renderFields={renderFields}
                        showLabel={false}
                        isOpen={openStatesRef.current[index]}
                        toggleOpen={() => toggleOpen(index)}
                        index={index}
                        isTemplateMode={isTemplateMode}
                      />
                    </div>
                    <div className="flex flex-col gap-1 self-start">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="bg-muted/50 text-muted-foreground"
                            onClick={() => removeItem(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Remove item</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="bg-muted/50 text-muted-foreground"
                            onClick={() => duplicateItem(index)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Duplicate item</TooltipContent>
                      </Tooltip>
                    </div>
                  </SortableItem>
                ))}
              </SortableContext>
            </DndContext>
            {typeof field.list === "object" &&
            field.list?.max &&
            arrayFields.length >= field.list.max ? null : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addItem}
                className="gap-x-2"
              >
                <Plus className="h-4 w-4" />
                Add an item
              </Button>
            )}
            <FormMessage />
          </div>
        </FormItem>
      )}
    />
  );
};

const BlocksField = forwardRef((props: any, ref) => {
  const {
    field,
    fieldName,
    renderFields,
    isOpen,
    onToggleOpen,
    index,
    isTemplateMode,
  } = props;

  const isCollapsible = !!(
    field.list &&
    !(typeof field.list === "object" && field.list?.collapsible === false)
  );

  const {
    setValue,
    watch,
    formState: { errors },
  } = useFormContext();

  const value = watch(fieldName);
  const onChange = (val: any) => {
    setValue(fieldName, val, { shouldDirty: true });
  };

  const hasErrors = () => {
    let curr: any = errors;
    return (
      fieldName
        .split(".")
        .every((part: string) => (curr = curr?.[part]) !== undefined) && !!curr
    );
  };

  const { blocks = [] } = field;
  const blockKey = field.blockKey || "_block";
  const selectedBlockName = value?.[blockKey];

  // Filter out blocks whose collection dependencies are disabled
  const { config: repoConfig } = useConfig();
  const { features } = useSiteFeatures();
  const availableBlocks = useMemo(() => {
    if (!repoConfig?.object?.components) return blocks;
    return blocks.filter((blockDef: Field) => {
      // Derive component name: kebab-case → camelCase + "Block"
      const componentName =
        blockDef.name
          .split("-")
          .map((part: string, i: number) =>
            i === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)
          )
          .join("") + "Block";
      const componentDef = repoConfig.object.components?.[componentName];
      const deps: Array<{ name: string }> = componentDef?.collections || [];
      return deps.every((dep) => features[dep.name] !== false);
    });
  }, [blocks, repoConfig, features]);

  const handleBlockSelect = (blockName: string) => {
    const selectedBlockDef = blocks.find((b: Field) => b.name === blockName);
    if (!selectedBlockDef) return;
    let initialState: Record<string, any> = { [blockKey]: blockName };
    if (selectedBlockDef.fields) {
      const choiceDefaults = initializeState(selectedBlockDef.fields, {});
      initialState = { ...initialState, ...choiceDefaults };
    }
    onChange(initialState);
  };

  const handleRemoveBlock = () => {
    onChange(null);
  };

  const [pickerOpen, setPickerOpen] = useState(false);

  const selectedBlockDefinition = useMemo(() => {
    const definition = blocks.find((b: Field) => b.name === selectedBlockName);
    return definition;
  }, [blocks, selectedBlockName]);

  const fieldValues = watch(fieldName);
  const interpolateData = {
    index: index !== undefined ? `${index + 1}` : "",
    fields: fieldValues,
  };
  const itemLabel =
    typeof field.list === "object" &&
    field.list.collapsible &&
    typeof field.list.collapsible === "object" &&
    field.list.collapsible.summary
      ? interpolate(field.list.collapsible.summary, interpolateData)
      : `Item ${index !== undefined ? `#${index + 1}` : ""}`;

  return (
    <div className="space-y-3" ref={ref as React.Ref<HTMLDivElement>}>
      {!selectedBlockDefinition ? (
        <div className="rounded-lg border">
          <header className="flex items-center gap-x-2 rounded-t-lg pl-4 pr-1 h-10 text-sm font-medium">
            <span>Choose content block:</span>
          </header>
          <div className="p-4">
            <Button
              type="button"
              variant="outline"
              className="w-full gap-x-2"
              onClick={() => setPickerOpen(true)}
            >
              <Plus className="h-4 w-4" />
              Browse blocks
            </Button>
          </div>
          <BlockPickerModal
            open={pickerOpen}
            onOpenChange={setPickerOpen}
            availableBlocks={availableBlocks}
            onSelect={(blockName) => {
              handleBlockSelect(blockName);
              setPickerOpen(false);
            }}
          />
        </div>
      ) : (
        <div className="border rounded-lg">
          <header
            className={cn(
              "flex items-center gap-x-2 px-4 h-10 text-sm font-medium transition-colors rounded-t-lg",
              isOpen ? "border-b" : "rounded-b-lg",
              isCollapsible ? "cursor-pointer hover:bg-muted" : "",
            )}
            onClick={isCollapsible ? onToggleOpen : undefined}
          >
            {isCollapsible && (
              <>
                <ChevronRight
                  className={cn(
                    "h-4 w-4 transition-transform",
                    isOpen ? "rotate-90" : "",
                  )}
                />
                <span
                  className={cn("mr-auto", hasErrors() ? "text-red-500" : "")}
                >
                  {itemLabel}
                </span>
              </>
            )}
            <div className="inline-flex items-center gap-x-0.5 text-muted-foreground">
              <span className={hasErrors() ? "text-red-500" : ""}>
                {selectedBlockDefinition.label || selectedBlockDefinition.name}
              </span>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    type="button"
                    size="icon-xs"
                    className="text-muted-foreground hover:text-foreground bg-transparent"
                  >
                    <Ellipsis className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={handleRemoveBlock}>
                    Remove block
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>
          <div className={cn("p-4 grid gap-6", isOpen ? "" : "hidden")}>
            {selectedBlockDefinition.type === "object" ? (
              (() => {
                const renderedElements = renderFields(
                  selectedBlockDefinition.fields || [],
                  fieldName,
                );
                const visibleElements = renderedElements.filter(Boolean);
                if (visibleElements.length === 0 && isTemplateMode) {
                  return (
                    <p className="text-sm text-muted-foreground italic">
                      No configuration options for this block
                    </p>
                  );
                }
                return visibleElements;
              })()
            ) : (
              <SingleField
                field={selectedBlockDefinition}
                fieldName={fieldName}
                renderFields={renderFields}
                showLabel={false}
                isTemplateMode={isTemplateMode}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
});

BlocksField.displayName = "BlocksField";

const ObjectField = forwardRef((props: any, ref) => {
  const {
    field,
    fieldName,
    renderFields,
    isOpen = true,
    onToggleOpen = () => {},
    index,
  } = props;

  const isCollapsible = !!(
    field.list &&
    !(typeof field.list === "object" && field.list?.collapsible === false)
  );

  const {
    watch,
    formState: { errors },
  } = useFormContext();

  const hasErrors = () => {
    let curr: any = errors;
    return (
      fieldName
        .split(".")
        .every((part: string) => (curr = curr?.[part]) !== undefined) && !!curr
    );
  };

  const fieldValues = watch(fieldName);
  const interpolateData = {
    index: index !== undefined ? `${index + 1}` : "",
    fields: fieldValues,
  };
  const itemLabel =
    typeof field.list === "object" &&
    field.list.collapsible &&
    typeof field.list.collapsible === "object" &&
    field.list.collapsible.summary
      ? interpolate(field.list.collapsible.summary, interpolateData)
      : `Item ${index !== undefined ? `#${index + 1}` : ""}`;

  return (
    <div className="border rounded-lg">
      {isCollapsible && (
        <header
          className={cn(
            "flex items-center gap-x-2 rounded-t-lg pl-4 pr-1 h-10 text-sm font-medium hover:bg-muted transition-colors cursor-pointer",
            isOpen ? "border-b" : "rounded-b-lg",
          )}
          onClick={onToggleOpen}
        >
          <ChevronRight
            className={cn(
              "h-4 w-4 transition-transform",
              isOpen ? "rotate-90" : "",
            )}
          />
          <span className={hasErrors() ? "text-red-500" : ""}>{itemLabel}</span>
        </header>
      )}
      <div className={cn("p-4 grid gap-6", isOpen ? "" : "hidden")}>
        {renderFields(field.fields, fieldName)}
      </div>
    </div>
  );
});

ObjectField.displayName = "ObjectField";

const SingleField = ({
  field,
  fieldName,
  renderFields,
  showLabel = true,
  isOpen = true,
  toggleOpen = () => {},
  index = 0,
  disabled = false,
  isTemplateMode = false,
}: {
  field: Field;
  fieldName: string;
  renderFields: Function;
  showLabel?: boolean;
  isOpen?: boolean;
  toggleOpen?: () => void;
  index?: number;
  disabled?: boolean;
  isTemplateMode?: boolean;
}) => {
  const {
    control,
    formState: { errors },
  } = useFormContext();

  let FieldComponent;

  const isCollapsible = !!(
    field.list &&
    !(typeof field.list === "object" && field.list?.collapsible === false)
  );

  if (field.type === "block") {
    FieldComponent = BlocksField;
  } else if (field.type === "object") {
    FieldComponent = ObjectField;
  } else if (typeof field.type === "string" && editComponents[field.type]) {
    FieldComponent = editComponents[field.type];
  } else {
    console.warn(
      `No component found for field type: ${field.type}. Defaulting to 'text'.`,
    );
    FieldComponent = editComponents["text"];
  }

  let fieldComponentProps: any = { field: field };
  if (["object", "block"].includes(field.type)) {
    fieldComponentProps = {
      ...fieldComponentProps,
      fieldName,
      renderFields,
      isOpen,
      isTemplateMode,
    };
    if (isCollapsible) {
      fieldComponentProps = {
        ...fieldComponentProps,
        onToggleOpen: toggleOpen,
        index,
      };
    }
  }

  if (["object", "block"].includes(field.type)) {
    const hasErrors = () => {
      let curr: any = errors;
      return (
        fieldName
          .split(".")
          .every((part: string) => (curr = curr?.[part]) !== undefined) &&
        !!curr
      );
    };

    return (
      <FormItem
        key={fieldName}
        className={disabled ? "opacity-50 pointer-events-none" : ""}
      >
        {showLabel && (
          <div className="flex items-center h-5 gap-x-2">
            {field.label !== false && (
              <Label className={hasErrors() ? "text-red-500" : ""}>
                {field.label || field.name}
              </Label>
            )}
            {field.required && (
              <span className="inline-flex items-center rounded-full bg-muted border px-2 h-5 text-xs font-medium">
                Required
              </span>
            )}
          </div>
        )}
        <FieldComponent {...fieldComponentProps} />
        {field.description && (
          <FormDescription>{field.description}</FormDescription>
        )}
      </FormItem>
    );
  } else {
    return (
      <FormField
        name={fieldName}
        key={fieldName}
        control={control}
        render={({ field: rhfManagedFieldProps, fieldState }) => (
          <FormItem className={disabled ? "opacity-50" : ""}>
            <div className="flex items-center h-5 gap-x-2">
              {showLabel && field.label !== false && (
                <FormLabel>{field.label || field.name}</FormLabel>
              )}
              {showLabel && field.required && (
                <span className="inline-flex items-center rounded-full bg-muted border px-2 h-5 text-xs font-medium">
                  Required
                </span>
              )}
            </div>
            <FormControl>
              <FieldComponent
                {...rhfManagedFieldProps}
                {...fieldComponentProps}
                disabled={disabled}
              />
            </FormControl>
            {field.description && (
              <FormDescription>{field.description}</FormDescription>
            )}
            <FormMessage />
          </FormItem>
        )}
      />
    );
  }
};

SingleField.displayName = "SingleField";

// Component to render a boolean toggle with its controlled fields inline
const ToggleFieldGroup = ({
  toggleField,
  controlledFields,
  parentName,
  renderFields: renderFieldsFn,
  isTemplateMode = false,
  controlledFieldsMap,
}: {
  toggleField: Field;
  controlledFields: Field[];
  parentName?: string;
  renderFields: Function;
  isTemplateMode?: boolean;
  controlledFieldsMap?: Map<string, Field[]>;
}) => {
  const { watch, clearErrors } = useFormContext();
  const toggleFieldName = parentName
    ? `${parentName}.${toggleField.name}`
    : toggleField.name;
  const toggleValue = watch(toggleFieldName);

  // Clear validation errors on controlled fields when the toggle disables them.
  // This ensures block-level error indicators update immediately rather than
  // waiting for the next form submission.
  useEffect(() => {
    controlledFields.forEach((controlledField) => {
      const isDisabled = controlledField.controlledByValue !== undefined
        ? Array.isArray(controlledField.controlledByValue)
          ? !controlledField.controlledByValue.includes(String(toggleValue))
          : String(toggleValue) !== controlledField.controlledByValue
        : controlledField.controlledByInverse
          ? toggleValue
          : !toggleValue;
      if (isDisabled) {
        const controlledFieldName = parentName
          ? `${parentName}.${controlledField.name}`
          : controlledField.name;
        clearErrors(controlledFieldName);
      }
    });
  }, [toggleValue]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-3">
      {/* Render the toggle field */}
      <SingleField
        field={toggleField}
        fieldName={toggleFieldName}
        renderFields={renderFieldsFn}
        isTemplateMode={isTemplateMode}
      />
      {/* Render controlled fields with disabled state based on toggle value */}
      {controlledFields.map((controlledField) => {
        const controlledFieldName = parentName
          ? `${parentName}.${controlledField.name}`
          : controlledField.name;

        // Determine disabled state: controlledByValue takes precedence (select controllers),
        // then controlledByInverse (inverted boolean), then standard boolean logic
        const isDisabled = controlledField.controlledByValue !== undefined
          ? Array.isArray(controlledField.controlledByValue)
            ? !controlledField.controlledByValue.includes(String(toggleValue))
            : String(toggleValue) !== controlledField.controlledByValue
          : controlledField.controlledByInverse
            ? toggleValue
            : !toggleValue;

        if (isDisabled) return null;

        // If this controlled field is itself a toggle/select that controls other fields,
        // render it as a nested ToggleFieldGroup so its children appear correctly.
        const subControlledFields = controlledFieldsMap?.get(controlledField.name);
        if (
          (controlledField.type === "boolean" || controlledField.type === "select") &&
          subControlledFields &&
          subControlledFields.length > 0
        ) {
          const visibleSubControlledFields = subControlledFields.filter(
            (cf: Field) =>
              !cf.hidden &&
              (!isTemplateMode || cf.templateEditable === true || cf.type === "block")
          );
          if (visibleSubControlledFields.length > 0) {
            return (
              <ToggleFieldGroup
                key={controlledFieldName}
                toggleField={controlledField}
                controlledFields={visibleSubControlledFields}
                parentName={parentName}
                renderFields={renderFieldsFn}
                controlledFieldsMap={controlledFieldsMap}
                isTemplateMode={isTemplateMode}
              />
            );
          }
        }

        if (
          controlledField.list === true ||
          (typeof controlledField.list === "object" &&
            controlledField.list !== null)
        ) {
          return (
            <ListField
              key={controlledFieldName}
              field={controlledField}
              fieldName={controlledFieldName}
              renderFields={renderFieldsFn}
              isTemplateMode={isTemplateMode}
            />
          );
        }

        return (
          <SingleField
            key={controlledFieldName}
            field={controlledField}
            fieldName={controlledFieldName}
            renderFields={renderFieldsFn}
            isTemplateMode={isTemplateMode}
          />
        );
      })}
    </div>
  );
};

ToggleFieldGroup.displayName = "ToggleFieldGroup";

interface SlugInfo {
  urlPrefix: string;
  extension: string;
  primaryFieldName: string;
  currentPath?: string;
}

function PageSlugField({
  slugInfo,
  onSlugChange,
  onRenameRequest,
}: {
  slugInfo: SlugInfo;
  onSlugChange: (slug: string) => void;
  onRenameRequest?: (slug: string) => Promise<void>;
}) {
  const originalSlug = slugInfo.currentPath
    ? getFileName(normalizePath(slugInfo.currentPath)).replace(/\.[^.]+$/, "")
    : "";

  const [slug, setSlug] = useState(originalSlug);
  const [manuallyEdited, setManuallyEdited] = useState(!!slugInfo.currentPath);
  const [isRenaming, setIsRenaming] = useState(false);

  const { watch } = useFormContext();
  const primaryValue = watch(slugInfo.primaryFieldName);

  useEffect(() => {
    if (!manuallyEdited && !slugInfo.currentPath && primaryValue) {
      const auto = slugify(primaryValue, { lower: true, strict: true });
      setSlug(auto);
      onSlugChange(auto);
    }
  }, [primaryValue]); // eslint-disable-line react-hooks/exhaustive-deps

  const urlPreview = (s: string) =>
    s === "index" && slugInfo.urlPrefix === "/"
      ? "/"
      : `${slugInfo.urlPrefix}${s || "..."}`;

  const showUpdateButton = !!slugInfo.currentPath && slug !== originalSlug && !!onRenameRequest;

  const handleConfirmRename = async () => {
    if (!onRenameRequest) return;
    setIsRenaming(true);
    try {
      await onRenameRequest(slug);
    } finally {
      setIsRenaming(false);
    }
  };

  return (
    <FormItem>
      <Label>Page Address</Label>
      <div className="flex gap-2">
        <Input
          value={slug}
          onChange={(e) => {
            const val = slugify(e.target.value, { lower: true, strict: true });
            setSlug(val);
            setManuallyEdited(true);
            onSlugChange(val);
          }}
          placeholder="e.g. about"
        />
        {showUpdateButton && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0 self-stretch"
                disabled={isRenaming}
              >
                {isRenaming ? <Loader className="h-4 w-4 animate-spin" /> : "Update"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Change page address?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will rename the page from{" "}
                  <span className="font-mono">{urlPreview(originalSlug)}</span> to{" "}
                  <span className="font-mono">{urlPreview(slug)}</span>.{" "}
                  Any existing links to this page will break.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleConfirmRename}>Update</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
      <p className="text-sm text-muted-foreground">
        Will be live at: <span className="font-mono">{urlPreview(slug)}</span>
      </p>
    </FormItem>
  );
}

const EntryForm = ({
  title,
  navigateBack,
  fields,
  contentObject,
  onSubmit = (values) => console.log("Default onSubmit:", values),
  history,
  path,
  filePath,
  options,
  previewUrl,
  isTemplateMode = false,
  collectionName,
  slugInfo,
  onSlugRename,
}: {
  title: string;
  navigateBack?: string;
  fields: Field[];
  contentObject?: any;
  onSubmit: (values: any, newSlug?: string) => void;
  history?: Record<string, any>[];
  path?: string;
  filePath?: React.ReactNode;
  options: React.ReactNode;
  previewUrl?: string;
  isTemplateMode?: boolean;
  collectionName?: string;
  slugInfo?: SlugInfo;
  onSlugRename?: (slug: string) => Promise<void>;
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingNavUrl, setPendingNavUrl] = useState<string | null>(null);
  const originalPushStateRef = useRef<typeof window.window.history.pushState | null>(null);
  const router = useRouter();
  const slugRef = useRef<string | undefined>(undefined);
  const [previewBlockIndex, setPreviewBlockIndex] = useState<number | null>(
    null,
  );
  const [showMobilePreview, setShowMobilePreview] = useState(false);
  const [mobilePreviewLoaded, setMobilePreviewLoaded] = useState(false);
  const [mobilePreviewKey, setMobilePreviewKey] = useState(0);
  const mobilePreviewIframeRef = useRef<HTMLIFrameElement>(null);
  // Track which preview panel is open (only one at a time)
  const [openPreview, setOpenPreview] = useState<"block" | "page" | null>(null);

  // Block list controls for preview navigation
  const blockListControlsRef = useRef<Map<string, BlockListControls>>(
    new Map(),
  );
  const blockListContextValue = useMemo(
    () => ({
      register: (fieldName: string, controls: BlockListControls) => {
        blockListControlsRef.current.set(fieldName, controls);
      },
      unregister: (fieldName: string) => {
        blockListControlsRef.current.delete(fieldName);
      },
    }),
    [],
  );

  const zodSchema = useMemo(() => {
    return generateZodSchema(fields, false, isTemplateMode);
  }, [fields, isTemplateMode]);

  // Find block list fields for preview
  const blockFieldInfo = useMemo(() => {
    const blockField = fields.find((f) => f.type === "block" && f.list);
    if (!blockField) return null;
    return {
      name: blockField.name,
      blockKey: blockField.blockKey || "_block",
    };
  }, [fields]);

  // Handle block selection from preview navigation
  const handleBlockSelect = useCallback(
    (index: number) => {
      if (blockFieldInfo) {
        const controls = blockListControlsRef.current.get(blockFieldInfo.name);
        controls?.selectBlock(index);
      }
    },
    [blockFieldInfo],
  );

  const defaultValues = useMemo(() => {
    return initializeState(fields, sanitizeObject(contentObject));
  }, [fields, contentObject]);

  const form = useForm({
    resolver: zodSchema && zodResolver(zodSchema),
    defaultValues,
    reValidateMode: "onSubmit",
  });

  const { isDirty } = useFormState({
    control: form.control,
  });

  // Warn on browser close / hard refresh when there are unsaved changes
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  // Intercept all in-app navigation (window.history.pushState) while the form is
  // dirty. Suspended during form submission so that post-save navigations
  // (e.g. redirect to the new entry's edit URL) are never blocked.
  useEffect(() => {
    if (!isDirty || isSubmitting) {
      if (originalPushStateRef.current) {
        window.history.pushState = originalPushStateRef.current;
        originalPushStateRef.current = null;
      }
      return;
    }
    const orig = window.history.pushState.bind(history);
    originalPushStateRef.current = orig;
    window.history.pushState = function (
      state: unknown,
      title: string,
      url?: string | URL | null,
    ) {
      setPendingNavUrl(url ? url.toString() : window.location.pathname);
    };
    return () => {
      if (originalPushStateRef.current) {
        window.history.pushState = originalPushStateRef.current;
        originalPushStateRef.current = null;
      }
    };
  }, [isDirty, isSubmitting]);

  // Navigate away after restoring the real pushState so the router isn't
  // blocked by our own interceptor.
  const navigateAway = useCallback(
    (url: string) => {
      if (originalPushStateRef.current) {
        window.history.pushState = originalPushStateRef.current;
        originalPushStateRef.current = null;
      }
      router.push(url);
    },
    [router],
  );

  const renderFields = useCallback(
    (fields: Field[], parentName?: string): React.ReactNode[] => {
      // Build a map of fields controlled by boolean toggles
      const controlledFieldsMap = new Map<string, Field[]>();
      const controlledFieldNames = new Set<string>();

      // First pass: identify controlled fields and their controllers
      for (const field of fields) {
        if (field?.controlledBy) {
          const controlled = controlledFieldsMap.get(field.controlledBy) || [];
          controlled.push(field);
          controlledFieldsMap.set(field.controlledBy, controlled);
          controlledFieldNames.add(field.name);
        }
      }

      return fields.map((field) => {
        if (!field || field.hidden) return null;

        // Skip fields that are controlled by a toggle (they render as part of the group)
        if (controlledFieldNames.has(field.name)) return null;

        // In template mode, only show fields marked templateEditable: true
        // Exception: block-type fields are always shown (they define structure)
        if (
          isTemplateMode &&
          field.templateEditable !== true &&
          field.type !== "block"
        )
          return null;

        const currentFieldName = parentName
          ? `${parentName}.${field.name}`
          : field.name;

        // Check if this is a boolean toggle or select field with controlled fields
        const controlledFields = controlledFieldsMap.get(field.name);
        if (
          (field.type === "boolean" || field.type === "select") &&
          controlledFields &&
          controlledFields.length > 0
        ) {
          // Filter controlled fields based on template mode
          const visibleControlledFields = controlledFields.filter((cf) => {
            if (
              isTemplateMode &&
              cf.templateEditable !== true &&
              cf.type !== "block"
            )
              return false;
            return !cf.hidden;
          });

          if (visibleControlledFields.length > 0) {
            return (
              <ToggleFieldGroup
                key={currentFieldName}
                toggleField={field}
                controlledFields={visibleControlledFields}
                parentName={parentName}
                renderFields={renderFields}
                controlledFieldsMap={controlledFieldsMap}
                isTemplateMode={isTemplateMode}
              />
            );
          }
        }

        if (
          field.list === true ||
          (typeof field.list === "object" && field.list !== null)
        ) {
          return (
            <ListField
              key={currentFieldName}
              field={field}
              fieldName={currentFieldName}
              renderFields={renderFields}
              isTemplateMode={isTemplateMode}
            />
          );
        }
        return (
          <SingleField
            key={currentFieldName}
            field={field}
            fieldName={currentFieldName}
            renderFields={renderFields}
            isTemplateMode={isTemplateMode}
          />
        );
      });
    },
    [isTemplateMode],
  );

  const handleSubmit = async (values: any) => {
    setIsSubmitting(true);
    try {
      await onSubmit(values, slugRef.current);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleError = (errors: any) => {
    toast.error("Please fix the errors before saving.", { duration: 5000 });
  };

  // Watch block values for preview
  const blocksValue = blockFieldInfo ? form.watch(blockFieldInfo.name) : null;
  // Serialize blocksValue to detect mutations (react-hook-form mutates arrays in place)
  const blocksValueKey = JSON.stringify(blocksValue);
  const currentBlockData = useMemo(() => {
    if (
      !blockFieldInfo ||
      !blocksValue ||
      !Array.isArray(blocksValue) ||
      blocksValue.length === 0
    ) {
      return null;
    }
    // Use the selected block index, or default to first block
    const index =
      previewBlockIndex !== null && previewBlockIndex < blocksValue.length
        ? previewBlockIndex
        : 0;
    const block = blocksValue[index];
    const blockType = block?.[blockFieldInfo.blockKey];
    if (!block || !blockType) return null;
    return {
      type: blockType,
      data: block,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- blocksValueKey is serialized blocksValue to detect mutations
  }, [blocksValueKey, previewBlockIndex, blockFieldInfo]);

  // Mobile preview URL and data
  const mobilePreviewData = useMemo(() => {
    if (!previewUrl || !blocksValue || !blockFieldInfo) return null;
    const transformedBlocks = blocksValue.map(
      (block: Record<string, unknown>) => transformImagePaths(block),
    );
    const data = {
      blocks: transformedBlocks,
      blockKey: blockFieldInfo.blockKey,
    };
    return {
      url: `${previewUrl}/preview/page?data=${encodeURIComponent(JSON.stringify(data))}`,
      blocks: transformedBlocks,
      blockKey: blockFieldInfo.blockKey,
    };
  }, [previewUrl, blocksValue, blockFieldInfo]);

  // Send updates to mobile preview iframe
  useEffect(() => {
    if (
      showMobilePreview &&
      mobilePreviewLoaded &&
      mobilePreviewIframeRef.current?.contentWindow &&
      mobilePreviewData
    ) {
      mobilePreviewIframeRef.current.contentWindow.postMessage(
        {
          type: "UPDATE_PAGE_PREVIEW",
          blocks: mobilePreviewData.blocks,
          blockKey: mobilePreviewData.blockKey,
        },
        "*",
      );
    }
  }, [showMobilePreview, mobilePreviewLoaded, mobilePreviewData]);

  const handleMobilePreviewLoad = () => {
    setMobilePreviewLoaded(true);
    setTimeout(() => {
      if (mobilePreviewIframeRef.current?.contentWindow && mobilePreviewData) {
        mobilePreviewIframeRef.current.contentWindow.postMessage(
          {
            type: "UPDATE_PAGE_PREVIEW",
            blocks: mobilePreviewData.blocks,
            blockKey: mobilePreviewData.blockKey,
          },
          "*",
        );
      }
    }, 150);
  };

  const handleCloseMobilePreview = () => {
    setShowMobilePreview(false);
    setMobilePreviewLoaded(false);
  };

  const handleMobilePreviewReload = () => {
    setMobilePreviewLoaded(false);
    setMobilePreviewKey((k) => k + 1);
  };

  const handleMobilePreviewOpenNewTab = () => {
    if (mobilePreviewData) {
      window.open(mobilePreviewData.url, "_blank");
    }
  };

  return (
    <BlockListControlsContext.Provider value={blockListContextValue}>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit, handleError)}>
          <div className="max-w-screen-xl mx-auto flex w-full gap-x-8">
            <div className="flex-1 w-0">
              <header className="flex items-center mb-6">
                {navigateBack && (
                  <button
                    type="button"
                    className={cn(
                      buttonVariants({ variant: "outline", size: "icon-xs" }),
                      "mr-4 shrink-0",
                    )}
                    onClick={() => router.push(navigateBack)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                )}

                <h1 className="font-semibold text-lg md:text-2xl truncate">
                  {title}
                </h1>
              </header>

              <div
                onSubmit={form.handleSubmit(handleSubmit)}
                className="grid items-start gap-6"
              >
                {filePath && (
                  <div className="space-y-2 overflow-hidden">
                    <FormLabel>Filename</FormLabel>
                    {filePath}
                  </div>
                )}
                {slugInfo
                  ? (() => {
                      const rendered = renderFields(fields).filter(Boolean);
                      return [
                        rendered[0],
                        <PageSlugField
                          key="__slug"
                          slugInfo={slugInfo}
                          onSlugChange={(s) => { slugRef.current = s; }}
                          onRenameRequest={onSlugRename}
                        />,
                        ...rendered.slice(1),
                      ];
                    })()
                  : renderFields(fields)
                }
              </div>
            </div>

            <div
              className={cn(
                "hidden lg:block sticky top-0 self-start max-h-[calc(100vh-6rem)] overflow-y-auto",
                previewUrl && currentBlockData ? "w-96" : "w-64",
              )}
            >
              <div className="flex flex-col gap-y-4 pb-4">
                <div className="flex gap-x-2">
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isSubmitting || !isDirty}
                  >
                    Save
                    {isSubmitting && (
                      <Loader className="ml-2 h-4 w-4 animate-spin" />
                    )}
                  </Button>
                  {options ? options : null}
                </div>
                {previewUrl && (
                  <BlockPreview
                    blockType={currentBlockData?.type}
                    blockData={currentBlockData?.data}
                    previewBaseUrl={previewUrl}
                    currentIndex={previewBlockIndex ?? 0}
                    totalBlocks={blocksValue?.length ?? 0}
                    onIndexChange={setPreviewBlockIndex}
                    onBlockSelect={handleBlockSelect}
                    isCollapsed={openPreview !== "block"}
                    onToggleCollapse={() =>
                      setOpenPreview(openPreview === "block" ? null : "block")
                    }
                    entryContext={collectionName && path ? {
                      collection: collectionName,
                      slug: path.split('/').pop()?.replace(/\.[^/.]+$/, '') || '',
                    } : undefined}
                  />
                )}
                {previewUrl &&
                  blocksValue &&
                  blocksValue.length > 0 &&
                  blockFieldInfo && (
                    <PagePreview
                      blocks={blocksValue}
                      blockKey={blockFieldInfo.blockKey}
                      previewBaseUrl={previewUrl}
                      isCollapsed={openPreview !== "page"}
                      onToggleCollapse={() =>
                        setOpenPreview(openPreview === "page" ? null : "page")
                      }
                      entryContext={collectionName && path ? {
                        collection: collectionName,
                        slug: path.split('/').pop()?.replace(/\.[^/.]+$/, '') || '',
                      } : undefined}
                    />
                  )}
                {path && history && (
                  <EntryHistoryBlock history={history} path={path} />
                )}
              </div>
            </div>
            <div className="lg:hidden fixed top-0 right-0 h-14 flex items-center gap-x-2 z-10 pr-4 md:pr-6">
              {path && history && (
                <EntryHistoryDropdown history={history} path={path} />
              )}
              {mobilePreviewData && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setShowMobilePreview(true)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Page preview</TooltipContent>
                </Tooltip>
              )}
              <Button type="submit" disabled={isSubmitting}>
                Save
                {isSubmitting && (
                  <Loader className="ml-2 h-4 w-4 animate-spin" />
                )}
              </Button>
              {options ? options : null}
            </div>
            {showMobilePreview && mobilePreviewData && (
              <ExpandedPreviewModal
                headerContent={
                  <div className="flex items-center justify-between px-3 py-2 bg-background/80 backdrop-blur-sm border-b">
                    <span className="text-sm font-medium text-muted-foreground">
                      Page Preview ({blocksValue?.length ?? 0}{" "}
                      {blocksValue?.length === 1 ? "block" : "blocks"})
                    </span>
                    <PreviewToolbar
                      onReload={handleMobilePreviewReload}
                      onOpenNewTab={handleMobilePreviewOpenNewTab}
                      onToggleExpand={handleCloseMobilePreview}
                      isExpanded={true}
                      isLoaded={mobilePreviewLoaded}
                    />
                  </div>
                }
                iframeContent={
                  <IFrameWrapper
                    url={mobilePreviewData.url}
                    title="Full page preview"
                    onLoad={handleMobilePreviewLoad}
                    isLoaded={mobilePreviewLoaded}
                    iframeRef={mobilePreviewIframeRef}
                    refreshKey={mobilePreviewKey}
                  />
                }
                onClose={handleCloseMobilePreview}
              />
            )}
          </div>
        </form>
      </Form>

      {/* Unsaved-changes guard — triggered by any intercepted navigation */}
      <AlertDialog
        open={!!pendingNavUrl}
        onOpenChange={(open) => !open && setPendingNavUrl(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes that will be lost if you leave this page.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              type="button"
              variant="outline"
              className="mt-2 sm:mt-0"
              onClick={() => {
                const url = pendingNavUrl!;
                setPendingNavUrl(null);
                navigateAway(url);
              }}
            >
              Leave without saving
            </Button>
            <AlertDialogAction
              onClick={() => {
                const url = pendingNavUrl!;
                form.handleSubmit(
                  async (values) => {
                    await handleSubmit(values);
                    navigateAway(url);
                  },
                  handleError,
                )();
              }}
            >
              Save
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </BlockListControlsContext.Provider>
  );
};

export { EntryForm };
