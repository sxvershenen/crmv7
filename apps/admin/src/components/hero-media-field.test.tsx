import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { TooltipProvider } from "@crm/ui"
import { HeroMediaField } from "./hero-media-field"

const { getAsset, getMedia, uploadMedia } = vi.hoisted(() => ({ getAsset: vi.fn(), getMedia: vi.fn(), uploadMedia: vi.fn() }))
vi.mock("@admin/data/cms-repository", () => ({ cmsRepository: { getAsset, getMedia, uploadMedia } }))

const ready = {
  id: "11111111-1111-4111-8111-111111111111", kind: "image", title: "Новый фон", filename: "forest.jpg", status: "ready",
  dimensions: "800×600", size: "20 KB", usageCount: 0, publishedUsage: false, alt: "Лес", license: "Собственное фото", dominant: "#66705a",
  variants: [{ id: "variant-1", format: "webp", width: 800, height: 600, byteSize: 20000, url: "/forest.webp" }],
}

beforeEach(() => {
  getAsset.mockReset()
  getMedia.mockReset().mockResolvedValue({ items: [], nextCursor: null })
  uploadMedia.mockReset()
})

it("keeps the picker open during processing and attaches an upload only when ready", async () => {
  const onChange = vi.fn()
  uploadMedia.mockResolvedValue({ ...ready, status: "converting", variants: [] })
  getAsset.mockResolvedValue(ready)
  render(<TooltipProvider><HeroMediaField assetId="" canUpload editable label="Фоновое изображение" onChange={onChange} /></TooltipProvider>)

  fireEvent.click(screen.getByRole("button", { name: "Выбрать: фоновое изображение" }))
  fireEvent.change(screen.getByLabelText("Загрузить новое изображение"), { target: { files: [new File(["image"], "forest.jpg", { type: "image/jpeg" })] } })
  expect(await screen.findByRole("status")).toHaveTextContent("Файл загружен и обрабатывается")
  expect(onChange).not.toHaveBeenCalled()

  fireEvent.click(screen.getByRole("button", { name: "Проверить готовность" }))
  await waitFor(() => expect(onChange).toHaveBeenCalledWith(ready.id))
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
})

it("hides upload from an editor without media management rights", async () => {
  render(<TooltipProvider><HeroMediaField assetId="" canUpload={false} editable label="Фоновое изображение" onChange={vi.fn()} /></TooltipProvider>)
  fireEvent.click(screen.getByRole("button", { name: "Выбрать: фоновое изображение" }))
  expect(await screen.findByRole("dialog")).toBeInTheDocument()
  expect(screen.queryByLabelText("Загрузить новое изображение")).not.toBeInTheDocument()
  expect(screen.getByRole("textbox", { name: "Поиск изображения" })).toBeInTheDocument()
})

it("does not attach a file from a previous picker session", async () => {
  const onChange = vi.fn()
  let finish!: (asset: typeof ready) => void
  uploadMedia.mockImplementation(() => new Promise((resolve) => { finish = resolve }))
  render(<TooltipProvider><HeroMediaField assetId="" canUpload editable label="Фоновое изображение" onChange={onChange} /></TooltipProvider>)
  fireEvent.click(screen.getByRole("button", { name: "Выбрать: фоновое изображение" }))
  fireEvent.change(screen.getByLabelText("Загрузить новое изображение"), { target: { files: [new File(["image"], "forest.jpg", { type: "image/jpeg" })] } })
  fireEvent.click(screen.getByRole("button", { name: "Close" }))
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  fireEvent.click(screen.getByRole("button", { name: "Выбрать: фоновое изображение" }))
  expect(await screen.findByRole("dialog")).toBeInTheDocument()
  await act(async () => finish(ready))
  expect(onChange).not.toHaveBeenCalled()
  expect(screen.queryByRole("status")).not.toBeInTheDocument()
})

it("loads the next ready-image page inside the picker", async () => {
  const older = { ...ready, id: "22222222-2222-4222-8222-222222222222", title: "Старый фон" }
  getMedia.mockImplementation(async (query: { cursor?: string }) => query.cursor ? { items: [older], nextCursor: null } : { items: [ready], nextCursor: "older" })
  const onChange = vi.fn()
  render(<TooltipProvider><HeroMediaField assetId="" canUpload={false} editable label="Фоновое изображение" onChange={onChange} /></TooltipProvider>)
  fireEvent.click(screen.getByRole("button", { name: "Выбрать: фоновое изображение" }))
  expect(await screen.findByText(ready.title)).toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: "Показать ещё" }))
  expect(await screen.findByText(older.title)).toBeInTheDocument()
  expect(getMedia).toHaveBeenCalledWith(expect.objectContaining({ cursor: "older", state: "ready", limit: 30 }))
  fireEvent.click(screen.getByRole("button", { name: new RegExp(older.title) }))
  expect(onChange).toHaveBeenCalledWith(older.id)
})
