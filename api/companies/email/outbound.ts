import { Server } from "@recommand/lib/api";
import { describeRoute } from "hono-openapi";
import { zodValidator } from "@recommand/lib/zod-validator";
import { actionSuccess, actionFailure } from "@recommand/lib/utils";
import { requireCompanyAccess, type CompanyAccessContext } from "@peppol/utils/auth-middleware";
import { updateCompany } from "@peppol/data/companies";
import type { Context } from "@recommand/lib/api";
import type { AuthenticatedUserContext, AuthenticatedTeamContext } from "@core/lib/auth-middleware";
import { z } from "zod";

const server = new Server();

const updateOutboundEmailSchema = z.object({
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase letters, numbers, and hyphens"),
  enabled: z.boolean(),
});

type UpdateOutboundEmailContext = Context<
  AuthenticatedUserContext & AuthenticatedTeamContext & CompanyAccessContext,
  string,
  {
    in: { json: z.input<typeof updateOutboundEmailSchema> };
    out: { json: z.infer<typeof updateOutboundEmailSchema> };
  }
>;

const _updateOutboundEmail = server.put(
  "/:teamId/companies/:companyId/email/outbound",
  requireCompanyAccess(),
  describeRoute({
    operationId: "updateCompanyOutboundEmail",
    summary: "Update company outbound email settings",
    description: "Update the email-to-Peppol sending settings for a company",
    tags: ["Companies"],
  }),
  zodValidator("json", updateOutboundEmailSchema),
  async (c: UpdateOutboundEmailContext) => {
    try {
      const { slug, enabled } = c.req.valid("json");
      const company = c.var.company;

      const updatedCompany = await updateCompany({
        id: company.id,
        teamId: company.teamId,
        outboundEmailSlug: slug,
        outboundEmailEnabled: enabled,
      });

      const outboundEmailAddress = slug
        ? `${slug}@out.recommand.eu`
        : null;

      return c.json(
        actionSuccess({
          company: updatedCompany,
          outboundEmailAddress,
        })
      );
    } catch (error) {
      console.error("Error updating outbound email settings:", error);
      return c.json(
        actionFailure(
          error instanceof Error ? error.message : "Failed to update outbound email settings"
        ),
        400
      );
    }
  }
);

export type CompanyEmailOutbound = typeof _updateOutboundEmail;

export default server;
