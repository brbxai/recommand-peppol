import { activatedIntegrations } from "@peppol/db/schema";
import { db } from "@recommand/db";
import { eq, and } from "drizzle-orm";
import { manifestSchema } from "@peppol/types/integration/manifest";
import { configurationSchema } from "@peppol/types/integration/configuration";
import { stateSchema } from "@peppol/types/integration/state";
import type { IntegrationManifest, IntegrationConfiguration, IntegrationState } from "@peppol/types/integration";
import { UserFacingError } from "@peppol/utils/util";
import { getCompany } from "@peppol/data/companies";

export type ActivatedIntegration = typeof activatedIntegrations.$inferSelect;
export type InsertActivatedIntegration = typeof activatedIntegrations.$inferInsert;

export async function getIntegrations(teamId: string): Promise<ActivatedIntegration[]> {
  return await db.select().from(activatedIntegrations).where(eq(activatedIntegrations.teamId, teamId));
}

export async function getIntegration(
  teamId: string,
  integrationId: string
): Promise<ActivatedIntegration | undefined> {
  return await db
    .select()
    .from(activatedIntegrations)
    .where(and(eq(activatedIntegrations.teamId, teamId), eq(activatedIntegrations.id, integrationId)))
    .then((rows) => rows[0]);
}

export async function getIntegrationsByCompany(
  teamId: string,
  companyId: string
): Promise<ActivatedIntegration[]> {
  return await db
    .select()
    .from(activatedIntegrations)
    .where(
      and(eq(activatedIntegrations.teamId, teamId), eq(activatedIntegrations.companyId, companyId))
    );
}

function validateManifest(manifest: unknown): IntegrationManifest {
  const result = manifestSchema.safeParse(manifest);
  if (!result.success) {
    throw new UserFacingError(`Invalid manifest: ${result.error.errors.map(e => e.message).join(", ")}`);
  }
  return result.data;
}

function validateConfiguration(configuration: unknown): IntegrationConfiguration {
  const result = configurationSchema.safeParse(configuration);
  if (!result.success) {
    throw new UserFacingError(`Invalid configuration: ${result.error.errors.map(e => e.message).join(", ")}`);
  }
  return result.data;
}

function validateState(state: unknown): IntegrationState {
  const result = stateSchema.safeParse(state);
  if (!result.success) {
    throw new UserFacingError(`Invalid state: ${result.error.errors.map(e => e.message).join(", ")}`);
  }
  return result.data;
}

function validateConfigurationCompatibility(
  manifest: IntegrationManifest,
  configuration: IntegrationConfiguration
): void {
  if (!manifest.authTypes.includes(configuration.auth.type)) {
    throw new UserFacingError(
      `Configuration auth type '${configuration.auth.type}' is not supported by manifest. Supported types: ${manifest.authTypes.join(", ")}`
    );
  }

  const manifestFieldIds = new Set(manifest.fields.map(f => f.id));
  const configurationFieldIds = new Set(configuration.fields.map(f => f.id));

  for (const manifestField of manifest.fields) {
    if (manifestField.required && !configurationFieldIds.has(manifestField.id)) {
      throw new UserFacingError(
        `Required field '${manifestField.id}' (${manifestField.title}) is missing from configuration`
      );
    }
  }

  for (const configField of configuration.fields) {
    if (!manifestFieldIds.has(configField.id)) {
      throw new UserFacingError(
        `Configuration contains extra field '${configField.id}' that is not defined in manifest`
      );
    }
  }

  const manifestCapabilityEvents = new Set(manifest.capabilities.map(c => c.event));

  for (const configCapability of configuration.capabilities) {
    if (!manifestCapabilityEvents.has(configCapability.event)) {
      throw new UserFacingError(
        `Configuration contains capability for event '${configCapability.event}' that is not supported by manifest`
      );
    }
  }

  for (const manifestCapability of manifest.capabilities) {
    if (manifestCapability.required) {
      const configCapability = configuration.capabilities.find(c => c.event === manifestCapability.event);
      if (!configCapability || !configCapability.enabled) {
        throw new UserFacingError(
          `Required capability '${manifestCapability.event}' must be enabled in configuration`
        );
      }
    }
  }
}

export async function createIntegration(integration: Omit<InsertActivatedIntegration, "state">): Promise<ActivatedIntegration> {
  const company = await getCompany(integration.teamId, integration.companyId);
  if (!company) {
    throw new UserFacingError("Company not found or does not belong to the team");
  }

  const manifest = validateManifest(integration.manifest);
  const configuration = validateConfiguration(integration.configuration);
  const state = validateState({});

  validateConfigurationCompatibility(manifest, configuration);

  return await db
    .insert(activatedIntegrations)
    .values({ ...integration, manifest, configuration, state })
    .returning()
    .then((rows) => rows[0]);
}

export async function updateIntegration(
  integration: Omit<InsertActivatedIntegration, "state"> & { id: string; }
): Promise<ActivatedIntegration> {
  const { id, teamId, ...updateFields } = integration;
  
  const company = await getCompany(teamId, updateFields.companyId);
  if (!company) {
    throw new UserFacingError("Company not found or does not belong to the team");
  }
  
  const manifest = validateManifest(updateFields.manifest);
  const configuration = validateConfiguration(updateFields.configuration);
  
  validateConfigurationCompatibility(manifest, configuration);
  
  return await db
    .update(activatedIntegrations)
    .set({ ...updateFields, manifest, configuration })
    .where(
      and(eq(activatedIntegrations.teamId, teamId), eq(activatedIntegrations.id, id))
    )
    .returning()
    .then((rows) => rows[0]);
}

export async function deleteIntegration(
  teamId: string,
  integrationId: string
): Promise<void> {
  await db
    .delete(activatedIntegrations)
    .where(and(eq(activatedIntegrations.teamId, teamId), eq(activatedIntegrations.id, integrationId)));
}

