export const crmAppBaseUrl = (
  import.meta.env.VITE_CRM_URL
  || import.meta.env.VITE_CRM_APP_URL
  || (import.meta.env.DEV ? "http://localhost:5173" : "/crm")
).replace(/\/$/, "")
