import type { IntegrationConfiguration } from "./configuration";

export * from "./manifest";
export * from "./configuration";
export * from "./state";
export * from "./response";

export type IntegrationTaskLog = {
  id: string;
  integrationId: string;
  event: string;
  task: string;
  success: boolean;
  message: string;
  context: string;
  createdAt: string;
  updatedAt: string;
};

export type Integration = {
  id: string;
  teamId: string;
  companyId: string;
  manifest: {
    name: string;
    description: string | null;
    imageUrl: string | null;
    url: string;
  };
  configuration: IntegrationConfiguration | null;
  state: unknown;
  createdAt: string;
  updatedAt: string;
};