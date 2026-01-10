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

const updateSendEmailSchema = z.object({
  sendEmailSlug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase letters, numbers, and hyphens"),
  sendEmailEnabled: z.boolean(),
});

type UpdateSendEmailContext = Context<
  AuthenticatedUserContext & AuthenticatedTeamContext & CompanyAccessContext,
  string,
  {
    in: { json: z.input<typeof updateSendEmailSchema> };
    out: { json: z.infer<typeof updateSendEmailSchema> };
  }
>;

const _updateSendEmail = server.put(
  "/:teamId/companies/:companyId/send-email",
  requireCompanyAccess(),
  describeRoute({
    operationId: "updateCompanySendEmail",
    summary: "Update company send email settings",
    description: "Update the email-to-Peppol sending settings for a company",
    tags: ["Companies"],
  }),
  zodValidator("json", updateSendEmailSchema),
  async (c: UpdateSendEmailContext) => {
    try {
      const { sendEmailSlug, sendEmailEnabled } = c.req.valid("json");
      const company = c.var.company;

      const updatedCompany = await updateCompany({
        id: company.id,
        teamId: company.teamId,
        sendEmailSlug,
        sendEmailEnabled,
      });

      const sendEmailAddress = sendEmailSlug
        ? `${sendEmailSlug}@send.recommand.eu`
        : null;

      return c.json(
        actionSuccess({
          company: updatedCompany,
          sendEmailAddress,
        })
      );
    } catch (error) {
      console.error("Error updating send email settings:", error);
      return c.json(
        actionFailure(
          error instanceof Error ? error.message : "Failed to update send email settings"
        ),
        400
      );
    }
  }
);

export type CompanySendEmail = typeof _updateSendEmail;

export default server;
