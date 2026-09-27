import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"

import { TooltipProvider } from "@crm/ui"

import { AssetPage, MediaLibraryPage } from "./media-pages"

const { getAsset, getMedia, permissions, replaceMedia, saveMediaMetadata, uploadMedia } = vi.hoisted(() => ({ getAsset: vi.fn(), getMedia: vi.fn(), permissions: { canManageMedia: true }, replaceMedia: vi.fn(), saveMediaMetadata: vi.fn(), uploadMedia: vi.fn() }))

vi.mock("@admin/data/cms-repository", () => ({ cmsRepository: { getAsset, getMedia, replaceMedia, saveMediaMetadata, uploadMedia } }))
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
  replaceMedia.mockReset()
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

it("shows published usage locations and narrows them by a page address", async () => {
  getAsset.mockResolvedValue({ ...asset, usageCount: 3, publishedUsage: true, usageTotal: 3, usagesTruncated: true, usages: [{ ownerType: "cms_revision", ownerId: "revision-1", pageId: "page-1", path: "/family", pointer: "/hero/config/background/assetId", published: true }] })
  render(<TooltipProvider><MemoryRouter initialEntries={["/media/asset-1?tab=usage"]}><Routes><Route element={<AssetPage />} path="/media/:assetId" /></Routes></MemoryRouter></TooltipProvider>)

  expect(await screen.findByText("Где используется · 3")).toBeInTheDocument()
  expect(screen.getByText(/Показаны первые 1 из 3 ссылок/)).toBeInTheDocument()
  expect(screen.getByRole("link", { name: "Открыть страницу" })).toHaveAttribute("href", "/content/tree?selected=page-1")
  expect(screen.getByRole("button", { name: "Архивировать" })).toBeDisabled()
  fireEvent.change(screen.getByLabelText("Адрес страницы"), { target: { value: "/family" } })
  fireEvent.click(screen.getByRole("button", { name: "Найти" }))
  await waitFor(() => expect(getAsset).toHaveBeenLastCalledWith("asset-1", { path: "/family" }))
})

it("explains a failed initial upload without displaying raw processing messages", async () => {
  getAsset.mockResolvedValue({ ...asset, status: "error", processing: { state: "failed", purpose: "initial", attempts: 1, nextAttemptAt: null, errorCode: "MEDIA_DECODE_FAILED" } })
  render(<TooltipProvider><MemoryRouter initialEntries={["/media/asset-1"]}><Routes><Route element={<AssetPage />} path="/media/:assetId" /></Routes></MemoryRouter></TooltipProvider>)
  expect(await screen.findByText("Файл не подготовлен")).toBeInTheDocument()
  expect(screen.getByText(/Изображение повреждено/)).toBeInTheDocument()
  expect(screen.getByRole("link", { name: "Загрузить исправленный файл" })).toHaveAttribute("href", "/media?upload=1")
  fireEvent.click(screen.getByRole("button", { name: "Обновить статус" }))
  await waitFor(() => expect(getAsset).toHaveBeenCalledTimes(2))
})

it("distinguishes a queued replacement from the still available original", async () => {
  getAsset.mockResolvedValue({ ...asset, processing: { state: "queued", purpose: "replacement", attempts: 1, nextAttemptAt: "2026-09-27T12:00:00.000Z", errorCode: "MEDIA_STORAGE_UNAVAILABLE" } })
  render(<TooltipProvider><MemoryRouter initialEntries={["/media/asset-1"]}><Routes><Route element={<AssetPage />} path="/media/:assetId" /></Routes></MemoryRouter></TooltipProvider>)
  expect(await screen.findByText("Ожидает повторной обработки")).toBeInTheDocument()
  expect(screen.getByText(/Прежняя готовая версия файла остаётся доступной/)).toBeInTheDocument()
  expect(screen.getByText(/15:00:00 МСК/)).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Заменить" })).toBeDisabled()
})

