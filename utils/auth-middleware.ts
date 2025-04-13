import { getTeam, isMember } from "@core/data/teams";
import type { AuthenticatedTeamContext, AuthenticatedUserContext } from "@core/lib/auth-middleware";
import { verifySession } from "@core/lib/session";
import { getCompanyById, type Company } from "@peppol/data/companies";
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

type CompanyAccessContext = {
  Variables: {
    company: Company;
  };
};

export function requireCompanyAccess() {
  return createMiddleware<AuthenticatedUserContext & AuthenticatedTeamContext & CompanyAccessContext>(async (c, next) => {
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

    // Check if user is member of team
    if (!(await isMember(user.id, company.teamId))) {
      return c.json(actionFailure("Unauthorized"), 401);
    }

    // Get team based on company
    const team = await getTeam(company.teamId);
    if (!team) {
      return c.json(actionFailure("Team not found"), 404);
    }

    c.set("team", team);
    c.set("company", company);

    await next();
  });
}
