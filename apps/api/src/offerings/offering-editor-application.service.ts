import { randomUUID } from "node:crypto"

import { ConflictException, ForbiddenException, Inject, Injectable, Logger, NotFoundException, UnprocessableEntityException } from "@nestjs/common"
import { DataSource, In, IsNull, type EntityManager } from "typeorm"

import {
  InternalOfferingEditorSchema,
  AddOnOfferingCreateResultSchema,
  AddOnOfferingListResponseSchema,
  AddOnTermsMutationResultSchema,
  OfferingEditorialLocatorSchema,
  InternalOfferingQuoteResultSchema,
  OfferingBindingTargetLookupResponseSchema,
  ResourcePrimaryStayOfferingLookupResponseSchema,
  ResourceStayOfferingCreateResultSchema,
  ResourcePrimaryVenueOfferingLookupResponseSchema,
  ResourceVenueOfferingCreateResultSchema,
  OfferingQuoteOperationalContextSchema,
  OfferingPricingMutationResultSchema,
  OfferingPricingOutboxEventSchema,
  OfferingConfigurationOutboxEventSchema,
  type OfferingListQuery,
  type OfferingListResponse,
  type AddOnOfferingCreateBody,
  type AddOnOfferingCreateResult,
  type AddOnTermsMutationBody,
  type AddOnTermsMutationResult,
  type HousePriceBookActivateBody,
  type HousePriceBookDraftCreateBody,
  type HousePriceBookDraftReplaceBody,
  type HousePriceBookScheduleBody,
  type InternalStayOfferingQuoteBody,
  type ResourceStayOfferingQuotePreviewBody,
  type InternalOfferingEditor,
  type OfferingEditorialLocator,
  type InternalOfferingQuoteResult,
  type OfferingBindingTargetLookupQuery,
  type OfferingBindingTargetLookupResponse,
  type ResourcePrimaryStayOfferingLookupResponse,
  type ResourceStayOfferingCreateBody,
  type ResourceStayOfferingCreateResult,
  type ResourcePrimaryVenueOfferingLookupResponse,
  type ResourceVenueOfferingCreateBody,
  type ResourceVenueOfferingCreateResult,
  type OfferingPricingMutationResult,
  type RatePlanDraft,
  type SessionUser,
} from "@crm/contracts"
import {
  BusinessCalendarDateEntity,
  BusinessCalendarEntity,
  CampgroundOfferingTermsEntity,
  CatalogOfferingEntity,
  ChangeLogEntity,
  CmsNodeEntity,
  CmsNodeRevisionEntity,
  CmsPublicProfileEntity,
  CmsSourceLinkEntity,
  AddonOfferingTermsEntity,
  EventServiceTemplateEntity,
  IdempotencyKeyEntity,
  OfferingAddonAssignmentEntity,
  OfferingBindingEntity,
  OfferingQuoteSnapshotEntity,
  OutboxDeliveryEntity,
  OutboxEventEntity,
  PriceBookEntity,
  PriceRuleEntity,
  ProgramTemplateEntity,
  RatePlanEntity,
  ResourceEntity,
  ResourceGroupEntity,
} from "@crm/db"
import {
  resolveCampgroundPerNightQuote,
  resolveAddOnServiceDateQuote,
  resolveHousePerNightQuote,
  validateCampgroundPricingForActivation,
  validateHousePricingForActivation,
  validateAddOnPricingForActivation,
  validateProgramPricingForActivation,
  validateEventServicePricingForActivation,
  validateVenuePricingForActivation,
  type HousePricingSnapshot,
} from "@crm/domain"

import { canonicalSha256, deriveOfferingEditorCapabilities } from "./offering-mutation-support.js"
import { ensureCatalogOfferingEditorialDraft } from "../cms/cms-source-draft.js"
import { loadEventServicePricingSnapshot, loadHousePricingSnapshot, loadPriceBook, loadPriceBooks, loadProgramPricingSnapshot } from "./offering-editor-pricing-snapshots.js"
import { addOnCatalogItem, addOnTermsDto, addOnTermsEntity, assignmentDto, bindingDto, offeringDto, quoteDto, resourceBindingTargetDto, resourcePrimaryOfferingSummary, type AddOnTermsRow } from "./offering-editor-projections.js"

export type OfferingRequestContext = Readonly<{
  actor: SessionUser
  requestId: string
  entrySurface: "internal" | "admin"
}>

type MutationContext = OfferingRequestContext | Readonly<{
  actor: null
  requestId: string
  entrySurface: "scheduler"
}>

type StoredReplay = { responseBody: Record<string, unknown> | null; operationId: string; idempotencyKey: string; requestHash: string }
type Cursor = { updatedAt: string; id: string }
type BindingTargetCursor = { name: string; code: string; id: string }

@Injectable()
export class OfferingEditorApplicationService {
  private readonly logger = new Logger(OfferingEditorApplicationService.name)

  constructor(@Inject(DataSource) private readonly dataSource: DataSource) {}

  async list(query: OfferingListQuery, context: OfferingRequestContext): Promise<OfferingListResponse> {
    this.assertRead(context)
    const cursor = query.cursor ? decodeCursor(query.cursor) : null
    const builder = this.dataSource.getRepository(CatalogOfferingEntity).createQueryBuilder("offering")
      .where("offering.kind = :kind", { kind: query.kind })
      .andWhere("offering.archived_at IS NULL")
      .orderBy("offering.updated_at", "DESC")
      .addOrderBy("offering.id", "DESC")
      .take(query.limit + 1)
    if (query.state) builder.andWhere("offering.state = :state", { state: query.state })
    if (query.q && query.kind !== "addon") builder.andWhere("(LOWER(offering.operational_name) LIKE :q ESCAPE '\\' OR LOWER(offering.code) LIKE :q ESCAPE '\\')", { q: `%${escapeLike(query.q.toLocaleLowerCase("ru-RU"))}%` })
    if (query.kind === "addon") {
      if (query.serviceType) builder.andWhere("EXISTS (SELECT 1 FROM addon_offering_terms terms WHERE terms.offering_id = offering.id AND terms.service_type = :serviceType)", { serviceType: query.serviceType })
      if (query.scope) builder.andWhere("offering.scope = :scope", { scope: query.scope })
      if (query.categoryKey) builder.andWhere("EXISTS (SELECT 1 FROM addon_offering_terms terms WHERE terms.offering_id = offering.id AND terms.category_key = :categoryKey)", { categoryKey: query.categoryKey })
      if (query.standalone !== undefined) builder.andWhere("EXISTS (SELECT 1 FROM addon_offering_terms terms WHERE terms.offering_id = offering.id AND terms.standalone = :standalone)", { standalone: query.standalone })
      if (query.q) builder.andWhere("(EXISTS (SELECT 1 FROM addon_offering_terms terms WHERE terms.offering_id = offering.id AND LOWER(terms.category_key) LIKE :q ESCAPE '\\') OR LOWER(offering.operational_name) LIKE :q ESCAPE '\\' OR LOWER(offering.code) LIKE :q ESCAPE '\\')", { q: `%${escapeLike(query.q.toLocaleLowerCase("ru-RU"))}%` })
    }
    if (cursor) builder.andWhere("(offering.updated_at, offering.id) < (:updatedAt, :id)", cursor)
    const rows = await builder.getMany()
    const hasMore = rows.length > query.limit
    const items = rows.slice(0, query.limit)
    const last = items.at(-1)
    if (query.kind === "addon") return this.addOnList(items, query, hasMore, last)
    const campgroundTerms = query.kind === "campground" && items.length > 0
      ? await this.dataSource.getRepository(CampgroundOfferingTermsEntity).find({ where: { offeringId: In(items.map((item) => item.id)) } })
      : []
    const termsByOfferingId = new Map(campgroundTerms.map((terms) => [terms.offeringId, terms]))
    return {
      items: items.map((row) => offeringDto(row, termsByOfferingId.get(row.id))),
      nextCursor: hasMore && last ? encodeCursor({ updatedAt: last.updatedAt.toISOString(), id: last.id }) : null,
    }
  }

  private async addOnList(rows: readonly CatalogOfferingEntity[], query: Extract<OfferingListQuery, { kind: "addon" }>, hasMore: boolean, last: CatalogOfferingEntity | undefined) {
    const ids = rows.map((row) => row.id)
    const [terms, assignments, links, books] = ids.length ? await Promise.all([
      this.dataSource.getRepository(AddonOfferingTermsEntity).find({ where: { offeringId: In(ids) } }),
      this.dataSource.getRepository(OfferingAddonAssignmentEntity).find({ where: { addonOfferingId: In(ids) } }),
      this.dataSource.getRepository(CmsSourceLinkEntity).find({ where: { sourceKind: "catalog_offering", sourceId: In(ids) } }),
      this.dataSource.getRepository(PriceBookEntity).find({ where: { offeringId: In(ids) } }),
    ]) : [[], [], [], []]
    const termsById = new Map(terms.map((term) => [term.offeringId, term]))
    const usageById = new Map<string, number>()
    for (const assignment of assignments) if (assignment.archivedAt === null) usageById.set(assignment.addonOfferingId, (usageById.get(assignment.addonOfferingId) ?? 0) + 1)
    const linkById = new Map(links.map((link) => [link.sourceId, link]))
    const booksById = new Map<string, PriceBookEntity[]>()
    for (const book of books) if (book.archivedAt === null) booksById.set(book.offeringId, [...(booksById.get(book.offeringId) ?? []), book])
    return AddOnOfferingListResponseSchema.parse({
      items: rows.map((offering) => {
        const terms = termsById.get(offering.id)
        if (!terms) throw unprocessable("ADDON_TERMS_NOT_FOUND", "Для дополнения не заданы operational terms", { offeringId: offering.id })
        const ownBooks = booksById.get(offering.id) ?? []
        const priceReadiness = offering.salesMode === "request_only" ? "not_sellable"
          : offering.activePriceBookId !== null ? "ready"
            : ownBooks.some((book) => book.state === "draft" || book.state === "scheduled") ? "draft_only" : "missing"
        return { offering: offeringDto(offering, undefined, terms), terms: addOnTermsDto(terms), usageCount: usageById.get(offering.id) ?? 0, priceReadiness, editorialNodeId: linkById.get(offering.id)?.nodeId ?? null }
      }),
      nextCursor: hasMore && last ? encodeCursor({ updatedAt: last.updatedAt.toISOString(), id: last.id }) : null,
    })
  }

  async bindingTargets(query: OfferingBindingTargetLookupQuery, context: OfferingRequestContext): Promise<OfferingBindingTargetLookupResponse> {
    this.assertRead(context)
    const cursor = query.cursor ? decodeBindingTargetCursor(query.cursor) : null
    const builder = this.dataSource.getRepository(ResourceEntity).createQueryBuilder("resource")
      .where("resource.archived_at IS NULL")
      .orderBy("resource.name", "ASC")
      .addOrderBy("resource.code", "ASC")
      .addOrderBy("resource.id", "ASC")
      .take(query.limit + 1)
    if (query.kind) builder.andWhere("resource.kind = :kind", { kind: query.kind })
    if (query.q) builder.andWhere("(LOWER(resource.name) LIKE :q ESCAPE '\\' OR LOWER(resource.code) LIKE :q ESCAPE '\\')", { q: `%${escapeLike(query.q.toLocaleLowerCase("ru-RU"))}%` })
    if (cursor) builder.andWhere("(resource.name, resource.code, resource.id) > (:name, :code, :id)", cursor)
    const rows = await builder.getMany()
    const items = rows.slice(0, query.limit)
    const last = items.at(-1)
    return OfferingBindingTargetLookupResponseSchema.parse({
      items: items.map((resource) => resourceBindingTargetDto(resource)),
      nextCursor: rows.length > query.limit && last ? encodeBindingTargetCursor({ name: last.name, code: last.code, id: last.id }) : null,
    })
  }

  /**
   * Resolve the commercial dossier associated with one operational Resource.
   * Legacy data can legitimately be incomplete or ambiguous, so this read
   * endpoint returns an explicit state instead of making an arbitrary choice.
   */
  async primaryStayOfferingForResource(resourceId: string, context: OfferingRequestContext): Promise<ResourcePrimaryStayOfferingLookupResponse> {
    this.assertRead(context)
    return this.primaryStayOfferingForResourceInManager(this.dataSource, resourceId)
  }

