import imageCompression from "browser-image-compression";

export type CompressionProfile = "logo" | "hero" | "content";

const PROFILES = {
  logo: {
    maxWidthOrHeight: 800,
    maxSizeMB: 0.3,
    fileType: "image/png", // keep as PNG to preserve transparency
    useWebWorker: true,
  },
  hero: {
    maxWidthOrHeight: 1920,
    maxSizeMB: 0.5,
    fileType: "image/jpeg", // always JPEG for predictable path
    useWebWorker: true,
  },
  content: {
    maxWidthOrHeight: 1920,
    maxSizeMB: 0.5,
    useWebWorker: true, // preserves original format
  },
} as const;

/**
 * Compress an image file using the named profile.
 * SVG files are returned as-is (canvas cannot process vector XML).
 * The original filename is restored on the returned File.
 */
export async function compressImage(
  file: File,
  profile: CompressionProfile
): Promise<File> {
  if (file.type === "image/svg+xml") return file;
  const compressed = await imageCompression(file, PROFILES[profile]);
  // browser-image-compression may alter the filename — restore the original
  return new File([compressed], file.name, { type: compressed.type });
}