it("allows another replacement after the previous attempt failed", async () => {
  getAsset.mockResolvedValue({ ...asset, processing: { state: "failed", purpose: "replacement", attempts: 1, nextAttemptAt: null, errorCode: "MEDIA_DECODE_FAILED" } })
  render(<TooltipProvider><MemoryRouter initialEntries={["/media/asset-1"]}><Routes><Route element={<AssetPage />} path="/media/:assetId" /></Routes></MemoryRouter></TooltipProvider>)
  expect(await screen.findByText("Замена файла не выполнена")).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Заменить" })).toBeEnabled()
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

it("treats a queued upload as accepted and refreshes the library", async () => {
  uploadMedia.mockResolvedValue({ ...asset, status: "converting", processing: { state: "queued", purpose: "initial", attempts: 1, nextAttemptAt: null, errorCode: "MEDIA_STORAGE_UNAVAILABLE" } })
  const view = render(<TooltipProvider><MemoryRouter initialEntries={["/media?upload=1"]}><Routes><Route element={<MediaLibraryPage />} path="/media" /><Route element={<AssetPage />} path="/media/:assetId" /></Routes></MemoryRouter></TooltipProvider>)
  fireEvent.change(view.container.querySelector('input[type="file"]')!, { target: { files: [new File(["image"], "sosna.jpg", { type: "image/jpeg" })] } })
  expect(await screen.findByRole("status")).toHaveTextContent("Файл принят. Сервер повторит обработку автоматически.")
  expect(screen.getByRole("link", { name: "Открыть файл и проверить статус" })).toHaveAttribute("href", "/media/asset-1")
  await waitFor(() => expect(getMedia).toHaveBeenCalledTimes(2))
  expect(screen.queryByText("Не удалось загрузить файл")).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole("link", { name: "Открыть файл и проверить статус" }))
  await waitFor(() => expect(getAsset).toHaveBeenCalledWith(asset.id, undefined))
})

it("clears a previous upload link and lets the same file be selected after a failed attempt", async () => {
  uploadMedia.mockResolvedValueOnce(asset).mockRejectedValueOnce(new Error("Соединение прервалось"))
  const view = render(<TooltipProvider><MemoryRouter initialEntries={["/media?upload=1"]}><Routes><Route element={<MediaLibraryPage />} path="/media" /></Routes></MemoryRouter></TooltipProvider>)
  const input = view.container.querySelector('input[type="file"]')!
  const file = new File(["image"], "sosna.jpg", { type: "image/jpeg" })
  fireEvent.change(input, { target: { files: [file] } })
  expect(await screen.findByRole("link", { name: "Открыть файл и проверить статус" })).toBeInTheDocument()
  expect(input).toHaveValue("")
  fireEvent.change(input, { target: { files: [file] } })
  expect(await screen.findByText("Соединение прервалось")).toBeInTheDocument()
  expect(screen.queryByRole("link", { name: "Открыть файл и проверить статус" })).not.toBeInTheDocument()
  expect(uploadMedia).toHaveBeenCalledTimes(2)
})

it("opens the queued replacement status after the server accepted its file", async () => {
  getAsset.mockResolvedValueOnce(asset).mockResolvedValue({ ...asset, processing: { state: "queued", purpose: "replacement", attempts: 1, nextAttemptAt: null, errorCode: "MEDIA_STORAGE_UNAVAILABLE" } })
  replaceMedia.mockResolvedValue({ ...asset, processing: { state: "queued", purpose: "replacement", attempts: 1, nextAttemptAt: null, errorCode: "MEDIA_STORAGE_UNAVAILABLE" } })
  const view = render(<TooltipProvider><MemoryRouter initialEntries={["/media/asset-1"]}><Routes><Route element={<AssetPage />} path="/media/:assetId" /></Routes></MemoryRouter></TooltipProvider>)
  fireEvent.click(await screen.findByRole("button", { name: "Заменить" }))
  fireEvent.change(view.container.querySelector('input[type="file"]')!, { target: { files: [new File(["image"], "new.jpg", { type: "image/jpeg" })] } })
  expect(await screen.findByText("Ожидает повторной обработки")).toBeInTheDocument()
  expect(getAsset).toHaveBeenCalledTimes(2)
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
