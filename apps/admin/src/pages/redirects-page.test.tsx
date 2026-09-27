import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"

import { cmsRepository } from "@admin/data/cms-repository"
import { RedirectsPage } from "@admin/pages/redirects-page"

const manifest = {
  releaseId: "00000000-0000-4000-8000-000000000020",
  generatedAt: "2026-09-01T09:00:00.000Z",
  routes: [],
  redirects: [{ sourcePath: "/houses", destinationPath: "/domiki", statusCode: 301 as const }],
  cache: { etag: '"fixture-routes"', maxAgeSeconds: 60, staleWhileRevalidateSeconds: 60, tags: [] },
}

afterEach(() => vi.restoreAllMocks())

function renderPage() { return render(<MemoryRouter><RedirectsPage /></MemoryRouter>) }

it("shows published redirect direction and never offers fake creation", async () => {
  vi.spyOn(cmsRepository, "getPublishedRedirects").mockResolvedValue(manifest)
  renderPage()
  expect(await screen.findByText("/houses")).toBeInTheDocument()
  expect(screen.getByText("/domiki")).toBeInTheDocument()
  expect(screen.getByText("301")).toBeInTheDocument()
  expect(screen.queryByRole("button", { name: /Создать/ })).not.toBeInTheDocument()
  expect(screen.getByRole("link", { name: "Открыть публикацию" })).toHaveAttribute("href", `/releases/${manifest.releaseId}`)
  fireEvent.change(screen.getByRole("textbox", { name: "Найти редирект по адресу" }), { target: { value: "/not-found" } })
  expect(screen.getByText("Редиректы не найдены")).toBeInTheDocument()
})

it("shows a truthful empty state before the first publication", async () => {
  vi.spyOn(cmsRepository, "getPublishedRedirects").mockResolvedValue(null)
  renderPage()
  expect(await screen.findByText("Сайт ещё не опубликован")).toBeInTheDocument()
})

it("retries a failed manifest request", async () => {
  vi.spyOn(cmsRepository, "getPublishedRedirects").mockRejectedValueOnce(new Error("Ошибка сети")).mockResolvedValueOnce(manifest)
  renderPage()
  expect(await screen.findByText("Ошибка сети")).toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: "Повторить" }))
  await waitFor(() => expect(screen.getByText("/houses")).toBeInTheDocument())
})
