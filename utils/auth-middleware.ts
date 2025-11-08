import { isMember } from "@core/data/teams";
import type {
  AuthenticatedTeamContext,
  AuthenticatedUserContext,
} from "@core/lib/auth-middleware";
import { verifySession } from "@core/lib/session";
import { getBillingProfile } from "@peppol/data/billing-profile";
import { getCompanyById, type Company } from "@peppol/data/companies";
import { getExtendedTeam, type ExtendedTeam } from "@peppol/data/teams";
import { actionFailure } from "@recommand/lib/utils";
import { createMiddleware } from "hono/factory";

type InternalTokenContext = {
  Variables: {
    token: string;
  };
};

export function requireInternalToken() {
  return createMiddleware<InternalTokenContext>(async (c, next) => {
    const token = c.req.header("X-Internal-Token");
    if (!token || token !== process.env.INTERNAL_TOKEN) {
      return c.json(actionFailure("Unauthorized"), 401);
    }
    c.set("token", token);
    await next();
  });
}

export type CompanyAccessContext = {
  Variables: {
    company: Company;
    team: ExtendedTeam;
  };
};

export function requireCompanyAccess() {
  return createMiddleware<
    AuthenticatedUserContext & AuthenticatedTeamContext & CompanyAccessContext
  >(async (c, next) => {
    // Verify user's session
    await verifySession(c);

    // Get user from context
    const user: { id: string; isAdmin: boolean } | null = c.get("user");
    if (!user?.id) {
      return c.json(actionFailure("Unauthorized"), 401);
    }

    const companyId = c.req.param("companyId");
    if (!companyId) {
      return c.json(actionFailure("Company ID is required"), 400);
    }
    const company = await getCompanyById(companyId);
    if (!company) {
      return c.json(actionFailure("Company not found"), 404);
    }

    const apiKey = c.get("apiKey");
    if (apiKey) {
      // If the user is authenticated via an API key, ensure the API key belongs to the team
      if (apiKey.teamId !== company.teamId) {
        return c.json(actionFailure("Unauthorized"), 401);
      }
    } else {
      // If the user is not authenticated via an API key, ensure they are a member of the team
      if (!(await isMember(user.id, company.teamId))) {
        return c.json(actionFailure("Unauthorized"), 401);
      }
    }

    // Get team based on company
    const team = await getExtendedTeam(company.teamId);
    if (!team) {
      return c.json(actionFailure("Team not found"), 404);
    }

    // If there is a teamId param as well, ensure it matches the company's teamId
    const teamId = c.req.param("teamId");
    if (teamId && teamId !== company.teamId) {
      return c.json(actionFailure("Unauthorized: provided teamId does not match company's teamId"), 401);
    }

    c.set("team", team);
    c.set("company", company);

    await next();
  });
}

export function requireValidSubscription() {
  return createMiddleware<AuthenticatedUserContext & AuthenticatedTeamContext & CompanyAccessContext>(
    async (c, next) => {
      const team = c.var.team;
      if (!team) {
        return c.json(actionFailure("Team not found"), 404);
      }

      // Ensure the team has a valid billing profile if it's not a playground team
      if (!team.isPlayground) {
        const billingProfile = await getBillingProfile(team.id);
        if (!billingProfile || !billingProfile.isMandateValidated) {
          return c.json(
            actionFailure(
              `Team ${team.name} does not have a valid billing profile`
            ),
            401
          );
        }
      }

      await next();
    }
  );
}
