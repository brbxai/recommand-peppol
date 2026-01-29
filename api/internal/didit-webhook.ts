import { Server } from "@recommand/lib/api";
import { actionFailure, actionSuccess } from "@recommand/lib/utils";
import { describeRoute } from "hono-openapi";
import { createHmac, timingSafeEqual } from "crypto";
import { getCompanyById, updateCompany } from "@peppol/data/companies";
import { UserFacingError } from "@peppol/utils/util";
import { companies } from "@peppol/db/schema";
import { and, eq } from "drizzle-orm";
import { db } from "@recommand/db";

const server = new Server();

server.post(
  "/didit",
  describeRoute({ hide: true }),
  async (c) => {
    console.log("Received Didit webhook");
    const webhookSecret = process.env.DIDIT_WEBHOOK_SECRET_KEY;
    if (!webhookSecret) {
      console.error("DIDIT_WEBHOOK_SECRET_KEY environment variable is not set");
      return c.json(actionFailure("Webhook secret not configured"), 500);
    }

    try {
      const rawBody = await c.req.raw.clone().text();
      const signature = c.req.header("X-Signature");
      const timestamp = c.req.header("X-Timestamp");

      if (!signature || !timestamp) {
        return c.json(actionFailure("Missing signature or timestamp"), 401);
      }

      const currentTime = Math.floor(Date.now() / 1000);
      const incomingTime = parseInt(timestamp, 10);
      if (Math.abs(currentTime - incomingTime) > 300) {
        return c.json(actionFailure("Request timestamp is stale"), 401);
      }

      const hmac = createHmac("sha256", webhookSecret);
      const expectedSignature = hmac.update(rawBody).digest("hex");

      const expectedSignatureBuffer = Buffer.from(expectedSignature, "utf8");
      const providedSignatureBuffer = Buffer.from(signature, "utf8");

      if (
        expectedSignatureBuffer.length !== providedSignatureBuffer.length ||
        !timingSafeEqual(expectedSignatureBuffer, providedSignatureBuffer)
      ) {
        return c.json(actionFailure("Invalid signature"), 401);
      }

      const body = JSON.parse(rawBody);
      const { session_id, status, vendor_data, webhook_type } = body;

      if (webhook_type !== "status.updated") {
        return c.json(actionSuccess({ message: "Webhook type not processed" }), 200);
      }

      if (!vendor_data) {
        return c.json(actionFailure("Missing vendor_data"), 400);
      }

      if (!session_id) {
        return c.json(actionFailure("Missing session_id"), 400);
      }

      const company = await getCompanyById(vendor_data);
      if (!company) {
        return c.json(actionFailure("Company not found"), 404);
      }

      const isVerified = status === "Approved";
      const verificationProofReference = session_id;

      await db.update(companies).set({ isVerified, verificationProofReference }).where(and(eq(companies.teamId, company.teamId), eq(companies.id, company.id)));

      return c.json(actionSuccess({ message: "Verification status updated" }), 200);
    } catch (error) {
      console.error("Error processing Didit webhook:", error);
      if (error instanceof UserFacingError) {
        return c.json(actionFailure(error), 400);
      }
      return c.json(actionFailure("Unknown error"), 500);
    }
  }
);

export default server;

