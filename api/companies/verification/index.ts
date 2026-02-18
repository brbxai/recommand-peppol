import "zod-openapi/extend";
import { Server } from "@recommand/lib/api";
import getVerificationContextServer, { type GetVerificationContext } from "./get-verification-context";
import submitIdentityFormServer, { type SubmitIdentityForm } from "./submit-identity-form";
import submitPlaygroundVerificationServer, { type SubmitPlaygroundVerification } from "./submit-playground-verification";

export type CompanyVerification = GetVerificationContext | SubmitIdentityForm | SubmitPlaygroundVerification;

const server = new Server();
server.route("/", getVerificationContextServer);
server.route("/", submitIdentityFormServer);
server.route("/", submitPlaygroundVerificationServer);
export default server;
