import { Server } from "@recommand/lib/api";
import emailServer from "./email";

const server = new Server();
server.route("/", emailServer);

export default server;
