import { Server } from "@recommand/lib/api";
import outboundServer from "./outbound";

const server = new Server();
server.route("/", outboundServer);

export default server;
