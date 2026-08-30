/** Explicit test/demo switch. Production and ordinary development use the API. */
export const useFixtureData = import.meta.env.VITE_DATA_MODE === "fixtures"
