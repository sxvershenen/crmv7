import { renderToStaticMarkup } from "react-dom/server"
import { expect, it } from "vitest"
import { DEFAULT_CMS_FOOTER_DETAILS } from "@crm/contracts"
import Footer from "./Footer"

it("renders published footer contacts and legal identity without template values", () => {
  const html = renderToStaticMarkup(<Footer siteName="Лесной отдых" details={{
    ...DEFAULT_CMS_FOOTER_DETAILS,
    bookingPhone: "+7 (999) 123-45-67",
    email: "hello@example.ru",
    socialLabel: "Наше сообщество",
    socialUrl: "https://example.ru/community",
    legalName: "ИП Пример",
    inn: "123456789012",
  }} />)

  expect(html).toContain('href="tel:+79991234567"')
  expect(html).toContain('href="mailto:hello@example.ru"')
  expect(html).toContain('href="https://example.ru/community"')
  expect(html).toContain("Наше сообщество")
  expect(html).toContain("ИП Пример")
  expect(html).toContain("ИНН: 123456789012")
  expect(html).toContain("Лесной отдых")
  expect(html).not.toContain("info@svistoplyasovo.ru")
})