  async createStayOfferingFromResource(resourceId: string, input: ResourceStayOfferingCreateBody, context: OfferingRequestContext): Promise<ResourceStayOfferingCreateResult> {
    this.assertStayOfferingCreate(context)
    const scope = `resource:${resourceId}:stay-offering:create`
    return this.serializable(async (manager) => {
      const hash = canonicalSha256({ command: "stay-offering.create-from-resource", resourceId, input })
      const replay = await this.replay<ResourceStayOfferingCreateResult>(manager, scope, input.operationId, input.idempotencyKey, hash)
      if (replay) return replay

      const resource = await manager.createQueryBuilder(ResourceEntity, "resource").setLock("pessimistic_write")
        .where("resource.id = :resourceId", { resourceId }).getOne()
      if (!resource || resource.archivedAt !== null) throw new NotFoundException({ code: "RESOURCE_NOT_FOUND", message: "Ресурс не найден" })
      const kind = stayOfferingKindForResource(resource)
      const existing = await this.primaryStayOfferingForResourceInManager(manager, resource.id)
      if (existing.resolution === "linked") throw conflict("RESOURCE_STAY_OFFERING_ALREADY_LINKED", "Для ресурса уже существует основное предложение", { resourceId: resource.id, offeringId: existing.offering.offeringId })
      if (existing.resolution === "ambiguous") throw conflict("RESOURCE_STAY_OFFERING_AMBIGUOUS", "У ресурса несколько основных предложений; требуется сверка", { resourceId: resource.id, offeringIds: existing.candidates.map((item) => item.offeringId) })

      const calendars = await manager.find(BusinessCalendarEntity, { where: { state: "active", archivedAt: IsNull() }, order: { id: "ASC" } })
      if (calendars.length !== 1) throw unprocessable("BUSINESS_CALENDAR_ACTIVE_COUNT_INVALID", "Для создания предложения нужен ровно один активный бизнес-календарь", { count: calendars.length })
      const calendar = calendars[0]!
      const campground = kind === "campground" ? campgroundTermsForResource(resource) : null
      if (campground) await this.assertCampgroundMembership(manager, resource.id, campground.expectedRole)

      const offering = await manager.save(manager.create(CatalogOfferingEntity, {
        id: randomUUID(), code: await this.uniqueResourceOfferingCode(manager, resource, kind), kind,
        operationalName: resource.name, internalComment: "Создано из operational Resource.", state: "draft",
        subjectVersion: 1, pricingVersion: 1, addonAssignmentsVersion: 1,
        salesMode: "quoted", priceDisplayMode: "from", currency: "RUB", timezone: calendar.timezone, taxMode: "tax_included",
        businessCalendarId: calendar.id, leadDirection: null, defaultAssigneeId: null, scope: null, ownerOfferingId: null,
        activePriceBookId: null, createdBy: context.actor.id, updatedBy: context.actor.id, archivedAt: null,
      }))
      if (campground) await manager.save(manager.create(CampgroundOfferingTermsEntity, {
        offeringId: offering.id, offeringKind: "campground", sellableUnit: campground.sellableUnit,
        inventoryMode: campground.inventoryMode, capacityUnit: "tent", pricingBasis: "per_night",
        createdAt: new Date(), createdBy: context.actor.id,
      }))
      await manager.save(manager.create(OfferingBindingEntity, {
        id: randomUUID(), offeringId: offering.id, resourceId: resource.id, resourceGroupId: null, programTemplateId: null, eventServiceTemplateId: null,
        role: "primary", quantityDefault: 1, capacityImpactDefault: 1, preparationBeforeMinutes: 0, preparationAfterMinutes: 0,
        availabilityRequired: true, createdBy: context.actor.id, updatedBy: context.actor.id, archivedAt: null,
      }))
      const editorial = await ensureCatalogOfferingEditorialDraft(manager, { offeringId: offering.id, actorId: context.actor.id, requestId: context.requestId })
      if (editorial.status === "report_only") throw conflict("OFFERING_EDITORIAL_RECONCILIATION_REQUIRED", "Нельзя автоматически связать CMS-черновик; требуется сверка legacy link", editorial.report)

      const response = ResourceStayOfferingCreateResultSchema.parse(resourcePrimaryOfferingSummary(offering, kind))
      await this.recordStayOfferingCreated(manager, offering, calendar.version, input.operationId, context, hash)
      await this.remember(manager, scope, input.operationId, input.idempotencyKey, hash, response)
      return response
    })
  }

  async primaryVenueOfferingForResource(resourceId: string, context: OfferingRequestContext): Promise<ResourcePrimaryVenueOfferingLookupResponse> {
    this.assertRead(context)
    return this.primaryVenueOfferingForResourceInManager(this.dataSource, resourceId)
  }

  async createVenueOfferingFromResource(resourceId: string, input: ResourceVenueOfferingCreateBody, context: OfferingRequestContext): Promise<ResourceVenueOfferingCreateResult> {
    this.assertStayOfferingCreate(context)
    const scope = `resource:${resourceId}:venue-offering:create`
    return this.serializable(async (manager) => {
      const hash = canonicalSha256({ command: "venue-offering.create-from-resource", resourceId, input })
      const replay = await this.replay<ResourceVenueOfferingCreateResult>(manager, scope, input.operationId, input.idempotencyKey, hash)
      if (replay) return replay
      const resource = await manager.createQueryBuilder(ResourceEntity, "resource").setLock("pessimistic_write")
        .where("resource.id = :resourceId", { resourceId }).getOne()
      if (!resource || resource.archivedAt !== null) throw new NotFoundException({ code: "RESOURCE_NOT_FOUND", message: "Ресурс не найден" })
      if (!["venue", "venues"].includes(resource.kind) || resource.capacityMode !== "fixed" || resource.capacityTotal <= 0) {
        throw unprocessable("RESOURCE_VENUE_INVALID", "Для площадки нужен активный Resource kind=venues с положительной fixed capacity", { resourceId, kind: resource.kind, capacityMode: resource.capacityMode, capacityTotal: resource.capacityTotal })
      }
      const existing = await this.primaryVenueOfferingForResourceInManager(manager, resource.id)
      if (existing.resolution === "linked") throw conflict("RESOURCE_VENUE_OFFERING_ALREADY_LINKED", "Для ресурса уже существует основное предложение площадки", { resourceId: resource.id, offeringId: existing.offering.offeringId })
      if (existing.resolution === "ambiguous") throw conflict("RESOURCE_VENUE_OFFERING_AMBIGUOUS", "У ресурса несколько основных предложений площадки; требуется сверка", { resourceId: resource.id, offeringIds: existing.candidates.map((item) => item.offeringId) })
      const calendars = await manager.find(BusinessCalendarEntity, { where: { state: "active", archivedAt: IsNull() }, order: { id: "ASC" } })
      if (calendars.length !== 1) throw unprocessable("BUSINESS_CALENDAR_ACTIVE_COUNT_INVALID", "Для создания предложения нужен ровно один активный бизнес-календарь", { count: calendars.length })
      const calendar = calendars[0]!
      const offering = await manager.save(manager.create(CatalogOfferingEntity, {
        id: randomUUID(), code: await this.uniqueResourceOfferingCode(manager, resource, "venue"), kind: "venue",
        operationalName: resource.name, internalComment: "Создано из operational Resource.", state: "draft",
        subjectVersion: 1, pricingVersion: 1, addonAssignmentsVersion: 1,
        salesMode: "quoted", priceDisplayMode: "from", currency: "RUB", timezone: calendar.timezone, taxMode: "tax_included",
        businessCalendarId: calendar.id, leadDirection: null, defaultAssigneeId: null, scope: null, ownerOfferingId: null,
        activePriceBookId: null, createdBy: context.actor.id, updatedBy: context.actor.id, archivedAt: null,
      }))
      await manager.save(manager.create(OfferingBindingEntity, {
        id: randomUUID(), offeringId: offering.id, resourceId: resource.id, resourceGroupId: null, programTemplateId: null, eventServiceTemplateId: null,
        role: "primary", quantityDefault: 1, capacityImpactDefault: 1, preparationBeforeMinutes: 0, preparationAfterMinutes: 0,
        availabilityRequired: true, createdBy: context.actor.id, updatedBy: context.actor.id, archivedAt: null,
      }))
      const editorial = await ensureCatalogOfferingEditorialDraft(manager, { offeringId: offering.id, actorId: context.actor.id, requestId: context.requestId })
      if (editorial.status === "report_only") throw conflict("OFFERING_EDITORIAL_RECONCILIATION_REQUIRED", "Нельзя автоматически связать CMS-черновик; требуется сверка legacy link", editorial.report)
      const response = ResourceVenueOfferingCreateResultSchema.parse(resourcePrimaryOfferingSummary(offering))
      await this.recordStayOfferingCreated(manager, offering, calendar.version, input.operationId, context, hash)
      await this.remember(manager, scope, input.operationId, input.idempotencyKey, hash, response)
      return response
    })
  }

  private async primaryStayOfferingForResourceInManager(manager: Pick<EntityManager, "getRepository">, resourceId: string): Promise<ResourcePrimaryStayOfferingLookupResponse> {
    const rows = await manager.getRepository(CatalogOfferingEntity).createQueryBuilder("offering")
      .innerJoin(OfferingBindingEntity, "binding", "binding.offering_id = offering.id")
      .where("binding.resource_id = :resourceId", { resourceId })
      .andWhere("binding.role = :role", { role: "primary" })
      .andWhere("binding.archived_at IS NULL")
      .andWhere("offering.archived_at IS NULL")
      .andWhere("offering.state <> :archivedState", { archivedState: "archived" })
      .andWhere("offering.kind IN (:...kinds)", { kinds: ["house", "campground"] })
      .orderBy("offering.code", "ASC")
      .addOrderBy("offering.id", "ASC")
      .getMany()
    const candidates = rows.map((offering) => resourcePrimaryOfferingSummary(offering, offering.kind as "house" | "campground"))
    if (candidates.length === 0) return ResourcePrimaryStayOfferingLookupResponseSchema.parse({ resolution: "none" })
    if (candidates.length === 1) return ResourcePrimaryStayOfferingLookupResponseSchema.parse({ resolution: "linked", offering: candidates[0] })
    return ResourcePrimaryStayOfferingLookupResponseSchema.parse({ resolution: "ambiguous", candidates })
  }

  private async primaryVenueOfferingForResourceInManager(manager: Pick<EntityManager, "getRepository">, resourceId: string): Promise<ResourcePrimaryVenueOfferingLookupResponse> {
    const rows = await manager.getRepository(CatalogOfferingEntity).createQueryBuilder("offering")
      .innerJoin(OfferingBindingEntity, "binding", "binding.offering_id = offering.id")
      .where("binding.resource_id = :resourceId", { resourceId })
      .andWhere("binding.role = 'primary'")
      .andWhere("binding.archived_at IS NULL")
      .andWhere("offering.archived_at IS NULL")
      .andWhere("offering.state <> 'archived'")
      .andWhere("offering.kind = 'venue'")
      .orderBy("offering.code", "ASC").addOrderBy("offering.id", "ASC").getMany()
    const candidates = rows.map((offering) => resourcePrimaryOfferingSummary(offering, "venue"))
    if (candidates.length === 0) return ResourcePrimaryVenueOfferingLookupResponseSchema.parse({ resolution: "none" })
    if (candidates.length === 1) return ResourcePrimaryVenueOfferingLookupResponseSchema.parse({ resolution: "linked", offering: candidates[0] })
    return ResourcePrimaryVenueOfferingLookupResponseSchema.parse({ resolution: "ambiguous", candidates })
  }

  async editor(offeringId: string, context: OfferingRequestContext): Promise<InternalOfferingEditor> {
    this.assertRead(context)
    return this.dataSource.transaction("REPEATABLE READ", async (manager) => {
      const offering = await this.findOffering(manager, offeringId)
      const campgroundTerms = offering.kind === "campground" ? await this.requireCampgroundTerms(manager, offering.id) : undefined
      const addOnTerms = offering.kind === "addon" ? await this.requireAddOnTerms(manager, offering.id) : undefined
      const bindings = offering.kind === "addon" ? [] : await manager.find(OfferingBindingEntity, { where: { offeringId }, order: { createdAt: "ASC" } })
      const activeBindings = bindings.filter((item) => item.archivedAt === null)
      const bindingTargets = offering.kind === "program" || offering.kind === "event_service" ? [] : await this.boundResourceTargets(manager, activeBindings)
      const priceBooks = await loadPriceBooks(manager, offeringId)
      const assignments = offering.kind === "addon" ? [] : await manager.find(OfferingAddonAssignmentEntity, { where: { offeringId }, order: { displayOrder: "ASC", id: "ASC" } })
      const activeAssignments = assignments.filter((item) => item.archivedAt === null)
      const addOnCatalog = await this.assignedAddOnCatalog(manager, activeAssignments)
      const addOnUsages = offering.kind === "addon" ? await this.addOnUsages(manager, offering.id) : []
      const editorial = await this.editorialLocator(manager, offering)
      const capabilities = deriveOfferingEditorCapabilities(context.actor)
      const canMutateFromSurface = context.entrySurface !== "admin" || capabilities.editorial.canEdit
      const projection = {
        offering: offeringDto(offering, campgroundTerms, addOnTerms),
        addOnTerms: addOnTerms ? addOnTermsDto(addOnTerms) : null,
        addOnUsages,
        bindings: activeBindings.map((item) => bindingDto(item)),
        bindingTargets,
        priceBooks,
        addOnAssignments: activeAssignments.map((item) => assignmentDto(item)),
        addOnCatalog,
        editorial,
        ownerVersions: {
          catalog: offering.version,
          subject: {
            aggregateVersion: offering.subjectVersion,
            primary: await this.primarySubjectVersion(manager, activeBindings),
          },
          pricing: offering.pricingVersion,
          draftPriceBook: priceBooks.find((item) => item.state === "draft") ? {
            id: priceBooks.find((item) => item.state === "draft")!.id,
            version: priceBooks.find((item) => item.state === "draft")!.version,
          } : null,
          addOnAssignments: offering.addonAssignmentsVersion,
          editorial: editorial ? {
            nodeId: editorial.node.id,
            nodeVersion: editorial.node.version,
            draftRevisionId: editorial.currentRevision?.state === "published" ? null : editorial.currentRevision?.id ?? null,
            contentHash: editorial.currentRevision?.contentHash ?? null,
          } : null,
        },
        capabilities: {
          ...capabilities,
          catalog: { canEdit: false, canChangeState: false, canArchive: false },
          subject: { canEdit: capabilities.subject.canEdit && canMutateFromSurface, canManageBindings: capabilities.subject.canManageBindings && canMutateFromSurface },
          pricing: { ...capabilities.pricing, canEditDraft: capabilities.pricing.canEditDraft && canMutateFromSurface, canActivate: capabilities.pricing.canActivate && canMutateFromSurface },
          addOns: { canSearch: capabilities.addOns.canSearch, canCreate: capabilities.addOns.canCreate && canMutateFromSurface, canAssign: capabilities.addOns.canAssign && canMutateFromSurface },
          canPreviewQuote: offering.kind !== "addon" && capabilities.pricing.canView && offering.state === "active" && offering.activePriceBookId !== null,
        },
      }
      return InternalOfferingEditorSchema.parse(projection)
    })
  }

