import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import HomePage from "../app/page";

describe("HomePage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("показывает форму входа, если в localStorage нет сессии", async () => {
    render(<HomePage />);

    expect(await screen.findByRole("heading", { name: "Вход в CRM" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Войти" })).toBeTruthy();
  });
});
