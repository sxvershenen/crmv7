import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { TooltipProvider } from "@crm/ui";

import { FixtureWorkspaceRepository } from "@app/data/workspace-repository";

import { ProfilePage } from "./profile-page";
import { SettingsPage } from "./settings-page";
import { TeamPage } from "./team-page";

function renderPage(page: React.ReactNode, entry: string) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <TooltipProvider>{page}</TooltipProvider>
    </MemoryRouter>,
  );
}

describe("workspace pages", () => {
  it("renders an editable personal profile with separate notification settings", async () => {
    const user = userEvent.setup();
    renderPage(<ProfilePage repository={new FixtureWorkspaceRepository()} />, "/profile");
    expect(await screen.findByDisplayValue("Марина Кириллова")).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Уведомления" }));
    expect(screen.getByText("Новые заявки")).toBeInTheDocument();
    expect(screen.getByText("Telegram")).toBeInTheDocument();
  });

  it("renders searchable team management and role navigation", async () => {
    const user = userEvent.setup();
    renderPage(<TeamPage repository={new FixtureWorkspaceRepository()} />, "/team");
    const searches = await screen.findAllByLabelText("Поиск сотрудников");
    await user.type(searches[0]!, "Ольга");
    expect(screen.getAllByText("Ольга Семёнова").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("Алексей Воронов")).not.toBeInTheDocument();
  });

  it("explains relative workload and exposes schedule and absence readiness", async () => {
    const user = userEvent.setup();
    renderPage(<TeamPage repository={new FixtureWorkspaceRepository()} />, "/team?section=workload");
    expect(await screen.findByText("Как считается нагрузка")).toBeInTheDocument();
    expect(screen.getByText(/100%/)).toBeInTheDocument();
    expect(screen.getAllByText("График не настроен").length).toBeGreaterThan(0);
    await user.click(screen.getByRole("tab", { name: "Сотрудники" }));
  });

  it("keeps public site intake separate from confirmed booking creation", async () => {
    const user = userEvent.setup();
    renderPage(<SettingsPage repository={new FixtureWorkspaceRepository()} />, "/settings");
    await screen.findByDisplayValue("Свистоплясово");
    await user.click(screen.getByRole("tab", { name: "Сайт и CMS" }));
    expect(screen.getByText("Контракт CRM ↔ публичный сайт и CMS")).toBeInTheDocument();
    expect(screen.getByText("Только после решения менеджера")).toBeInTheDocument();
  });
});
