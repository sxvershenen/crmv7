import { readdir, readFile } from "node:fs/promises"
import { relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const appRoot = resolve(fileURLToPath(new URL("..", import.meta.url)))
const workspaceRoot = resolve(appRoot, "../..")
const kitRoot = resolve(workspaceRoot, "packages/site-ui")
const sourceRoot = resolve(appRoot, "src")
const extensions = new Set([".astro", ".css", ".ts", ".tsx"])

const sectionContracts = new Map([
  ["react/components/sections/HeroSection.tsx", "hero"],
  ["react/components/sections/EventsSection.tsx", "events"],
  ["react/components/sections/HousesSection.tsx", "houses"],
  ["react/components/sections/SaunaChanSection.tsx", "sauna-chan"],
  ["react/components/sections/ProgramsSection.tsx", "programs"],
  ["react/components/sections/VenuesSection.tsx", "venues"],
  ["react/components/sections/ReviewsSection.tsx", "reviews"],
  ["react/components/sections/TerritoryMapSection.tsx", "map"],
  ["react/components/sections/FaqLocationSection.tsx", "faq"],
  ["react/components/sections/BookingQuizSection.tsx", "calculator"],
  ["components/islands/BlogSectionIsland.tsx", "blog"],
  ["components/sections/WhyUsSection.astro", "why-us"],
  ["components/sections/PartnersMarquee.astro", "partners"],
  ["components/sections/Footer.tsx", "footer"],
])

const boundaryChecks = [
  [/@crm\/ui(?:[/'"]|$)/g, "CRM @crm/ui import is forbidden in the public frontend"],
  [/@crm\/db(?:[/'"]|$)|\/api\/internal\/v1|typeorm/g, "public frontend crossed an internal data boundary"],
]

const visualChecks = [
  [/(^|[^\w-])#[0-9a-f]{3,8}\b/gi, "direct color literal; add or use a @crm/site-ui token"],
  [/\b(?:bg|text|border|ring|from|via|to)-(?:white|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(?:-[0-9]{2,3})?(?:\/[0-9]{1,3})?\b/g, "named semantic color utility; use a @crm/site-ui color token"],
  [/\brounded-(?:none|sm|md|lg|xl|2xl|3xl|full)\b/g, "direct radius utility; use --site-radius-*"],
  [/(?<!site-)\bshadow-(?:2?xs|sm|md|lg|xl|2xl|inner|none)\b|(?<!site-)\bshadow\b(?!-\[)/g, "direct shadow utility; use --site-shadow-*"],
  [/\btext-(?:xs|sm|base|lg|xl|[2-9]xl)\b|text-\[[0-9.]+(?:px|rem)\]/g, "direct typography size; use --site-text-* or site-type-*"],
  [/\bfont-(?:normal|medium|semibold|bold)\b/g, "direct font weight; use --site-weight-*"],
]

// These files are the pixel-verified homepage baseline. They stay on the exact
// legacy utility contract until each component has a dedicated visual-regression
// fixture. New pages/components are token-strict immediately; the allowlist is a
// migration fence, not a blanket exception for the application.
const pixelVerifiedLegacyFiles = new Set([
  "pages/privacy.astro",
  "pages/resources/[slug].astro",
  "react/components/common/FloatingHelper.tsx",
  "react/components/modals/BookingModal.tsx",
  "react/components/modals/CallModal.tsx",
  "react/components/modals/HouseDetailModal.tsx",
  "react/components/modals/PrivacyPolicyModal.tsx",
  "react/components/navigation/MobileDrawer.tsx",
  "react/components/navigation/Sidebar.tsx",
  "react/components/sections/BookingQuizSection.tsx",
  "react/components/sections/FaqLocationSection.tsx",
  "react/components/sections/ReviewsSection.tsx",
  "react/components/sections/TerritoryMapSection.tsx",
])

const pageShellConsumers = [
  "pages/index.astro",
  "pages/[...path].astro",
  "pages/blog.astro",
  "pages/dev/site-ui-v2.astro",
  "pages/resources/[slug].astro",
]

const sharedSectionHeaderConsumers = [
  "components/sections/WhyUsSection.astro",
  "react/components/sections/BookingQuizSection.tsx",
  "react/components/sections/FaqLocationSection.tsx",
  "react/components/sections/ReviewsSection.tsx",
  "react/components/sections/TerritoryMapSection.tsx",
]

async function filesUnder(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) return filesUnder(path)
    return extensions.has(entry.name.slice(entry.name.lastIndexOf("."))) ? [path] : []
  }))
  return nested.flat()
}

function lineAt(source, index) {
  return source.slice(0, index).split("\n").length
}

const failures = []
const v2Inventory = JSON.parse(await readFile(resolve(kitRoot, "component-inventory-v2.json"), "utf8"))
const kitComponentSources = (await filesUnder(resolve(kitRoot, "src/components"))).filter((file) => /\.tsx$/.test(file))
const kitSource = (await Promise.all(kitComponentSources.map((file) => readFile(file, "utf8")))).join("\n")

for (const item of v2Inventory.canonical) {
  if (!new RegExp(`export (?:function|const) ${item.export}\\b`).test(kitSource)) failures.push(`v2 component inventory: missing canonical export ${item.export}`)
  const consumer = await readFile(resolve(workspaceRoot, item.consumer), "utf8").catch(() => "")
  if (!consumer.includes(item.export)) failures.push(`v2 component inventory: ${item.export} missing actual homepage consumer ${item.consumer}`)
  const v2GallerySource = await readFile(resolve(workspaceRoot, item.gallerySource), "utf8").catch(() => "")
  if (!v2GallerySource.includes(item.galleryNeedle ?? item.export)) failures.push(`v2 component inventory: ${item.export} missing /dev/site-ui-v2 example`)
}
for (const item of v2Inventory.foundations ?? []) {
  if (!new RegExp(`export (?:function|const) ${item.export}\\b`).test(kitSource)) failures.push(`v2 foundation inventory: missing export ${item.export}`)
  if (!item.sourceConsumer || !item.sourceNeedle) failures.push(`v2 foundation inventory: ${item.export} missing sourceConsumer/sourceNeedle`)
  const sourceConsumer = item.sourceConsumer ? await readFile(resolve(workspaceRoot, item.sourceConsumer), "utf8").catch(() => "") : ""
  if (item.sourceNeedle && !sourceConsumer.includes(item.sourceNeedle)) failures.push(`v2 foundation inventory: ${item.export} source pattern missing in ${item.sourceConsumer}`)
  const foundationGallerySource = await readFile(resolve(workspaceRoot, item.gallerySource), "utf8").catch(() => "")
  if (!foundationGallerySource.includes(item.export)) failures.push(`v2 foundation inventory: ${item.export} missing /dev/site-ui-v2 state gallery`)
}
for (const file of await filesUnder(sourceRoot)) {
  const source = await readFile(file, "utf8")
  const localPath = relative(sourceRoot, file)
  const isPresentationFile = /^(?:components|layouts|pages|react\/components|styles)\//.test(localPath)
  const checks = pixelVerifiedLegacyFiles.has(localPath) || !isPresentationFile
    ? boundaryChecks
    : [...boundaryChecks, ...visualChecks]
  for (const [pattern, message] of checks) {
    for (const match of source.matchAll(pattern)) {
      failures.push(`${localPath}:${lineAt(source, match.index)} ${message} (${match[0].trim()})`)
    }
  }
  const sectionKey = sectionContracts.get(localPath)
  if (sectionKey && !source.includes(`data-section-key="${sectionKey}"`)) {
    failures.push(`${localPath}:1 missing section registry marker data-section-key="${sectionKey}"`)
  }
}

const baseLayout = await readFile(resolve(sourceRoot, "layouts/BaseLayout.astro"), "utf8")
if (!baseLayout.includes("site-theme")) failures.push("layouts/BaseLayout.astro:1 missing site-theme root")

const globalStyles = await readFile(resolve(sourceRoot, "styles/global.css"), "utf8")
if (!globalStyles.includes('@source "../../../../packages/site-ui/src"')) {
  failures.push("styles/global.css:1 @crm/site-ui is missing from the Tailwind source graph")
}
if (/\[class\*=["']/.test(globalStyles)) {
  failures.push("styles/global.css:1 class-fragment styling selectors are forbidden; use an explicit @crm/site-ui variant")
}

const themeStyles = await readFile(resolve(kitRoot, "src/styles/theme.css"), "utf8")
if (!themeStyles.includes('@import "tw-animate-css"')) failures.push("packages/site-ui theme is missing the shared animation foundation")
if (!themeStyles.includes("@layer components")) failures.push("packages/site-ui components must use Tailwind's components layer so consumer utilities can override defaults")

for (const localPath of pageShellConsumers) {
  const source = await readFile(resolve(sourceRoot, localPath), "utf8")
  if (!source.includes("SitePageShell")) failures.push(`${localPath}:1 missing shared SitePageShell`)
}

for (const localPath of sharedSectionHeaderConsumers) {
  const source = await readFile(resolve(sourceRoot, localPath), "utf8")
  if (!source.includes("SiteSectionHeader")) failures.push(`${localPath}:1 missing shared SiteSectionHeader`)
}

const homepageComponents = await readFile(resolve(kitRoot, "src/components/homepage.tsx"), "utf8")
const astroSectionHeader = await readFile(resolve(kitRoot, "src/astro/SiteSectionHeader.astro"), "utf8")
for (const className of ["site-home-heading", "site-home-heading__eyebrow", "site-home-heading__title"]) {
  if (!homepageComponents.includes(className)) failures.push(`packages/site-ui React section header is missing semantic class ${className}`)
  if (!astroSectionHeader.includes(className)) failures.push(`packages/site-ui Astro section header is missing semantic class ${className}`)
}

if (failures.length > 0) {
  console.error("Public site UI architecture gate failed:\n" + failures.map((failure) => `- ${failure}`).join("\n"))
  process.exit(1)
}

console.log(`Public site UI architecture gate passed (${sectionContracts.size} registered sections).`)
