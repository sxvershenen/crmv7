import { fireEvent, render, screen } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"

import { TooltipProvider } from "@crm/ui"

import { AssetPage, MediaLibraryPage } from "./media-pages"

const { getAsset, getMedia, uploadMedia } = vi.hoisted(() => ({ getAsset: vi.fn(), getMedia: vi.fn(), uploadMedia: vi.fn() }))

vi.mock("@admin/data/cms-repository", () => ({ cmsRepository: { getAsset, getMedia, uploadMedia } }))
vi.mock("@admin/features/auth-session-context", () => ({ useAdminAuthSession: () => ({ user: { capabilities: { canManageMedia: true } } }) }))

const asset = {
  id: "asset-1", version: 1, title: "Дом Сосна", filename: "sosna.jpg", status: "ready", dimensions: "1200×800", size: "1 MB",
  usageCount: 0, publishedUsage: false, alt: "Дом среди деревьев", license: "Фото базы", dominant: "#66705a", variants: [], usages: [],
}

beforeEach(() => {
  getAsset.mockReset().mockResolvedValue(asset)
  getMedia.mockReset().mockResolvedValue([])
  uploadMedia.mockReset()
})

it("opens old media log and version URLs on the real metadata tab without invented history", async () => {
  for (const legacyTab of ["log", "versions"]) {
    const view = render(<TooltipProvider><MemoryRouter initialEntries={[`/media/asset-1?tab=${legacyTab}`]}><Routes><Route element={<AssetPage />} path="/media/:assetId" /></Routes></MemoryRouter></TooltipProvider>)
    expect(await screen.findByText("Описание файла")).toBeInTheDocument()
    expect(screen.queryByText("Технический лог")).not.toBeInTheDocument()
    expect(screen.queryByText("Версии")).not.toBeInTheDocument()
    expect(screen.queryByText(/10:31:02 upload verified/)).not.toBeInTheDocument()
    view.unmount()
  }
})

it("shows processing after upload when the API has not marked the file ready", async () => {
  uploadMedia.mockResolvedValue({ ...asset, status: "converting" })
  const view = render(<TooltipProvider><MemoryRouter initialEntries={["/media?upload=1"]}><Routes><Route element={<MediaLibraryPage />} path="/media" /></Routes></MemoryRouter></TooltipProvider>)
  const input = view.container.querySelector('input[type="file"]')
  expect(input).not.toBeNull()
  fireEvent.change(input!, { target: { files: [new File(["image"], "sosna.jpg", { type: "image/jpeg" })] } })
  expect(await screen.findByRole("status")).toHaveTextContent("Файл загружен. Обработка продолжается.")
  expect(uploadMedia).toHaveBeenCalledOnce()
  expect(screen.queryByText("Файл готов")).not.toBeInTheDocument()
})
