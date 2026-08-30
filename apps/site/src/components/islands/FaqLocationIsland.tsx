import { FaqLocationSection } from "../../react/components/sections/FaqLocationSection";
import { openCall } from "../../lib/site-events";

export function FaqLocationIsland() {
  return <FaqLocationSection onOpenCallModal={openCall} />;
}

export default FaqLocationIsland;
