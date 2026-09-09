# Public component roadmap v2

Этот список использует официальный [shadcn/ui Components inventory](https://ui.shadcn.com/docs/components) только как проверку полноты anatomy и accessibility. Визуальные defaults shadcn не копируются: каждый компонент получает стиль из реального public consumer и фиксируется через `sourceConsumer` / `sourceNeedle`.

## Canonical сейчас

- foundations: Typography, Button, ButtonGroup, Field, Input, Select, Textarea, Checkbox, Radio, Switch;
- navigation/disclosure: Tabs, Accordion, Pagination;
- overlays/feedback: Dialog, Drawer, Popover, Tooltip, Toast, loading/error/empty states;
- booking: DateRangeCalendar, GuestStepper, BookingSummary, ResourceBookingDialog;
- public content: hero, section headers, filters, responsive rails, event/house/SPA/program/category/venue/blog cards, footer.

## Следующие extraction slices

1. Calculator: promo input group, contact-method segmented control, selectable option card, step progress.
2. Navigation: breadcrumbs, anchor navigation, mobile sheet/drawer states.
3. Catalog: active filter summary, combobox, range/slider, pagination/load-more states.
4. Media: carousel/gallery, aspect frame, upload/usage states for CMS preview.
5. Feedback: Alert, AlertDialog, Progress, Skeleton, Spinner, retry/stale states.
6. Booking: date trigger/popover, alternative dates, unavailable/conflict, stale quote, submission retry.

## Только при доказанном public use case

- Attachment/InputGroup/OTP, Combobox/Command, DropdownMenu/HoverCard, ScrollArea, Toggle/ToggleGroup;
- Table/DataTable/Chart, Message/Bubble/Marker, Kbd/Direction;
- Sidebar, Resizable, ContextMenu и Menubar не входят в public kit без отдельного сценария.

Availability, price, eligibility и booking confirmation всегда приходят из public API/CRM authority; компоненты отображают состояния, но не вычисляют бизнес-факты.
