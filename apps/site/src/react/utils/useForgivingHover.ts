import { useCallback, useEffect, useRef, useState } from "react";

export function useForgivingHover(closeDelay = 220) {
  const [expanded, setExpanded] = useState(false);
  const closeTimer = useRef<number | undefined>(undefined);

  const cancelClose = useCallback(() => {
    if (closeTimer.current !== undefined) window.clearTimeout(closeTimer.current);
    closeTimer.current = undefined;
  }, []);
  const open = useCallback(() => {
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    cancelClose();
    setExpanded(true);
  }, [cancelClose]);
  const closeSoon = useCallback(() => {
    cancelClose();
    closeTimer.current = window.setTimeout(() => setExpanded(false), closeDelay);
  }, [cancelClose, closeDelay]);

  useEffect(() => cancelClose, [cancelClose]);

  return { expanded, open, closeSoon, cancelClose };
}
