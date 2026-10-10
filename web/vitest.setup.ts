import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";
import { resetStorageForTests } from "@/lib/storage/asyncStorageShim";

// The RN app's poseImages.js require()s PNGs, which only the bundler can
// load. Tests run without photos, so every pose shows its placeholder.
vi.mock("@app-data/poseImages", () => {
  const getPoseImage = () => null;
  return {
    default: getPoseImage,
    getPoseImage,
    getPoseIcon: () => ({ family: "mci", name: "yoga" }),
  };
});

// jsdom doesn't implement <dialog> modality.
if (typeof HTMLDialogElement !== "undefined" && !HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.removeAttribute("open");
  };
}

beforeEach(() => {
  localStorage.clear();
  resetStorageForTests();
});

afterEach(() => {
  cleanup();
});
