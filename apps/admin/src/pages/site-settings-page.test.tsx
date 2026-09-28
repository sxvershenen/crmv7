import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { CmsSiteSettingsDetailSchema, DEFAULT_CMS_FOOTER_DETAILS } from "@crm/contracts"
import { TooltipProvider } from "@crm/ui"

import { cmsRepository } from "@admin/data/cms-repository"
import { siteSettingsChanges } from "@admin/data/site-settings"
import { CmsConflictError } from "@admin/entities/cms"
import { AdminAuthSessionProvider } from "@admin/features/auth-session"
import { SiteSettingsPage } from "./site-settings-page"

const value = { siteName: "Свистоплясово", headerNavigation: [], mobileNavigation: [], footerNavigation: [], headerCta: null, heroDefault: null, sectionDefaults: [] }
const revision = { id: "00000000-0000-4000-8000-000000000001", revision: 1, state: "published" as const, value,
  contentHash: "a".repeat(64), createdBy: "00000000-0000-4000-8000-000000000002", createdAt: "2026-09-27T08:00:00.000Z" }
const published = CmsSiteSettingsDetailSchema.parse({ id: "00000000-0000-4000-8000-000000000003", version: 3, draft: null, published: revision })

function view() { return render(<TooltipProvider><AdminAuthSessionProvider><MemoryRouter><SiteSettingsPage /></MemoryRouter></AdminAuthSessionProvider></TooltipProvider>) }

describe("SiteSettingsPage", () => {
  afterEach(() => vi.restoreAllMocks())

  it("shows exactly which shared settings will publish", () => {
    const draft = CmsSiteSettingsDetailSchema.parse({ ...published, draft: { ...revision, id: "00000000-0000-4000-8000-000000000004", state: "draft", revision: 2,
      value: { ...value, siteName: "Новое название", footerNavigation: [{ id: "00000000-0000-4000-8000-000000000005", label: "Контакты", link: { kind: "internal", path: "/contacts" }, children: [] }] } } })
    expect(siteSettingsChanges(draft)).toEqual(["Название сайта", "Нижнее меню"])
  })

  it("keeps the saved version after a failed publication, then retries without saving twice", async () => {
    const saved = CmsSiteSettingsDetailSchema.parse({ ...published, version: 4, draft: { ...revision, id: "00000000-0000-4000-8000-000000000004", state: "draft", revision: 2, value: { ...value, siteName: "Новое название" } } })
    vi.spyOn(cmsRepository, "getSiteSettings").mockResolvedValue(published)
    vi.spyOn(cmsRepository, "getAccess").mockResolvedValue({ canViewContent: true, canEditContent: true, canReviewContent: true, canPublishContent: true })
    const save = vi.spyOn(cmsRepository, "saveSiteSettings").mockResolvedValue(saved)
    const publish = vi.spyOn(cmsRepository, "publishSiteSettings").mockRejectedValueOnce(new Error("Delivery unavailable")).mockResolvedValueOnce({ ...saved, version: 5, published: { ...saved.draft!, state: "published" }, draft: null })
    view()

    fireEvent.change(await screen.findByLabelText("Название"), { target: { value: "Новое название" } })
    fireEvent.click(screen.getByRole("button", { name: "Сохранить и опубликовать" }))
    expect(await screen.findByText("Delivery unavailable")).toBeInTheDocument()
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ siteName: "Новое название", footerDetails: DEFAULT_CMS_FOOTER_DETAILS }), 3)
    expect(publish).toHaveBeenCalledWith(4)

    fireEvent.click(screen.getByRole("button", { name: "Опубликовать" }))
    await waitFor(() => expect(publish).toHaveBeenCalledTimes(2))
    expect(save).toHaveBeenCalledOnce()
  })

  it("does not offer a technical reader edits that the API would reject", async () => {
    vi.spyOn(cmsRepository, "getSiteSettings").mockResolvedValue(published)
    vi.spyOn(cmsRepository, "getAccess").mockResolvedValue({ canViewContent: true, canEditContent: false, canReviewContent: false, canPublishContent: false })
    view()

    expect(await screen.findByLabelText("Название")).toHaveAttribute("readonly")
    expect(screen.getByLabelText("Телефон для бронирования")).toHaveAttribute("readonly")
    expect(screen.getByRole("button", { name: "Сохранить" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Опубликовать" })).toBeDisabled()
  })

  it("preserves a local name while rebasing onto concurrent server settings", async () => {
    const concurrent = CmsSiteSettingsDetailSchema.parse({ ...published, version: 4, published: { ...revision, value: { ...value, siteName: "Название коллеги" } } })
    vi.spyOn(cmsRepository, "getSiteSettings").mockResolvedValueOnce(published).mockResolvedValueOnce(concurrent)
    vi.spyOn(cmsRepository, "getAccess").mockResolvedValue({ canViewContent: true, canEditContent: true, canReviewContent: true, canPublishContent: true })
    const save = vi.spyOn(cmsRepository, "saveSiteSettings").mockRejectedValueOnce(new CmsConflictError(4))
    view()

    fireEvent.change(await screen.findByLabelText("Название"), { target: { value: "Моё название" } })
    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }))
    expect((await screen.findAllByText("Конфликт версий")).length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole("button", { name: "Сверить с сервером" }))
    await screen.findByText(/Загружена серверная версия 4/)
    expect(screen.getByLabelText("Название")).toHaveValue("Моё название")
    expect(screen.getByRole("button", { name: "Сохранить" })).toBeEnabled()
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ siteName: "Моё название" }), 3)
  })

  it("saves footer contacts with the shared settings draft", async () => {
    const footerDetails = { ...DEFAULT_CMS_FOOTER_DETAILS, bookingPhone: "+7 (999) 123-45-67" }
    const saved = CmsSiteSettingsDetailSchema.parse({ ...published, version: 4, draft: { ...revision, id: "00000000-0000-4000-8000-000000000004", state: "draft", revision: 2, value: { ...value, footerDetails } } })
    vi.spyOn(cmsRepository, "getSiteSettings").mockResolvedValue(published)
    vi.spyOn(cmsRepository, "getAccess").mockResolvedValue({ canViewContent: true, canEditContent: true, canReviewContent: true, canPublishContent: true })
    const save = vi.spyOn(cmsRepository, "saveSiteSettings").mockResolvedValue(saved)
    view()

    fireEvent.change(await screen.findByLabelText("Телефон для бронирования"), { target: { value: footerDetails.bookingPhone } })
    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }))
    await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ footerDetails }), 3))
    expect(screen.getByRole("button", { name: "Сохранить" })).toBeDisabled()
    expect(siteSettingsChanges(saved)).toContain("Контакты и реквизиты подвала")
  })
})
