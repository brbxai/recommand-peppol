import { requireTeamAccess } from "@core/lib/auth-middleware";
import { zValidator } from "@hono/zod-validator";
import {
  createCompany,
  deleteCompany,
  getCompany,
  getCompanies,
  updateCompany,
} from "@peppol/data/companies";
import { zodValidCountryCodes } from "@peppol/db/schema";
import { cleanEnterpriseNumber, cleanVatNumber } from "@peppol/utils/util";
import { Server } from "@recommand/lib/api";
import { actionFailure, actionSuccess } from "@recommand/lib/utils";
import { z } from "zod";

const server = new Server();

const _companies = server.get(
  "/:teamId/companies",
  requireTeamAccess(),
  zValidator("param", z.object({ teamId: z.string() })),
  async (c) => {
    const allCompanies = await getCompanies(c.var.team.id);
    return c.json(actionSuccess({ companies: allCompanies }));
  }
);

const _company = server.get(
  "/:teamId/companies/:companyId",
  requireTeamAccess(),
  zValidator("param", z.object({ teamId: z.string(), companyId: z.string() })),
  async (c) => {
    const company = await getCompany(
      c.var.team.id,
      c.req.valid("param").companyId
    );
    return c.json(actionSuccess({ company }));
  }
);

const _createCompany = server.post(
  "/:teamId/companies",
  requireTeamAccess(),
  zValidator("param", z.object({ teamId: z.string() })),
  zValidator(
    "json",
    z.object({
      name: z.string(),
      address: z.string(),
      postalCode: z.string(),
      city: z.string(),
      country: zodValidCountryCodes,
      enterpriseNumber: z.string().nullish().transform(cleanEnterpriseNumber),
      vatNumber: z.string().nullish().transform(cleanVatNumber),
    })
  ),
  async (c) => {
    let enterpriseNumber = c.req.valid("json").enterpriseNumber;
    if(!enterpriseNumber && c.req.valid("json").vatNumber) {
      enterpriseNumber = cleanEnterpriseNumber(c.req.valid("json").vatNumber!);
    }
    if(!enterpriseNumber) {
      return c.json(actionFailure("Enterprise number or VAT number is required"), 400);
    }
    try {
      const company = await createCompany({
        ...c.req.valid("json"),
        teamId: c.var.team.id,
        enterpriseNumber: enterpriseNumber!,
      });
      return c.json(actionSuccess({ company }));
    } catch (error) {
      return c.json(actionFailure("Could not create company"), 500);
    }
  }
);

const _updateCompany = server.put(
  "/:teamId/companies/:companyId",
  requireTeamAccess(),
  zValidator("param", z.object({ teamId: z.string(), companyId: z.string() })),
  zValidator(
    "json",
    z.object({
      name: z.string(),
      address: z.string(),
      postalCode: z.string(),
      city: z.string(),
      country: zodValidCountryCodes,
      enterpriseNumber: z.string().nullish().transform(cleanEnterpriseNumber),
      vatNumber: z.string().nullish().transform(cleanVatNumber),
    })
  ),
  async (c) => {
    let enterpriseNumber = c.req.valid("json").enterpriseNumber;
    if(!enterpriseNumber && c.req.valid("json").vatNumber) {
      enterpriseNumber = cleanEnterpriseNumber(c.req.valid("json").vatNumber!);
    }
    if(!enterpriseNumber) {
      return c.json(actionFailure("Enterprise number or VAT number is required"), 400);
    }

    const company = await updateCompany({
      ...c.req.valid("json"),
      teamId: c.var.team.id,
      id: c.req.valid("param").companyId,
      enterpriseNumber: enterpriseNumber!,
    });
    if (!company) {
      return c.json(actionFailure("Company not found"), 404);
    }
    return c.json(actionSuccess({ company }));
  }
);

const _deleteCompany = server.delete(
  "/:teamId/companies/:companyId",
  requireTeamAccess(),  
  zValidator("param", z.object({ teamId: z.string(), companyId: z.string() })),
  async (c) => {
    try {
      await deleteCompany(c.var.team.id, c.req.valid("param").companyId);
      return c.json(actionSuccess());
    } catch (error) {
      return c.json(actionFailure("Could not delete company"), 500);
    }
  }
);

export type Companies =
  | typeof _companies
  | typeof _company
  | typeof _createCompany
  | typeof _updateCompany
  | typeof _deleteCompany;

export default server; 