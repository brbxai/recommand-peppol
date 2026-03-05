import "zod-openapi/extend";
import { Server } from "@recommand/lib/api";
import getVerificationContextServer, { type GetVerificationContext } from "./get-verification-context";
import getVerificationStatusServer, { type GetVerificationStatus } from "./get-verification-status";
import submitIdentityFormServer, { type SubmitIdentityForm } from "./submit-identity-form";
import submitPlaygroundVerificationServer, { type SubmitPlaygroundVerification } from "./submit-playground-verification";
import restartIdVerificationServer, { type RestartIdVerification } from "./restart-id-verification";

export type CompanyVerification = GetVerificationContext | GetVerificationStatus | SubmitIdentityForm | SubmitPlaygroundVerification | RestartIdVerification;

const server = new Server();
server.route("/", getVerificationContextServer);
server.route("/", getVerificationStatusServer);
server.route("/", submitIdentityFormServer);
server.route("/", submitPlaygroundVerificationServer);
server.route("/", restartIdVerificationServer);
export default server;
