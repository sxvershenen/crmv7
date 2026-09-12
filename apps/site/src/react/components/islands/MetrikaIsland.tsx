import { useEffect } from "react"

import { ANALYTICS_CONSENT_CHANGED_EVENT, type AnalyticsConsentChangedDetail, getAnalyticsConsentState } from "../../../lib/analytics-client"

const METRIKA_SCRIPT_ID = "yandex-metrika-tag"
const METRIKA_SCRIPT_SRC = "https://mc.yandex.ru/metrika/tag.js"
const COUNTER_ID_PATTERN = /^\d{1,20}$/

type MetrikaSettings = {
  enabled: boolean
  counterId: string | null
}

type MetrikaCounter = {
  destruct?: () => void
  hit?: (url: string) => void
}

type MetrikaNamespace = {
  Metrika2?: new (options: Record<string, unknown>) => MetrikaCounter
}

export function MetrikaIsland({ metrika }: { metrika: MetrikaSettings }) {
  useEffect(() => {
    const counterId = metrika.counterId
    if (!metrika.enabled || !counterId || !COUNTER_ID_PATTERN.test(counterId)) return undefined

    let mounted = true
    let counter: MetrikaCounter | null = null
    const disableKey = `disableYaCounter${counterId}`
    const browser = window as unknown as Window & { Ya?: MetrikaNamespace } & Record<string, unknown>

    const stop = () => {
      browser[disableKey] = true
      try { counter?.destruct?.() } catch { /* Metrika must not affect site UX. */ }
      counter = null
    }

    const start = () => {
      if (!mounted || getAnalyticsConsentState() !== "analytics" || counter) return
      const Constructor = browser.Ya?.Metrika2
      if (!Constructor) return

      browser[disableKey] = false
      try {
        counter = new Constructor({
          id: Number(counterId),
          clickmap: false,
          trackLinks: false,
          accurateTrackBounce: false,
          webvisor: false,
          sendTitle: false,
          trackHash: false,
          ecommerce: false,
          defer: true,
        })
        counter.hit?.(`${window.location.origin}${window.location.pathname}`)
      } catch {
        counter = null
      }
    }

    let script = document.getElementById(METRIKA_SCRIPT_ID) as HTMLScriptElement | null
    const handleScriptLoad = () => start()
    const ensureScript = () => {
      if (!mounted || getAnalyticsConsentState() !== "analytics") return
      if (!script) {
        script = document.createElement("script")
        script.id = METRIKA_SCRIPT_ID
        script.async = true
        script.src = METRIKA_SCRIPT_SRC
        script.addEventListener("load", handleScriptLoad, { once: true })
        document.head.appendChild(script)
      } else if (browser.Ya?.Metrika2) {
        start()
      } else {
        script.addEventListener("load", handleScriptLoad, { once: true })
      }
    }

    const handleConsentChanged = (event: Event) => {
      const { state } = (event as CustomEvent<AnalyticsConsentChangedDetail>).detail
      if (state === "analytics") ensureScript()
      else stop()
    }
    window.addEventListener(ANALYTICS_CONSENT_CHANGED_EVENT, handleConsentChanged)
    ensureScript()

    return () => {
      mounted = false
      window.removeEventListener(ANALYTICS_CONSENT_CHANGED_EVENT, handleConsentChanged)
      script?.removeEventListener("load", handleScriptLoad)
      stop()
    }
  }, [metrika.counterId, metrika.enabled])

  return null
}

export default MetrikaIsland
