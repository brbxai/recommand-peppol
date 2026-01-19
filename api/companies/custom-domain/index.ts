import "zod-openapi/extend";
import { Server } from "@recommand/lib/api";
import getDomainServer, { type GetDomain } from "./get-domain";
import createDomainServer, { type CreateDomain } from "./create-domain";
import updateDomainServer, { type UpdateDomain } from "./update-domain";
import deleteDomainServer, { type DeleteDomain } from "./delete-domain";
import verifyDomainServer, {
  type VerifyDkim,
  type VerifyReturnPath,
} from "./verify-domain";

export type CompanyCustomDomain =
  | GetDomain
  | CreateDomain
  | UpdateDomain
  | DeleteDomain
  | VerifyDkim
  | VerifyReturnPath;

const server = new Server();
server.route("/", getDomainServer);
server.route("/", createDomainServer);
server.route("/", updateDomainServer);
server.route("/", deleteDomainServer);
server.route("/", verifyDomainServer);
export default server;
