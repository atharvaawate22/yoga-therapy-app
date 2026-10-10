import { Hand, HandHeart, PersonStanding } from "lucide-react";
import { poseIconHint, type WebImage } from "@/content";

// Placeholders for poses without a photo, standing in for the RN app's
// MaterialCommunityIcons choices (data/poseImages.js).
const PLACEHOLDERS = {
  "hands-pray": HandHeart,
  "human-handsup": PersonStanding,
  "human-handsdown": Hand,
} as const;

interface Props {
  poseId: string;
  image: WebImage | null;
  alt: string;
  className?: string;
  /** Hint for picking a srcset candidate, e.g. "(min-width: 768px) 50vw, 100vw". */
  sizes?: string;
  priority?: boolean;
}

/** A pose's photo (pre-optimised WebP), or a themed icon placeholder. */
export function PoseImage({ poseId, image, alt, className = "", sizes = "100vw", priority }: Props) {
  if (image) {
    return (
      // A static export has no image optimizer; the photos are resized to
      // WebP at build time (scripts/generate-images.mjs), so a plain <img>
      // with srcset does the job of next/image here.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={image.src}
        srcSet={image.srcSet || undefined}
        sizes={image.srcSet ? sizes : undefined}
        width={image.width}
        height={image.height}
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : undefined}
        decoding="async"
        className={`object-cover ${className}`}
        style={
          image.blurDataURL
            ? { backgroundImage: `url(${image.blurDataURL})`, backgroundSize: "cover" }
            : undefined
        }
      />
    );
  }
  const hint = poseIconHint(poseId).name as keyof typeof PLACEHOLDERS;
  const Icon = PLACEHOLDERS[hint] ?? PersonStanding;
  return (
    <div
      role="img"
      aria-label={alt}
      className={`flex items-center justify-center bg-surface-alt text-primary ${className}`}
    >
      <Icon aria-hidden="true" className="size-1/3 max-h-24 max-w-24" strokeWidth={1.5} />
    </div>
  );
}
