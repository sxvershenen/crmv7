import { useNavigate } from "react-router-dom"
import { IconLink, IconUsers } from "@tabler/icons-react"
import {
  AssigneePicker,
  Button,
  EditorSection,
  Input,
  ListRow,
  OperationalSummary,
  type Assignee,
} from "@crm/ui"
import { ManualRelationPicker } from "@app/components/shared/manual-relation-picker"
import {
  EditorMarketingAttribution,
  EditorPreviewCommunications,
  EditorPreviewHistory,
  EditorPreviewTasks,
  EditorPreviewVisits,
} from "@app/components/shared/editor-preview-tabs"
import { useDirectoryAssignees, useDirectoryBookings, useDirectoryLeads } from "@app/features/use-directory-data"
import type { BookingLeadLink } from "@crm/contracts"
import type { BookingEditorRecord, BookingPaymentMethod } from "@app/entities/bookings"
import type { MarketingAttributionDraft } from "@app/components/shared/editor-preview-data"
import { getLeadRelationOptions, money, type BookingEditorTab } from "./booking-editor-model.js"
import { PaymentEditor } from "./booking-payment-editor.js"

export function BookingMarketing({
  draft,
  updateMarketing,
}: {
  draft: BookingEditorRecord;
  updateMarketing: <K extends keyof MarketingAttributionDraft>(
    key: K,
    value: MarketingAttributionDraft[K],
  ) => void;
}) {
  return (
    <EditorMarketingAttribution
      idPrefix="booking-marketing"
      onChange={updateMarketing}
      value={draft.marketing}
    />
  );
}

export function BookingRelatedTab({
  draft,
  leadHistory,
  tab,
}: {
  draft: BookingEditorRecord;
  leadHistory:
    | { status: "idle" | "loading" }
    | { status: "ready"; items: BookingLeadLink[] }
    | { status: "error"; message: string };
  tab: Exclude<BookingEditorTab, "main" | "composition" | "marketing">;
}) {
  if (tab === "communications")
    return <EditorPreviewCommunications phone={draft.phone} />;
  if (tab === "tasks")
    return <EditorPreviewTasks relationLabel={`Бронирование #${draft.id}`} />;
  if (tab === "visits")
    return <EditorPreviewVisits clientName={draft.clientName} />;
  return <div className="space-y-3">
    <EditorSection title="История связи с заявкой">
      {leadHistory.status === "idle" || leadHistory.status === "loading" ? <p className="text-sm text-muted-foreground">Загрузка истории…</p> : null}
      {leadHistory.status === "error" ? <p role="alert" className="text-sm text-destructive">{leadHistory.message}</p> : null}
      {leadHistory.status === "ready" && leadHistory.items.length === 0 ? <p className="text-sm text-muted-foreground">Связей с заявками ещё не было.</p> : null}
      {leadHistory.status === "ready" && leadHistory.items.length > 0 ? <div className="divide-y">
        {leadHistory.items.map((item) => <div className="grid gap-1 py-2 text-sm" key={item.id}>
          <span>Заявка #{item.leadId} · {item.method === "from_lead" ? "создание из заявки" : "ручная связь"}</span>
          <span className="text-xs text-muted-foreground">{new Date(item.linkedAt).toLocaleString("ru-RU")}{item.unlinkedAt ? ` · отвязана ${new Date(item.unlinkedAt).toLocaleString("ru-RU")}` : " · активна"}</span>
        </div>)}
      </div> : null}
    </EditorSection>
    <EditorPreviewHistory entityLabel="Бронь" />
  </div>;
}

export function BookingSidebar({
  draft,
  onAddPayment,
  onAssigneeChange,
  onAssigneesChange,
  onCancelRefund,
  onPromoChange,
  onApplyPromo,
  promoPending,
  relationPending,
  onRefund,
  onSourceLeadChange,
}: {
  draft: BookingEditorRecord;
  onAddPayment: (
    amount: number,
    method: BookingPaymentMethod,
    date: string,
    comment: string,
  ) => void;
  onAssigneeChange: (person: Assignee | null) => void;
  onAssigneesChange: (people: Assignee[]) => void;
  onCancelRefund: (id: string) => void;
  onPromoChange: (value: string) => void;
  onApplyPromo?: (() => void) | undefined;
  promoPending: boolean;
  relationPending: boolean;
  onRefund: (id: string) => void;
  onSourceLeadChange: (leadId: string | null) => void;
}) {
  const navigate = useNavigate();
  const bookingAssignees = useDirectoryAssignees("booking");
  const leads = useDirectoryLeads();
  const bookings = useDirectoryBookings();
  const promoReadonly = Boolean(draft.lifecycleStatus && !["draft", "unconfirmed"].includes(draft.lifecycleStatus));
  return (
    <div className="space-y-3">
      <OperationalSummary
        details={<>
          <ListRow>
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="text-xs text-muted-foreground">
                Ответственные
              </span>
              <AssigneePicker
                label="Сменить ответственного бронирования в сводке"
                onPeopleChange={onAssigneesChange}
                onValueChange={onAssigneeChange}
                options={bookingAssignees}
                people={draft.assignees}
              />
            </div>
          </ListRow>
          <ListRow>
            <div className="grid gap-2 px-4 py-3">
              <div className="flex items-center gap-2 text-xs">
                <IconLink
                  aria-hidden="true"
                  className="size-3.5 text-muted-foreground"
                />
                <span className="text-muted-foreground">Исходная заявка</span>
              </div>
              <ManualRelationPicker
                addLabel="Связать с заявкой"
                disabled={relationPending}
                emptyLabel="Не привязана"
                label="Найти и связать заявку"
                onOpen={(href) => navigate(href)}
                onValuesChange={(values) =>
                  onSourceLeadChange(values[0] ?? null)
                }
                options={getLeadRelationOptions(draft, leads, bookings)}
                values={draft.sourceLeadId ? [draft.sourceLeadId] : []}
              />
            </div>
          </ListRow>
        </>}
        detailsCount={2}
        icon={IconUsers}
        tone="stay"
      />
      <PaymentEditor
        booking={draft}
        promoControl={<div className="grid gap-2 border-t pt-3">
              <span className="text-xs font-medium">Промокод</span>
              <Input
                aria-label="Промокод бронирования"
                disabled={promoReadonly || promoPending}
                onChange={(event) => onPromoChange(event.target.value)}
                value={draft.promo === "Без промокода" ? "" : draft.promo}
                placeholder="Например, SUMMER10"
              />
              {onApplyPromo ? <>
                <div className="flex gap-2">
                  <Button disabled={promoReadonly || promoPending || !draft.promo.trim() || Boolean(draft.promotion)} onClick={onApplyPromo} size="sm" variant="outline">{promoPending ? "Проверяем…" : "Применить"}</Button>
                  {draft.promo ? <Button disabled={promoReadonly || promoPending} onClick={() => onPromoChange("")} size="sm" variant="ghost">Убрать код</Button> : null}
                </div>
                <p className="text-xs text-muted-foreground" aria-live="polite">{draft.promotion ? `Скидка по коду: −${money.format(draft.promotion.discountAmountMinor / 100)}. Итого: ${money.format(draft.amount)}` : draft.promo ? "Проверьте код для текущего состава перед сохранением. С ручной скидкой не суммируется." : "Скидка применяется только после проверки кода."}</p>
              </> : <p className="text-xs text-muted-foreground">Проверка промокодов недоступна в демонстрационном режиме.</p>}
            </div>}
        onAdd={onAddPayment}
        onCancelRefund={onCancelRefund}
        onRefund={onRefund}
      />
    </div>
  );
}
