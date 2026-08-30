import type {
  CrmSettings,
  TeamMember,
  WorkspaceProfile,
} from "@app/entities/workspace";
import {
  crmSettingsFixture,
  teamMembersFixture,
  workspaceProfileFixture,
} from "@app/fixtures/workspace";

export interface WorkspaceRepository {
  getProfile(): Promise<WorkspaceProfile>;
  getSettings(): Promise<CrmSettings>;
  listTeam(): Promise<TeamMember[]>;
  saveProfile(profile: WorkspaceProfile): Promise<WorkspaceProfile>;
  saveSettings(settings: CrmSettings): Promise<CrmSettings>;
}

export class FixtureWorkspaceRepository implements WorkspaceRepository {
  private profile = structuredClone(workspaceProfileFixture);
  private settings = structuredClone(crmSettingsFixture);
  private team = structuredClone(teamMembersFixture);

  async getProfile() {
    return Promise.resolve(structuredClone(this.profile));
  }

  async getSettings() {
    return Promise.resolve(structuredClone(this.settings));
  }

  async listTeam() {
    return Promise.resolve(structuredClone(this.team));
  }

  async saveProfile(profile: WorkspaceProfile) {
    this.profile = structuredClone(profile);
    return Promise.resolve(structuredClone(this.profile));
  }

  async saveSettings(settings: CrmSettings) {
    this.settings = structuredClone(settings);
    return Promise.resolve(structuredClone(this.settings));
  }
}

export const workspaceRepository: WorkspaceRepository =
  new FixtureWorkspaceRepository();
