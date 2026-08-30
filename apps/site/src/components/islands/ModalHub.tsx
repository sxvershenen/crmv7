import { useCallback, useEffect, useRef, useState } from "react";
import { Toast } from "../../react/components/common/Toast";
import { BookingModal } from "../../react/components/modals/BookingModal";
import { CallModal } from "../../react/components/modals/CallModal";
import { HouseDetailModal } from "../../react/components/modals/HouseDetailModal";
import { PrivacyPolicyModal } from "../../react/components/modals/PrivacyPolicyModal";
import type { HouseItem } from "../../react/data/resortData";
import { SITE_EVENTS, listenForSiteEvent } from "../../lib/site-events";

export function ModalHub() {
  const [bookingItemName, setBookingItemName] = useState<string | undefined>();
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [isCallOpen, setIsCallOpen] = useState(false);
  const [selectedHouse, setSelectedHouse] = useState<HouseItem | null>(null);
  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const handleToast = useCallback((message: string) => {
    setToastMessage(message);
    if (toastTimeout.current) {
      clearTimeout(toastTimeout.current);
    }

    toastTimeout.current = setTimeout(() => {
      setToastMessage(null);
      toastTimeout.current = undefined;
    }, 3500);
  }, []);

  useEffect(() => () => {
    if (toastTimeout.current) {
      clearTimeout(toastTimeout.current);
    }
  }, []);

  useEffect(() => listenForSiteEvent(SITE_EVENTS.booking, ({ itemName }) => {
    setSelectedHouse(null);
    setIsCallOpen(false);
    setBookingItemName(itemName);
    setIsBookingOpen(true);
  }), []);

  useEffect(() => listenForSiteEvent(SITE_EVENTS.call, () => {
    setSelectedHouse(null);
    setIsBookingOpen(false);
    setIsCallOpen(true);
  }), []);

  useEffect(() => listenForSiteEvent(SITE_EVENTS.house, ({ house }) => {
    setIsBookingOpen(false);
    setIsCallOpen(false);
    setSelectedHouse(house);
  }), []);

  useEffect(() => listenForSiteEvent(SITE_EVENTS.privacy, () => {
    setIsPrivacyOpen(true);
  }), []);

  useEffect(() => listenForSiteEvent(SITE_EVENTS.toast, ({ message }) => {
    handleToast(message);
  }), [handleToast]);

  useEffect(() => {
    const handleStaticAction = (event: MouseEvent) => {
      const target = event.target instanceof Element
        ? event.target.closest<HTMLElement>("[data-site-action]")
        : null;

      if (!target || target.hasAttribute("disabled")) {
        return;
      }

      switch (target.dataset.siteAction) {
        case "booking":
          event.preventDefault();
          setSelectedHouse(null);
          setIsCallOpen(false);
          setBookingItemName(target.dataset.siteItem ?? target.dataset.siteBookingItem);
          setIsBookingOpen(true);
          break;
        case "call":
          event.preventDefault();
          setSelectedHouse(null);
          setIsBookingOpen(false);
          setIsCallOpen(true);
          break;
        case "privacy":
          event.preventDefault();
          setIsPrivacyOpen(true);
          break;
        case "toast":
          event.preventDefault();
          if (target.dataset.siteMessage) {
            handleToast(target.dataset.siteMessage);
          }
          break;
        default:
          break;
      }
    };

    document.addEventListener("click", handleStaticAction);
    return () => document.removeEventListener("click", handleStaticAction);
  }, [handleToast]);

  const closeBooking = () => {
    setIsBookingOpen(false);
    setBookingItemName(undefined);
  };

  const bookingItemProps = bookingItemName === undefined
    ? {}
    : { initialItemName: bookingItemName };

  return (
    <>
      <BookingModal
        isOpen={isBookingOpen}
        onClose={closeBooking}
        onOpenCallModal={() => {
          closeBooking();
          setIsCallOpen(true);
        }}
        {...bookingItemProps}
      />
      <CallModal
        isOpen={isCallOpen}
        onClose={() => setIsCallOpen(false)}
        onToast={handleToast}
      />
      <HouseDetailModal
        house={selectedHouse}
        isOpen={Boolean(selectedHouse)}
        onClose={() => setSelectedHouse(null)}
        onBook={(houseTitle) => {
          setSelectedHouse(null);
          setBookingItemName(`Дом: ${houseTitle}`);
          setIsBookingOpen(true);
        }}
      />
      <PrivacyPolicyModal
        isOpen={isPrivacyOpen}
        onClose={() => setIsPrivacyOpen(false)}
      />
      <Toast message={toastMessage} onClose={() => setToastMessage(null)} />
    </>
  );
}

export default ModalHub;
