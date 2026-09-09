import { useRef, useState } from "react";
import { IconMenu2, IconPlus } from "@tabler/icons-react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  ConfirmationDialog,
  cn,
} from "@crm/ui";

import { getQuickCreateItems, mobileNav, navGroups } from "@app/app/navigation";
import { useEditorLayout } from "@app/app/editor-layout-context";

export function MobileNavigation() {
  const navigate = useNavigate();
  const location = useLocation();
  const { chrome: editorChrome } = useEditorLayout();
  const createItems = getQuickCreateItems(location.pathname);
  const [createOpen, setCreateOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmLeadBooking, setConfirmLeadBooking] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  const handleMenuOpenChange = (open: boolean) => {
    setMenuOpen(open);

    if (!open) {
      requestAnimationFrame(() => menuButtonRef.current?.focus());
    }
  };
  const createRoute = (href: string) => {
    setCreateOpen(false);
    if (
      href === "/bookings/new" &&
      location.pathname.startsWith("/leads/") &&
      editorChrome
    ) {
      setConfirmLeadBooking(true);
      return;
    }
    navigate(href);
  };

  return (
    <>
      <nav
        aria-label="Мобильная навигация"
        className="fixed inset-x-0 bottom-0 z-40 grid h-[calc(3.75rem+env(safe-area-inset-bottom))] grid-cols-5 border-t bg-background pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        {mobileNav.slice(0, 2).map((item) => (
          <MobileNavLink key={item.href} {...item} />
        ))}
        <button
          aria-label="Открыть создание записи"
          className="flex min-h-11 flex-col items-center justify-center gap-0.5 text-[10px] font-medium"
          onClick={() => setCreateOpen(true)}
          type="button"
        >
          <span className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
            <IconPlus aria-hidden="true" className="size-5" />
          </span>
          <span>Создать</span>
        </button>
        <MobileNavLink {...mobileNav[2]} />
        <button
          aria-label="Открыть меню"
          className="flex min-h-11 flex-col items-center justify-center gap-1 text-[10px] text-muted-foreground"
          onClick={() => setMenuOpen(true)}
          ref={menuButtonRef}
          type="button"
        >
          <IconMenu2 aria-hidden="true" className="size-5" />
          <span>Меню</span>
        </button>
      </nav>

      <Sheet onOpenChange={setCreateOpen} open={createOpen}>
        <SheetContent className="w-full" side="bottom">
          <SheetHeader>
            <SheetTitle>Создать запись</SheetTitle>
            <SheetDescription>Выберите тип новой записи.</SheetDescription>
          </SheetHeader>
          <div className="grid grid-cols-2 gap-2 px-4 pb-5">
            {[...createItems.contextual, ...createItems.global].map((item) => (
              <button
                className="flex min-h-12 items-center gap-3 rounded-lg border px-3 text-left text-[13px] font-normal hover:bg-muted"
                key={item.href}
                onClick={() => {
                  createRoute(item.href);
                }}
                type="button"
              >
                <item.icon
                  aria-hidden="true"
                  className="size-4 text-muted-foreground"
                />
                {item.label}
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      <ConfirmationDialog
        confirmLabel="Создать бронь"
        description={`Создать бронь из заявки для клиента «${editorChrome?.title ?? "Клиент"}»?`}
        onConfirm={() => {
          const leadId = location.pathname.split("/").at(-1) ?? "";
          navigate(
            `/bookings/new?leadId=${encodeURIComponent(leadId)}&clientName=${encodeURIComponent(editorChrome?.title ?? "")}`,
          );
        }}
        onOpenChange={setConfirmLeadBooking}
        open={confirmLeadBooking}
        title="Создать бронь из заявки?"
      />

      <Sheet onOpenChange={handleMenuOpenChange} open={menuOpen}>
        <SheetContent className="w-[88%] overflow-y-auto" side="right">
          <SheetHeader>
            <SheetTitle>Меню CRM</SheetTitle>
            <SheetDescription>Все разделы и быстрые действия</SheetDescription>
          </SheetHeader>
          <div className="px-3 pb-6">
            <p className="mb-2 px-2 text-[10px] font-semibold uppercase text-muted-foreground">
              Создать
            </p>
            <div className="mb-5 grid gap-1">
              {[...createItems.contextual, ...createItems.global].map((item) => (
                <button
                  className="flex min-h-11 items-center gap-3 rounded-md px-2 text-left text-xs hover:bg-muted"
                  key={item.href}
                  onClick={() => {
                    handleMenuOpenChange(false);
                    if (
                      item.href === "/bookings/new" &&
                      location.pathname.startsWith("/leads/") &&
                      editorChrome
                    ) {
                      setConfirmLeadBooking(true);
                      return;
                    }
                    navigate(item.href);
                  }}
                  type="button"
                >
                  <item.icon aria-hidden="true" className="size-4" />
                  {item.label}
                </button>
              ))}
            </div>
            {navGroups.map((group) => (
              <div className="mb-5" key={group.label}>
                <p className="mb-2 px-2 text-[10px] font-semibold uppercase text-muted-foreground">
                  {group.label}
                </p>
                <div className="grid gap-1">
                  {group.items.map((item) => (
                    <button
                      className="flex min-h-11 items-center gap-3 rounded-md px-2 text-left text-xs hover:bg-muted"
                      key={item.href}
                      onClick={() => {
                        handleMenuOpenChange(false);
                        navigate(item.href);
                      }}
                      type="button"
                    >
                      <item.icon
                        aria-hidden="true"
                        className="size-4 text-muted-foreground"
                      />
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function MobileNavLink({
  href,
  icon: Icon,
  label,
}: (typeof mobileNav)[number]) {
  return (
    <NavLink
      className={({ isActive }) =>
        cn(
          "flex min-h-11 flex-col items-center justify-center gap-1 text-[10px] text-muted-foreground",
          isActive && "font-medium text-foreground",
        )
      }
      end={href === "/"}
      to={href}
    >
      <Icon aria-hidden="true" className="size-5" stroke={1.8} />
      <span>{label}</span>
    </NavLink>
  );
}
