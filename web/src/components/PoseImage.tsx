import Image, { type StaticImageData } from "next/image";
import { Hand, HandHeart, PersonStanding } from "lucide-react";
import { poseIconHint } from "@/content";

// Placeholders for poses without a photo, standing in for the RN app's
// MaterialCommunityIcons choices (data/poseImages.js).
const PLACEHOLDERS = {
  "hands-pray": HandHeart,
  "human-handsup": PersonStanding,
  "human-handsdown": Hand,
} as const;

interface Props {
  poseId: string;
  image: StaticImageData | null;
  alt: string;
  className?: string;
  /** Hint for responsive loading, e.g. "(min-width: 768px) 50vw, 100vw". */
  sizes?: string;
  priority?: boolean;
}

/** A pose's bundled photo, or a themed icon placeholder when it has none. */
export function PoseImage({ poseId, image, alt, className = "", sizes = "100vw", priority }: Props) {
  if (image) {
    return (
      <Image
        src={image}
        alt={alt}
        sizes={sizes}
        priority={priority}
        placeholder="blur"
        className={`object-cover ${className}`}
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
