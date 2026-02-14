import "zod-openapi/extend";
import { Server } from "@recommand/lib/api";
import getVerificationContextServer, { type GetVerificationContext } from "./get-verification-context";
import submitIdentityFormServer, { type SubmitIdentityForm } from "./submit-identity-form";

export type CompanyVerification = GetVerificationContext | SubmitIdentityForm;

const server = new Server();
server.route("/", getVerificationContextServer);
server.route("/", submitIdentityFormServer);
export default server;
