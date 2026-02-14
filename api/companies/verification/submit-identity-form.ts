import { requireTeamAccess, type AuthenticatedTeamContext, type AuthenticatedUserContext } from "@core/lib/auth-middleware";
import { getCompany } from "@peppol/data/companies";
import { getCompanyVerificationLog, requestIdVerification, submitIdentityForm } from "@peppol/data/company-verification";
import { Server, type Context } from "@recommand/lib/api";
import { actionFailure, actionSuccess } from "@recommand/lib/utils";
import { z } from "zod";
import "zod-openapi/extend";
import { zodValidator } from "@recommand/lib/zod-validator";
import type { CompanyAccessContext } from "@peppol/utils/auth-middleware";
import { UserFacingError } from "@peppol/utils/util";

const server = new Server();

const submitIdentityFormParamSchema = z.object({
    teamId: z.string(),
    companyVerificationLogId: z.string(),
});

const submitIdentityFormJsonBodySchema = z.object({
    firstName: z.string(),
    lastName: z.string(),
});

type SubmitIdentityFormContext = Context<AuthenticatedUserContext & AuthenticatedTeamContext & CompanyAccessContext, string, { in: { param: z.input<typeof submitIdentityFormParamSchema>, json: z.input<typeof submitIdentityFormJsonBodySchema> }, out: { param: z.infer<typeof submitIdentityFormParamSchema>, json: z.infer<typeof submitIdentityFormJsonBodySchema> } }>;

const _submitIdentityForm = server.post(
    "/:teamId/companies/verification/:companyVerificationLogId/submit-identity-form",
    requireTeamAccess(),
    zodValidator("param", submitIdentityFormParamSchema),
    zodValidator("json", submitIdentityFormJsonBodySchema),
    _submitIdentityFormImplementation,
);

async function _submitIdentityFormImplementation(c: SubmitIdentityFormContext) {
    try {
        const companyVerificationLogId = c.req.valid("param").companyVerificationLogId;
        const firstName = c.req.valid("json").firstName;
        const lastName = c.req.valid("json").lastName;

        // Get the company verification log
        const companyVerificationLog = await getCompanyVerificationLog(companyVerificationLogId);
        if (!companyVerificationLog) {
            return c.json(actionFailure("Company verification log not found"), 404);
        }

        // Ensure the company verification log belongs to the team
        const company = await getCompany(c.var.team.id, companyVerificationLog.companyId);
        if (!company) {
            return c.json(actionFailure("Company verification log not found"), 404);
        }

        // Submit the identity form
        await submitIdentityForm(companyVerificationLogId, company, firstName, lastName);

        // Request ID verification
        const verificationUrl = await requestIdVerification(c.var.team.id, company.id, companyVerificationLogId);
        return c.json(actionSuccess({ verificationUrl }));
    } catch (error) {
        console.error(error);
        if (error instanceof UserFacingError) {
            return c.json(actionFailure(error), 400);
        }
        return c.json(actionFailure("Could not submit identity form"), 500);
    }
}


export type SubmitIdentityForm = typeof _submitIdentityForm;

export default server;

