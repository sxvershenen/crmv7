import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { bookingPriceKey } from "@app/lib/booking-pricing";
import { IconAlertTriangle } from "@tabler/icons-react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

import {
  AssigneePicker,
  Button,
  EditorFrame,
  FilterSelect,
  PageNav,
  PageState,
  Skeleton,
  type Assignee,
  type CommentThreadItem,
  type EditorSaveState,
} from "@crm/ui";

import { useEditorLayoutChrome } from "@app/app/editor-layout-context";
import {
  type MarketingAttributionDraft,
} from "@app/components/shared/editor-preview-data";
import {
  bookingRepository,
  type BookingEditorRepository,
} from "@app/data/bookings-repository";
import { ApiClientError } from "@app/lib/api-client";
import { houseOfferingGateway } from "@app/data/house-offerings-repository";
import type { BookingLeadLink } from "@crm/contracts";
import type {
  BookingEditorPosition,
  BookingEditorRecord,
  BookingPaymentMethod,
  BookingStatus,
} from "@app/entities/bookings";
import { useDirectoryData } from "@app/features/use-directory-data";
import { BookingComposition } from "./booking-editor-composition.js";
import { BookingMain } from "./booking-editor-main.js";
import {
  BookingOverflow,
  BookingMobileActions,
} from "./booking-editor-mobile-actions.js";
import {
  BookingMarketing,
  BookingRelatedTab,
  BookingSidebar,
} from "./booking-editor-sidebar.js";
import {
  PRICE_PENDING_MESSAGE,
  bookingMutationMessage,
  createEmptyBooking,
  createPosition,
  dateLabel,
  isStayCategory,
  isUuid,
  oneOf,
  statusOptions,
  tabs,
  tabItems,
  withPositions,
  type BookingEditorTab,
  type ResourceStayQuoteGateway,
} from "./booking-editor-model.js";

export type { ResourceStayQuoteGateway } from "./booking-editor-model.js";

