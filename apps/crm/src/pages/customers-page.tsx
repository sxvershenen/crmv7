import { useMemo, useState } from "react"
import { IconAlertTriangle, IconFilter } from "@tabler/icons-react"
import { useSearchParams } from "react-router-dom"

import { PageFrame, PageState } from "@crm/ui"

import { CustomerFilters } from "@app/components/customers/customer-filters"
import { CustomerCards, CustomerTable, CustomersLoading } from "@app/components/customers/customer-views"
import { customerRepository, type CustomerRepository } from "@app/data/customers-repository"
import type { CustomerChannel, CustomerFlag, CustomerQuery, CustomerSortDirection, CustomerSortKey, CustomerType } from "@app/entities/customers"
import { customerChannels, customerFlags, customerSortKeys, customerTypes } from "@app/entities/customers"
import { useCustomers } from "@app/features/use-customers"

function oneOf<T extends string>(value: string | null, options: readonly T[], fallback: T): T {
  return value && options.includes(value as T) ? value as T : fallback
}

function readFlags(value: string | null): CustomerFlag[] {
  if (!value) return []
  return [...new Set(value.split(",").filter((flag): flag is CustomerFlag => customerFlags.includes(flag as CustomerFlag)))]
}

export function CustomersPage({ repository = customerRepository }: { repository?: CustomerRepository }) {
  const [assignmentMessage, setAssignmentMessage] = useState("")
  const [searchParams, setSearchParams] = useSearchParams()
  const type = oneOf(searchParams.get("type"), ["all", ...customerTypes] as const, "all")
  const channel = oneOf(searchParams.get("channel"), ["all", ...customerChannels] as const, "all")
  const flagsParam = searchParams.get("flags")
  const flags = useMemo(() => readFlags(flagsParam), [flagsParam])
  const lastVisitDays = oneOf(searchParams.get("visit"), ["all", "30", "60", "90"] as const, "all")
  const sortKey = oneOf(searchParams.get("sort"), customerSortKeys, "client")
  const sortDirection = oneOf(searchParams.get("order"), ["asc", "desc"] as const, "asc")

  const query = useMemo<CustomerQuery>(() => ({
    type,
    channel,
    flags,
    lastVisitDays: lastVisitDays === "all" ? null : Number(lastVisitDays) as 30 | 60 | 90,
    sort: { key: sortKey, direction: sortDirection },
  }), [channel, flags, lastVisitDays, sortDirection, sortKey, type])
  const { assignSelf, retry, state } = useCustomers(query, repository)
  const visibleCustomers = state.status === "ready" ? state.data : []

  const assignCustomer = async (customerId: string) => {
    setAssignmentMessage("")
    try {
      const assigned = await assignSelf(customerId)
      const person = assigned.assignees.at(-1)
      setAssignmentMessage(`${person?.name ?? "Вы"} назначена клиенту #${customerId}`)
    } catch (error) {
      setAssignmentMessage(error instanceof Error ? error.message : "Не удалось назначить ответственного")
    }
  }

  const setFilter = (name: "type" | "channel" | "visit", value: string, defaultValue = "all") => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      if (value === defaultValue) next.delete(name)
      else next.set(name, value)
      return next
    })
  }

  const toggleFlag = (flag: CustomerFlag) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      const selected = new Set(readFlags(next.get("flags")))
      if (selected.has(flag)) selected.delete(flag)
      else selected.add(flag)
      const ordered = customerFlags.filter((item) => selected.has(item))
      if (ordered.length) next.set("flags", ordered.join(","))
      else next.delete("flags")
      return next
    })
  }

  const resetFilters = () => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      for (const key of ["type", "channel", "flags", "visit"]) next.delete(key)
      return next
    })
  }

  const handleSort = (key: CustomerSortKey) => {
    const nextDirection: CustomerSortDirection = sortKey === key && sortDirection === "asc" ? "desc" : "asc"
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      next.set("sort", key)
      next.set("order", nextDirection)
      return next
    })
  }

  return (
    <PageFrame className="space-y-3" width="full">
      <CustomerFilters
        channel={channel as CustomerChannel | "all"}
        flags={flags}
        lastVisitDays={query.lastVisitDays}
        onChannelChange={(value) => setFilter("channel", value)}
        onFlagToggle={toggleFlag}
        onLastVisitChange={(value) => setFilter("visit", value === null ? "all" : String(value))}
        onReset={resetFilters}
        onTypeChange={(value) => setFilter("type", value)}
        type={type as CustomerType | "all"}
      />
      <p aria-live="polite" className="sr-only">{assignmentMessage}</p>

      {state.status === "loading" ? <CustomersLoading /> : null}
      {state.status === "error" ? (
        <div className="rounded-xl border bg-surface-raised">
          <PageState actionLabel="Повторить" icon={IconAlertTriangle} onAction={retry} title="Клиенты не загрузились" tone="danger">{state.message}</PageState>
        </div>
      ) : null}
      {state.status === "ready" && state.data.length === 0 ? (
        <div className="rounded-xl border bg-surface-raised">
          <PageState actionLabel="Сбросить фильтры" icon={IconFilter} onAction={resetFilters} title="Клиенты не найдены">Измените тип, канал или дополнительные признаки.</PageState>
        </div>
      ) : null}
      {state.status === "ready" && state.data.length > 0 ? (
        <>
          <CustomerCards customers={visibleCustomers} onAssign={(id) => { void assignCustomer(id) }} />
          <CustomerTable customers={visibleCustomers} onAssign={(id) => { void assignCustomer(id) }} onSort={handleSort} sortDirection={sortDirection} sortKey={sortKey} />
          <p className="text-[11px] font-normal text-muted-foreground">Показано: {state.data.length}</p>
        </>
      ) : null}
    </PageFrame>
  )
}