  private async editorialLocator(manager: EntityManager, offering: CatalogOfferingEntity): Promise<OfferingEditorialLocator | null> {
    const link = await manager.findOne(CmsSourceLinkEntity, { where: { sourceKind: "catalog_offering", sourceId: offering.id } })
    if (!link) return null
    const node = await manager.findOne(CmsNodeEntity, { where: { id: link.nodeId } })
    if (!node) throw conflict("OFFERING_EDITORIAL_LOCATOR_INVALID", "CMS locator ссылается на отсутствующий материал", { nodeId: link.nodeId })
    const revisions = await manager.find(CmsNodeRevisionEntity, {
      where: { nodeId: node.id, state: In(["draft", "review", "approved", "scheduled", "published"]) },
      order: { revision: "DESC" },
    })
    const current = revisions[0] ?? null
    const latestPublished = revisions.find((revision) => revision.state === "published") ?? null
    const profiles = await manager.find(CmsPublicProfileEntity, {
      where: [{ kind: "catalog_offering", entityId: offering.id }, { nodeId: node.id }],
    })
    const exactProfile = profiles.find((profile) => profile.archivedAt === null && profile.kind === "catalog_offering" && profile.entityId === offering.id && profile.nodeId === node.id)
    const blockers: Array<"offering_not_active" | "cms_node_archived" | "cms_node_kind_incompatible" | "public_profile_missing" | "public_profile_mismatch" | "revision_relation_missing" | "revision_relation_mismatch" | "safe_public_projection_missing"> = []
    if (offering.state !== "active" || offering.archivedAt !== null) blockers.push("offering_not_active")
    if (node.status !== "active" || node.archivedAt !== null) blockers.push("cms_node_archived")
    const expectedNodeKind = offering.kind === "addon" ? "addon_detail" : offering.kind === "program" ? "program_detail" : offering.kind === "event_service" ? "event_detail" : "resource_detail"
    if (node.kind !== expectedNodeKind) blockers.push("cms_node_kind_incompatible")
    if (!exactProfile) blockers.push(profiles.length === 0 ? "public_profile_missing" : "public_profile_mismatch")
    const relations = current?.relations.filter((relation) => relation.kind === "catalog_offering") ?? []
    if (relations.length === 0) blockers.push("revision_relation_missing")
    else if (relations.length !== 1 || relations[0]?.entityId !== offering.id) blockers.push("revision_relation_mismatch")
    // P4.5E exposes strict typed public summaries for add-ons, venues, houses and programs.
    // Houses additionally need the exact operational join used by the public resolver.
    if (offering.kind === "house") {
      const primaryBindings = await manager.find(OfferingBindingEntity, { where: { offeringId: offering.id, role: "primary", archivedAt: IsNull() } })
      const binding = primaryBindings.length === 1 ? primaryBindings[0] : null
      const resource = binding?.resourceId ? await manager.findOne(ResourceEntity, { where: { id: binding.resourceId, archivedAt: IsNull() } }) : null
      const calendar = await manager.findOne(BusinessCalendarEntity, { where: { id: offering.businessCalendarId, state: "active", archivedAt: IsNull() } })
      if (!binding || binding.quantityDefault !== 1 || binding.capacityImpactDefault !== 1 || !binding.availabilityRequired || !resource || !["house", "houses"].includes(resource.kind) || resource.capacityMode !== "fixed" || resource.capacityTotal <= 0 || !calendar || !current?.path.startsWith("/houses/")) {
        blockers.push("safe_public_projection_missing")
      }
    } else if (offering.kind === "campground") {
      const terms = await manager.findOne(CampgroundOfferingTermsEntity, { where: { offeringId: offering.id } })
      const primaryBindings = await manager.find(OfferingBindingEntity, { where: { offeringId: offering.id, role: "primary", archivedAt: IsNull() } })
      const binding = primaryBindings.length === 1 ? primaryBindings[0] : null
      const expectedMode = terms?.sellableUnit === "owned_tent" ? "fixed" : terms?.sellableUnit === "own_tent_pitch" ? "shared" : null
      const expectedRole = terms?.sellableUnit === "owned_tent" ? "owned_tent" : terms?.sellableUnit === "own_tent_pitch" ? "own_tent_area" : null
      const resource = binding?.resourceId ? await manager.findOne(ResourceEntity, { where: { id: binding.resourceId, archivedAt: IsNull() } }) : null
      const memberships = resource && expectedRole ? await manager.query(`
        SELECT member.id
        FROM resource_group_members member
        JOIN resource_groups resource_group ON resource_group.id = member.group_id
        WHERE member.resource_id = $1 AND member.role = $2 AND member.archived_at IS NULL
          AND resource_group.kind = 'campground' AND resource_group.state = 'active' AND resource_group.archived_at IS NULL
      `, [resource.id, expectedRole]) as Array<{ id: string }> : []
      const calendar = await manager.findOne(BusinessCalendarEntity, { where: { id: offering.businessCalendarId, state: "active", archivedAt: IsNull() } })
      const termsValid = terms?.offeringKind === "campground" && terms.capacityUnit === "tent" && terms.pricingBasis === "per_night"
        && ((terms.sellableUnit === "owned_tent" && terms.inventoryMode === "discrete_inventory") || (terms.sellableUnit === "own_tent_pitch" && terms.inventoryMode === "shared_capacity"))
      if (!termsValid || !expectedMode || !expectedRole || !binding || binding.quantityDefault !== 1 || binding.capacityImpactDefault !== 1 || !binding.availabilityRequired || !resource || !["camping", "campground", "campground_owned_tent", "campground_own_tent_area"].includes(resource.kind) || resource.capacityMode !== expectedMode || resource.capacityTotal <= 0 || memberships.length !== 1 || !calendar || !current?.path.startsWith("/campgrounds/")) {
        blockers.push("safe_public_projection_missing")
      }
    } else if (offering.kind === "program") {
      const primaryBindings = await manager.find(OfferingBindingEntity, { where: { offeringId: offering.id, role: "primary", archivedAt: IsNull() } })
      const binding = primaryBindings.length === 1 ? primaryBindings[0] : null
      const template = binding?.programTemplateId ? await manager.findOne(ProgramTemplateEntity, { where: { id: binding.programTemplateId, publication: "published", archivedAt: IsNull() } }) : null
      const calendar = await manager.findOne(BusinessCalendarEntity, { where: { id: offering.businessCalendarId, state: "active", archivedAt: IsNull() } })
      if (!binding || !binding.programTemplateId || !template || !calendar || !current?.path.startsWith("/programs/")) blockers.push("safe_public_projection_missing")
    } else if (offering.kind !== "addon" && offering.kind !== "venue") blockers.push("safe_public_projection_missing")
    const revision = (row: CmsNodeRevisionEntity | null) => row ? {
      id: row.id, revision: row.revision, state: row.state, path: row.path, title: row.title, contentHash: row.contentHash,
    } : null
    return OfferingEditorialLocatorSchema.parse({
      source: { sourceKind: "catalog_offering", sourceId: link.sourceId, sourceVersion: link.sourceVersion, createdAt: link.createdAt.toISOString() },
      node: { id: node.id, version: node.version, kind: node.kind, status: node.status },
      currentRevision: revision(current), latestPublished: revision(latestPublished),
      publication: { eligible: blockers.length === 0, blockers: [...new Set(blockers)] },
    })
  }

  async createAddOn(input: AddOnOfferingCreateBody, context: OfferingRequestContext): Promise<AddOnOfferingCreateResult> {
    this.assertAddOnCreate(context)
    if (input.terms.serviceType !== "quantity_service" && input.terms.serviceType !== "person_service") {
      throw unprocessable("ADDON_SERVICE_TYPE_UNSUPPORTED", "Первый operational add-on slice поддерживает только quantity_service и person_service")
    }
    const scope = "offerings:addons:create"
    return this.serializable(async (manager) => {
      const hash = canonicalSha256({ command: "addon.create", actorId: context.actor.id, input })
      const replay = await this.replay<AddOnOfferingCreateResult>(manager, scope, input.operationId, input.idempotencyKey, hash)
      if (replay) return replay
      if (input.ownerOfferingId) await this.lockOfferingForAddOnOwner(manager, input.ownerOfferingId)
      const id = randomUUID()
      const code = input.code ?? `ADDON-${id.replaceAll("-", "").slice(0, 12).toUpperCase()}`
      const offering = await manager.save(manager.create(CatalogOfferingEntity, {
        id, code, kind: "addon", operationalName: input.operationalName, internalComment: input.internalComment,
        state: input.salesMode === "request_only" ? "active" : "draft",
        subjectVersion: 1, pricingVersion: 1, addonAssignmentsVersion: 1, salesMode: input.salesMode, priceDisplayMode: input.priceDisplayMode,
        currency: input.currency, timezone: input.timezone, taxMode: input.taxMode, businessCalendarId: input.businessCalendarId,
        leadDirection: null, defaultAssigneeId: null, scope: input.scope, ownerOfferingId: input.ownerOfferingId, activePriceBookId: null,
        createdBy: context.actor.id, updatedBy: context.actor.id, archivedAt: null,
      }))
      const terms = await manager.save(manager.create(AddonOfferingTermsEntity, addOnTermsEntity(offering.id, input.terms, input.standalone, context.actor.id) as never))
      await this.createAddOnEditorialDraft(manager, offering, context)
      const editorial = await this.editorialLocator(manager, offering)
      if (!editorial) throw unprocessable("OFFERING_EDITORIAL_LOCATOR_INVALID", "Не удалось создать canonical CMS locator")
      const response = AddOnOfferingCreateResultSchema.parse({ offering: offeringDto(offering, undefined, terms), terms: addOnTermsDto(terms), subjectVersion: offering.subjectVersion, editorial })
      await this.recordAddOnMutation(manager, "crm.offering.addon_created", offering, input.operationId, context, { subject: offering.subjectVersion }, hash)
      await this.remember(manager, scope, input.operationId, input.idempotencyKey, hash, response)
      return response
    })
  }

  async replaceAddOnTerms(offeringId: string, input: AddOnTermsMutationBody, context: OfferingRequestContext): Promise<AddOnTermsMutationResult> {
    this.assertAddOnTermsEdit(context)
    if (input.terms.serviceType !== "quantity_service" && input.terms.serviceType !== "person_service") throw unprocessable("ADDON_SERVICE_TYPE_UNSUPPORTED", "Первый operational add-on slice поддерживает только quantity_service и person_service")
    const scope = `offering:${offeringId}:addon-terms:replace`
    return this.serializable(async (manager) => {
      const hash = canonicalSha256({ command: "addon.terms.replace", offeringId, actorId: context.actor.id, input })
      const replay = await this.replay<AddOnTermsMutationResult>(manager, scope, input.operationId, input.idempotencyKey, hash)
      if (replay) return replay
      const offering = await this.lockAddOnOffering(manager, offeringId)
      if (offering.subjectVersion !== input.expectedSubjectVersion) throw conflict("VERSION_CONFLICT", "Условия дополнения были изменены другим пользователем", { segment: "subject", offeringId, expectedVersion: input.expectedSubjectVersion, serverVersion: offering.subjectVersion })
      const terms = await this.requireAddOnTerms(manager, offeringId)
      if (terms.serviceType !== input.terms.serviceType) throw unprocessable("ADDON_SERVICE_TYPE_IMMUTABLE", "Тип услуги дополнения нельзя изменить после создания", { serviceType: terms.serviceType })
      Object.assign(terms as unknown as AddOnTermsRow, addOnTermsEntity(offeringId, input.terms, input.standalone, context.actor.id))
      await manager.save(terms)
      const subjectVersion = await this.bumpSubjectVersion(manager, offering, input.expectedSubjectVersion, context.actor.id)
      const response = AddOnTermsMutationResultSchema.parse({ offeringId, subjectVersion, standalone: input.standalone, terms: addOnTermsDto(terms) })
      await this.recordAddOnMutation(manager, "crm.offering.addon_terms_replaced", offering, input.operationId, context, { subject: subjectVersion }, hash)
      await this.remember(manager, scope, input.operationId, input.idempotencyKey, hash, response)
      return response
    })
  }

  async createDraft(offeringId: string, input: HousePriceBookDraftCreateBody, context: OfferingRequestContext): Promise<OfferingPricingMutationResult> {
    this.assertPricingEdit(context)
    const scope = `offering:${offeringId}:price-book:create`
    return this.serializable(async (manager) => {
      const hash = canonicalSha256({ command: "createDraft", offeringId, actorId: context.actor.id, input })
      const replay = await this.replay<OfferingPricingMutationResult>(manager, scope, input.operationId, input.idempotencyKey, hash)
      if (replay) return replay
      const offering = await this.lockPricedOffering(manager, offeringId)
      this.assertPricingVersion(offering, input.expectedPricingVersion)
      const existingDraft = await manager.findOne(PriceBookEntity, { where: { offeringId, state: "draft" } })
      if (existingDraft && existingDraft.archivedAt === null) throw conflict("PRICE_BOOK_NOT_DRAFT", "У предложения уже есть редактируемый черновик", { priceBookId: existingDraft.id })
      await this.validateDraftStructure(manager, offering, input.ratePlans)
      const revisions = await manager.query(`SELECT COALESCE(MAX(revision), 0) + 1 AS "nextRevision" FROM price_books WHERE offering_id = $1`, [offeringId]) as Array<{ nextRevision: number }>
      const nextRevision = Number(revisions[0]!.nextRevision)
      const book = await manager.save(manager.create(PriceBookEntity, {
        id: randomUUID(), offeringId, revision: nextRevision, name: input.name,
        currency: offering.currency, timezone: offering.timezone, state: "draft",
        validFrom: input.validFrom, validToExclusive: input.validToExclusive,
        supersedesPriceBookId: input.supersedesPriceBookId, changeReason: input.changeReason,
        scheduledActivationAt: null, scheduledBy: null, activatedAt: null, activatedBy: null,
        retiredAt: null, retiredBy: null, createdBy: context.actor.id, updatedBy: context.actor.id, archivedAt: null,
      }))
      await this.replaceChildren(manager, book, input.ratePlans, context.actor.id)
      const pricingVersion = await this.bumpPricingVersion(manager, offering, input.expectedPricingVersion, context.actor.id)
      const response = OfferingPricingMutationResultSchema.parse({ priceBook: await loadPriceBook(manager, book.id), pricingVersion })
      await this.recordMutation(manager, "draft_created", offering, book, pricingVersion, input.operationId, context, { revision: book.revision })
      await this.remember(manager, scope, input.operationId, input.idempotencyKey, hash, response)
      return response
    })
  }

