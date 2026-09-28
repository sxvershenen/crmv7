import { useState, type FormEvent } from "react"
import { IconAlertTriangle, IconLock } from "@tabler/icons-react"
import { InvitationAcceptedSchema, InvitationTokenSchema } from "@crm/contracts"
import { Alert, AlertDescription, AlertTitle, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, FormField, Input } from "@crm/ui"
import { apiClient } from "@app/lib/api-client"

export function InvitationPage() {
  const token = window.location.hash.slice(1)
  const validToken = InvitationTokenSchema.safeParse(token).success
  const [password, setPassword] = useState("")
  const [confirmation, setConfirmation] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string>()
  const [email, setEmail] = useState<string>()

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!validToken || pending) return
    if (password !== confirmation) { setError("Пароли не совпадают"); return }
    setPending(true)
    setError(undefined)
    try {
      const result = await apiClient.post("auth/invitations/accept", { token, password }, InvitationAcceptedSchema)
      window.history.replaceState(null, "", "/invite")
      try { window.sessionStorage.setItem("crm-invitation-email", result.email) }
      catch { /* The invitation remains valid even if browser storage is unavailable. */ }
      setEmail(result.email)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось принять приглашение")
    } finally { setPending(false) }
  }

  return <main className="grid min-h-screen place-items-center bg-surface-sunken p-4 sm:p-6"><Card className="w-full max-w-sm" size="sm"><CardHeader><div className="mb-3 flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground"><IconLock aria-hidden="true" className="size-5" /></div><CardTitle><h1>Приглашение в CRM</h1></CardTitle><CardDescription>Создайте пароль для входа в команду «Свистоплясово».</CardDescription></CardHeader><CardContent>
    {email ? <div className="space-y-4 text-sm"><p>Доступ для {email} активирован.</p><Button render={<a href="/" />} className="w-full">Войти в CRM</Button></div> : !validToken ? <Alert variant="destructive"><IconAlertTriangle aria-hidden="true" /><AlertTitle>Ссылка недействительна</AlertTitle><AlertDescription>Попросите администратора выдать новую ссылку-приглашение.</AlertDescription></Alert> : <form className="space-y-4" onSubmit={(event) => void submit(event)}>
      {error && <Alert variant="destructive"><IconAlertTriangle aria-hidden="true" /><AlertTitle>Не удалось принять приглашение</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
      <FormField htmlFor="invitation-password" label="Новый пароль"><Input autoComplete="new-password" id="invitation-password" minLength={12} onChange={(event) => setPassword(event.target.value)} required type="password" value={password} /></FormField>
      <FormField htmlFor="invitation-confirmation" label="Повторите пароль"><Input autoComplete="new-password" id="invitation-confirmation" minLength={12} onChange={(event) => setConfirmation(event.target.value)} required type="password" value={confirmation} /></FormField>
      <p className="text-xs text-muted-foreground">Не менее 12 символов. Ссылка работает один раз.</p>
      <Button className="w-full" disabled={pending || password.length < 12 || confirmation.length < 12} type="submit">{pending ? "Активируем…" : "Создать доступ"}</Button>
    </form>}
  </CardContent></Card></main>
}
