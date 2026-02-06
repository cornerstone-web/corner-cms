"use client";

import { forwardRef, useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { useFormContext } from "react-hook-form";
import { useConfig } from "@/contexts/config-context";
import { getSchemaByName, initializeState } from "@/lib/schema";
import Select, { components } from "react-select";
import { ChevronDown, X } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import "@/fields/core/select/edit-component.css";

const DropdownIndicator = (props: any) => (
  <components.DropdownIndicator {...props}>
    <ChevronDown className="w-4 h-4" />
  </components.DropdownIndicator>
);

const ClearIndicator = (props: any) => (
  <components.ClearIndicator {...props}>
    <X className="w-4 h-4" />
  </components.ClearIndicator>
);

type TemplateOption = {
  value: string;
  label: string;
  description?: string;
  blocks?: any[];
};

const EditComponent = forwardRef((props: any, ref: any) => {
  const { value, field, onChange } = props;
  const params = useParams();
  const { config } = useConfig();
  const form = useFormContext();

  const [isMounted, setIsMounted] = useState(false);
  const [options, setOptions] = useState<TemplateOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Confirmation dialog state
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingTemplate, setPendingTemplate] = useState<TemplateOption | null>(null);
  const previousValueRef = useRef<string | null>(value);

  // Get the current collection name from the URL params
  const currentCollection = useMemo(() => {
    return params?.name ? decodeURIComponent(params.name as string) : null;
  }, [params?.name]);

  // Get the blocks field definition from the collection schema
  const blocksFieldDef = useMemo(() => {
    if (!config || !currentCollection) return null;
    const collectionSchema = getSchemaByName(config.object, currentCollection);
    return collectionSchema?.fields?.find((f: any) => f.name === "blocks");
  }, [config, currentCollection]);

  useEffect(() => setIsMounted(true), []);

  // Fetch templates and filter by applicableTo
  useEffect(() => {
    const fetchTemplates = async () => {
      if (!config || !currentCollection) {
        setIsLoading(false);
        return;
      }

      try {
        const templatesPath = "src/content/templates";
        const response = await fetch(
          `/api/${config.owner}/${config.repo}/${encodeURIComponent(config.branch)}/collections/templates?path=${encodeURIComponent(templatesPath)}`
        );

        if (!response.ok) {
          throw new Error("Failed to fetch templates");
        }

        const data = await response.json();

        if (data.status === "success" && Array.isArray(data.data?.contents)) {
          // Filter templates where applicableTo includes the current collection
          const filteredTemplates = data.data.contents
            .filter((template: any) => {
              const applicableTo = template.fields?.applicableTo;
              if (!applicableTo || !Array.isArray(applicableTo)) {
                return false;
              }
              return applicableTo.includes(currentCollection);
            })
            .map((template: any) => ({
              value: template.fields?.name || template.name,
              label: template.fields?.name || template.name,
              description: template.fields?.description,
              blocks: template.fields?.blocks || [],
            }));

          setOptions(filteredTemplates);
        }
      } catch (error) {
        console.error("Error fetching templates:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTemplates();
  }, [config, currentCollection]);

  const selectedOption = useMemo(() => {
    if (!value) return null;
    const found = options.find((opt) => opt.value === value);
    return found || { value, label: value };
  }, [value, options]);

  const handleChange = useCallback(
    (newValue: TemplateOption | null) => {
      if (!newValue) {
        // Clearing the template - just update the value without confirmation
        onChange(null);
        previousValueRef.current = null;
        return;
      }

      // If selecting the same template, no need for confirmation
      if (newValue.value === previousValueRef.current) {
        return;
      }

      // Show confirmation dialog
      setPendingTemplate(newValue);
      setShowConfirmDialog(true);
    },
    [onChange]
  );

  const handleConfirm = useCallback(() => {
    if (!pendingTemplate) return;

    // Update the template field
    onChange(pendingTemplate.value);
    previousValueRef.current = pendingTemplate.value;

    // Update the blocks field with the template's blocks, initializing with schema defaults
    if (form && pendingTemplate.blocks) {
      // Initialize each block with defaults from the schema
      // This ensures toggle fields (showBackgroundImage, showSubheadline, etc.) get their default values
      const initializedBlocks = pendingTemplate.blocks.map((block: any) => {
        const blockType = block.type; // blockKey is 'type' for pages
        const blockDef = blocksFieldDef?.blocks?.find((b: any) => b.name === blockType);
        if (blockDef?.fields) {
          return initializeState(blockDef.fields, block);
        }
        return block;
      });

      form.setValue("blocks", initializedBlocks, {
        shouldDirty: true,
        shouldValidate: true
      });
    }

    setShowConfirmDialog(false);
    setPendingTemplate(null);
  }, [pendingTemplate, onChange, form, blocksFieldDef]);

  const handleCancel = useCallback(() => {
    setShowConfirmDialog(false);
    setPendingTemplate(null);
  }, []);

  // Get block type labels for display
  const getBlockTypeLabels = (blocks: any[]) => {
    if (!blocks || blocks.length === 0) return "No blocks";
    return blocks.map((block) => block.type || "unknown").join(", ");
  };

  if (!isMounted) return null;

  return (
    <>
      <Select
        ref={ref}
        isClearable={!field.required}
        isLoading={isLoading}
        classNamePrefix="react-select"
        placeholder={field.options?.placeholder || "Select a template..."}
        components={{
          DropdownIndicator,
          ClearIndicator,
        }}
        options={options}
        value={selectedOption}
        onChange={handleChange}
        formatOptionLabel={(option: TemplateOption) => (
          <div>
            <div className="font-medium">{option.label}</div>
            {option.description && (
              <div className="text-xs text-muted-foreground">{option.description}</div>
            )}
          </div>
        )}
      />

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change Template?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  Are you sure you want to select the <strong>{pendingTemplate?.label}</strong> template?
                </p>
                <p>
                  This will remove all existing blocks and replace them with the blocks defined in{" "}
                  <strong>{pendingTemplate?.label}</strong>:
                </p>
                <div className="bg-muted rounded-md p-3 text-sm">
                  <strong>New blocks:</strong>{" "}
                  {pendingTemplate?.blocks && pendingTemplate.blocks.length > 0 ? (
                    <ul className="list-disc list-inside mt-1">
                      {pendingTemplate.blocks.map((block: any, index: number) => (
                        <li key={index}>{block.type}</li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-muted-foreground">No blocks</span>
                  )}
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancel}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>
              Replace Blocks
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
});

EditComponent.displayName = "TemplateEditComponent";

export { EditComponent };