  async replaceDraft(offeringId: string, priceBookId: string, input: HousePriceBookDraftReplaceBody, context: OfferingRequestContext): Promise<OfferingPricingMutationResult> {
    this.assertPricingEdit(context)
    const scope = `offering:${offeringId}:price-book:${priceBookId}:replace`
    return this.serializable(async (manager) => {
      const hash = canonicalSha256({ command: "replaceDraft", offeringId, priceBookId, actorId: context.actor.id, input })
      const replay = await this.replay<OfferingPricingMutationResult>(manager, scope, input.operationId, input.idempotencyKey, hash)
      if (replay) return replay
      const offering = await this.lockPricedOffering(manager, offeringId)
      this.assertPricingVersion(offering, input.expectedPricingVersion)
      const book = await this.lockPriceBook(manager, offeringId, priceBookId)
      if (book.state !== "draft") throw conflict("PRICE_BOOK_NOT_DRAFT", "Активированный или запланированный прайс-лист неизменяем", { priceBookId, state: book.state })
      await this.validateDraftStructure(manager, offering, input.ratePlans)
      await this.assertDraftIds(manager, book.id, input.ratePlans)
      await manager.delete(PriceRuleEntity, { ratePlanId: In((await manager.find(RatePlanEntity, { where: { priceBookId: book.id } })).map((item) => item.id)) })
      await manager.delete(RatePlanEntity, { priceBookId: book.id })
      book.name = input.name
      book.validFrom = input.validFrom
      book.validToExclusive = input.validToExclusive
      book.changeReason = input.changeReason
      book.updatedBy = context.actor.id
      const saved = await manager.save(book)
      await this.replaceChildren(manager, saved, input.ratePlans, context.actor.id)
      const pricingVersion = await this.bumpPricingVersion(manager, offering, input.expectedPricingVersion, context.actor.id)
      const response = OfferingPricingMutationResultSchema.parse({ priceBook: await loadPriceBook(manager, saved.id), pricingVersion })
      await this.recordMutation(manager, "draft_replaced", offering, saved, pricingVersion, input.operationId, context, { revision: saved.revision })
      await this.remember(manager, scope, input.operationId, input.idempotencyKey, hash, response)
      return response
    })
  }

  async activate(offeringId: string, priceBookId: string, input: HousePriceBookActivateBody, context: OfferingRequestContext): Promise<OfferingPricingMutationResult> {
    this.assertPricingTransition(context)
    const scope = `offering:${offeringId}:price-book:${priceBookId}:activate`
    return this.serializable(async (manager) => {
      const hash = canonicalSha256({ command: "activate", offeringId, priceBookId, actorId: context.actor.id, input })
      const replay = await this.replay<OfferingPricingMutationResult>(manager, scope, input.operationId, input.idempotencyKey, hash)
      if (replay) return replay
      const offering = await this.lockPricedOffering(manager, offeringId)
      this.assertPricingVersion(offering, input.expectedPricingVersion)
      const book = await this.lockPriceBook(manager, offeringId, priceBookId)
      const now = new Date()
      if (!(["draft", "scheduled"] as string[]).includes(book.state)) throw conflict("PRICE_BOOK_NOT_DRAFT", "Прайс-лист нельзя активировать из текущего состояния", { state: book.state })
      this.assertActivationTime(book, now)
      await this.assertActivationReady(manager, offering, book)
      const activation = await this.activateLocked(manager, offering, book, now, context.actor.id)
      const activated = await loadPriceBook(manager, book.id)
      const activatedEntity = await manager.findOneByOrFail(PriceBookEntity, { id: book.id })
      const response = OfferingPricingMutationResultSchema.parse({ priceBook: activated, pricingVersion: activation.pricingVersion })
      await this.recordMutation(manager, "activated", offering, activatedEntity, activation.pricingVersion, input.operationId, context, {
        reason: input.reason,
        ...(activation.offeringStateChanged ? { offeringState: { from: "draft", to: "active", reason: "first_active_price_book" } } : {}),
      })
      await this.recordProjectionInvalidation(manager, offering, activatedEntity, activation.pricingVersion, input.operationId, context)
      await this.remember(manager, scope, input.operationId, input.idempotencyKey, hash, response)
      return response
    })
  }

  async schedule(offeringId: string, priceBookId: string, input: HousePriceBookScheduleBody, context: OfferingRequestContext): Promise<OfferingPricingMutationResult> {
    this.assertPricingTransition(context)
    const scope = `offering:${offeringId}:price-book:${priceBookId}:schedule`
    return this.serializable(async (manager) => {
      const hash = canonicalSha256({ command: "schedule", offeringId, priceBookId, actorId: context.actor.id, input })
      const replay = await this.replay<OfferingPricingMutationResult>(manager, scope, input.operationId, input.idempotencyKey, hash)
      if (replay) return replay
      const offering = await this.lockPricedOffering(manager, offeringId)
      this.assertPricingVersion(offering, input.expectedPricingVersion)
      const book = await this.lockPriceBook(manager, offeringId, priceBookId)
      if (book.state !== "draft") throw conflict("PRICE_BOOK_NOT_DRAFT", "Запланировать можно только черновик", { state: book.state })
      const scheduledAt = new Date(input.scheduledActivationAt)
      if (scheduledAt <= new Date()) throw conflict("PRICE_BOOK_ACTIVATION_TOO_EARLY", "Время активации должно быть в будущем", { validFrom: book.validFrom })
      this.assertActivationTime(book, scheduledAt)
      await this.assertActivationReady(manager, offering, book)
      const result = await manager.createQueryBuilder().update(PriceBookEntity).set({
        state: "scheduled", scheduledActivationAt: scheduledAt, scheduledBy: context.actor.id,
        updatedBy: context.actor.id, version: () => '"version" + 1', updatedAt: () => "now()",
      }).where("id = :id AND state = 'draft'", { id: book.id }).execute()
      if (result.affected !== 1) throw conflict("PRICE_BOOK_NOT_DRAFT", "Состояние прайс-листа изменилось параллельно")
      const pricingVersion = await this.bumpPricingVersion(manager, offering, input.expectedPricingVersion, context.actor.id)
      const scheduled = await loadPriceBook(manager, book.id)
      const response = OfferingPricingMutationResultSchema.parse({ priceBook: scheduled, pricingVersion })
      const scheduledEntity = await manager.findOneByOrFail(PriceBookEntity, { id: book.id })
      await this.recordMutation(manager, "scheduled", offering, scheduledEntity, pricingVersion, input.operationId, context, { reason: input.reason, scheduledActivationAt: scheduledAt.toISOString() })
      await this.remember(manager, scope, input.operationId, input.idempotencyKey, hash, response)
      return response
    })
  }

  async previewQuote(offeringId: string, input: InternalStayOfferingQuoteBody, context: OfferingRequestContext): Promise<InternalOfferingQuoteResult> {
    this.assertRead(context)
    return this.serializable(async (manager) => {
      return this.previewQuoteInManager(manager, offeringId, input, context)
    })
  }

  /** Resolve the exact active commercial subject behind an operational Resource. */
  async previewQuoteForResource(resourceId: string, input: ResourceStayOfferingQuotePreviewBody, context: OfferingRequestContext): Promise<InternalOfferingQuoteResult> {
    this.assertRead(context)
    return this.serializable(async (manager) => {
      const resource = await manager.createQueryBuilder(ResourceEntity, "resource").setLock("pessimistic_write")
        .where("resource.id = :resourceId AND resource.archived_at IS NULL", { resourceId }).getOne()
      if (!resource) throw new NotFoundException({ code: "RESOURCE_NOT_FOUND", message: "Ресурс не найден" })
      const expectedKind = stayOfferingKindForResource(resource)
      const candidates = await manager.createQueryBuilder(CatalogOfferingEntity, "offering").setLock("pessimistic_write")
        .innerJoin(OfferingBindingEntity, "binding", "binding.offering_id = offering.id")
        .where("binding.resource_id = :resourceId", { resourceId })
        .andWhere("binding.role = 'primary' AND binding.archived_at IS NULL")
        .andWhere("offering.archived_at IS NULL AND offering.state <> 'archived'")
        .andWhere("offering.kind IN (:...kinds)", { kinds: ["house", "campground"] })
        .orderBy("offering.id", "ASC")
        .getMany()
      if (candidates.length === 0) throw unprocessable("RESOURCE_STAY_OFFERING_REQUIRED", "Для ресурса нет основного предложения с ценами", { resourceId })
      if (candidates.length !== 1) throw conflict("RESOURCE_STAY_OFFERING_AMBIGUOUS", "У ресурса несколько основных предложений; требуется сверка", { resourceId, offeringIds: candidates.map((item) => item.id) })
      const offering = candidates[0]!
      if (offering.kind !== expectedKind) throw unprocessable("RESOURCE_STAY_OFFERING_KIND_MISMATCH", "Тип предложения не соответствует типу ресурса", { resourceId, resourceKind: resource.kind, offeringKind: offering.kind })
      if (offering.state !== "active") throw unprocessable("RESOURCE_STAY_OFFERING_INACTIVE", "Для расчёта нужно активное предложение", { resourceId, offeringId: offering.id, state: offering.state })
      const quantities = offering.kind === "house"
        ? { guests: input.quantity, participants: null, units: 1 as const }
        : await this.resourceQuoteQuantities(manager, offering.id, input.quantity)
      return this.previewQuoteInManager(manager, offering.id, {
        ratePlanKey: null,
        period: { type: "stay", arrivalDate: input.arrivalDate, departureDate: input.departureDate },
        quantities,
        currency: input.currency,
        addOns: input.addOns,
        operationId: input.operationId,
        idempotencyKey: input.idempotencyKey,
      }, context)
    })
  }

  private async resourceQuoteQuantities(manager: EntityManager, offeringId: string, quantity: number) {
    const terms = await this.requireCampgroundTerms(manager, offeringId)
    return terms.sellableUnit === "owned_tent"
      ? { guests: quantity, participants: null, units: 1 as const }
      : { guests: null, participants: null, units: quantity }
  }

  private async previewQuoteInManager(manager: EntityManager, offeringId: string, input: InternalStayOfferingQuoteBody, context: OfferingRequestContext): Promise<InternalOfferingQuoteResult> {
      const scope = `offering:${offeringId}:quote-preview`
      const hash = canonicalSha256({ command: "previewQuote", offeringId, actorId: context.actor.id, input })
      const replay = await this.replay<InternalOfferingQuoteResult>(manager, scope, input.operationId, input.idempotencyKey, hash)
      if (replay) return replay
      const offering = await this.lockStayOffering(manager, offeringId)
      if (offering.kind === "house" && (input.quantities.guests === null || input.quantities.units !== 1)) {
        throw unprocessable("HOUSE_QUOTE_QUANTITIES_INVALID", "Домик рассчитывается для количества гостей и одной единицы проживания")
      }
      const primaryBinding = await manager.createQueryBuilder(OfferingBindingEntity, "binding").setLock("pessimistic_write")
        .where("binding.offering_id = :offeringId AND binding.role = 'primary' AND binding.archived_at IS NULL", { offeringId }).getOne()
      if (!primaryBinding?.resourceId) throw unprocessable("OFFERING_PRIMARY_RESOURCE_REQUIRED", "Для расчёта проживания требуется primary Resource binding")
      const primaryResource = await manager.createQueryBuilder(ResourceEntity, "resource").setLock("pessimistic_write").where("resource.id = :resourceId AND resource.archived_at IS NULL", { resourceId: primaryBinding.resourceId }).getOne()
      if (!primaryResource) throw unprocessable("OFFERING_PRIMARY_RESOURCE_REQUIRED", "Primary Resource недоступен для расчёта")
      const operationalContext = offering.kind === "house"
        ? OfferingQuoteOperationalContextSchema.parse({ kind: "house_stay", subjectVersion: offering.subjectVersion, primaryResourceId: primaryResource.id, primaryResourceVersion: primaryResource.version })
        : null
      if (!offering.activePriceBookId) throw unprocessable("PRICE_BOOK_NOT_ACTIVE", "Для предложения нет активного прайс-листа")
      const book = await this.lockPriceBook(manager, offeringId, offering.activePriceBookId)
      const snapshot = await loadHousePricingSnapshot(manager, offering, book, input.period.arrivalDate, input.period.departureDate)
      const now = new Date()
      const nextScheduled = await manager.createQueryBuilder(PriceBookEntity, "book").where("book.offering_id = :offeringId", { offeringId }).andWhere("book.state = 'scheduled'").orderBy("book.scheduled_activation_at", "ASC").getOne()
      if (nextScheduled?.scheduledActivationAt && nextScheduled.scheduledActivationAt <= now) {
        throw conflict("PRICE_BOOK_NOT_ACTIVE", "Запланированная цена ожидает активации; повторите расчёт после обработки расписания", {
          priceBookId: nextScheduled.id, scheduledActivationAt: nextScheduled.scheduledActivationAt.toISOString(),
        })
      }
      const trustedContext = {
        quoteId: randomUUID(), calculatedAt: now, quoteTtlSeconds: 15 * 60,
        nextPricingActivationAt: nextScheduled?.scheduledActivationAt ?? null,
      }
      const calculation = offering.kind === "house"
        ? resolveHousePerNightQuote(snapshot, {
          offeringId, ratePlanKey: input.ratePlanKey, arrivalDate: input.period.arrivalDate,
          departureDate: input.period.departureDate, guests: input.quantities.guests,
          units: input.quantities.units, currency: input.currency,
        }, trustedContext)
        : await this.resolveCampgroundQuote(manager, offering, snapshot, input, trustedContext)
      const baseResult = quoteDto(calculation, offering.addonAssignmentsVersion)
      const addOns = await this.calculateAssignedAddOns(manager, offering, input, context, now)
      const validUntil = addOns.validUntil && addOns.validUntil < baseResult.validUntil ? addOns.validUntil : baseResult.validUntil
      const result = InternalOfferingQuoteResultSchema.parse({
        ...baseResult,
        validUntil,
        lines: [...baseResult.lines, ...addOns.lines],
        total: { amountMinor: baseResult.total.amountMinor + addOns.lines.reduce((sum, line) => sum + line.amount.amountMinor, 0), currency: baseResult.currency },
        provenance: { ...baseResult.provenance, matchedRuleIds: [...new Set([...baseResult.provenance.matchedRuleIds, ...addOns.lines.flatMap((line) => line.matchedRuleId ? [line.matchedRuleId] : [])])], addOns: addOns.provenance },
      })
      await manager.save(manager.create(OfferingQuoteSnapshotEntity, {
        id: calculation.quoteId, offeringId, offeringVersion: offering.version,
        pricingVersion: offering.pricingVersion, addOnAssignmentsVersion: offering.addonAssignmentsVersion,
        priceBookId: book.id, priceBookVersion: book.version,
        businessCalendarId: snapshot.calendar.id, businessCalendarVersion: snapshot.calendar.version,
        businessCalendarSourceVersion: snapshot.calendar.sourceVersion,
        requestPayload: { offeringId, ...input } as Record<string, unknown>,
        resultPayload: result as unknown as Record<string, unknown>,
        provenance: { base: calculation, addOns: addOns.provenance } as unknown as Record<string, unknown>,
        calculatedAt: new Date(calculation.calculatedAt), validUntil: new Date(result.validUntil),
        operationId: input.operationId, idempotencyKey: input.idempotencyKey,
        actorId: context.actor.id, requestId: context.requestId, entrySurface: context.entrySurface,
        operationalContext,
      }))
      await this.remember(manager, scope, input.operationId, input.idempotencyKey, hash, result)
      return result
  }

