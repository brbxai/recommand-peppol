import { getCompanyById } from "@peppol/data/companies";
import { getCompanyVerificationLog, submitPlaygroundVerification } from "@peppol/data/company-verification";
import { isPlayground } from "@peppol/data/teams";
import { Server, type Context } from "@recommand/lib/api";
import { actionFailure, actionSuccess } from "@recommand/lib/utils";
import { z } from "zod";
import "zod-openapi/extend";
import { zodValidator } from "@recommand/lib/zod-validator";
import { UserFacingError } from "@peppol/utils/util";
import { describeRoute } from "hono-openapi";

const server = new Server();

const submitPlaygroundVerificationParamSchema = z.object({
    companyVerificationLogId: z.string(),
});

type SubmitPlaygroundVerificationContext = Context<Record<string, never>, string, { in: { param: z.input<typeof submitPlaygroundVerificationParamSchema> }, out: { param: z.infer<typeof submitPlaygroundVerificationParamSchema> } }>;

const _submitPlaygroundVerification = server.post(
    "/companies/verification/:companyVerificationLogId/submit-playground-verification",
    describeRoute({ hide: true }),
    zodValidator("param", submitPlaygroundVerificationParamSchema),
    _submitPlaygroundVerificationImplementation,
);

async function _submitPlaygroundVerificationImplementation(c: SubmitPlaygroundVerificationContext) {
    try {
        const { companyVerificationLogId } = c.req.valid("param");

        const verificationLog = await getCompanyVerificationLog(companyVerificationLogId);
        if (!verificationLog) {
            return c.json(actionFailure("Company verification log not found"), 404);
        }

        const company = await getCompanyById(verificationLog.companyId);
        if (!company) {
            return c.json(actionFailure("Company not found"), 404);
        }

        const teamIsPlayground = await isPlayground(company.teamId);
        if (!teamIsPlayground) {
            return c.json(actionFailure("This endpoint is only available for playground teams"), 403);
        }

        await submitPlaygroundVerification(companyVerificationLogId, verificationLog, company);

        return c.json(actionSuccess({ verified: true }));
    } catch (error) {
        console.error(error);
        if (error instanceof UserFacingError) {
            return c.json(actionFailure(error), 400);
        }
        return c.json(actionFailure("Could not complete playground verification"), 500);
    }
}

export type SubmitPlaygroundVerification = typeof _submitPlaygroundVerification;

export default server;
