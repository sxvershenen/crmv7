const requestedMode = import.meta.env.VITE_DATA_MODE

export const useFixtureData = requestedMode === "fixtures" || (import.meta.env.MODE === "test" && requestedMode !== "api")
export const cmsDataMode = useFixtureData ? "fixtures" as const : "api" as const
