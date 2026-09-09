import type { MigrationInterface, QueryRunner } from "typeorm"

/**
 * Additive P4.5A commercial catalog foundation. No existing resource/program
 * readers are switched here; pricing activation and migration are P4.5B work.
 */
export class OfferingCatalogFoundation1788118000000 implements MigrationInterface {
  name = "OfferingCatalogFoundation1788118000000"

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`)

    await queryRunner.query(`CREATE TABLE resource_groups (
      id uuid PRIMARY KEY, version integer NOT NULL DEFAULT 1, code text NOT NULL, kind text NOT NULL,
      name text NOT NULL, state text NOT NULL DEFAULT 'draft',
      created_at timestamptz NOT NULL DEFAULT now(), created_by uuid REFERENCES users(id),
      updated_at timestamptz NOT NULL DEFAULT now(), updated_by uuid REFERENCES users(id), archived_at timestamptz,
      CONSTRAINT resource_groups_code_unique UNIQUE (code),
      CONSTRAINT resource_groups_kind_check CHECK (kind = 'campground'),
      CONSTRAINT resource_groups_name_check CHECK (length(btrim(name)) > 0),
      CONSTRAINT resource_groups_state_check CHECK (state IN ('draft','active','archived'))
    )`)
    await queryRunner.query(`CREATE INDEX resource_groups_kind_state_idx ON resource_groups(kind, state)`)

    await queryRunner.query(`CREATE TABLE resource_group_members (
      id uuid PRIMARY KEY, version integer NOT NULL DEFAULT 1,
      group_id uuid NOT NULL REFERENCES resource_groups(id) ON DELETE RESTRICT,
      resource_id uuid NOT NULL REFERENCES resources(id) ON DELETE RESTRICT,
      role text NOT NULL, sort_order integer NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(), created_by uuid REFERENCES users(id),
      updated_at timestamptz NOT NULL DEFAULT now(), updated_by uuid REFERENCES users(id), archived_at timestamptz,
      CONSTRAINT resource_group_members_role_check CHECK (role IN ('owned_tent','own_tent_area','common_area')),
      CONSTRAINT resource_group_members_sort_order_check CHECK (sort_order >= 0)
    )`)
    await queryRunner.query(`CREATE UNIQUE INDEX resource_group_members_live_unique ON resource_group_members(group_id, resource_id) WHERE archived_at IS NULL`)
    await queryRunner.query(`CREATE UNIQUE INDEX resource_group_members_one_own_tent_area_idx ON resource_group_members(group_id) WHERE role = 'own_tent_area' AND archived_at IS NULL`)
    await queryRunner.query(`CREATE INDEX resource_group_members_resource_idx ON resource_group_members(resource_id)`)

    await queryRunner.query(`CREATE TABLE event_service_templates (
      id uuid PRIMARY KEY, version integer NOT NULL DEFAULT 1, code text NOT NULL, format text NOT NULL,
      default_duration_minutes integer NOT NULL, minimum_guests integer, maximum_guests integer,
      preparation_before_minutes integer NOT NULL DEFAULT 0, preparation_after_minutes integer NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(), created_by uuid REFERENCES users(id),
      updated_at timestamptz NOT NULL DEFAULT now(), updated_by uuid REFERENCES users(id), archived_at timestamptz,
      CONSTRAINT event_service_templates_code_unique UNIQUE (code),
      CONSTRAINT event_service_templates_format_check CHECK (format IN ('wedding','corporate','birthday','other')),
      CONSTRAINT event_service_templates_duration_check CHECK (default_duration_minutes > 0),
      CONSTRAINT event_service_templates_guests_check CHECK (
        (minimum_guests IS NULL OR minimum_guests >= 0) AND (maximum_guests IS NULL OR maximum_guests >= 0)
        AND (minimum_guests IS NULL OR maximum_guests IS NULL OR minimum_guests <= maximum_guests)
      ),
      CONSTRAINT event_service_templates_preparation_check CHECK (preparation_before_minutes >= 0 AND preparation_after_minutes >= 0)
    )`)

    await queryRunner.query(`CREATE TABLE catalog_offerings (
      id uuid PRIMARY KEY, version integer NOT NULL DEFAULT 1, code text NOT NULL, kind text NOT NULL,
      operational_name text NOT NULL, internal_comment text NOT NULL DEFAULT '', state text NOT NULL DEFAULT 'draft',
      subject_version integer NOT NULL DEFAULT 1, pricing_version integer NOT NULL DEFAULT 1, addon_assignments_version integer NOT NULL DEFAULT 1,
      sales_mode text NOT NULL DEFAULT 'request_only', price_display_mode text NOT NULL DEFAULT 'request',
      currency text NOT NULL DEFAULT 'RUB', timezone text NOT NULL DEFAULT 'Europe/Moscow', tax_mode text NOT NULL DEFAULT 'tax_included',
      business_calendar_id uuid NOT NULL,
      lead_direction text, default_assignee_id uuid REFERENCES users(id) ON DELETE SET NULL,
      scope text, owner_offering_id uuid REFERENCES catalog_offerings(id) ON DELETE RESTRICT, active_price_book_id uuid,
      created_at timestamptz NOT NULL DEFAULT now(), created_by uuid REFERENCES users(id),
      updated_at timestamptz NOT NULL DEFAULT now(), updated_by uuid REFERENCES users(id), archived_at timestamptz,
      CONSTRAINT catalog_offerings_code_unique UNIQUE (code),
      CONSTRAINT catalog_offerings_kind_check CHECK (kind IN ('house','campground','addon','venue','event_service','program')),
      CONSTRAINT catalog_offerings_name_check CHECK (length(btrim(operational_name)) > 0),
      CONSTRAINT catalog_offerings_state_check CHECK (state IN ('draft','active','paused','archived')),
      CONSTRAINT catalog_offerings_segment_versions_check CHECK (subject_version > 0 AND pricing_version > 0 AND addon_assignments_version > 0),
      CONSTRAINT catalog_offerings_sales_mode_check CHECK (sales_mode IN ('request_only','quoted','selectable')),
      CONSTRAINT catalog_offerings_price_display_mode_check CHECK (price_display_mode IN ('from','exact','request')),
      CONSTRAINT catalog_offerings_currency_check CHECK (currency ~ '^[A-Z]{3}$'),
      CONSTRAINT catalog_offerings_tax_mode_check CHECK (tax_mode IN ('tax_included','tax_excluded','not_taxable')),
      CONSTRAINT catalog_offerings_id_kind_unique UNIQUE (id, kind),
      CONSTRAINT catalog_offerings_addon_scope_check CHECK (
        (kind <> 'addon' AND scope IS NULL AND owner_offering_id IS NULL)
        OR (kind = 'addon' AND ((scope = 'reusable' AND owner_offering_id IS NULL) OR (scope = 'offering_specific' AND owner_offering_id IS NOT NULL)))
      )
    )`)
    await queryRunner.query(`CREATE INDEX catalog_offerings_kind_state_idx ON catalog_offerings(kind, state)`)
    await queryRunner.query(`CREATE INDEX catalog_offerings_owner_idx ON catalog_offerings(owner_offering_id) WHERE owner_offering_id IS NOT NULL`)
    await queryRunner.query(`CREATE INDEX catalog_offerings_addon_name_trgm_idx ON catalog_offerings USING gin (lower(operational_name) gin_trgm_ops) WHERE kind = 'addon' AND archived_at IS NULL`)

    await queryRunner.query(`CREATE TABLE campground_offering_terms (
      offering_id uuid PRIMARY KEY, offering_kind text NOT NULL DEFAULT 'campground',
      sellable_unit text NOT NULL, inventory_mode text NOT NULL, capacity_unit text NOT NULL, pricing_basis text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(), created_by uuid REFERENCES users(id),
      CONSTRAINT campground_offering_terms_sellable_unit_check CHECK (sellable_unit IN ('owned_tent','own_tent_pitch')),
      CONSTRAINT campground_offering_terms_kind_check CHECK (offering_kind = 'campground'),
      CONSTRAINT campground_offering_terms_capacity_unit_check CHECK (capacity_unit = 'tent'),
      CONSTRAINT campground_offering_terms_pricing_basis_check CHECK (pricing_basis = 'per_night'),
      CONSTRAINT campground_offering_terms_inventory_mode_check CHECK (
        (sellable_unit = 'owned_tent' AND inventory_mode = 'discrete_inventory')
        OR (sellable_unit = 'own_tent_pitch' AND inventory_mode = 'shared_capacity')
      ),
      CONSTRAINT campground_offering_terms_offering_fk FOREIGN KEY (offering_id, offering_kind) REFERENCES catalog_offerings(id, kind) ON DELETE RESTRICT
    )`)

    await queryRunner.query(`CREATE TABLE addon_offering_terms (
      offering_id uuid PRIMARY KEY, offering_kind text NOT NULL DEFAULT 'addon',
      service_type text NOT NULL, standalone boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now(), created_by uuid REFERENCES users(id),
      CONSTRAINT addon_offering_terms_kind_check CHECK (offering_kind = 'addon'),
      CONSTRAINT addon_offering_terms_service_type_check CHECK (service_type IN ('scheduled_resource','quantity_service','person_service','package_service','content_only')),
      CONSTRAINT addon_offering_terms_offering_fk FOREIGN KEY (offering_id, offering_kind) REFERENCES catalog_offerings(id, kind) ON DELETE RESTRICT
    )`)

    await queryRunner.query(`CREATE TABLE offering_bindings (
      id uuid PRIMARY KEY, version integer NOT NULL DEFAULT 1, offering_id uuid NOT NULL REFERENCES catalog_offerings(id) ON DELETE RESTRICT,
      resource_id uuid REFERENCES resources(id) ON DELETE RESTRICT,
      resource_group_id uuid REFERENCES resource_groups(id) ON DELETE RESTRICT,
      program_template_id uuid REFERENCES program_templates(id) ON DELETE RESTRICT,
      event_service_template_id uuid REFERENCES event_service_templates(id) ON DELETE RESTRICT,
      role text NOT NULL, quantity_default integer NOT NULL DEFAULT 1, capacity_impact_default integer NOT NULL DEFAULT 1,
      preparation_before_minutes integer NOT NULL DEFAULT 0, preparation_after_minutes integer NOT NULL DEFAULT 0,
      availability_required boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now(), created_by uuid REFERENCES users(id),
      updated_at timestamptz NOT NULL DEFAULT now(), updated_by uuid REFERENCES users(id), archived_at timestamptz,
      CONSTRAINT offering_bindings_target_check CHECK (num_nonnulls(resource_id, resource_group_id, program_template_id, event_service_template_id) = 1),
      CONSTRAINT offering_bindings_role_check CHECK (role IN ('primary','required','optional','inventory_unit','shared_area')),
      CONSTRAINT offering_bindings_quantity_check CHECK (quantity_default > 0 AND capacity_impact_default >= 0),
      CONSTRAINT offering_bindings_preparation_check CHECK (preparation_before_minutes >= 0 AND preparation_after_minutes >= 0)
    )`)
    await queryRunner.query(`CREATE UNIQUE INDEX offering_bindings_one_primary_idx ON offering_bindings(offering_id) WHERE role = 'primary' AND archived_at IS NULL`)
    await queryRunner.query(`CREATE UNIQUE INDEX offering_bindings_live_resource_role_unique ON offering_bindings(offering_id, resource_id, role) WHERE resource_id IS NOT NULL AND archived_at IS NULL`)
    await queryRunner.query(`CREATE UNIQUE INDEX offering_bindings_live_group_role_unique ON offering_bindings(offering_id, resource_group_id, role) WHERE resource_group_id IS NOT NULL AND archived_at IS NULL`)
    await queryRunner.query(`CREATE UNIQUE INDEX offering_bindings_live_program_role_unique ON offering_bindings(offering_id, program_template_id, role) WHERE program_template_id IS NOT NULL AND archived_at IS NULL`)
    await queryRunner.query(`CREATE UNIQUE INDEX offering_bindings_live_event_template_role_unique ON offering_bindings(offering_id, event_service_template_id, role) WHERE event_service_template_id IS NOT NULL AND archived_at IS NULL`)
    await queryRunner.query(`CREATE INDEX offering_bindings_offering_role_idx ON offering_bindings(offering_id, role)`)
    await queryRunner.query(`CREATE INDEX offering_bindings_resource_idx ON offering_bindings(resource_id) WHERE resource_id IS NOT NULL`)
    await queryRunner.query(`CREATE INDEX offering_bindings_group_idx ON offering_bindings(resource_group_id) WHERE resource_group_id IS NOT NULL`)
    await queryRunner.query(`CREATE INDEX offering_bindings_program_template_idx ON offering_bindings(program_template_id) WHERE program_template_id IS NOT NULL`)
    await queryRunner.query(`CREATE INDEX offering_bindings_event_template_idx ON offering_bindings(event_service_template_id) WHERE event_service_template_id IS NOT NULL`)

    await queryRunner.query(`CREATE TABLE business_calendars (
      id uuid PRIMARY KEY, version integer NOT NULL DEFAULT 1, code text NOT NULL, name text NOT NULL, timezone text NOT NULL DEFAULT 'Europe/Moscow',
      country_code text NOT NULL DEFAULT 'RU', source text NOT NULL DEFAULT 'official_ru', source_version text NOT NULL,
      state text NOT NULL DEFAULT 'draft', imported_at timestamptz NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(), created_by uuid REFERENCES users(id),
      updated_at timestamptz NOT NULL DEFAULT now(), updated_by uuid REFERENCES users(id), archived_at timestamptz,
      CONSTRAINT business_calendars_code_unique UNIQUE (code),
      CONSTRAINT business_calendars_name_check CHECK (length(btrim(name)) > 0),
      CONSTRAINT business_calendars_country_check CHECK (country_code = 'RU'),
      CONSTRAINT business_calendars_source_check CHECK (source = 'official_ru'),
      CONSTRAINT business_calendars_state_check CHECK (state IN ('draft','active','retired'))
    )`)
    await queryRunner.query(`ALTER TABLE catalog_offerings ADD CONSTRAINT catalog_offerings_business_calendar_fk FOREIGN KEY (business_calendar_id) REFERENCES business_calendars(id) ON DELETE RESTRICT`)
    await queryRunner.query(`CREATE TABLE business_calendar_dates (
      id uuid PRIMARY KEY, version integer NOT NULL DEFAULT 1, calendar_id uuid NOT NULL REFERENCES business_calendars(id) ON DELETE RESTRICT,
      local_date date NOT NULL, official_class text NOT NULL, official_label text, source_version text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(), created_by uuid REFERENCES users(id),
      updated_at timestamptz NOT NULL DEFAULT now(), updated_by uuid REFERENCES users(id), archived_at timestamptz,
      CONSTRAINT business_calendar_dates_calendar_date_unique UNIQUE (calendar_id, local_date),
      CONSTRAINT business_calendar_dates_class_check CHECK (official_class IN ('weekday','weekend','holiday'))
    )`)
    await queryRunner.query(`CREATE INDEX business_calendar_dates_calendar_date_idx ON business_calendar_dates(calendar_id, local_date)`)
    await queryRunner.query(`CREATE TABLE business_calendar_date_overrides (
      id uuid PRIMARY KEY, version integer NOT NULL DEFAULT 1, calendar_id uuid NOT NULL REFERENCES business_calendars(id) ON DELETE RESTRICT,
      local_date date NOT NULL, override_class text NOT NULL, label text, reason text NOT NULL, state text NOT NULL DEFAULT 'active',
      created_at timestamptz NOT NULL DEFAULT now(), created_by uuid REFERENCES users(id),
      updated_at timestamptz NOT NULL DEFAULT now(), updated_by uuid REFERENCES users(id), archived_at timestamptz,
      CONSTRAINT business_calendar_date_overrides_class_check CHECK (override_class IN ('weekday','weekend','holiday')),
      CONSTRAINT business_calendar_date_overrides_reason_check CHECK (length(btrim(reason)) > 0),
      CONSTRAINT business_calendar_date_overrides_state_check CHECK (state IN ('active','archived'))
    )`)
    await queryRunner.query(`CREATE UNIQUE INDEX business_calendar_date_overrides_live_unique ON business_calendar_date_overrides(calendar_id, local_date) WHERE state = 'active' AND archived_at IS NULL`)
    await queryRunner.query(`CREATE INDEX business_calendar_date_overrides_calendar_date_idx ON business_calendar_date_overrides(calendar_id, local_date)`)

    await queryRunner.query(`CREATE TABLE price_books (
      id uuid PRIMARY KEY, version integer NOT NULL DEFAULT 1, offering_id uuid NOT NULL REFERENCES catalog_offerings(id) ON DELETE RESTRICT,
      revision integer NOT NULL, name text NOT NULL, currency text NOT NULL DEFAULT 'RUB', timezone text NOT NULL DEFAULT 'Europe/Moscow',
      state text NOT NULL DEFAULT 'draft', valid_from date NOT NULL, valid_to_exclusive date,
      supersedes_price_book_id uuid REFERENCES price_books(id) ON DELETE RESTRICT,
      change_reason text NOT NULL DEFAULT '',
      scheduled_activation_at timestamptz, scheduled_by uuid REFERENCES users(id), activated_at timestamptz, activated_by uuid REFERENCES users(id),
      retired_at timestamptz, retired_by uuid REFERENCES users(id),
      created_at timestamptz NOT NULL DEFAULT now(), created_by uuid REFERENCES users(id),
      updated_at timestamptz NOT NULL DEFAULT now(), updated_by uuid REFERENCES users(id), archived_at timestamptz,
      CONSTRAINT price_books_offering_revision_unique UNIQUE (offering_id, revision),
      CONSTRAINT price_books_id_offering_unique UNIQUE (id, offering_id),
      CONSTRAINT price_books_name_check CHECK (length(btrim(name)) > 0),
      CONSTRAINT price_books_currency_check CHECK (currency ~ '^[A-Z]{3}$'),
      CONSTRAINT price_books_state_check CHECK (state IN ('draft','scheduled','active','retired')),
      CONSTRAINT price_books_schedule_check CHECK ((state = 'scheduled' AND scheduled_activation_at IS NOT NULL) OR state <> 'scheduled'),
      CONSTRAINT price_books_valid_range_check CHECK (valid_to_exclusive IS NULL OR valid_to_exclusive > valid_from)
    )`)
    await queryRunner.query(`CREATE INDEX price_books_offering_state_period_idx ON price_books(offering_id, state, valid_from)`)
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS btree_gist`)
    await queryRunner.query(`ALTER TABLE price_books ADD CONSTRAINT price_books_active_period_excl EXCLUDE USING gist (
      offering_id WITH =, daterange(valid_from, COALESCE(valid_to_exclusive, 'infinity'::date), '[)') WITH &&
    ) WHERE (state = 'active')`)
    await queryRunner.query(`ALTER TABLE price_books ADD CONSTRAINT price_books_scheduled_period_excl EXCLUDE USING gist (
      offering_id WITH =, daterange(valid_from, COALESCE(valid_to_exclusive, 'infinity'::date), '[)') WITH &&
    ) WHERE (state = 'scheduled')`)
    await queryRunner.query(`ALTER TABLE catalog_offerings ADD CONSTRAINT catalog_offerings_active_price_book_fk FOREIGN KEY (active_price_book_id, id) REFERENCES price_books(id, offering_id) ON DELETE RESTRICT`)

    await queryRunner.query(`CREATE TABLE rate_plans (
      id uuid PRIMARY KEY, version integer NOT NULL DEFAULT 1, price_book_id uuid NOT NULL REFERENCES price_books(id) ON DELETE RESTRICT,
      rate_key text NOT NULL, label text NOT NULL, pricing_basis text NOT NULL,
      base_amount_minor integer NOT NULL, base_extra_unit_amount_minor integer,
      quantity_metric text, included_quantity integer,
      minimum_quantity integer, maximum_quantity integer, minimum_duration_minutes integer, maximum_duration_minutes integer,
      sort_order integer NOT NULL DEFAULT 0, is_default boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now(), created_by uuid REFERENCES users(id),
      updated_at timestamptz NOT NULL DEFAULT now(), updated_by uuid REFERENCES users(id), archived_at timestamptz,
      CONSTRAINT rate_plans_book_key_unique UNIQUE (price_book_id, rate_key),
      CONSTRAINT rate_plans_key_check CHECK (rate_key ~ '^[a-z][a-z0-9_]*$'),
      CONSTRAINT rate_plans_label_check CHECK (length(btrim(label)) > 0),
      CONSTRAINT rate_plans_basis_check CHECK (pricing_basis IN ('per_night','per_day','per_slot','per_hour','per_person','per_unit','flat_package')),
      CONSTRAINT rate_plans_base_amount_check CHECK (base_amount_minor >= 0 AND (base_extra_unit_amount_minor IS NULL OR base_extra_unit_amount_minor >= 0)),
      CONSTRAINT rate_plans_quantity_metric_check CHECK (quantity_metric IS NULL OR quantity_metric IN ('guests','participants','units')),
      CONSTRAINT rate_plans_included_check CHECK (included_quantity IS NULL OR included_quantity >= 0),
      CONSTRAINT rate_plans_quantity_dependency_check CHECK ((included_quantity IS NULL AND base_extra_unit_amount_minor IS NULL) OR quantity_metric IS NOT NULL),
      CONSTRAINT rate_plans_quantity_range_check CHECK ((minimum_quantity IS NULL OR minimum_quantity > 0) AND (maximum_quantity IS NULL OR maximum_quantity > 0) AND (minimum_quantity IS NULL OR maximum_quantity IS NULL OR minimum_quantity <= maximum_quantity)),
      CONSTRAINT rate_plans_duration_range_check CHECK ((minimum_duration_minutes IS NULL OR minimum_duration_minutes > 0) AND (maximum_duration_minutes IS NULL OR maximum_duration_minutes > 0) AND (minimum_duration_minutes IS NULL OR maximum_duration_minutes IS NULL OR minimum_duration_minutes <= maximum_duration_minutes)),
      CONSTRAINT rate_plans_sort_order_check CHECK (sort_order BETWEEN -100000 AND 100000)
    )`)
    await queryRunner.query(`CREATE UNIQUE INDEX rate_plans_one_default_idx ON rate_plans(price_book_id) WHERE is_default AND archived_at IS NULL`)
    await queryRunner.query(`CREATE INDEX rate_plans_price_book_order_idx ON rate_plans(price_book_id, sort_order)`)

    await queryRunner.query(`CREATE TABLE price_rules (
      id uuid PRIMARY KEY, version integer NOT NULL DEFAULT 1, rate_plan_id uuid NOT NULL REFERENCES rate_plans(id) ON DELETE RESTRICT,
      selector text NOT NULL, day_class text, service_date_from date, service_date_to_exclusive date, selector_label text,
      minimum_quantity integer, maximum_quantity integer,
      minimum_duration_minutes integer, maximum_duration_minutes integer, minimum_booking_lead_days integer, maximum_booking_lead_days integer,
      amount_minor integer, extra_unit_amount_minor integer, priority integer NOT NULL DEFAULT 0, reason text NOT NULL DEFAULT '', enabled boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now(), created_by uuid REFERENCES users(id),
      updated_at timestamptz NOT NULL DEFAULT now(), updated_by uuid REFERENCES users(id), archived_at timestamptz,
      CONSTRAINT price_rules_selector_check CHECK (
        (selector = 'any_date' AND day_class IS NULL AND service_date_from IS NULL AND service_date_to_exclusive IS NULL AND selector_label IS NULL)
        OR (selector = 'day_class' AND day_class IN ('weekday','weekend') AND service_date_from IS NULL AND service_date_to_exclusive IS NULL AND selector_label IS NULL)
        OR (selector = 'calendar_holiday' AND day_class IS NULL AND service_date_from IS NULL AND service_date_to_exclusive IS NULL AND selector_label IS NULL)
        OR (selector = 'custom_date_override' AND day_class IS NULL AND service_date_from IS NOT NULL AND service_date_to_exclusive IS NOT NULL AND length(btrim(selector_label)) > 0)
      ),
      CONSTRAINT price_rules_any_date_dimension_check CHECK (
        selector <> 'any_date' OR num_nonnulls(minimum_quantity, maximum_quantity, minimum_duration_minutes, maximum_duration_minutes, minimum_booking_lead_days, maximum_booking_lead_days) > 0
      ),
      CONSTRAINT price_rules_date_range_check CHECK (service_date_to_exclusive IS NULL OR service_date_from IS NULL OR service_date_to_exclusive > service_date_from),
      CONSTRAINT price_rules_quantity_range_check CHECK ((minimum_quantity IS NULL OR minimum_quantity >= 0) AND (maximum_quantity IS NULL OR maximum_quantity >= 0) AND (minimum_quantity IS NULL OR maximum_quantity IS NULL OR minimum_quantity <= maximum_quantity)),
      CONSTRAINT price_rules_duration_range_check CHECK ((minimum_duration_minutes IS NULL OR minimum_duration_minutes >= 0) AND (maximum_duration_minutes IS NULL OR maximum_duration_minutes >= 0) AND (minimum_duration_minutes IS NULL OR maximum_duration_minutes IS NULL OR minimum_duration_minutes <= maximum_duration_minutes)),
      CONSTRAINT price_rules_lead_range_check CHECK ((minimum_booking_lead_days IS NULL OR minimum_booking_lead_days >= 0) AND (maximum_booking_lead_days IS NULL OR maximum_booking_lead_days >= 0) AND (minimum_booking_lead_days IS NULL OR maximum_booking_lead_days IS NULL OR minimum_booking_lead_days <= maximum_booking_lead_days)),
      CONSTRAINT price_rules_amount_check CHECK ((amount_minor IS NOT NULL OR extra_unit_amount_minor IS NOT NULL) AND (amount_minor IS NULL OR amount_minor >= 0) AND (extra_unit_amount_minor IS NULL OR extra_unit_amount_minor >= 0)),
      CONSTRAINT price_rules_priority_check CHECK (priority >= 0)
    )`)
    await queryRunner.query(`CREATE INDEX price_rules_rate_plan_selector_priority_idx ON price_rules(rate_plan_id, selector, priority)`)

    await queryRunner.query(`CREATE TABLE offering_addon_assignments (
      id uuid PRIMARY KEY, version integer NOT NULL DEFAULT 1,
      offering_id uuid NOT NULL REFERENCES catalog_offerings(id) ON DELETE RESTRICT,
      addon_offering_id uuid NOT NULL, addon_offering_kind text NOT NULL DEFAULT 'addon',
      enabled boolean NOT NULL DEFAULT true, required boolean NOT NULL DEFAULT false, recommended boolean NOT NULL DEFAULT false, group_key text,
      minimum_quantity integer, maximum_quantity integer, default_quantity integer,
      display_order integer NOT NULL DEFAULT 0, label_override text, description_override text, rate_plan_key_override text,
      created_at timestamptz NOT NULL DEFAULT now(), created_by uuid REFERENCES users(id),
      updated_at timestamptz NOT NULL DEFAULT now(), updated_by uuid REFERENCES users(id), archived_at timestamptz,
      CONSTRAINT offering_addon_assignments_not_self_check CHECK (offering_id <> addon_offering_id),
      CONSTRAINT offering_addon_assignments_addon_kind_check CHECK (addon_offering_kind = 'addon'),
      CONSTRAINT offering_addon_assignments_addon_fk FOREIGN KEY (addon_offering_id, addon_offering_kind) REFERENCES catalog_offerings(id, kind) ON DELETE RESTRICT,
      CONSTRAINT offering_addon_assignments_display_order_check CHECK (display_order BETWEEN -100000 AND 100000),
      CONSTRAINT offering_addon_assignments_group_key_check CHECK (group_key IS NULL OR group_key ~ '^[a-z][a-z0-9_]*$'),
      CONSTRAINT offering_addon_assignments_rate_key_check CHECK (rate_plan_key_override IS NULL OR rate_plan_key_override ~ '^[a-z][a-z0-9_]*$'),
      CONSTRAINT offering_addon_assignments_quantity_check CHECK (
        (minimum_quantity IS NULL OR minimum_quantity >= 0)
        AND (maximum_quantity IS NULL OR maximum_quantity > 0)
        AND (minimum_quantity IS NULL OR maximum_quantity IS NULL OR minimum_quantity <= maximum_quantity)
        AND (default_quantity IS NULL OR default_quantity >= 0)
        AND (default_quantity IS NULL OR minimum_quantity IS NULL OR default_quantity >= minimum_quantity)
        AND (default_quantity IS NULL OR maximum_quantity IS NULL OR default_quantity <= maximum_quantity)
      )
    )`)
    await queryRunner.query(`CREATE UNIQUE INDEX offering_addon_assignments_live_unique ON offering_addon_assignments(offering_id, addon_offering_id) WHERE enabled AND archived_at IS NULL`)
    await queryRunner.query(`CREATE INDEX offering_addon_assignments_owner_idx ON offering_addon_assignments(offering_id, enabled, display_order)`)
    await queryRunner.query(`CREATE INDEX offering_addon_assignments_addon_idx ON offering_addon_assignments(addon_offering_id)`)
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS offering_addon_assignments`)
    await queryRunner.query(`DROP TABLE IF EXISTS price_rules`)
    await queryRunner.query(`DROP TABLE IF EXISTS rate_plans`)
    await queryRunner.query(`ALTER TABLE catalog_offerings DROP CONSTRAINT IF EXISTS catalog_offerings_active_price_book_fk`)
    await queryRunner.query(`DROP TABLE IF EXISTS price_books`)
    await queryRunner.query(`DROP TABLE IF EXISTS business_calendar_date_overrides`)
    await queryRunner.query(`DROP TABLE IF EXISTS business_calendar_dates`)
    await queryRunner.query(`ALTER TABLE catalog_offerings DROP CONSTRAINT IF EXISTS catalog_offerings_business_calendar_fk`)
    await queryRunner.query(`DROP TABLE IF EXISTS business_calendars`)
    await queryRunner.query(`DROP TABLE IF EXISTS offering_bindings`)
    await queryRunner.query(`DROP TABLE IF EXISTS addon_offering_terms`)
    await queryRunner.query(`DROP TABLE IF EXISTS campground_offering_terms`)
    await queryRunner.query(`DROP TABLE IF EXISTS catalog_offerings`)
    await queryRunner.query(`DROP TABLE IF EXISTS event_service_templates`)
    await queryRunner.query(`DROP TABLE IF EXISTS resource_group_members`)
    await queryRunner.query(`DROP TABLE IF EXISTS resource_groups`)
    // pg_trgm may predate this migration or be used by another feature, so it is intentionally retained.
  }
}
