export type TeamMemberStatus = "active" | "away" | "invited" | "archived";

export type TeamMember = {
  colorClass: string;
  email: string;
  id: string;
  version: number;
  initials: string;
  lastActiveLabel: string;
  name: string;
  openItems: number;
  phone: string;
  role: string;
  status: TeamMemberStatus;
};

export type WorkspaceProfile = {
  browserNotifications: boolean;
  email: string;
  emailNotifications: boolean;
  id: string;
  version: number;
  initials: string;
  language: "ru";
  name: string;
  notifyConflicts: boolean;
  notifyNewLeads: boolean;
  notifyOverdueTasks: boolean;
  phone: string;
  role: string;
  telegramNotifications: boolean;
  timezone: string;
};

export type IntegrationStatus = "connected" | "attention" | "planned";

export type WorkspaceIntegration = {
  description: string;
  id: string;
  lastSyncLabel: string;
  name: string;
  status: IntegrationStatus;
};

export type CrmSettings = {
  id: string;
  version: number;
  canManageSettings: boolean;
  organization: {
    currency: "RUB";
    email: string;
    locale: "ru-RU";
    name: string;
    phone: string;
    timezone: string;
  };
  operations: {
    autoAssignNewLeads: boolean;
    bookingPrefix: string;
    conflictWarnings: boolean;
    defaultLeadSource: string;
    requireClientPhone: boolean;
  };
  site: {
    connectionStatus: IntegrationStatus;
    defaultAssigneeId: string;
    defaultSource: string;
    intakeEnabled: boolean;
    publishAggregatedAvailability: boolean;
    publishPrices: boolean;
    publishResources: boolean;
    siteUrl: string;
  };
  integrations: WorkspaceIntegration[];
};
