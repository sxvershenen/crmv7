import type * as React from "react"
import { useState } from "react"
import { IconCash, IconExternalLink, IconRotateClockwise, IconX } from "@tabler/icons-react"
import { useNavigate } from "react-router-dom"
import {
  Button,
  ConfirmationDialog,
  DatePicker,
  EditorSection,
  FormField,
  FormSelect,
  Input,
  PaymentProgress,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@crm/ui"
import { bookingPaymentMethodLabels, type BookingEditorRecord, type BookingPaymentMethod } from "@app/entities/bookings"
import { inputNumber, money, paymentMethodOptions } from "./booking-editor-model.js"

export function PaymentEditor({
  booking,
  promoControl,
  onAdd,
  onCancelRefund,
  onRefund,
}: {
  booking: BookingEditorRecord;
  promoControl: React.ReactNode;
  onAdd: (
    amount: number,
    method: BookingPaymentMethod,
    date: string,
    comment: string,
  ) => void;
  onCancelRefund: (id: string) => void;
  onRefund: (id: string) => void;
}) {
  const navigate = useNavigate();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<BookingPaymentMethod>("card");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [comment, setComment] = useState("");
  const [refundTargetId, setRefundTargetId] = useState<string | null>(null);
  const refundTarget = booking.payments.find(
    (payment) => payment.id === refundTargetId,
  );
  const submit = () => {
    const value = inputNumber(amount);
    if (value <= 0) return;
    onAdd(value, method, date, comment);
    setAmount("");
    setComment("");
  };
  const debt = Math.abs(booking.amount - booking.paid);
  return (
    <EditorSection title="Оплата">
      <div className="space-y-4">
        <PaymentProgress
          className="w-full"
          paid={booking.paid}
          total={booking.amount}
        />
        <div className="grid grid-cols-2 gap-3 border-t pt-3 text-xs">
          <div>
            <span className="text-muted-foreground">{booking.paid > booking.amount ? "Переплата" : "Долг"}</span>
            <p className="mt-1 tabular-nums">{money.format(debt)}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Скидка по коду</span>
            <p className="mt-1 tabular-nums">{money.format((booking.promotion?.discountAmountMinor ?? 0) / 100)}</p>
          </div>
        </div>
        <div className="grid gap-3">
          {promoControl}
          <FormField htmlFor="payment-amount" label="Сумма">
            <Input
              id="payment-amount"
              min="0"
              onChange={(event) => setAmount(event.target.value)}
              placeholder="0"
              type="number"
              value={amount}
            />
          </FormField>
          <FormField htmlFor="payment-method" label="Способ оплаты">
            <FormSelect
              id="payment-method"
              label="Способ оплаты"
              onValueChange={(value) =>
                setMethod(value as BookingPaymentMethod)
              }
              options={paymentMethodOptions}
              value={method}
            />
          </FormField>
          <FormField htmlFor="payment-date" label="Дата">
            <DatePicker
              className="w-full max-w-none"
              density="form"
              id="payment-date"
              label="Дата оплаты"
              onValueChange={(next) =>
                next && setDate(next.toISOString().slice(0, 10))
              }
              value={new Date(`${date}T12:00:00`)}
            />
          </FormField>
          <FormField htmlFor="payment-comment" label="Комментарий">
            <Input
              id="payment-comment"
              onChange={(event) => setComment(event.target.value)}
              placeholder="Необязательно"
              value={comment}
            />
          </FormField>
          <Button
            disabled={inputNumber(amount) <= 0}
            onClick={submit}
            size="sm"
          >
            <IconCash aria-hidden="true" />
            Добавить оплату
          </Button>
        </div>
        {booking.payments.length ? (
          <div className="divide-y border-t">
            {booking.payments.map((payment) => {
              const refunded =
                payment.kind === "payment" &&
                booking.payments.some(
                  (item) =>
                    item.kind === "refund" &&
                    item.sourcePaymentId === payment.id,
                );
              return (
                <div
                  className="flex items-center gap-2 py-3 text-xs"
                  key={payment.id}
                >
                  <span
                    className={
                      payment.kind === "refund"
                        ? "text-danger-foreground"
                        : "text-success-foreground"
                    }
                  >
                    {payment.kind === "refund" ? "−" : "+"}
                  </span>
                  <Button
                    className="h-auto min-w-0 flex-1 justify-start rounded-none p-0 text-left"
                    onClick={() => navigate(`/bookings/${booking.id}`)}
                    variant="ghost"
                  >
                    <span className="min-w-0"><span className="block tabular-nums">
                      {money.format(payment.amount)}
                      {refunded ? (
                        <span className="ml-1.5 text-[10px] text-muted-foreground">
                          возвращено
                        </span>
                      ) : null}
                    </span>
                    <span className="block truncate text-[10px] text-muted-foreground">
                      {payment.dateLabel} ·{" "}
                      {bookingPaymentMethodLabels[payment.method]} · бронь #
                      {booking.id}
                      {payment.comment ? ` · ${payment.comment}` : ""}
                    </span></span>
                  </Button>
                  <Button
                    aria-label={`Открыть бронь #${booking.id}`}
                    onClick={() => navigate(`/bookings/${booking.id}`)}
                    size="icon-xs"
                    variant="ghost"
                  >
                    <IconExternalLink aria-hidden="true" />
                  </Button>
                  {payment.kind === "payment" ? (
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <Button
                            aria-label={`Оформить возврат ${money.format(payment.amount)}`}
                            disabled={refunded}
                            onClick={() => setRefundTargetId(payment.id)}
                            size="icon-xs"
                            variant="ghost"
                          />
                        }
                      >
                        <IconRotateClockwise aria-hidden="true" />
                      </TooltipTrigger>
                      <TooltipContent>
                        {refunded ? "Возврат уже оформлен" : "Оформить возврат"}
                      </TooltipContent>
                    </Tooltip>
                  ) : payment.id.startsWith("refund-") ? (
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <Button
                            aria-label={`Отменить возврат ${money.format(payment.amount)}`}
                            onClick={() => onCancelRefund(payment.id)}
                            size="icon-xs"
                            variant="ghost"
                          />
                        }
                      >
                        <IconX aria-hidden="true" />
                      </TooltipTrigger>
                      <TooltipContent>Отменить возврат</TooltipContent>
                    </Tooltip>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="border-t pt-3 text-center text-[11px] text-muted-foreground">
            Операций пока нет
          </p>
        )}
      </div>
      <ConfirmationDialog
        confirmLabel="Оформить возврат"
        description={`Вернуть ${money.format(refundTarget?.amount ?? 0)} по этой операции? Оплаченная сумма брони уменьшится на размер возврата.`}
        destructive
        onConfirm={() => refundTargetId && onRefund(refundTargetId)}
        onOpenChange={(open) => {
          if (!open) setRefundTargetId(null);
        }}
        open={refundTargetId !== null}
        title="Подтвердить возврат"
      />
    </EditorSection>
  );
}

