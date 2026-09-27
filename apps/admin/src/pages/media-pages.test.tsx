import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"

import { TooltipProvider } from "@crm/ui"

import { AssetPage, MediaLibraryPage } from "./media-pages"

const { getAsset, getMedia, permissions, saveMediaMetadata, uploadMedia } = vi.hoisted(() => ({ getAsset: vi.fn(), getMedia: vi.fn(), permissions: { canManageMedia: true }, saveMediaMetadata: vi.fn(), uploadMedia: vi.fn() }))

vi.mock("@admin/data/cms-repository", () => ({ cmsRepository: { getAsset, getMedia, saveMediaMetadata, uploadMedia } }))
vi.mock("@admin/features/auth-session-context", () => ({ useAdminAuthSession: () => ({ user: { capabilities: permissions } }) }))

const asset = {
  id: "asset-1", version: 1, title: "Дом Сосна", filename: "sosna.jpg", status: "ready", dimensions: "1200×800", size: "1 MB",
  usageCount: 0, publishedUsage: false, alt: "Дом среди деревьев", license: "Фото базы", dominant: "#66705a", variants: [], usages: [],
}

beforeEach(() => {
  getAsset.mockReset().mockResolvedValue(asset)
  getMedia.mockReset().mockResolvedValue({ items: [], nextCursor: null })
  saveMediaMetadata.mockReset().mockResolvedValue({ ...asset, version: 2 })
  uploadMedia.mockReset()
  permissions.canManageMedia = true
})

it("saves the supported caption, credit, tags and focal point with the asset version", async () => {
  render(<TooltipProvider><MemoryRouter initialEntries={["/media/asset-1"]}><Routes><Route element={<AssetPage />} path="/media/:assetId" /></Routes></MemoryRouter></TooltipProvider>)
  expect(await screen.findByLabelText("Подпись")).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText("Подпись"), { target: { value: "Домик у сосен" } })
  fireEvent.change(screen.getByLabelText("Автор / источник"), { target: { value: "Фотограф базы" } })
  fireEvent.change(screen.getByLabelText("Метки через запятую"), { target: { value: "лес, домик" } })
  fireEvent.change(screen.getByLabelText("Фокус по горизонтали, %"), { target: { value: "30" } })
  fireEvent.click(screen.getByRole("button", { name: "Сохранить описание" }))
  await waitFor(() => expect(saveMediaMetadata).toHaveBeenCalledWith(expect.objectContaining({ id: asset.id, version: 1, caption: "Домик у сосен", credit: "Фотограф базы", tags: ["лес", "домик"], focalPoint: { x: 0.3, y: 0.5 } })))
})

it("shows asset metadata but disables mutations without media management rights", async () => {
  permissions.canManageMedia = false
  render(<TooltipProvider><MemoryRouter initialEntries={["/media/asset-1"]}><Routes><Route element={<AssetPage />} path="/media/:assetId" /></Routes></MemoryRouter></TooltipProvider>)
  expect(await screen.findByLabelText("Название")).toHaveAttribute("readonly")
  expect(screen.getByRole("button", { name: "Сохранить описание" })).toBeDisabled()
  expect(screen.getByRole("button", { name: "Архивировать" })).toBeDisabled()
  expect(screen.getByRole("button", { name: "Заменить" })).toBeDisabled()
})

it("keeps metadata edits after a failed save", async () => {
  saveMediaMetadata.mockRejectedValueOnce(new Error("Сервер не сохранил изменения"))
  render(<TooltipProvider><MemoryRouter initialEntries={["/media/asset-1"]}><Routes><Route element={<AssetPage />} path="/media/:assetId" /></Routes></MemoryRouter></TooltipProvider>)
  const caption = await screen.findByLabelText("Подпись")
  fireEvent.change(caption, { target: { value: "Новая подпись" } })
  fireEvent.click(screen.getByRole("button", { name: "Сохранить описание" }))
  expect(await screen.findByRole("alert")).toHaveTextContent("Сервер не сохранил изменения")
  expect(caption).toHaveValue("Новая подпись")
  expect(screen.getByRole("button", { name: "Сохранить описание" })).toBeEnabled()
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

it("searches on the server and loads older media without the first-page limit", async () => {
  const older = { ...asset, id: "asset-2", title: "Старый кадр" }
  getMedia.mockImplementation(async (query?: { cursor?: string }) => query?.cursor ? { items: [older], nextCursor: null } : { items: [asset], nextCursor: "older" })
  render(<TooltipProvider><MemoryRouter initialEntries={["/media"]}><Routes><Route element={<MediaLibraryPage />} path="/media" /></Routes></MemoryRouter></TooltipProvider>)
  expect(await screen.findByText(asset.title)).toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: "Показать ещё" }))
  expect(await screen.findByText(older.title)).toBeInTheDocument()
  expect(getMedia).toHaveBeenCalledWith(expect.objectContaining({ cursor: "older", limit: 30 }))
  fireEvent.change(screen.getByRole("textbox", { name: "Поиск медиа" }), { target: { value: "берёза" } })
  await waitFor(() => expect(getMedia).toHaveBeenLastCalledWith(expect.objectContaining({ q: "берёза", limit: 30 })))
  expect(await screen.findByText(asset.title)).toBeInTheDocument()
  expect(screen.queryByText(older.title)).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: "Ошибка" }))
  await waitFor(() => expect(getMedia).toHaveBeenLastCalledWith(expect.objectContaining({ q: "берёза", state: "failed", limit: 30 })))
})
