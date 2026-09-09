import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react"
import { IconAlertTriangle, IconExternalLink, IconLock } from "@tabler/icons-react"

import { AuthUserResponseSchema, LoginRequestSchema, OkResponseSchema, SessionUserSchema, type AuthUserResponse, type SessionUser } from "@crm/contracts/auth"
import {
  Alert, AlertDescription, AlertTitle, Button, Card, CardContent, CardDescription, CardHeader, CardTitle,
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, FormField, Input,
} from "@crm/ui"

import { AdminAuthSessionContext } from "@admin/features/auth-session-context"
import { AdminApiError, ADMIN_AUTH_REQUIRED_EVENT, createAdminApiClient } from "@admin/lib/api-client"
import { cmsDataMode } from "@admin/lib/data-mode"

type AuthState =
  | { status: "loading" }
  | { status: "login"; error: string | null }
  | { status: "authenticated"; user: SessionUser }
  | { status: "reauth"; user: SessionUser; error: string | null }

const fixtureUser = SessionUserSchema.parse({
  id: "40ec463c-1bf9-4bc0-b6ed-6bbda633bd25",
  name: "Марина Кириллова",
  email: "marina@svistoplyasovo.local",
  role: "admin",
  capabilities: {
    canView: true, canCreate: true, canEdit: true, canDelete: true, canArchive: true,
    canAssign: true, canChangeStatus: true, canAddPayment: true, canRefund: true,
    canOverrideConflict: true, canViewFinance: true, canViewAudit: true,
    canManageUsers: true, canManageSettings: true,
    canViewContent: true, canEditContent: true, canReviewContent: true, canPublishContent: true,
    canManageSeo: true, canManageMedia: true, canViewAnalytics: true, canViewRawAnalytics: true,
    canManageSiteCode: true, canManageIntegrations: true, canManageRedirects: true, canManageSiteSettings: true,
  },
})

// Auth belongs to the CMS API surface too. The server mounts the same
// session authority under /api/admin/v1, so all CMS transport stays inside
// one namespace and one client configuration.
const adminClient = createAdminApiClient()

export function AdminAuthSessionProvider({ children }: { children: ReactNode }) {
  if (cmsDataMode === "fixtures") {
    return <AdminAuthSessionContext.Provider value={{ user: fixtureUser, logout: async () => undefined }}>{children}</AdminAuthSessionContext.Provider>
  }
  return <ApiAdminAuthSessionProvider>{children}</ApiAdminAuthSessionProvider>
}

function ApiAdminAuthSessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading" })

  const loadSession = useCallback(async () => {
    setState({ status: "loading" })
    try {
      const response = await adminClient.authGet("/auth/session", AuthUserResponseSchema)
      setState({ status: "authenticated", user: response.user })
    } catch (error) {
      const authenticationRequired = error instanceof AdminApiError && error.code === "AUTHENTICATION_REQUIRED"
      setState({ status: "login", error: authenticationRequired ? null : readableError(error, "Не удалось проверить сессию") })
    }
  }, [])

  useEffect(() => { void loadSession() }, [loadSession])
  useEffect(() => {
    const handleExpiry = () => setState((current) => {
      if (current.status === "authenticated") return { status: "reauth", user: current.user, error: "Сессия завершилась. Войдите снова, чтобы продолжить без потери черновика." }
      return current
    })
    window.addEventListener(ADMIN_AUTH_REQUIRED_EVENT, handleExpiry)
    return () => window.removeEventListener(ADMIN_AUTH_REQUIRED_EVENT, handleExpiry)
  }, [])

  if (state.status === "loading") return <AuthLoading />
  if (state.status === "login") {
    return <LoginScreen initialError={state.error} onAuthenticated={(response) => setState({ status: "authenticated", user: response.user })} />
  }

  const establishedUser = state.user
  const contextValue = {
    user: establishedUser,
    logout: async () => {
      try {
        await adminClient.authPost("/auth/logout", undefined, OkResponseSchema)
      } catch (error) {
        if (!(error instanceof AdminApiError) || error.code !== "AUTHENTICATION_REQUIRED") throw error
      }
      setState({ status: "login", error: null })
    },
  }

  if (establishedUser.capabilities.canViewContent !== true) {
    return <AdminAuthSessionContext.Provider value={contextValue}><AccessDenied onLogout={contextValue.logout} /></AdminAuthSessionContext.Provider>
  }

  return <AdminAuthSessionContext.Provider value={contextValue}>
    {children}
    {state.status === "reauth" ? <ReauthenticationDialog
      initialError={state.error}
      user={state.user}
      onAuthenticated={(response) => {
        if (response.user.id !== state.user.id) {
          window.location.reload()
          return
        }
        setState({ status: "authenticated", user: response.user })
      }}
    /> : null}
  </AdminAuthSessionContext.Provider>
}

function AuthLoading() {
  return <main className="grid min-h-screen place-items-center bg-surface-sunken p-5">
    <div aria-live="polite" className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
      <span className="size-2 animate-pulse rounded-full bg-primary" />
      Проверяем сессию CMS…
    </div>
  </main>
}

