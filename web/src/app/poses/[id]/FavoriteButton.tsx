"use client";

import { useCallback } from "react";
import { Heart } from "lucide-react";
import { useStored } from "@/lib/hooks/useStored";
import { getFavoriteIds, toggleFavorite } from "@/lib/storage";

export function FavoriteButton({ poseId, poseName }: { poseId: string; poseName: string }) {
  const load = useCallback(async () => (await getFavoriteIds()).includes(poseId), [poseId]);
  const { value: isFavorite, reload } = useStored(load);

  return (
    <button
      type="button"
      aria-pressed={Boolean(isFavorite)}
      aria-label={`Favorite ${poseName}`}
      disabled={isFavorite === undefined}
      onClick={async () => {
        await toggleFavorite(poseId);
        await reload();
      }}
      className="flex size-11 items-center justify-center rounded-full bg-surface/95 shadow-md hover:bg-surface"
    >
      <Heart
        aria-hidden="true"
        className={`size-6 ${isFavorite ? "text-danger" : "text-muted"}`}
        fill={isFavorite ? "currentColor" : "none"}
      />
    </button>
  );
}
