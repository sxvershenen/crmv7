import {
  CommentThread,
  EditorSection,
  EntityCombobox,
  FormField,
  Input,
  Textarea,
} from "@crm/ui"
import { useDirectoryCustomers } from "@app/features/use-directory-data"
import type { BookingEditorRecord } from "@app/entities/bookings"

export function BookingMain({
  draft,
  newComment,
  onAddComment,
  onCommentChange,
  update,
}: {
  draft: BookingEditorRecord;
  newComment: string;
  onAddComment: () => void;
  onCommentChange: (value: string) => void;
  update: <K extends keyof BookingEditorRecord>(
    key: K,
    value: BookingEditorRecord[K],
  ) => void;
}) {
  const customers = useDirectoryCustomers();
  const selectedCustomer = customers.find(
    (customer) =>
      customer.name === draft.clientName || customer.phone === draft.phone,
  );
  return (
    <div className="space-y-3">
      <EditorSection title="Основные данные">
        <div className="grid items-start gap-4 sm:grid-cols-6">
          <FormField
            className="sm:col-span-4"
            htmlFor="booking-client"
            label="Клиент"
          >
            <EntityCombobox
              label="Клиент бронирования"
              {...(selectedCustomer
                ? {
                    onOpenSelected: () => {
                      window.location.href = `/customers/${selectedCustomer.id}`;
                    },
                  }
                : {})}
              onValueChange={(customerId) => {
                const customer = customers.find(
                  (item) => item.id === customerId,
                );
                if (customer) {
                  update("clientName", customer.name);
                  update("phone", customer.phone);
                }
              }}
              options={customers.map((customer) => ({
                value: customer.id,
                label: customer.name,
                secondary: customer.phone,
              }))}
              placeholder={draft.clientName || "Выберите клиента"}
              value={selectedCustomer?.id ?? ""}
            />
          </FormField>
          <FormField
            className="sm:col-span-2"
            htmlFor="booking-phone"
            label="Телефон"
          >
            <Input
              id="booking-phone"
              inputMode="tel"
              onChange={(event) => update("phone", event.target.value)}
              value={draft.phone}
            />
          </FormField>
          <FormField
            className="sm:col-span-6"
            htmlFor="booking-message"
            label="Сообщение от клиента"
          >
            <Textarea
              id="booking-message"
              onChange={(event) => update("clientMessage", event.target.value)}
              placeholder="Сообщение отсутствует"
              value={draft.clientMessage}
            />
          </FormField>
        </div>
      </EditorSection>
      <EditorSection title="Комментарии менеджеров">
        <CommentThread
          comments={draft.comments}
          draft={newComment}
          onAdd={onAddComment}
          onDraftChange={onCommentChange}
        />
      </EditorSection>
    </div>
  );
}