  private async calculateAssignedAddOns(
    manager: EntityManager,
    owner: CatalogOfferingEntity,
    input: InternalStayOfferingQuoteBody,
    context: OfferingRequestContext,
    now: Date,
  ) {
    const requested = input.addOns
    if (requested.length === 0) return { lines: [] as InternalOfferingQuoteResult["lines"], provenance: [] as NonNullable<InternalOfferingQuoteResult["provenance"]["addOns"]>, validUntil: null as string | null }
    if (new Set(requested.map((item) => item.assignmentId)).size !== requested.length) {
      throw unprocessable("ADDON_ASSIGNMENT_DUPLICATED", "Дополнительная услуга выбрана несколько раз")
    }
    const lines: InternalOfferingQuoteResult["lines"] = []
    const provenance: NonNullable<InternalOfferingQuoteResult["provenance"]["addOns"]> = []
    let validUntil: Date | null = null
    for (const selection of requested) {
      const assignment = await manager.createQueryBuilder(OfferingAddonAssignmentEntity, "assignment").setLock("pessimistic_write")
        .where("assignment.id = :id AND assignment.offering_id = :offeringId AND assignment.archived_at IS NULL", { id: selection.assignmentId, offeringId: owner.id }).getOne()
      if (!assignment || !assignment.enabled) throw unprocessable("ADDON_ASSIGNMENT_UNAVAILABLE", "Дополнительная услуга не подключена к выбранному ресурсу", { assignmentId: selection.assignmentId })
      const addOn = await manager.createQueryBuilder(CatalogOfferingEntity, "offering").setLock("pessimistic_write")
        .where("offering.id = :id AND offering.kind = 'addon' AND offering.archived_at IS NULL", { id: assignment.addonOfferingId }).getOne()
      if (!addOn || addOn.state !== "active") throw unprocessable("ADDON_OFFERING_INACTIVE", "Дополнительная услуга сейчас недоступна", { assignmentId: assignment.id })
      if (addOn.salesMode === "request_only") throw unprocessable("ADDON_REQUEST_ONLY", "Услугу по запросу пока нельзя добавить как рассчитанную позицию", { assignmentId: assignment.id })
      if (addOn.currency !== input.currency || !addOn.activePriceBookId) throw unprocessable("ADDON_PRICE_BOOK_NOT_ACTIVE", "Для дополнительной услуги нет активной цены", { assignmentId: assignment.id })
      const terms = await this.requireAddOnTerms(manager, addOn.id)
      if (!terms.applicableOfferingKinds.includes(owner.kind)) throw unprocessable("ADDON_NOT_APPLICABLE", "Дополнительная услуга не подходит выбранному ресурсу", { assignmentId: assignment.id })
      const minimum = assignment.minimumQuantity ?? terms.minimumQuantity ?? 1
      const maximum = assignment.maximumQuantity ?? terms.maximumQuantity
      const step = terms.quantityStep ?? 1
      if (selection.quantity < minimum || (maximum !== null && selection.quantity > maximum) || (selection.quantity - minimum) % step !== 0) {
        throw unprocessable("ADDON_QUANTITY_OUT_OF_RANGE", "Количество дополнительной услуги вне допустимого диапазона", { assignmentId: assignment.id, minimum, maximum, step })
      }
      const book = await this.lockPriceBook(manager, addOn.id, addOn.activePriceBookId)
      const snapshot = await loadHousePricingSnapshot(manager, addOn, book, input.period.arrivalDate, addDays(input.period.arrivalDate, 1))
      const calculation = resolveAddOnServiceDateQuote(snapshot, {
        offeringId: addOn.id,
        ratePlanKey: assignment.ratePlanKeyOverride,
        serviceDate: input.period.arrivalDate,
        quantity: selection.quantity,
        serviceType: terms.serviceType as "quantity_service" | "person_service",
        currency: input.currency,
      }, { quoteId: randomUUID(), calculatedAt: now, quoteTtlSeconds: 15 * 60, nextPricingActivationAt: null })
      const scheduled = await manager.createQueryBuilder(PriceBookEntity, "book")
        .where("book.offering_id = :offeringId AND book.state = 'scheduled'", { offeringId: addOn.id })
        .orderBy("book.scheduled_activation_at", "ASC").getOne()
      if (scheduled?.scheduledActivationAt && scheduled.scheduledActivationAt <= now) {
        throw conflict("ADDON_PRICE_BOOK_NOT_ACTIVE", "Запланированная цена дополнительной услуги ожидает активации; повторите расчёт после обработки расписания", {
          assignmentId: assignment.id, priceBookId: scheduled.id, scheduledActivationAt: scheduled.scheduledActivationAt.toISOString(),
        })
      }
      if (scheduled?.scheduledActivationAt && (!validUntil || scheduled.scheduledActivationAt < validUntil)) validUntil = scheduled.scheduledActivationAt
      lines.push({
        kind: "addon",
        label: assignment.labelOverride ?? addOn.operationalName,
        serviceDate: calculation.serviceDate,
        quantity: calculation.quantity,
        amount: { amountMinor: calculation.totalAmountMinor, currency: calculation.currency },
        ratePlanId: calculation.ratePlan.id,
        ratePlanVersion: calculation.ratePlan.version,
        matchedRuleId: calculation.matchedRule?.id ?? null,
        matchedRuleVersion: calculation.matchedRule?.version ?? null,
        addOnAssignmentId: assignment.id,
        addOnOfferingId: addOn.id,
        explanation: calculation.matchedRule?.selector.type ?? "base",
      })
      provenance.push({
        assignmentId: assignment.id,
        addOnOfferingId: addOn.id,
        serviceType: terms.serviceType as "quantity_service" | "person_service",
        offeringVersion: addOn.version,
        pricingVersion: addOn.pricingVersion,
        priceBookId: book.id,
        priceBookVersion: book.version,
        businessCalendarId: calculation.calendarId,
        businessCalendarVersion: calculation.calendarVersion,
      })
    }
    const ttl = new Date(now.getTime() + 15 * 60 * 1000)
    return { lines, provenance, validUntil: (validUntil && validUntil < ttl ? validUntil : ttl).toISOString() }
  }

  private async resolveCampgroundQuote(
    manager: EntityManager,
    offering: CatalogOfferingEntity,
    snapshot: HousePricingSnapshot,
    input: InternalStayOfferingQuoteBody,
    trustedContext: { quoteId: string; calculatedAt: Date; quoteTtlSeconds: number; nextPricingActivationAt: Date | null },
  ) {
    const terms = await this.requireCampgroundTerms(manager, offering.id)
    const primary = await manager.createQueryBuilder(OfferingBindingEntity, "binding")
      .where("binding.offering_id = :offeringId AND binding.role = 'primary' AND binding.archived_at IS NULL", { offeringId: offering.id })
      .getMany()
    if (primary.length !== 1 || !primary[0]!.resourceId) throw unprocessable("OFFERING_PRIMARY_RESOURCE_REQUIRED", "Кемпинг требует один primary Resource binding")
    const resource = await manager.findOne(ResourceEntity, { where: { id: primary[0]!.resourceId } })
    const expectedMode = terms.sellableUnit === "owned_tent" ? "fixed" : "shared"
    if (!resource || resource.archivedAt !== null || resource.capacityMode !== expectedMode) {
      throw unprocessable("CAMPGROUND_CAPACITY_MODE_MISMATCH", "Режим вместимости ресурса не соответствует campground terms", { expectedMode })
    }
    if (terms.sellableUnit === "owned_tent" && (input.quantities.guests === null || input.quantities.units !== 1)) {
      throw unprocessable("CAMPGROUND_QUOTE_QUANTITIES_INVALID", "Наша палатка рассчитывается для количества гостей и одной палатки")
    }
    if (terms.sellableUnit === "owned_tent" && input.quantities.guests! > resource.capacityTotal) {
      throw unprocessable("CAMPGROUND_CAPACITY_EXCEEDED", "Количество гостей превышает вместимость нашей палатки", {
        requestedGuests: input.quantities.guests, guestCapacity: resource.capacityTotal,
      })
    }
    if (terms.sellableUnit === "own_tent_pitch" && input.quantities.guests !== null) {
      throw unprocessable("CAMPGROUND_QUOTE_QUANTITIES_INVALID", "Общая зона рассчитывается по количеству палаточных мест без количества гостей")
    }
    if (terms.sellableUnit === "own_tent_pitch" && input.quantities.units > resource.capacityTotal) {
      throw unprocessable("CAMPGROUND_CAPACITY_EXCEEDED", "Количество палаточных мест превышает статическую вместимость общей зоны", {
        requestedUnits: input.quantities.units, capacityTotal: resource.capacityTotal,
      })
    }
    const expectedRole = terms.sellableUnit === "owned_tent" ? "owned_tent" : "own_tent_area"
    const memberships = returningRows<{ role: string }>(await manager.query(`
      SELECT member.role
      FROM resource_group_members member
      JOIN resource_groups resource_group ON resource_group.id = member.group_id
      WHERE member.resource_id = $1 AND member.archived_at IS NULL
        AND resource_group.archived_at IS NULL AND resource_group.state = 'active'
        AND member.role = $2
    `, [resource.id, expectedRole]))
    if (memberships.length !== 1) throw unprocessable("CAMPGROUND_GROUP_MEMBERSHIP_INVALID", "Продаваемый ресурс должен принадлежать одной активной campground-группе", { expectedRole })
    return resolveCampgroundPerNightQuote(snapshot, {
      offeringId: offering.id,
      ratePlanKey: input.ratePlanKey,
      arrivalDate: input.period.arrivalDate,
      departureDate: input.period.departureDate,
      guests: input.quantities.guests,
      units: input.quantities.units,
      currency: input.currency,
      salesUnit: terms.sellableUnit as "owned_tent" | "own_tent_pitch",
      allocationMode: terms.inventoryMode as "discrete_inventory" | "shared_capacity",
    }, trustedContext)
  }

  async activateDueScheduled(limit = 25): Promise<number> {
    const due = await this.dataSource.query(`
      SELECT id FROM price_books
      WHERE state = 'scheduled' AND scheduled_activation_at <= now()
      ORDER BY scheduled_activation_at, id LIMIT $1
    `, [limit]) as Array<{ id: string }>
    let activated = 0
    for (const candidate of due) {
      try {
        const changed = await this.serializable(async (manager) => {
          const book = await manager.createQueryBuilder(PriceBookEntity, "book").setLock("pessimistic_write").where("book.id = :id", { id: candidate.id }).getOne()
          if (!book || book.state !== "scheduled" || !book.scheduledActivationAt || book.scheduledActivationAt > new Date()) return false
          const offering = await this.lockPricedOffering(manager, book.offeringId)
          const now = new Date()
          this.assertActivationTime(book, now)
          await this.assertActivationReady(manager, offering, book)
          const activation = await this.activateLocked(manager, offering, book, now, null)
          const activatedBook = await manager.findOneByOrFail(PriceBookEntity, { id: book.id })
          const operationId = randomUUID()
          const context: MutationContext = { actor: null, requestId: `price-book-scheduler:${book.id}`, entrySurface: "scheduler" }
          await this.recordMutation(manager, "activated", offering, activatedBook, activation.pricingVersion, operationId, context, {
            scheduledActivationAt: book.scheduledActivationAt.toISOString(),
            ...(activation.offeringStateChanged ? { offeringState: { from: "draft", to: "active", reason: "first_active_price_book" } } : {}),
          })
          await this.recordProjectionInvalidation(manager, offering, activatedBook, activation.pricingVersion, operationId, context)
          return true
        })
        if (changed) activated += 1
      } catch (error) {
        this.logger.warn(`Scheduled price book ${candidate.id} was isolated and will retry: ${error instanceof Error ? error.message : "unknown error"}`)
      }
    }
    return activated
  }

