import { renderToStaticMarkup } from "react-dom/server"
import { expect, it } from "vitest"
import { CmsHeroConfigSchema } from "@crm/contracts"
import { SiteHero } from "@crm/site-ui"
import { toSiteHero } from "./cms-public"

const desktopId = "11111111-1111-4111-8111-111111111111"
const mobileId = "22222222-2222-4222-8222-222222222222"

it("renders a published mobile hero image while retaining the desktop source", () => {
  const hero = CmsHeroConfigSchema.parse({
    title: "Семейный отдых", backgroundAssetId: desktopId, mobileBackgroundAssetId: mobileId,
    background: { assetId: desktopId, alt: "Лес", variants: [{ url: "/desktop.webp", format: "webp", width: 1600, height: 900 }] },
    mobileBackground: { assetId: mobileId, alt: "Лес на телефоне", variants: [{ url: "/mobile.webp", format: "webp", width: 720, height: 1080 }] },
  })
  const mapped = toSiteHero(hero)
  const html = renderToStaticMarkup(<SiteHero config={mapped} promos={[]} onBooking={() => {}} onCall={() => {}} onNavigate={() => {}} />)

  expect(mapped.slides[0]).toMatchObject({ image: "/desktop.webp", mobileImage: "/mobile.webp" })
  expect(html).toContain('<source media="(max-width: 767px)" srcSet="/mobile.webp"')
  expect(html).toContain('src="/desktop.webp"')
})

it("leaves old published heroes without a mobile source", () => {
  const hero = CmsHeroConfigSchema.parse({ title: "Семейный отдых", backgroundAssetId: desktopId,
    background: { assetId: desktopId, alt: "Лес", variants: [{ url: "/desktop.webp", format: "webp", width: 1600, height: 900 }] },
  })
  expect("mobileBackground" in hero).toBe(false)
  expect(toSiteHero(hero).slides[0]).not.toHaveProperty("mobileImage")
})
