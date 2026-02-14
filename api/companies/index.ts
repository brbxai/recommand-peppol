import "zod-openapi/extend";
import { Server } from "@recommand/lib/api";
import getCompaniesServer, { type GetCompanies } from "./get-companies";
import getCompanyServer, { type GetCompany } from "./get-company";
import createCompanyServer, { type CreateCompany } from "./create-company";
import updateCompanyServer, { type UpdateCompany } from "./update-company";
import deleteCompanyServer, { type DeleteCompany } from "./delete-company";
import verifyCompanyServer, { type VerifyCompany } from "./verify-company";
import enterpriseDataServer, { type GetCompanyEnterpriseData } from "./enterprise-data";
import companyIdentifiersServer, { type CompanyIdentifiers } from "./identifiers";
import companyDocumentTypesServer, { type CompanyDocumentTypes } from "./document-types";
import companyNotificationEmailAddressesServer, { type CompanyNotificationEmailAddresses } from "./notification-email-addresses";

export type Companies = GetCompanies | GetCompany | CreateCompany | UpdateCompany | DeleteCompany | VerifyCompany | GetCompanyEnterpriseData | CompanyIdentifiers | CompanyDocumentTypes | CompanyNotificationEmailAddresses;

const server = new Server();
server.route("/", getCompaniesServer);
server.route("/", getCompanyServer);
server.route("/", createCompanyServer);
server.route("/", updateCompanyServer);
server.route("/", deleteCompanyServer);
server.route("/", verifyCompanyServer);
server.route("/", enterpriseDataServer);
server.route("/", companyIdentifiersServer);
server.route("/", companyDocumentTypesServer);
server.route("/", companyNotificationEmailAddressesServer);
export default server;