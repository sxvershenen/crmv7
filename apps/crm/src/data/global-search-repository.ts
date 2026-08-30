import { bookingsFixture } from "@app/fixtures/bookings";
import { customersFixture } from "@app/fixtures/customers";
import { eventsFixture } from "@app/fixtures/events";
import { leadsFixture } from "@app/fixtures/leads";
import {
  programRegistrationsFixture,
  programRunsFixture,
  programTemplatesFixture,
} from "@app/fixtures/programs";
import { resourcesFixture } from "@app/fixtures/resources";
import { tasksFixture } from "@app/fixtures/tasks";
import { teamMembersFixture } from "@app/fixtures/workspace";
import { GlobalSearchResponseSchema } from "@crm/contracts";
import { apiClient } from "@app/lib/api-client";
import { useFixtureData } from "@app/lib/data-mode";

import { normalizePhone, normalizeSearchText } from "./search-normalization";

export const globalSearchKinds = [
  "customer",
  "lead",
  "booking",
  "resource",
  "program",
  "event",
  "task",
  "team",
] as const;

export type GlobalSearchKind = (typeof globalSearchKinds)[number];

export type GlobalSearchResult = {
  href: string;
  id: string;
  kind: GlobalSearchKind;
  meta: string;
  phone?: string;
  title: string;
};

export const globalSearchKindLabels: Record<GlobalSearchKind, string> = {
  booking: "Бронирования",
  customer: "Клиенты",
  event: "Мероприятия",
  lead: "Заявки",
  program: "Программы и регистрации",
  resource: "Ресурсы",
  task: "Задачи",
  team: "Команда",
};

export interface GlobalSearchRepository {
  search(query: string): Promise<GlobalSearchResult[]>;
}

export type ApiGlobalSearchRepositoryOptions = {
  client?: Pick<typeof apiClient, "get">;
};

type IndexedResult = GlobalSearchResult & { searchText: string };

function indexed(result: GlobalSearchResult): IndexedResult {
  return {
    ...result,
    searchText: normalizeSearchText(
      `${result.id} #${result.id} ${result.title} ${result.meta} ${result.phone ?? ""}`,
    ),
  };
}

const fixtureSearchIndex: IndexedResult[] = [
  ...customersFixture.map((customer) => indexed({ kind: "customer", id: customer.id, href: `/customers/${customer.id}`, title: customer.name, meta: `${customer.phone} · клиент #${customer.id}`, phone: customer.phone })),
  ...leadsFixture.map((lead) => indexed({ kind: "lead", id: lead.id, href: `/leads/${lead.id}`, title: lead.clientName, meta: `Заявка #${lead.id} · ${lead.phone} · ${lead.requestedItem}`, phone: lead.phone })),
  ...bookingsFixture.map((booking) => indexed({ kind: "booking", id: booking.id, href: `/bookings/${booking.id}`, title: booking.clientName, meta: `Бронь #${booking.id} · ${booking.resourceName} · ${booking.phone}`, phone: booking.phone })),
  ...resourcesFixture.map((resource) => indexed({ kind: "resource", id: resource.id, href: `/resources/${resource.kind}/${resource.id}`, title: resource.name, meta: resource.secondaryType })),
  ...programTemplatesFixture.map((program) => indexed({ kind: "program", id: program.id, href: `/programs/${program.id}`, title: program.name, meta: `Шаблон · ${program.categoryName} · #${program.id}` })),
  ...programRunsFixture.map((run) => indexed({ kind: "program", id: run.id, href: `/programs/runs/${run.id}`, title: run.name, meta: `Проведение #${run.id}` })),
  ...programRegistrationsFixture.map((registration) => indexed({ kind: "program", id: registration.id, href: `/programs/registrations/${registration.id}`, title: registration.clientName, meta: `Регистрация #${registration.id} · ${registration.programName} · ${registration.phone}`, phone: registration.phone })),
  ...eventsFixture.map((event) => indexed({ kind: "event", id: event.id, href: `/events/${event.id}`, title: event.name, meta: `#${event.id} · ${event.clientName} · ${event.phone}`, phone: event.phone })),
  ...tasksFixture.map((task) => indexed({ kind: "task", id: task.id, href: `/tasks/${task.id}`, title: task.title, meta: `#${task.id} · ${task.relation.label}` })),
  ...teamMembersFixture.map((member) => indexed({ kind: "team", id: member.id, href: `/team?section=members&search=${encodeURIComponent(member.name)}`, title: member.name, meta: `${member.role} · ${member.email} · ${member.phone}`, phone: member.phone })),
];

function score(result: IndexedResult, query: string, phoneQuery: string) {
  const id = normalizeSearchText(result.id);
  if (query === id || query === `#${id}`) return 0;
  if (phoneQuery.length >= 5 && normalizePhone(result.phone ?? "") === phoneQuery) return 1;
  if (normalizeSearchText(result.title).startsWith(query)) return 2;
  if (result.searchText.includes(query)) return 3;
  if (phoneQuery.length >= 5 && normalizePhone(result.phone ?? "").includes(phoneQuery)) return 4;
  return null;
}

export class FixtureGlobalSearchRepository implements GlobalSearchRepository {
  async search(rawQuery: string) {
    const query = normalizeSearchText(rawQuery);
    if (!query) return [];
    const phoneQuery = normalizePhone(rawQuery);
    return fixtureSearchIndex
      .map((result) => ({ result, score: score(result, query, phoneQuery) }))
      .filter((item): item is { result: IndexedResult; score: number } => item.score !== null)
      .sort((left, right) => left.score - right.score || left.result.title.localeCompare(right.result.title, "ru"))
      .slice(0, 24)
      .map(({ result }) => ({
        href: result.href,
        id: result.id,
        kind: result.kind,
        meta: result.meta,
        ...(result.phone ? { phone: result.phone } : {}),
        title: result.title,
      }));
  }
}

export class ApiGlobalSearchRepository implements GlobalSearchRepository {
  private readonly client: Pick<typeof apiClient, "get">;

  constructor(options: ApiGlobalSearchRepositoryOptions = {}) {
    this.client = options.client ?? apiClient;
  }

  async search(rawQuery: string): Promise<GlobalSearchResult[]> {
    const query = rawQuery.trim();
    if (!query) return [];
    const params = new URLSearchParams({ q: query, limit: "24" });
    const results = await this.client.get(`/search?${params.toString()}`, GlobalSearchResponseSchema);
    return results.map((result) => ({
      href: result.href,
      id: result.code ?? result.id,
      kind: result.kind,
      meta: result.meta,
      ...(result.phone ? { phone: result.phone } : {}),
      title: result.title,
    }));
  }
}

export const fixtureGlobalSearchRepository: GlobalSearchRepository = new FixtureGlobalSearchRepository();
export const globalSearchRepository: GlobalSearchRepository = useFixtureData ? fixtureGlobalSearchRepository : new ApiGlobalSearchRepository();