  private async activateLocked(manager: EntityManager, offering: CatalogOfferingEntity, book: PriceBookEntity, now: Date, actorId: string | null) {
    if (offering.activePriceBookId) {
      const current = await this.lockPriceBook(manager, offering.id, offering.activePriceBookId)
      if (current.state !== "active") throw conflict("PRICE_BOOK_NOT_ACTIVE", "Указатель активного прайс-листа повреждён", { activePriceBookId: current.id, state: current.state })
      if (current.id !== book.id) {
        await manager.createQueryBuilder().update(PriceBookEntity).set({
          state: "retired", retiredAt: now, retiredBy: actorId,
          updatedBy: actorId, version: () => '"version" + 1', updatedAt: () => "now()",
        }).where("id = :id AND state = 'active'", { id: current.id }).execute()
      }
    }
    const transition = await manager.createQueryBuilder().update(PriceBookEntity).set({
      state: "active", activatedAt: now, activatedBy: actorId,
      updatedBy: actorId, version: () => '"version" + 1', updatedAt: () => "now()",
    }).where("id = :id AND state IN ('draft','scheduled')", { id: book.id }).execute()
    if (transition.affected !== 1) throw conflict("PRICE_BOOK_NOT_DRAFT", "Прайс-лист уже активирован или изменён")
    const activateOnFirstPriceBook = (offering.kind === "addon" || offering.kind === "program" || offering.kind === "event_service" || offering.kind === "venue") && offering.state === "draft"
    const updateResult = await manager.query(`
      UPDATE catalog_offerings
      SET active_price_book_id = $1, pricing_version = pricing_version + 1,
          state = CASE WHEN $4 THEN 'active' ELSE state END,
          version = CASE WHEN $4 THEN version + 1 ELSE version END,
          updated_at = now(), updated_by = $2
      WHERE id = $3 RETURNING pricing_version, version, state
    `, [book.id, actorId, offering.id, activateOnFirstPriceBook])
    const update = returningRows<{ pricing_version: number; version: number; state: string }>(updateResult)
    if (update.length !== 1) throw conflict("VERSION_CONFLICT", "Не удалось обновить активную версию цен", { offeringId: offering.id })
    offering.activePriceBookId = book.id
    offering.pricingVersion = Number(update[0]!.pricing_version)
    offering.version = Number(update[0]!.version)
    offering.state = update[0]!.state
    return { pricingVersion: Number(update[0]!.pricing_version), offeringStateChanged: activateOnFirstPriceBook }
  }

  private async assertActivationReady(manager: EntityManager, offering: CatalogOfferingEntity, book: PriceBookEntity) {
    const calendarDates = await manager.find(BusinessCalendarDateEntity, { where: { calendarId: offering.businessCalendarId }, order: { localDate: "ASC" } })
    const lastDate = calendarDates.filter((item) => item.archivedAt === null).at(-1)?.localDate
    if (!lastDate || lastDate < book.validFrom) throw unprocessable("BUSINESS_CALENDAR_GAP", "Производственный календарь не покрывает начало прайс-листа")
    if (book.validToExclusive && book.validToExclusive > addDays(lastDate, 1)) {
      throw unprocessable("BUSINESS_CALENDAR_GAP", "Производственный календарь не покрывает весь конечный период прайс-листа", {
        calendarCoveredToExclusive: addDays(lastDate, 1), priceBookValidToExclusive: book.validToExclusive,
      })
    }
    const toExclusive = book.validToExclusive && book.validToExclusive <= addDays(lastDate, 1) ? book.validToExclusive : addDays(lastDate, 1)
    const snapshot = await loadHousePricingSnapshot(manager, offering, book, book.validFrom, toExclusive)
    const issues = offering.kind === "event_service"
      ? validateEventServicePricingForActivation(await loadEventServicePricingSnapshot(manager, offering, book, snapshot), { from: book.validFrom, toExclusive })
      : offering.kind === "program"
      ? validateProgramPricingForActivation(await loadProgramPricingSnapshot(manager, offering, snapshot), book.validFrom, toExclusive)
      : offering.kind === "addon"
      ? validateAddOnPricingForActivation(snapshot, { from: book.validFrom, toExclusive }, (await this.requireAddOnTerms(manager, offering.id)).serviceType as "quantity_service" | "person_service")
      : offering.kind === "campground"
      ? validateCampgroundPricingForActivation(snapshot, { from: book.validFrom, toExclusive }, (await this.requireCampgroundTerms(manager, offering.id)).sellableUnit as "owned_tent" | "own_tent_pitch")
      : offering.kind === "venue"
        ? validateVenuePricingForActivation(snapshot, { from: book.validFrom, toExclusive })
      : validateHousePricingForActivation(snapshot, { from: book.validFrom, toExclusive })
    if (issues.length > 0) throw unprocessable("PRICE_BOOK_VALIDATION_FAILED", "Прайс-лист не готов к активации", { issues })
  }

  private async replaceChildren(manager: EntityManager, book: PriceBookEntity, drafts: readonly RatePlanDraft[], actorId: string) {
    const now = new Date()
    for (const [index, draft] of drafts.entries()) {
      const plan = await manager.save(manager.create(RatePlanEntity, {
        id: draft.id ?? randomUUID(), priceBookId: book.id, key: draft.key, label: draft.label,
        pricingBasis: draft.pricingBasis, baseAmountMinor: draft.baseAmount,
        baseExtraUnitAmountMinor: draft.baseExtraUnitAmount, quantityMetric: draft.quantityMetric,
        includedQuantity: draft.includedQuantity, minimumQuantity: draft.minQuantity,
        maximumQuantity: draft.maxQuantity, minimumDurationMinutes: draft.minDurationMinutes,
        maximumDurationMinutes: draft.maxDurationMinutes, sortOrder: draft.displayOrder ?? index,
        isDefault: draft.isDefault, createdAt: now, createdBy: actorId, updatedAt: now, updatedBy: actorId, archivedAt: null,
      }))
      for (const rule of draft.rules) {
        const selector = rule.dateSelector
        await manager.save(manager.create(PriceRuleEntity, {
          id: rule.id ?? randomUUID(), ratePlanId: plan.id, selector: selector.type,
          dayClass: selector.type === "day_class" ? selector.dayClass : null,
          serviceDateFrom: selector.type === "custom_date_override" ? selector.from : null,
          serviceDateToExclusive: selector.type === "custom_date_override" ? selector.toExclusive : null,
          selectorLabel: selector.type === "custom_date_override" ? selector.label : selector.type === "recurring_weekdays" ? selector.days.join(",") : null,
          minimumQuantity: rule.quantityRange?.min ?? null, maximumQuantity: rule.quantityRange?.max ?? null,
          minimumDurationMinutes: rule.durationMinutes?.min ?? null, maximumDurationMinutes: rule.durationMinutes?.max ?? null,
          minimumBookingLeadDays: rule.bookingLeadDays?.min ?? null, maximumBookingLeadDays: rule.bookingLeadDays?.max ?? null,
          amountMinor: rule.amount, extraUnitAmountMinor: rule.extraUnitAmount,
          priority: rule.priority, reason: rule.reason, enabled: rule.enabled,
          createdAt: now, createdBy: actorId, updatedAt: now, updatedBy: actorId, archivedAt: null,
        }))
      }
    }
  }

  private async validateDraftStructure(manager: EntityManager, offering: CatalogOfferingEntity, plans: readonly RatePlanDraft[]) {
    const campgroundTerms = offering.kind === "campground" ? await this.requireCampgroundTerms(manager, offering.id) : null
    if ((offering.kind === "house" || offering.kind === "campground" || offering.kind === "venue") && plans.length > 1) throw unprocessable("PRICE_BOOK_VALIDATION_FAILED", "Для ресурса допустима только одна базовая цена")
    if ((offering.kind === "house" || offering.kind === "campground" || offering.kind === "venue") && plans.length === 1 && !plans[0]!.isDefault) throw unprocessable("PRICE_BOOK_VALIDATION_FAILED", "Базовая цена ресурса должна быть ценой по умолчанию")
    const keys = new Set<string>()
    const ids = new Set<string>()
    const ruleIds = new Set<string>()
    let defaults = 0
    for (const plan of plans) {
      if (keys.has(plan.key)) throw unprocessable("PRICE_BOOK_VALIDATION_FAILED", "Ключи тарифов должны быть уникальны", { key: plan.key })
      keys.add(plan.key)
      if (plan.id && ids.has(plan.id)) throw unprocessable("PRICE_BOOK_VALIDATION_FAILED", "ID тарифов должны быть уникальны", { id: plan.id })
      if (plan.id) ids.add(plan.id)
      if (plan.isDefault) defaults += 1
      if (offering.kind === "addon") {
        const terms = await this.requireAddOnTerms(manager, offering.id)
        const expectedBasis = terms.serviceType === "quantity_service" ? "per_unit" : "per_person"
        const expectedMetric = terms.serviceType === "quantity_service" ? "units" : "participants"
        if (plan.pricingBasis !== expectedBasis || plan.quantityMetric !== expectedMetric) throw unprocessable("PRICE_BOOK_VALIDATION_FAILED", "Дополнение должно использовать допустимую pricing basis и quantity metric", { expectedBasis, expectedMetric })
        if (plan.includedQuantity !== null || plan.baseExtraUnitAmount !== null || plan.minQuantity !== null || plan.maxQuantity !== null) throw unprocessable("PRICE_BOOK_VALIDATION_FAILED", "Количество дополнения задаётся terms, не прайс-листом")
      } else if (offering.kind === "program") {
        if (plan.pricingBasis !== "per_person" && plan.pricingBasis !== "flat_package") throw unprocessable("PRICE_BOOK_VALIDATION_FAILED", "Программа поддерживает per_person или flat_package")
        if (plan.quantityMetric !== "participants") throw unprocessable("PRICE_BOOK_VALIDATION_FAILED", "Программа использует quantityMetric=participants")
        if (plan.pricingBasis === "per_person" && (plan.includedQuantity !== null || plan.baseExtraUnitAmount !== null)) throw unprocessable("PRICE_BOOK_VALIDATION_FAILED", "Per-person тариф не использует included/extra")
        if (plan.pricingBasis === "flat_package" && ((plan.includedQuantity === null) !== (plan.baseExtraUnitAmount === null))) throw unprocessable("PRICE_BOOK_VALIDATION_FAILED", "Package extra требует одновременно includedQuantity и extraUnitAmount")
      } else if (offering.kind === "event_service") {
        if (plan.pricingBasis !== "flat_package") throw unprocessable("PRICE_BOOK_VALIDATION_FAILED", "Мероприятие поддерживает только flat_package")
        if (plan.quantityMetric !== "guests") throw unprocessable("PRICE_BOOK_VALIDATION_FAILED", "Тариф мероприятия использует quantityMetric=guests")
        if (plan.includedQuantity === null) throw unprocessable("PRICE_BOOK_VALIDATION_FAILED", "Пакет мероприятия требует includedQuantity")
      } else if (offering.kind === "venue") {
        if (!["per_day", "per_slot", "per_hour", "flat_package"].includes(plan.pricingBasis)) throw unprocessable("PRICE_BOOK_VALIDATION_FAILED", "Площадка поддерживает per_day, per_slot, per_hour или flat_package")
        if (plan.quantityMetric !== "guests" || plan.includedQuantity === null || plan.baseExtraUnitAmount === null) throw unprocessable("PRICE_BOOK_VALIDATION_FAILED", "Тариф площадки требует quantityMetric=guests, includedQuantity и extraUnitPrice")
      } else if (plan.pricingBasis !== "per_night") throw unprocessable("PRICE_BOOK_VALIDATION_FAILED", "Проживание поддерживает только цену за ночь")
      if (offering.kind === "house" && plan.quantityMetric !== null && plan.quantityMetric !== "guests") throw unprocessable("PRICE_BOOK_VALIDATION_FAILED", "Домик может учитывать только guest quantity")
      if (campgroundTerms) {
        const expectedMetric = campgroundTerms.sellableUnit === "own_tent_pitch" ? "units" : plan.includedQuantity !== null || plan.baseExtraUnitAmount !== null ? "guests" : null
        if (plan.quantityMetric !== expectedMetric || (campgroundTerms.sellableUnit === "own_tent_pitch" && (plan.includedQuantity !== null || plan.baseExtraUnitAmount !== null))) {
          throw unprocessable("PRICE_BOOK_VALIDATION_FAILED", campgroundTerms.sellableUnit === "own_tent_pitch"
            ? "Тариф общей зоны должен задавать прямую цену per_night с quantityMetric=units"
            : "Тариф собственного шатра должен задавать цену per_night без quantity metric")
        }
      }
      for (const rule of plan.rules) {
        if (rule.id && ruleIds.has(rule.id)) throw unprocessable("PRICE_BOOK_VALIDATION_FAILED", "ID правил должны быть уникальны", { id: rule.id })
        if (rule.id) ruleIds.add(rule.id)
        if (offering.kind === "addon" && (rule.durationMinutes !== null || rule.quantityRange !== null || rule.bookingLeadDays !== null)) throw unprocessable("PRICE_BOOK_VALIDATION_FAILED", "Первый add-on slice не поддерживает quantity/duration/lead rules")
        if (offering.kind !== "addon" && offering.kind !== "program" && offering.kind !== "event_service" && offering.kind !== "venue" && rule.durationMinutes !== null) throw unprocessable("PRICE_BOOK_VALIDATION_FAILED", "Duration-правила не поддерживаются для проживания")
        if (offering.kind === "program" && plan.pricingBasis === "per_person" && rule.extraUnitAmount !== null) throw unprocessable("PRICE_BOOK_VALIDATION_FAILED", "Per-person правило не использует extra-unit цену")
        if (offering.kind === "program" && plan.pricingBasis === "flat_package" && rule.extraUnitAmount !== null && plan.includedQuantity === null) throw unprocessable("PRICE_BOOK_VALIDATION_FAILED", "Package extra требует includedQuantity")
      }
    }
    if (defaults > 1) throw unprocessable("PRICE_BOOK_VALIDATION_FAILED", "Допустим только один тариф по умолчанию")
  }

  private async assertDraftIds(manager: EntityManager, priceBookId: string, plans: readonly RatePlanDraft[]) {
    const planIds = plans.flatMap((plan) => plan.id ? [plan.id] : [])
    if (planIds.length > 0) {
      const existing = await manager.find(RatePlanEntity, { where: { id: In(planIds) } })
      if (existing.some((item) => item.priceBookId !== priceBookId)) throw conflict("PRICE_BOOK_VALIDATION_FAILED", "ID тарифа уже принадлежит другому прайс-листу")
    }
    const ruleIds = plans.flatMap((plan) => plan.rules.flatMap((rule) => rule.id ? [rule.id] : []))
    if (ruleIds.length > 0) {
      const existing = await manager.find(PriceRuleEntity, { where: { id: In(ruleIds) } })
      const owners = existing.length === 0 ? [] : await manager.find(RatePlanEntity, { where: { id: In(existing.map((item) => item.ratePlanId)) } })
      if (owners.some((item) => item.priceBookId !== priceBookId)) throw conflict("PRICE_BOOK_VALIDATION_FAILED", "ID правила уже принадлежит другому прайс-листу")
    }
  }