export function BookingEditorPage({
  repository = bookingRepository,
  pricingGateway = houseOfferingGateway,
}: {
  repository?: BookingEditorRepository;
  pricingGateway?: ResourceStayQuoteGateway;
}) {
  const { data: directory, error: directoryError } = useDirectoryData();
  const bookingAssignees = directory?.assignees.booking ?? [];
  const navigate = useNavigate();
  const { id = "new" } = useParams();
  const [params, setParams] = useSearchParams();
  const createParamsRef = useRef(params);
  const tab = oneOf(params.get("tab"), tabs, "main");
  const [draft, setDraft] = useState<BookingEditorRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<EditorSaveState>("saved");
  const [newComment, setNewComment] = useState("");
  const [promoPending, setPromoPending] = useState(false);
  const [relationPending, setRelationPending] = useState(false);
  const [leadHistoryRevision, setLeadHistoryRevision] = useState(0);
  const [leadHistory, setLeadHistory] = useState<
    | { status: "idle" | "loading" }
    | { status: "ready"; items: BookingLeadLink[] }
    | { status: "error"; message: string }
  >({ status: "idle" });
  const [mutationError, setMutationError] = useState<string | null>(null);
  const currentDraft = useRef(draft);
  currentDraft.current = draft;

  useEffect(() => {
    if (!directory) return;
    let active = true;
    setLoading(true);
    setError(null);
    if (id === "new") {
      setDraft(createEmptyBooking(createParamsRef.current, directory));
      setLoading(false);
      return () => {
        active = false;
      };
    }
    repository
      .get(id)
      .then((booking) => {
        if (!active) return;
        if (!booking) {
          setError("Бронирование не найдено");
          setLoading(false);
          return;
        }
        setDraft(booking);
        setLoading(false);
      })
      .catch((reason: unknown) => {
        if (active) {
          setError(
            reason instanceof Error
              ? reason.message
              : "Не удалось загрузить бронирование",
          );
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [directory, id, repository]);

  useEffect(() => {
    if (directoryError) { setError(directoryError); setLoading(false); }
  }, [directoryError]);

  useEffect(() => {
    if (tab !== "history") return;
    if (id === "new" || !repository.leadLinkHistory) {
      setLeadHistory({ status: "ready", items: [] });
      return;
    }
    let active = true;
    setLeadHistory({ status: "loading" });
    repository.leadLinkHistory(id).then(({ items }) => {
      if (active) setLeadHistory({ status: "ready", items });
    }).catch((reason: unknown) => {
      if (active) setLeadHistory({ status: "error", message: bookingMutationMessage(reason, "Не удалось загрузить историю связей") });
    });
    return () => { active = false; };
  }, [id, leadHistoryRevision, repository, tab]);

  const update = useCallback(
    <K extends keyof BookingEditorRecord>(
      key: K,
      value: BookingEditorRecord[K],
    ) => {
      setDraft((current) => (current ? { ...current, [key]: value } : current));
      setSaveState("dirty");
    },
    [],
  );
  const updateMarketing = useCallback(
    <K extends keyof MarketingAttributionDraft>(
      key: K,
      value: MarketingAttributionDraft[K],
    ) => {
      setDraft((current) =>
        current
          ? {
              ...current,
              marketing: { ...current.marketing, [key]: value },
              ...(key === "source" ? { source: value } : {}),
              ...(key === "utmSource" ? { utm: value } : {}),
            }
          : current,
      );
      setSaveState("dirty");
    },
    [],
  );
  const setStatus = useCallback(
    (status: BookingStatus) => update("status", status),
    [update],
  );
  const setAssignee = useCallback(
    (person: Assignee | null) => update("assignees", person ? [person] : []),
    [update],
  );
  const updatePosition = useCallback(
    <K extends keyof BookingEditorPosition>(
      positionId: string,
      key: K,
      value: BookingEditorPosition[K],
    ) => {
      setDraft((current) => {
        if (!current) return current;
        const positions = current.positions.map((position) => {
          if (position.id !== positionId) return position;
          const next = { ...position, [key]: value };
          if (key === "basePrice" || key === "discount")
            next.total = (Math.round(next.basePrice * 100) - Math.round(Math.round(next.basePrice * 100) * Math.min(100, Math.max(0, next.discount)) / 100)) / 100;
          return next;
        });
        return withPositions(current, positions);
      });
      setSaveState("dirty");
    },
    [],
  );
  const changeResource = useCallback(
    (positionId: string, resourceId: string) => {
      const resource = directory?.resources.find(
        (item) => item.id === resourceId,
      );
      if (!resource) return;
      setDraft((current) =>
        current
          ? withPositions(
              current,
              current.positions.map((position) =>
                position.id === positionId
                  ? {
                      ...position,
                      category: resource.category,
                      resourceId,
                      resourceName: resource.name,
                      addOns: [],
                      quoteSnapshotId: null,
                    }
                  : position,
              ),
            )
          : current,
      );
      setSaveState("dirty");
    },
    [directory],
  );
  const addPosition = useCallback(() => {
    setDraft((current) =>
      current
        ? withPositions(current, [
            ...current.positions,
            createPosition(directory!.resources, current.resourceId, current.date, current.startHour),
          ])
        : current,
    );
    setSaveState("dirty");
  }, [directory]);
  const duplicatePosition = useCallback((position: BookingEditorPosition) => {
    setDraft((current) =>
      current
        ? withPositions(current, current.positions.flatMap((item) => item.id === position.id
            ? [item, { ...position, id: `position-${crypto.randomUUID()}-copy`, quoteSnapshotId: null, calculatedInputKey: null }]
            : [item]))
        : current,
    );
    setSaveState("dirty");
  }, []);
  const deletePosition = useCallback((positionId: string) => {
    setDraft((current) =>
      current
        ? withPositions(
            current,
            current.positions.filter((position) => position.id !== positionId),
          )
        : current,
    );
    setSaveState("dirty");
  }, []);
  const addComment = useCallback(() => {
    const text = newComment.trim();
    if (!text) return;
    const comment: CommentThreadItem = {
      author: "Марина Кириллова",
      createdLabel: "Только что",
      id: `comment-${Date.now()}`,
      text,
    };
    setDraft((current) =>
      current
        ? { ...current, comments: [comment, ...current.comments] }
        : current,
    );
    setNewComment("");
    setSaveState("dirty");
  }, [newComment]);
  const addPayment = useCallback(
    (
      amount: number,
      method: BookingPaymentMethod,
      date: string,
      comment: string,
    ) => {
      if (amount <= 0) return;
      setDraft((current) =>
        current
          ? {
              ...current,
              paid: current.paid + amount,
              payments: [
                {
                  amount,
                  assignee: current.assignees[0] ?? null,
                  comment,
                  date,
                  dateLabel: dateLabel(date),
                  id: `payment-${Date.now()}`,
                  kind: "payment",
                  method,
                },
                ...current.payments,
              ],
            }
          : current,
      );
      setSaveState("dirty");
    },
    [],
  );
  const refundPayment = useCallback((paymentId: string) => {
    setDraft((current) => {
      if (!current) return current;
      const payment = current.payments.find((item) => item.id === paymentId);
      const alreadyRefunded = current.payments.some(
        (item) => item.kind === "refund" && item.sourcePaymentId === paymentId,
      );
      if (!payment || payment.kind === "refund" || alreadyRefunded)
        return current;
      return {
        ...current,
        paid: Math.max(0, current.paid - payment.amount),
        payments: [
          {
            ...payment,
            date: new Date().toISOString().slice(0, 10),
            dateLabel: "Сегодня",
            id: `refund-${Date.now()}`,
            kind: "refund",
            sourcePaymentId: payment.id,
          },
          ...current.payments,
        ],
      };
    });
    setSaveState("dirty");
  }, []);
  const cancelRefund = useCallback((refundId: string) => {
    setDraft((current) => {
      if (!current) return current;
      const refund = current.payments.find(
        (item) => item.id === refundId && item.kind === "refund",
      );
      if (!refund || !refund.id.startsWith("refund-")) return current;
      return {
        ...current,
        paid: current.paid + refund.amount,
        payments: current.payments.filter((item) => item.id !== refundId),
      };
    });
    setSaveState("dirty");
  }, []);
  const pricePending = Boolean(draft?.positions.some(position => isUuid(position.resourceId) && isStayCategory(position.category) &&
    (id === "new" || Boolean(position.addOns?.length) || position.calculatedInputKey != null) && position.calculatedInputKey !== bookingPriceKey(position)));
  useEffect(() => {
    if (!pricePending) setMutationError((current) => current === PRICE_PENDING_MESSAGE ? null : current);
  }, [pricePending]);
  const showPendingPrice = () => {
    setMutationError(PRICE_PENDING_MESSAGE);
    setParams((current) => {
      const next = new URLSearchParams(current);
      next.set("tab", "composition");
      return next;
    });
  };
  const applyPromo = async () => {
    if (!draft || !repository.previewPromotion) return;
    if (pricePending) { showPendingPrice(); return; }
    const input = draft;
    setPromoPending(true);
    setMutationError(null);
    try {
      const result = await repository.previewPromotion(input);
      if (currentDraft.current?.promo !== input.promo || JSON.stringify(currentDraft.current.positions) !== JSON.stringify(input.positions)) return;
      setDraft(current => current ? { ...current, promotion: result.promotion, promo: result.promotion.code, amount: result.total.amountMinor / 100 } : current);
      setSaveState("dirty");
    } catch (reason) { setMutationError(bookingMutationMessage(reason, "Не удалось применить промокод")); }
    finally { setPromoPending(false); }
  };
  const changePromo = (promo: string) => {
    setDraft(current => current ? { ...current, promo, promotion: null, amount: current.positions.reduce((sum, position) => sum + position.total, 0) } : current);
    setSaveState("dirty");
    setMutationError(null);
  };
  const changeSourceLead = async (sourceLeadId: string | null) => {
    const current = currentDraft.current;
    if (!current || current.sourceLeadId === sourceLeadId) return;
    if (current.id === "new") {
      update("sourceLeadId", sourceLeadId);
      return;
    }
    if (current.version === undefined || !repository.linkLead || !repository.unlinkLead) {
      setMutationError("Изменение связи с заявкой недоступно.");
      return;
    }
    setRelationPending(true);
    setMutationError(null);
    try {
      const result = sourceLeadId
        ? await repository.linkLead(current.id, sourceLeadId, current.version, "manual")
        : await repository.unlinkLead(current.id, current.version);
      setDraft((latest) => latest ? {
        ...latest,
        sourceLeadId: result.link?.leadId ?? null,
        version: result.bookingVersion,
      } : latest);
      setLeadHistory({ status: "idle" });
      setLeadHistoryRevision((revision) => revision + 1);
    } catch (reason) {
      if (reason instanceof ApiClientError && reason.isConflict) setSaveState("conflict");
      setMutationError(bookingMutationMessage(reason, "Не удалось изменить связь с заявкой"));
    } finally {
      setRelationPending(false);
    }
  };
  const save = async () => {
    if (!draft) return;
    if (pricePending) { showPendingPrice(); return; }
    if (draft.positions.some((position) => position.addOns?.length && position.discount !== 0)) return;
    setSaveState("saving");
    setMutationError(null);
    try {
      const saved = await repository.save(draft);
      setDraft(saved);
      setSaveState("saved");
    } catch (reason) {
      setSaveState("conflict");
      setMutationError(bookingMutationMessage(reason, "Не удалось сохранить бронирование"));
    }
  };

  const draftStatus = draft?.status;
  const statusControl = useMemo(
    () =>
      draftStatus ? (
        <FilterSelect
          className="w-28 max-w-28 sm:w-36 sm:max-w-36"
          label="Статус бронирования"
          onValueChange={(value) => setStatus(value as BookingStatus)}
          options={statusOptions}
          value={draftStatus}
        />
      ) : undefined,
    [draftStatus, setStatus],
  );
  const title = draft?.clientName ?? "Бронирование";
  const editorChrome = useMemo(
    () => ({
      idLabel: `#${id}`,
      mobileStatus: statusControl,
      onBack: () => navigate(-1),
      title,
    }),
    [id, navigate, statusControl, title],
  );
  useEditorLayoutChrome(editorChrome);

  const navigation = (
    <PageNav
      ariaLabel="Разделы редактора бронирования"
      items={tabItems}
      onValueChange={(value) =>
        setParams((current) => {
          const next = new URLSearchParams(current);
          if (value === "main") next.delete("tab");
          else next.set("tab", value);
          return next;
        })
      }
      value={tab}
    />
  );
  const desktopActions = draft ? (
    <>
      {statusControl}
      <AssigneePicker
        label="Сменить ответственного бронирования"
        onPeopleChange={(people) => update("assignees", people)}
        onValueChange={setAssignee}
        options={bookingAssignees}
        people={draft.assignees}
      />
      <BookingOverflow
        cancelled={draft.status === "cancelled"}
        onCancel={() => setStatus("cancelled")}
      />
    </>
  ) : null;
  const mobileActions = draft ? (
    <BookingMobileActions
      cancelled={draft.status === "cancelled"}
      onAssigneeChange={setAssignee}
      onCancel={() => setStatus("cancelled")}
    />
  ) : null;
  return (
    <EditorFrame
      actions={desktopActions}
      footerActions={
        <>
          <Button onClick={() => navigate(-1)} size="sm" variant="outline">
            Закрыть
          </Button>
          <Button
            disabled={!draft || saveState === "saving" || promoPending || relationPending || Boolean(repository.previewPromotion && draft.promo && draft.promo !== "Без промокода" && !draft.promotion) || draft.positions.some((position) => position.addOns?.length && position.discount !== 0)}
            onClick={() => void save()}
            size="sm"
          >
            Сохранить
          </Button>
        </>
      }
      mobileActions={mobileActions}
      navigation={navigation}
      saveState={saveState}
      sidebar={
        draft ? (
          <BookingSidebar
            draft={draft}
            onAddPayment={addPayment}
            onAssigneeChange={setAssignee}
            onAssigneesChange={(people) => update("assignees", people)}
            onCancelRefund={cancelRefund}
            onPromoChange={changePromo}
            onApplyPromo={repository.previewPromotion ? () => void applyPromo() : undefined}
            promoPending={promoPending}
            onRefund={refundPayment}
            onSourceLeadChange={(sourceLeadId) => void changeSourceLead(sourceLeadId)}
            relationPending={relationPending}
          />
        ) : (
          <Skeleton className="h-96 rounded-xl" />
        )
      }
    >
      {loading ? <BookingEditorLoading /> : null}
      {mutationError ? <p role="alert" className="rounded-lg border border-destructive/30 p-3 text-sm text-destructive">{mutationError}</p> : null}
      {error ? (
        <div className="rounded-xl border bg-background">
          <PageState
            icon={IconAlertTriangle}
            title="Бронирование не открылось"
            tone="danger"
          >
            {error}
          </PageState>
        </div>
      ) : null}
      {draft && tab === "main" ? (
        <BookingMain
          draft={draft}
          newComment={newComment}
          onAddComment={addComment}
          onCommentChange={setNewComment}
          update={update}
        />
      ) : null}
      {draft && tab === "composition" ? (
        <BookingComposition
          autoPrice={id === "new"}
          draft={draft}
          onAdd={addPosition}
          onDelete={deletePosition}
          onDuplicate={duplicatePosition}
          onResourceChange={changeResource}
          pricingGateway={pricingGateway}
          updatePosition={updatePosition}
        />
      ) : null}
      {draft && tab === "marketing" ? (
        <BookingMarketing draft={draft} updateMarketing={updateMarketing} />
      ) : null}
      {draft && !["main", "composition", "marketing"].includes(tab) ? (
        <BookingRelatedTab
          draft={draft}
          leadHistory={leadHistory}
          tab={
            tab as Exclude<
              BookingEditorTab,
              "main" | "composition" | "marketing"
            >
          }
        />
      ) : null}
    </EditorFrame>
  );
}

function BookingEditorLoading() {
  return (
    <div
      aria-label="Загрузка редактора бронирования"
      className="space-y-3"
      role="status"
    >
      <Skeleton className="h-64 rounded-xl" />
      <Skeleton className="h-52 rounded-xl" />
    </div>
  );
}
