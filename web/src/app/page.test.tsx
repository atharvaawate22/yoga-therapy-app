import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { APK_URL, REPO_URL } from "@/lib/links";
import Home from "./page";

describe("landing page", () => {
  it("links to the current APK and the source", () => {
    render(<Home />);
    expect(screen.getByRole("link", { name: "Download the Android app" })).toHaveAttribute(
      "href",
      APK_URL,
    );
    expect(screen.getByRole("link", { name: "View the source" })).toHaveAttribute(
      "href",
      REPO_URL,
    );
  });

  it("describes the pipeline using pose-core's keypoint count", () => {
    render(<Home />);
    expect(screen.getByText("MoveNet finds 17 body keypoints")).toBeInTheDocument();
  });

  it("says plainly that the web app is not finished", () => {
    render(<Home />);
    expect(
      screen.getByRole("heading", { name: "The web app is under construction" }),
    ).toBeInTheDocument();
  });
});
