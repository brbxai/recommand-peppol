import { Server } from "@recommand/lib/api";
import sendServer from "./send";

const server = new Server();
server.route("/", sendServer);

export default server;
