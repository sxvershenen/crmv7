import { expect, it } from "vitest"
import { curatedHomepageItems } from "./homepage-commerce"

it("uses explicit CMS order while skipping resources without public projections", () => {
  const published = [{ offeringId: "first", price: 100 }, { offeringId: "second", price: 200 }]
  expect(curatedHomepageItems(published, ["second", "draft", "first"])).toEqual([published[1], published[0]])
  expect(curatedHomepageItems(published, [])).toEqual([])
  expect(curatedHomepageItems(published, undefined)).toEqual(published)
})
