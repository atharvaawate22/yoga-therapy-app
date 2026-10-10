import type { MetadataRoute } from "next";

// Required for `output: "export"`: the manifest is written at build time.
export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Yoga Therapy",
    short_name: "Yoga Therapy",
    description:
      "Yoga routines for common health problems, with guided practice and an AI pose corrector that runs on your device.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#F1F8E9", // splash, as in the APK (app.config.js)
    theme_color: "#2e7d32",
    categories: ["health", "fitness", "lifestyle"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Pose corrector", url: "/corrector", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Surya Namaskar", url: "/surya", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "My progress", url: "/progress", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
