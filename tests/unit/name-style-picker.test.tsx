import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NameStylePicker, useNameStyle } from "@/components/NameStylePicker";

const KEY = "reizdio:name-style";

function Harness({ hidden }: { hidden?: boolean }) {
  const [style, setStyle] = useNameStyle();
  return (
    <>
      <NameStylePicker value={style} onChange={setStyle} hidden={hidden} />
      <output data-testid="style">{style}</output>
    </>
  );
}

const current = () => screen.getByTestId("style").textContent;

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState(null, "", "/");
});
afterEach(cleanup);

describe("NameStylePicker", () => {
  it("is a radiogroup of the five styles, Original by default", () => {
    render(<Harness />);
    const group = screen.getByRole("radiogroup", { name: /name style/i });
    expect(group).toBeInTheDocument();
    expect(screen.getAllByRole("radio").map((r) => r.getAttribute("value"))).toEqual([
      "original",
      "ticker",
      "part",
      "orbit",
      "stack",
    ]);
    expect(screen.getByRole("radio", { name: "Original" })).toBeChecked();
    expect(current()).toBe("original");
  });

  it("choosing a style sets it and persists it", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("radio", { name: "Orbit" }));
    expect(current()).toBe("orbit");
    expect(screen.getByRole("radio", { name: "Orbit" })).toBeChecked();
    expect(localStorage.getItem(KEY)).toBe("orbit");
  });

  it("restores the stored style on load", () => {
    localStorage.setItem(KEY, "part");
    render(<Harness />);
    expect(current()).toBe("part");
  });

  it("?name= in the URL overrides the stored style", () => {
    localStorage.setItem(KEY, "part");
    window.history.replaceState(null, "", "/?name=stack");
    render(<Harness />);
    expect(current()).toBe("stack");
  });

  it("ignores unknown values", () => {
    localStorage.setItem(KEY, "bogus");
    window.history.replaceState(null, "", "/?name=nope");
    render(<Harness />);
    expect(current()).toBe("original");
  });

  it("is not rendered while hidden", () => {
    render(<Harness hidden />);
    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
  });
});
