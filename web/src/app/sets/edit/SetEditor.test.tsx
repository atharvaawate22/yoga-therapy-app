import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCustomSets, saveCustomSet } from "@/lib/storage";
import { SetEditor } from "./SetEditor";

const push = vi.fn();
let search = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => search,
}));

beforeEach(() => {
  push.mockReset();
  search = new URLSearchParams();
});

describe("SetEditor", () => {
  it("asks for a name first and moves focus to the field", async () => {
    const user = userEvent.setup();
    render(<SetEditor />);
    await user.click(screen.getByRole("button", { name: "Save set" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Please enter a name");
    expect(screen.getByLabelText("Set name")).toHaveFocus();
    expect(push).not.toHaveBeenCalled();
  });

  it("requires at least one pose", async () => {
    const user = userEvent.setup();
    render(<SetEditor />);
    await user.type(screen.getByLabelText("Set name"), "Morning");
    await user.click(screen.getByRole("button", { name: "Save set" }));
    expect(screen.getByRole("alert")).toHaveTextContent("select at least one pose");
  });

  it("saves poses in the chosen order", async () => {
    const user = userEvent.setup();
    render(<SetEditor />);
    await user.type(screen.getByLabelText("Set name"), "Morning");
    await user.click(screen.getByRole("checkbox", { name: /Child's Pose/ }));
    await user.click(screen.getByRole("checkbox", { name: /Cat-Cow/ }));
    await user.click(screen.getByRole("button", { name: "Move Cat-Cow Stretch up" }));
    await user.click(screen.getByRole("button", { name: "Save set" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/sets?saved=created"));
    const [set] = await getCustomSets();
    expect(set).toMatchObject({ name: "Morning", poseIds: ["cat_cow", "childs_pose"] });
  });

  it("edits an existing set in place", async () => {
    const user = userEvent.setup();
    const existing = await saveCustomSet({ name: "Evening", poseIds: ["tree_pose"] });
    search = new URLSearchParams({ id: existing.id });
    render(<SetEditor />);

    const name = screen.getByLabelText("Set name");
    await waitFor(() => expect(name).toHaveValue("Evening"));
    await user.clear(name);
    await user.type(name, "Wind down");
    await user.click(screen.getByRole("button", { name: "Save set" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/sets?saved=updated"));
    const sets = await getCustomSets();
    expect(sets).toHaveLength(1);
    expect(sets[0]).toMatchObject({ id: existing.id, name: "Wind down", poseIds: ["tree_pose"] });
  });
});
