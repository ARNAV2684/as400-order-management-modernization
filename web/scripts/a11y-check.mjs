// Accessibility scan: axe-core (WCAG 2.1 A/AA + best practices) on every screen, light and dark.
// Drives the locally installed Microsoft Edge, so no browser download is needed.
//   npm run dev            (in another terminal)
//   npm run a11y           [BASE=http://localhost:5173]
import AxeBuilder from "@axe-core/playwright"
import { chromium } from "playwright-core"

const BASE = process.env.BASE ?? "http://localhost:5173"
const PAGES = [
  ["Dashboard", "/"],
  ["Orders", "/orders"],
  ["Orders · 5250 twin", "/orders?view=5250"],
  ["Order detail", "/orders/10001"],
  ["Order editor", "/orders/10002/edit"],
  ["New order", "/orders/new"],
  ["Customers", "/customers"],
  ["Customer detail", "/customers/2001"],
  ["New customer panel", "/customers?new=1"],
  ["Items", "/items"],
  ["Item detail", "/items/5004"],
  ["Audit log", "/audit"],
  ["System", "/system"],
]

const browser = await chromium.launch({ channel: "msedge", headless: true })
let total = 0

for (const scheme of ["light", "dark"]) {
  const context = await browser.newContext({ colorScheme: scheme, viewport: { width: 1366, height: 900 } })
  const page = await context.newPage()
  for (const [name, path] of PAGES) {
    await page.goto(BASE + path)
    await page.locator("main h1").first().waitFor({ timeout: 15_000 })
    await page.waitForLoadState("networkidle")
    await page.waitForTimeout(600) // let the API answer and entry animations finish
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"])
      .analyze()
    total += result.violations.length
    const tag = `${scheme.padEnd(5)} ${name}`
    if (result.violations.length === 0) {
      console.log(`ok    ${tag}`)
      continue
    }
    console.log(`FAIL  ${tag}`)
    for (const v of result.violations) {
      console.log(`      [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length})`)
      for (const n of v.nodes.slice(0, 3)) {
        console.log(`        - ${n.target.join(" ")}`)
        if (n.failureSummary)
          console.log(`          ${n.failureSummary.split("\n").slice(1, 3).join(" | ").trim()}`)
      }
    }
  }
  await context.close()
}

await browser.close()
console.log(total === 0 ? "\nNo accessibility violations." : `\n${total} violation group(s).`)
process.exit(total === 0 ? 0 : 1)
