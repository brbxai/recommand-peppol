import { requireTeamAccess, type AuthenticatedTeamContext, type AuthenticatedUserContext } from "@core/lib/auth-middleware";
import { getCompany } from "@peppol/data/companies";
import { getCompanyVerificationLog } from "@peppol/data/company-verification";
import { getEnterpriseData } from "@peppol/data/cbe-public-search/client";
import { Server, type Context } from "@recommand/lib/api";
import { actionFailure, actionSuccess } from "@recommand/lib/utils";
import { z } from "zod";
import "zod-openapi/extend";
import { zodValidator } from "@recommand/lib/zod-validator";
import { describeRoute } from "hono-openapi";
import type { CompanyAccessContext } from "@peppol/utils/auth-middleware";
import { UserFacingError } from "@peppol/utils/util";

const server = new Server();

const getVerificationContextParamSchema = z.object({
    teamId: z.string(),
    companyVerificationLogId: z.string(),
});

type GetVerificationContextContext = Context<AuthenticatedUserContext & AuthenticatedTeamContext & CompanyAccessContext, string, { in: { param: z.input<typeof getVerificationContextParamSchema> }, out: { param: z.infer<typeof getVerificationContextParamSchema> } }>;

const _getVerificationContext = server.get(
    "/:teamId/companies/verification/:companyVerificationLogId/context",
    requireTeamAccess(),
    describeRoute({ hide: true }),
    zodValidator("param", getVerificationContextParamSchema),
    _getVerificationContextImplementation,
);

async function _getVerificationContextImplementation(c: GetVerificationContextContext) {
    try {
        const companyVerificationLogId = c.req.valid("param").companyVerificationLogId;

        const verificationLog = await getCompanyVerificationLog(companyVerificationLogId);
        if (!verificationLog) {
            return c.json(actionFailure("Company verification log not found"), 404);
        }

        const company = await getCompany(c.var.team.id, verificationLog.companyId);
        if (!company) {
            return c.json(actionFailure("Company not found"), 404);
        }

        const isRepresentativeSelectionRequired = company.country === "BE";

        let representatives: { firstName: string; lastName: string; function: string }[] = [];
        if (isRepresentativeSelectionRequired && company.enterpriseNumber) {
            try {
                const enterpriseData = await getEnterpriseData(company.enterpriseNumber, company.country);
                representatives = enterpriseData.representatives.map((rep) => ({
                    firstName: rep.firstName,
                    lastName: rep.lastName,
                    function: rep.function,
                }));
            } catch (error) {
                console.error("Failed to fetch enterprise data:", error);
            }
        }

        return c.json(actionSuccess({
            verificationLog: {
                id: verificationLog.id,
                status: verificationLog.status,
                companyName: verificationLog.companyName,
            },
            company: {
                id: company.id,
                name: company.name,
                enterpriseNumber: company.enterpriseNumber,
            },
            isRepresentativeSelectionRequired,
            representatives,
        }));
    } catch (error) {
        console.error(error);
        if (error instanceof UserFacingError) {
            return c.json(actionFailure(error), 400);
        }
        return c.json(actionFailure("Could not fetch verification context"), 500);
    }
}

export type GetVerificationContext = typeof _getVerificationContext;

export default server;
