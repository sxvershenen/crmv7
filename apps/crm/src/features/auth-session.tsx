import { useMemo, useState, type FormEvent, type ReactNode } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { IconAlertTriangle, IconLock } from "@tabler/icons-react"
import { z } from "zod"

import { LoginRequestSchema, SessionUserSchema } from "@crm/contracts"
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  FormField,
  Input,
} from "@crm/ui"

import { ApiClientError, apiClient } from "@app/lib/api-client"
import { AuthSessionContext, type AuthSessionContextValue } from "@app/features/auth-session-context"

const AuthUserResponseSchema = z.object({ user: SessionUserSchema }).strict()
const authSessionKey = ["auth", "session"] as const
const fixtureMode = import.meta.env.VITE_DATA_MODE === "fixtures"

const fixtureSessionUser = SessionUserSchema.parse({
  id: "40ec463c-1bf9-4bc0-b6ed-6bbda633bd25",
  name: "Марина Кириллова",
  role: "admin",
  capabilities: {
    canView: true, canCreate: true, canEdit: true, canDelete: true, canArchive: true,
    canAssign: true, canChangeStatus: true, canAddPayment: true, canRefund: true,
    canOverrideConflict: true, canViewFinance: true, canViewAudit: true,
    canManageUsers: true, canManageSettings: true,
  },
})

export function AuthSessionProvider({ children }: { children: ReactNode }) {
  if (fixtureMode) {
    const value: AuthSessionContextValue = { logout: async () => undefined, user: fixtureSessionUser }
    return <AuthSessionContext.Provider value={value}>{children}</AuthSessionContext.Provider>
  }
  return <ApiAuthSessionProvider>{children}</ApiAuthSessionProvider>
}

function ApiAuthSessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [showLogin, setShowLogin] = useState(false)
  const session = useQuery({
    queryKey: authSessionKey,
    queryFn: () => apiClient.get("/auth/session", AuthUserResponseSchema),
    retry: false,
  })
  const logout = useMutation({
    mutationFn: () => apiClient.post("/auth/logout", undefined, z.object({ ok: z.literal(true) }).strict()),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: authSessionKey })
      setShowLogin(true)
    },
  })

  if (session.isPending) return <AuthLoading />
  if (session.isError || showLogin) {
    const authenticationRequired = session.error instanceof ApiClientError && session.error.code === "AUTHENTICATION_REQUIRED"
    return <LoginScreen
      initialError={showLogin || authenticationRequired ? null : session.error instanceof Error ? session.error.message : "Не удалось проверить сессию"}
      onAuthenticated={(response) => {
        queryClient.setQueryData(authSessionKey, response)
        setShowLogin(false)
      }}
    />
  }

  const value: AuthSessionContextValue = {
    logout: async () => { await logout.mutateAsync() },
    user: session.data.user,
  }
  return <AuthSessionContext.Provider value={value}>{children}</AuthSessionContext.Provider>
}

function AuthLoading() {
  return <main className="grid min-h-screen place-items-center bg-surface-sunken p-5">
    <div aria-live="polite" className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
      <span className="size-2 animate-pulse rounded-full bg-primary" />
      Проверяем сессию…
    </div>
  </main>
}

function LoginScreen({ initialError, onAuthenticated }: { initialError: string | null; onAuthenticated: (response: z.infer<typeof AuthUserResponseSchema>) => void }) {
  const [email, setEmail] = useState("admin@svistoplyasovo.local")
  const [password, setPassword] = useState("")
  const login = useMutation({
    mutationFn: () => {
      const input = LoginRequestSchema.parse({ email, password })
      return apiClient.post("/auth/login", input, AuthUserResponseSchema)
    },
    onSuccess: onAuthenticated,
  })
  const error = useMemo(() => {
    if (login.error instanceof Error) return login.error.message
    return initialError
  }, [initialError, login.error])
  const submit = (event: FormEvent) => {
    event.preventDefault()
    login.mutate()
  }

  return <main className="grid min-h-screen place-items-center bg-surface-sunken p-4 sm:p-6">
    <Card className="w-full max-w-sm" size="sm">
      <CardHeader>
        <div className="mb-3 flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <IconLock aria-hidden="true" className="size-5" />
        </div>
        <CardTitle><h1>Вход в CRM</h1></CardTitle>
        <CardDescription>Внутренняя система «Свистоплясово»</CardDescription>
      </CardHeader>
      <CardContent>
        {error ? <Alert variant="destructive"><IconAlertTriangle aria-hidden="true" /><AlertTitle>Не удалось войти</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}
        <form className="space-y-4" onSubmit={submit}>
          <FormField htmlFor="login-email" label="E-mail">
            <Input autoComplete="username" id="login-email" name="email" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} />
          </FormField>
          <FormField htmlFor="login-password" label="Пароль">
            <Input autoComplete="current-password" autoFocus id="login-password" name="password" onChange={(event) => setPassword(event.target.value)} required type="password" value={password} />
          </FormField>
          <Button className="w-full" disabled={login.isPending || !email || !password} type="submit">
            {login.isPending ? "Входим…" : "Войти"}
          </Button>
        </form>
      </CardContent>
    </Card>
  </main>
}
