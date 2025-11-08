import "zod-openapi/extend";
import { Server } from "@recommand/lib/api";
import getAddressesServer, { type GetAddresses } from "./get-addresses";
import getAddressServer, { type GetAddress } from "./get-address";
import createAddressServer, { type CreateAddress } from "./create-address";
import updateAddressServer, { type UpdateAddress } from "./update-address";
import deleteAddressServer, { type DeleteAddress } from "./delete-address";

export type CompanyNotificationEmailAddresses = GetAddresses | GetAddress | CreateAddress | UpdateAddress | DeleteAddress;

const server = new Server();
server.route("/", getAddressesServer);
server.route("/", getAddressServer);
server.route("/", createAddressServer);
server.route("/", updateAddressServer);
server.route("/", deleteAddressServer);
export default server;