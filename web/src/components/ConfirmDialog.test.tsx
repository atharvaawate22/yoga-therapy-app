import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ConfirmDialog } from "./ConfirmDialog";

function renderDialog(open: boolean) {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  const view = render(
    <ConfirmDialog
      open={open}
      title="Delete set?"
      confirmLabel="Delete"
      destructive
      onConfirm={onConfirm}
      onCancel={onCancel}
    >
      This can&apos;t be undone.
    </ConfirmDialog>,
  );
  return { ...view, onConfirm, onCancel };
}

describe("ConfirmDialog", () => {
  it("is hidden until opened", () => {
    renderDialog(false);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("is a labelled dialog that reports confirm and cancel", async () => {
    const user = userEvent.setup();
    const { onConfirm, onCancel } = renderDialog(true);
    const dialog = screen.getByRole("dialog", { name: "Delete set?" });
    expect(dialog).toHaveTextContent("This can't be undone.");

    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("closes when the parent says so", () => {
    const { rerender, onConfirm, onCancel } = renderDialog(true);
    rerender(
      <ConfirmDialog open={false} title="Delete set?" confirmLabel="Delete" onConfirm={onConfirm} onCancel={onCancel} />,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
