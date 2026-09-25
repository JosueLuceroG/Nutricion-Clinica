import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ErrorBoundary } from "@app/ErrorBoundary";

class DynamicImportFailure extends Error {
  constructor() {
    super(
      "Failed to fetch dynamically imported module: http://localhost:1420/src/example.tsx",
    );
  }
}

function BrokenPage(): never {
  throw new DynamicImportFailure();
}

describe("ErrorBoundary", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reloads the application when retrying a failed dynamic import", () => {
    const reload = vi
      .spyOn(window.location, "reload")
      .mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    render(
      <MemoryRouter>
        <ErrorBoundary>
          <BrokenPage />
        </ErrorBoundary>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));

    expect(reload).toHaveBeenCalledOnce();
  });
});