  private async addOnUsages(manager: EntityManager, addOnOfferingId: string) {
    const assignments = await manager.find(OfferingAddonAssignmentEntity, { where: { addonOfferingId: addOnOfferingId } })
    const active = assignments.filter((assignment) => assignment.archivedAt === null)
    const parentIds = [...new Set(active.map((assignment) => assignment.offeringId))]
    const parents = parentIds.length ? await manager.find(CatalogOfferingEntity, { where: { id: In(parentIds) } }) : []
    const byId = new Map(parents.map((parent) => [parent.id, parent]))
    return active.flatMap((assignment) => {
      const parent = byId.get(assignment.offeringId)
      return !parent || parent.archivedAt !== null ? [] : [{ assignmentId: assignment.id, parentOffering: { id: parent.id, kind: parent.kind, code: parent.code, operationalName: parent.operationalName, state: parent.state }, enabled: assignment.enabled, required: assignment.required, recommended: assignment.recommended, groupKey: assignment.groupKey, displayOrder: assignment.displayOrder }]
    })
  }

  private async boundResourceTargets(manager: EntityManager, bindings: readonly OfferingBindingEntity[]) {
    const resourceIds = [...new Set(bindings.map((binding) => {
      if (!binding.resourceId || binding.resourceGroupId || binding.programTemplateId || binding.eventServiceTemplateId) {
        throw unprocessable("OFFERING_BINDING_TARGET_UNSUPPORTED", "House editor supports only Resource binding targets", { bindingId: binding.id })
      }
      return binding.resourceId
    }))]
    if (resourceIds.length === 0) return []
    const resources = await manager.find(ResourceEntity, { where: { id: In(resourceIds) } })
    const byId = new Map(resources.map((resource) => [resource.id, resource]))
    const missingResourceIds = resourceIds.filter((id) => !byId.has(id))
    if (missingResourceIds.length) {
      throw unprocessable("OFFERING_BINDING_TARGET_NOT_FOUND", "Связанный ресурс не найден", { resourceIds: missingResourceIds })
    }
    return resourceIds.map((id) => resourceBindingTargetDto(byId.get(id)!))
  }

  private async assignedAddOnCatalog(manager: EntityManager, assignments: readonly OfferingAddonAssignmentEntity[]) {
    const addOnIds = [...new Set(assignments.map((assignment) => assignment.addonOfferingId))]
    if (addOnIds.length === 0) return []
    const [addOns, terms] = await Promise.all([
      manager.find(CatalogOfferingEntity, { where: { id: In(addOnIds) } }),
      manager.find(AddonOfferingTermsEntity, { where: { offeringId: In(addOnIds) } }),
    ])
    const addOnById = new Map(addOns.map((addOn) => [addOn.id, addOn]))
    const termsByOfferingId = new Map(terms.map((term) => [term.offeringId, term]))
    for (const addOnId of addOnIds) {
      const addOn = addOnById.get(addOnId)
      const term = termsByOfferingId.get(addOnId)
      if (!addOn || addOn.kind !== "addon" || !term || term.offeringKind !== "addon") {
        throw unprocessable("ADDON_CATALOG_TARGET_INVALID", "Назначенное дополнение не найдено или повреждено", { addOnOfferingId: addOnId })
      }
    }
    return addOnIds.map((id) => addOnCatalogItem(addOnById.get(id)!, termsByOfferingId.get(id)!))
  }

  private async primarySubjectVersion(manager: EntityManager, bindings: readonly OfferingBindingEntity[]) {
    const primary = bindings.find((item) => item.role === "primary" && item.archivedAt === null)
    if (!primary) return null
    if (primary.resourceId) {
      const subject = await manager.findOneByOrFail(ResourceEntity, { id: primary.resourceId })
      return { type: "resource" as const, id: subject.id, version: subject.version }
    }
    if (primary.resourceGroupId) {
      const subject = await manager.findOneByOrFail(ResourceGroupEntity, { id: primary.resourceGroupId })
      return { type: "resource_group" as const, id: subject.id, version: subject.version }
    }
    if (primary.programTemplateId) {
      const subject = await manager.findOneByOrFail(ProgramTemplateEntity, { id: primary.programTemplateId })
      return { type: "program_template" as const, id: subject.id, version: subject.version }
    }
    const subject = await manager.findOneByOrFail(EventServiceTemplateEntity, { id: primary.eventServiceTemplateId! })
    return { type: "event_service_template" as const, id: subject.id, version: subject.version }
  }

  private assertActivationTime(book: PriceBookEntity, at: Date) {
    const activationDate = localDate(at, book.timezone)
    if (activationDate < book.validFrom) throw conflict("PRICE_BOOK_ACTIVATION_TOO_EARLY", "Прайс-лист ещё не вступил в период действия", { validFrom: book.validFrom })
    if (book.validToExclusive && activationDate >= book.validToExclusive) {
      throw conflict("PRICE_BOOK_ACTIVATION_EXPIRED", "Период действия прайс-листа уже завершён", { validToExclusive: book.validToExclusive })
    }
  }

  private async recordMutation(manager: EntityManager, action: "draft_created" | "draft_replaced" | "scheduled" | "activated", offering: CatalogOfferingEntity, book: PriceBookEntity, pricingVersion: number, operationId: string, context: MutationContext, changes: Record<string, unknown>) {
    const now = new Date()
    const eventType = `crm.price_book.${action}` as "crm.price_book.draft_created" | "crm.price_book.draft_replaced" | "crm.price_book.scheduled" | "crm.price_book.activated"
    const event = OfferingPricingOutboxEventSchema.parse({
      eventId: randomUUID(), eventType, occurredAt: now.toISOString(), actorId: context.actor?.id ?? null,
      requestId: context.requestId, operationId, entrySurface: context.entrySurface,
      offeringId: offering.id, pricingVersion, priceBookId: book.id, priceBookVersion: book.version,
    })
    await manager.save(manager.create(ChangeLogEntity, {
      id: randomUUID(), entityType: "catalog_offering_pricing", entityId: offering.id,
      action, actorId: context.actor?.id ?? null, requestId: context.requestId,
      changes: { ...changes, operationId, entrySurface: context.entrySurface, priceBookId: book.id, pricingVersion }, createdAt: now,
    }))
    await this.saveOutbox(manager, event, ["sse"])
  }

  private async createAddOnEditorialDraft(manager: EntityManager, offering: CatalogOfferingEntity, context: OfferingRequestContext) {
    const links = manager.getRepository(CmsSourceLinkEntity)
    const existing = await links.findOneBy({ sourceKind: "catalog_offering", sourceId: offering.id })
    if (existing) {
      const node = await manager.findOne(CmsNodeEntity, { where: { id: existing.nodeId } })
      if (!node || node.kind !== "addon_detail") throw conflict("OFFERING_EDITORIAL_LOCATOR_INVALID", "Canonical CMS locator дополнения имеет несовместимый тип", { offeringId: offering.id, nodeId: existing.nodeId })
      return existing
    }
    const now = new Date(), nodeId = randomUUID(), revisionId = randomUUID(), path = `/drafts/addons/${offering.id}`
    const title = offering.operationalName.trim().slice(0, 240) || "Новое дополнение"
    const content = { route: { path, slug: offering.id, parentNodeId: null, sortOrder: 0 }, title, summary: null, hero: { mode: "inherit" }, sections: [], seo: { title: title.slice(0, 70), description: `${title}. Черновик из CRM.`.slice(0, 320), indexPolicy: "noindex_follow", canonical: { mode: "self" }, structuredData: [] }, relations: [{ kind: "catalog_offering", entityId: offering.id }], schemaVersion: 1 }
    await manager.save(manager.create(CmsNodeEntity, { id: nodeId, kind: "addon_detail", status: "active", createdBy: context.actor.id, updatedBy: context.actor.id, archivedAt: null }))
    await manager.save(manager.create(CmsNodeRevisionEntity, { id: revisionId, nodeId, revision: 1, state: "draft", path, slug: offering.id, parentNodeId: null, sortOrder: 0, title, summary: null, hero: content.hero, sections: [], seo: content.seo, relations: content.relations, schemaVersion: 1, contentHash: canonicalSha256(content), createdBy: context.actor.id, createdAt: now }))
    return manager.save(manager.create(CmsSourceLinkEntity, { id: randomUUID(), sourceKind: "catalog_offering", sourceId: offering.id, sourceVersion: offering.version, nodeId, syncState: "draft", createdAt: now }))
  }

  private async recordAddOnMutation(manager: EntityManager, topic: "crm.offering.addon_created" | "crm.offering.addon_terms_replaced", offering: CatalogOfferingEntity, operationId: string, context: OfferingRequestContext, versions: { subject: number }, configurationHash: string) {
    const now = new Date()
    const event = OfferingConfigurationOutboxEventSchema.parse({ eventId: randomUUID(), eventType: topic, occurredAt: now.toISOString(), actorId: context.actor.id, requestId: context.requestId, operationId, entrySurface: context.entrySurface, aggregate: { type: "catalog_offering", id: offering.id }, versions: { calendar: null, subject: versions.subject, addOns: null }, configurationHash })
    await manager.save(manager.create(ChangeLogEntity, { id: randomUUID(), entityType: "catalog_offering", entityId: offering.id, action: topic, actorId: context.actor.id, requestId: context.requestId, changes: event, createdAt: now }))
    await this.saveConfigurationOutbox(manager, event, ["sse"])
    if (offering.state === "active" && (offering.salesMode === "request_only" || offering.activePriceBookId !== null)) {
      const invalidation = OfferingConfigurationOutboxEventSchema.parse({ ...event, eventId: randomUUID(), eventType: "public.offering_projection.invalidated" })
      await this.saveConfigurationOutbox(manager, invalidation, ["sse", "public_projection"])
    }
  }

  private async saveConfigurationOutbox(manager: EntityManager, event: ReturnType<typeof OfferingConfigurationOutboxEventSchema.parse>, consumers: readonly string[]) {
    const at = new Date(event.occurredAt)
    await manager.save(manager.create(OutboxEventEntity, { id: event.eventId, topic: event.eventType, aggregateType: event.aggregate.type, aggregateId: event.aggregate.id, payload: event as unknown as Record<string, unknown>, availableAt: at, processedAt: null, attempts: 0, createdAt: at }))
    await manager.save(consumers.map((consumer) => manager.create(OutboxDeliveryEntity, { eventId: event.eventId, consumer, status: "pending", attempts: 0, availableAt: at, processedAt: null, lastError: null, createdAt: at, updatedAt: at })))
  }

  private async recordProjectionInvalidation(manager: EntityManager, offering: CatalogOfferingEntity, book: PriceBookEntity, pricingVersion: number, operationId: string, context: MutationContext) {
    const now = new Date()
    const event = OfferingPricingOutboxEventSchema.parse({
      eventId: randomUUID(), eventType: "public.offering_projection.invalidated", occurredAt: now.toISOString(),
      actorId: context.actor?.id ?? null, requestId: context.requestId, operationId,
      entrySurface: context.entrySurface, offeringId: offering.id, pricingVersion,
      priceBookId: book.id, priceBookVersion: book.version,
    })
    await this.saveOutbox(manager, event, ["sse", "public_projection"])
  }

  private async saveOutbox(manager: EntityManager, event: ReturnType<typeof OfferingPricingOutboxEventSchema.parse>, consumers: readonly string[]) {
    const at = new Date(event.occurredAt)
    await manager.save(manager.create(OutboxEventEntity, {
      id: event.eventId, topic: event.eventType, aggregateType: "catalog_offering",
      aggregateId: event.offeringId, payload: event as unknown as Record<string, unknown>,
      availableAt: at, processedAt: null, attempts: 0, createdAt: at,
    }))
    await manager.save(consumers.map((consumer) => manager.create(OutboxDeliveryEntity, {
      eventId: event.eventId, consumer, status: "pending", attempts: 0,
      availableAt: at, processedAt: null, lastError: null, createdAt: at, updatedAt: at,
    })))
  }

