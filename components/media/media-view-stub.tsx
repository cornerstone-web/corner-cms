// Temporary stub for the unified Media page.
// Task 8 will replace this with the full R2-backed MediaView implementation
// and export it from media-view.tsx with the category prop signature.

export function MediaView({ category }: { category: string }) {
  return (
    <div className="flex items-center justify-center flex-1 text-muted-foreground text-sm">
      Media — {category} (coming soon)
    </div>
  );
}