function LoginScreen({ initialError, onAuthenticated }: { initialError: string | null; onAuthenticated: (response: AuthUserResponse) => void }) {
  return <main className="grid min-h-screen place-items-center bg-surface-sunken p-4 sm:p-6">
    <Card className="w-full max-w-sm" size="sm">
      <CardHeader>
        <div className="mb-3 flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground"><IconLock aria-hidden="true" className="size-5" /></div>
        <CardTitle><h1>Вход в CMS</h1></CardTitle>
        <CardDescription>Контент, SEO и публикации сайта «Свистоплясово»</CardDescription>
      </CardHeader>
      <CardContent><LoginForm initialEmail={import.meta.env.DEV ? "admin@svistoplyasovo.local" : ""} initialError={initialError} onAuthenticated={onAuthenticated} /></CardContent>
    </Card>
  </main>
}

function ReauthenticationDialog({ initialError, onAuthenticated, user }: { initialError: string | null; onAuthenticated: (response: AuthUserResponse) => void; user: SessionUser }) {
  return <Dialog open>
    <DialogContent className="max-w-sm" showCloseButton={false}>
      <DialogHeader>
        <div className="mb-1 flex size-9 items-center justify-center rounded-lg bg-warning/15 text-warning-foreground"><IconLock aria-hidden="true" className="size-4" /></div>
        <DialogTitle>Сессия CMS завершилась</DialogTitle>
        <DialogDescription>Редактор и несохранённые изменения оставлены на месте. Войдите снова, чтобы продолжить.</DialogDescription>
      </DialogHeader>
      <LoginForm initialEmail={user.email ?? ""} initialError={initialError} onAuthenticated={onAuthenticated} />
    </DialogContent>
  </Dialog>
}

function LoginForm({ initialEmail, initialError, onAuthenticated }: { initialEmail: string; initialError: string | null; onAuthenticated: (response: AuthUserResponse) => void }) {
  const [email, setEmail] = useState(initialEmail)
  const [password, setPassword] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [requestError, setRequestError] = useState<string | null>(null)
  const [emailError, setEmailError] = useState<string | undefined>()
  const [passwordError, setPasswordError] = useState<string | undefined>()
  const passwordRef = useRef<HTMLInputElement>(null)
  const error = requestError ?? initialError

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setRequestError(null)
    setEmailError(undefined)
    setPasswordError(undefined)
    const parsed = LoginRequestSchema.safeParse({ email, password })
    if (!parsed.success) {
      const flattened = parsed.error.flatten().fieldErrors
      setEmailError(flattened.email?.[0])
      setPasswordError(flattened.password?.[0])
      return
    }
    setSubmitting(true)
    try {
      const response = await adminClient.authPost("/auth/login", parsed.data, AuthUserResponseSchema)
      setPassword("")
      onAuthenticated(response)
    } catch (loginError) {
      setPassword("")
      setRequestError(loginErrorMessage(loginError))
      requestAnimationFrame(() => passwordRef.current?.focus())
    } finally {
      setSubmitting(false)
    }
  }

  return <>
    {error ? <Alert aria-live="assertive" className="mb-4" id="cms-login-error" variant="destructive"><IconAlertTriangle aria-hidden="true" /><AlertTitle>Не удалось войти</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}
    <form className="space-y-4" onSubmit={(event) => { void submit(event) }}>
      <FormField error={emailError} htmlFor="cms-login-email" label="E-mail"><Input aria-describedby={error ? "cms-login-error" : undefined} aria-invalid={Boolean(emailError)} autoComplete="username" id="cms-login-email" name="email" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} /></FormField>
      <FormField error={passwordError} htmlFor="cms-login-password" label="Пароль"><Input ref={passwordRef} aria-describedby={error ? "cms-login-error" : undefined} aria-invalid={Boolean(passwordError || error)} autoComplete="current-password" autoFocus id="cms-login-password" name="password" onChange={(event) => setPassword(event.target.value)} required type="password" value={password} /></FormField>
      <Button className="w-full" disabled={submitting || !email || !password} type="submit">{submitting ? "Входим…" : "Войти"}</Button>
    </form>
  </>
}

function AccessDenied({ onLogout }: { onLogout: () => Promise<void> }) {
  const [error, setError] = useState<string | null>(null)
  return <main className="grid min-h-screen place-items-center bg-surface-sunken p-4 sm:p-6">
    <Card className="w-full max-w-sm" size="sm"><CardHeader><div className="mb-3 flex size-10 items-center justify-center rounded-lg bg-warning/15 text-warning-foreground"><IconLock aria-hidden="true" className="size-5" /></div><CardTitle><h1>Нет доступа к CMS</h1></CardTitle><CardDescription>Для этой учётной записи не выдано право просмотра контента.</CardDescription></CardHeader><CardContent className="space-y-3">{error ? <Alert variant="destructive"><IconAlertTriangle /><AlertDescription>{error}</AlertDescription></Alert> : null}<Button className="w-full" onClick={() => { window.location.href = "/crm" }} variant="outline"><IconExternalLink />Открыть CRM</Button><Button className="w-full" onClick={() => { setError(null); void onLogout().catch((logoutError) => setError(readableError(logoutError, "Не удалось завершить сессию"))) }}>Выйти</Button></CardContent></Card>
  </main>
}

function loginErrorMessage(error: unknown) {
  if (!(error instanceof AdminApiError)) return readableError(error, "Не удалось войти")
  if (error.rawCode === "INVALID_CREDENTIALS") return "Неверный e-mail или пароль."
  if (error.rawCode === "RATE_LIMITED") return error.message
  if (error.rawCode === "CSRF_REJECTED") return "Адрес CMS не разрешён сервером. Проверьте trusted origin в конфигурации."
  if (error.status === 0 || error.status >= 500) return "Сервер CMS недоступен. Проверьте соединение и повторите вход."
  return error.message
}

function readableError(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}