  private async uniqueResourceOfferingCode(manager: EntityManager, resource: ResourceEntity, kind: "house" | "campground" | "venue") {
    const prefix = kind === "house" ? "HOUSE" : kind === "campground" ? "CAMP" : "VENUE"
    const identity = resource.id.replaceAll("-", "").toUpperCase()
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const suffix = attempt === 0 ? identity : `${identity}-${randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase()}`
      const code = `${prefix}-${suffix}`
      if (!await manager.findOne(CatalogOfferingEntity, { where: { code } })) return code
    }
    throw conflict("OFFERING_CODE_ALLOCATION_FAILED", "Не удалось выделить уникальный код предложения", { resourceId: resource.id })
  }

  private async assertCampgroundMembership(manager: EntityManager, resourceId: string, expectedRole: "owned_tent" | "own_tent_area") {
    const memberships = returningRows<{ groupId: string }>(await manager.query(`
      SELECT member.group_id AS "groupId"
      FROM resource_group_members member
      JOIN resource_groups resource_group ON resource_group.id = member.group_id
      WHERE member.resource_id = $1 AND member.archived_at IS NULL
        AND member.role = $2 AND resource_group.archived_at IS NULL
        AND resource_group.state = 'active' AND resource_group.kind = 'campground'
      ORDER BY member.group_id ASC
    `, [resourceId, expectedRole]))
    if (memberships.length !== 1) throw unprocessable("CAMPGROUND_GROUP_MEMBERSHIP_INVALID", "Продаваемый ресурс должен принадлежать одной активной campground-группе", { resourceId, expectedRole, count: memberships.length })
  }

  private async recordStayOfferingCreated(manager: EntityManager, offering: CatalogOfferingEntity, calendarVersion: number, operationId: string, context: OfferingRequestContext, configurationHash: string) {
    const now = new Date()
    const event = OfferingConfigurationOutboxEventSchema.parse({
      eventId: randomUUID(), eventType: "crm.offering.created_from_resource", occurredAt: now.toISOString(),
      actorId: context.actor.id, requestId: context.requestId, operationId, entrySurface: context.entrySurface,
      aggregate: { type: "catalog_offering", id: offering.id },
      versions: { calendar: calendarVersion, subject: offering.subjectVersion, addOns: offering.addonAssignmentsVersion },
      configurationHash,
    })
    await manager.save(manager.create(ChangeLogEntity, {
      id: randomUUID(), entityType: "catalog_offering", entityId: offering.id, action: event.eventType,
      actorId: context.actor.id, requestId: context.requestId,
      changes: { operationId, entrySurface: context.entrySurface, resourceOrigin: true, versions: event.versions, configurationHash }, createdAt: now,
    }))
    await this.saveConfigurationOutbox(manager, event, ["sse"])
  }

  private async replay<T>(manager: EntityManager, scope: string, operationId: string, idempotencyKey: string, requestHash: string): Promise<T | null> {
    const locks = [`key:${scope}:${idempotencyKey}`, `operation:${scope}:${operationId}`].sort()
    for (const lock of locks) await manager.query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [lock])
    const stored = await manager.createQueryBuilder(IdempotencyKeyEntity, "key")
      .where("key.scope = :scope", { scope })
      .andWhere("(key.operation_id = :operationId OR key.idempotency_key = :idempotencyKey)", { operationId, idempotencyKey })
      .getOne() as StoredReplay | null
    if (!stored) return null
    if (stored.operationId !== operationId || stored.idempotencyKey !== idempotencyKey || stored.requestHash !== requestHash) {
      throw conflict("IDEMPOTENCY_CONFLICT", "Ключ идемпотентности уже использован для другой операции")
    }
    return stored.responseBody as T
  }

  private async remember(manager: EntityManager, scope: string, operationId: string, idempotencyKey: string, requestHash: string, response: object) {
    await manager.save(manager.create(IdempotencyKeyEntity, {
      id: randomUUID(), scope, operationId, idempotencyKey, requestHash,
      responseStatus: 200, responseBody: response as Record<string, unknown>, createdAt: new Date(),
    }))
  }

  private async findStayOffering(manager: EntityManager, offeringId: string) {
    const offering = await manager.findOne(CatalogOfferingEntity, { where: { id: offeringId } })
    if (!offering || offering.archivedAt !== null) throw new NotFoundException({ code: "OFFERING_NOT_FOUND", message: "Предложение не найдено" })
    if (offering.kind !== "house" && offering.kind !== "campground") throw unprocessable("OFFERING_KIND_UNSUPPORTED", "Редактор проживания поддерживает домики и кемпинги")
    return offering
  }

  private async findOffering(manager: EntityManager, offeringId: string) {
    const offering = await manager.findOne(CatalogOfferingEntity, { where: { id: offeringId } })
    if (!offering || offering.archivedAt !== null) throw new NotFoundException({ code: "OFFERING_NOT_FOUND", message: "Предложение не найдено" })
    if (offering.kind !== "house" && offering.kind !== "campground" && offering.kind !== "addon" && offering.kind !== "venue" && offering.kind !== "program" && offering.kind !== "event_service") throw unprocessable("OFFERING_KIND_UNSUPPORTED", "Редактор не поддерживает этот тип предложения")
    return offering
  }

  private async lockStayOffering(manager: EntityManager, offeringId: string) {
    const offering = await manager.createQueryBuilder(CatalogOfferingEntity, "offering").setLock("pessimistic_write").where("offering.id = :offeringId", { offeringId }).getOne()
    if (!offering || offering.archivedAt !== null) throw new NotFoundException({ code: "OFFERING_NOT_FOUND", message: "Предложение не найдено" })
    if (offering.kind !== "house" && offering.kind !== "campground") throw unprocessable("OFFERING_KIND_UNSUPPORTED", "Редактор проживания поддерживает домики и кемпинги")
    return offering
  }

  private async lockPricedOffering(manager: EntityManager, offeringId: string) {
    const offering = await manager.createQueryBuilder(CatalogOfferingEntity, "offering").setLock("pessimistic_write").where("offering.id = :offeringId", { offeringId }).getOne()
    if (!offering || offering.archivedAt !== null) throw new NotFoundException({ code: "OFFERING_NOT_FOUND", message: "Предложение не найдено" })
    if (offering.kind !== "house" && offering.kind !== "campground" && offering.kind !== "addon" && offering.kind !== "venue" && offering.kind !== "program" && offering.kind !== "event_service") throw unprocessable("OFFERING_KIND_UNSUPPORTED", "Ценообразование не поддерживается для этого типа предложения")
    if (offering.kind === "addon") await this.requireAddOnTerms(manager, offering.id)
    return offering
  }

  private async lockAddOnOffering(manager: EntityManager, offeringId: string) {
    const offering = await manager.createQueryBuilder(CatalogOfferingEntity, "offering").setLock("pessimistic_write").where("offering.id = :offeringId", { offeringId }).getOne()
    if (!offering || offering.archivedAt !== null || offering.kind !== "addon") throw new NotFoundException({ code: "OFFERING_NOT_FOUND", message: "Дополнение не найдено" })
    return offering
  }

  private async lockOfferingForAddOnOwner(manager: EntityManager, offeringId: string) {
    const offering = await manager.createQueryBuilder(CatalogOfferingEntity, "offering").setLock("pessimistic_write").where("offering.id = :offeringId", { offeringId }).getOne()
    if (!offering || offering.archivedAt !== null || offering.kind === "addon") throw unprocessable("ADDON_OWNER_NOT_FOUND", "Владелец offering-specific дополнения не найден", { ownerOfferingId: offeringId })
    return offering
  }

  private async requireCampgroundTerms(manager: EntityManager, offeringId: string) {
    const terms = await manager.findOne(CampgroundOfferingTermsEntity, { where: { offeringId } })
    if (!terms || terms.offeringKind !== "campground" || terms.capacityUnit !== "tent" || terms.pricingBasis !== "per_night") {
      throw unprocessable("CAMPGROUND_TERMS_INVALID", "У campground offering отсутствуют совместимые operational terms", { offeringId })
    }
    return terms
  }

  private async requireAddOnTerms(manager: EntityManager, offeringId: string) {
    const terms = await manager.findOne(AddonOfferingTermsEntity, { where: { offeringId } })
    if (!terms || terms.offeringKind !== "addon" || (terms.serviceType !== "quantity_service" && terms.serviceType !== "person_service")) throw unprocessable("ADDON_TERMS_INVALID", "Для дополнения не заданы совместимые operational terms", { offeringId })
    return terms
  }

  private async lockPriceBook(manager: EntityManager, offeringId: string, priceBookId: string) {
    const book = await manager.createQueryBuilder(PriceBookEntity, "book").setLock("pessimistic_write").where("book.id = :priceBookId AND book.offering_id = :offeringId", { priceBookId, offeringId }).getOne()
    if (!book || book.archivedAt !== null) throw new NotFoundException({ code: "PRICE_BOOK_NOT_FOUND", message: "Прайс-лист не найден" })
    return book
  }

  private assertPricingVersion(offering: CatalogOfferingEntity, expectedVersion: number) {
    if (offering.pricingVersion !== expectedVersion) throw conflict("VERSION_CONFLICT", "Условия и цены были изменены другим пользователем", {
      segment: "pricing", offeringId: offering.id, expectedVersion, serverVersion: offering.pricingVersion, affectedFields: ["priceBooks"],
    })
  }

  private async bumpPricingVersion(manager: EntityManager, offering: CatalogOfferingEntity, expectedVersion: number, actorId: string) {
    const result = await manager.query(`
      UPDATE catalog_offerings
      SET pricing_version = pricing_version + 1, updated_at = now(), updated_by = $1
      WHERE id = $2 AND pricing_version = $3
      RETURNING pricing_version
    `, [actorId, offering.id, expectedVersion])
    const rows = returningRows<{ pricing_version: number }>(result)
    if (rows.length !== 1) {
      const current = await manager.query(`SELECT pricing_version FROM catalog_offerings WHERE id = $1`, [offering.id]) as Array<{ pricing_version: number }>
      throw conflict("VERSION_CONFLICT", "Условия и цены были изменены другим пользователем", {
        segment: "pricing", offeringId: offering.id, expectedVersion, serverVersion: Number(current[0]?.pricing_version),
      })
    }
    return Number(rows[0]!.pricing_version)
  }

  private async bumpSubjectVersion(manager: EntityManager, offering: CatalogOfferingEntity, expectedVersion: number, actorId: string) {
    const rows = returningRows<{ subject_version: number }>(await manager.query(`UPDATE catalog_offerings SET subject_version = subject_version + 1, updated_at = now(), updated_by = $1 WHERE id = $2 AND subject_version = $3 RETURNING subject_version`, [actorId, offering.id, expectedVersion]))
    if (rows.length !== 1) throw conflict("VERSION_CONFLICT", "Условия дополнения были изменены другим пользователем", { segment: "subject", offeringId: offering.id, expectedVersion })
    return Number(rows[0]!.subject_version)
  }

  private assertRead(context: OfferingRequestContext) {
    if (!context.actor.capabilities.canView || (context.entrySurface === "admin" && context.actor.capabilities.canViewContent !== true)) throw new ForbiddenException({ code: "PERMISSION_DENIED", message: "Недостаточно прав для просмотра предложений" })
  }

  private assertPricingEdit(context: OfferingRequestContext) {
    if (!context.actor.capabilities.canEdit || (context.entrySurface === "admin" && context.actor.capabilities.canEditContent !== true)) throw new ForbiddenException({ code: "PERMISSION_DENIED", message: "Недостаточно прав для редактирования цен" })
  }

  private assertPricingTransition(context: OfferingRequestContext) {
    if (!context.actor.capabilities.canChangeStatus || (context.entrySurface === "admin" && context.actor.capabilities.canEditContent !== true)) throw new ForbiddenException({ code: "PERMISSION_DENIED", message: "Недостаточно прав для активации цен" })
  }

  private assertAddOnCreate(context: OfferingRequestContext) {
    if (!context.actor.capabilities.canCreate || !context.actor.capabilities.canEdit || (context.entrySurface === "admin" && context.actor.capabilities.canEditContent !== true)) throw new ForbiddenException({ code: "PERMISSION_DENIED", message: "Недостаточно прав для создания дополнения" })
  }

  private assertAddOnTermsEdit(context: OfferingRequestContext) {
    if (!context.actor.capabilities.canEdit || (context.entrySurface === "admin" && context.actor.capabilities.canEditContent !== true)) throw new ForbiddenException({ code: "PERMISSION_DENIED", message: "Недостаточно прав для редактирования условий дополнения" })
  }

  private assertStayOfferingCreate(context: OfferingRequestContext) {
    if (!context.actor.capabilities.canCreate || !context.actor.capabilities.canEdit || (context.entrySurface === "admin" && context.actor.capabilities.canEditContent !== true)) {
      throw new ForbiddenException({ code: "PERMISSION_DENIED", message: "Недостаточно прав для создания предложения из ресурса" })
    }
  }

  private async serializable<T>(operation: (manager: EntityManager) => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await this.dataSource.transaction("SERIALIZABLE", operation)
      } catch (error) {
        const code = (error as { driverError?: { code?: string }; code?: string }).driverError?.code ?? (error as { code?: string }).code
        if (attempt >= 2 || (code !== "40001" && code !== "40P01")) throw error
      }
    }
  }
}

function returningRows<T>(result: unknown): T[] {
  if (!Array.isArray(result)) return []
  return (Array.isArray(result[0]) ? result[0] : result) as T[]
}

function encodeCursor(cursor: Cursor) {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url")
}

function decodeCursor(value: string): Cursor {
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Partial<Cursor>
    if (typeof parsed.updatedAt !== "string" || typeof parsed.id !== "string") throw new Error("invalid")
    return { updatedAt: parsed.updatedAt, id: parsed.id }
  } catch {
    throw new UnprocessableEntityException({ code: "INVALID_CURSOR", message: "Некорректный курсор" })
  }
}

function encodeBindingTargetCursor(cursor: BindingTargetCursor) {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url")
}

function decodeBindingTargetCursor(value: string): BindingTargetCursor {
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Partial<BindingTargetCursor>
    if (typeof parsed.name !== "string" || typeof parsed.code !== "string" || typeof parsed.id !== "string") throw new Error("invalid")
    return { name: parsed.name, code: parsed.code, id: parsed.id }
  } catch {
    throw new UnprocessableEntityException({ code: "INVALID_CURSOR", message: "Некорректный курсор" })
  }
}

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, "\\$&")
}

function stayOfferingKindForResource(resource: Pick<ResourceEntity, "kind" | "capacityMode">): "house" | "campground" {
  if (resource.kind === "house" || resource.kind === "houses") return "house"
  if (["camping", "campground", "campground_owned_tent", "campground_own_tent_area"].includes(resource.kind)) return "campground"
  throw unprocessable("RESOURCE_STAY_KIND_UNSUPPORTED", "Для ресурса этого типа нельзя создать предложение проживания", { kind: resource.kind })
}

function campgroundTermsForResource(resource: Pick<ResourceEntity, "kind" | "capacityMode">) {
  const owned = resource.kind === "campground_owned_tent" || (resource.kind !== "campground_own_tent_area" && resource.capacityMode === "fixed")
  if (owned) return { sellableUnit: "owned_tent" as const, inventoryMode: "discrete_inventory" as const, expectedRole: "owned_tent" as const }
  if (resource.kind === "campground_own_tent_area" || resource.capacityMode === "shared") return { sellableUnit: "own_tent_pitch" as const, inventoryMode: "shared_capacity" as const, expectedRole: "own_tent_area" as const }
  throw unprocessable("CAMPGROUND_CAPACITY_MODE_UNSUPPORTED", "Нельзя определить продаваемую единицу кемпинга по режиму вместимости", { kind: resource.kind, capacityMode: resource.capacityMode })
}

function localDate(value: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(value)
  const get = (type: "year" | "month" | "day") => parts.find((item) => item.type === type)!.value
  return `${get("year")}-${get("month")}-${get("day")}`
}

function addDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function conflict(code: string, message: string, details: Record<string, unknown> = {}) {
  return new ConflictException({ code, message, details })
}

function unprocessable(code: string, message: string, details: Record<string, unknown> = {}) {
  return new UnprocessableEntityException({ code, message, details })
}
