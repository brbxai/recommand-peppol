import { Server } from "@recommand/lib/api";
import { actionFailure, actionSuccess } from "@recommand/lib/utils";
import { describeRoute } from "hono-openapi";
import { createHmac, timingSafeEqual } from "crypto";
import { UserFacingError } from "@peppol/utils/util";
import { companies, companyVerificationLog } from "@peppol/db/schema";
import { eq } from "drizzle-orm";
import { db } from "@recommand/db";
import { getCompanyVerificationLog, normalizeName } from "@peppol/data/company-verification";
import { getCompanyById } from "@peppol/data/companies";
import { getTeamExtension } from "@peppol/data/teams";
import { upsertCompanyRegistrations } from "@peppol/data/phoss-smp";
import { shouldRegisterWithSmp } from "@peppol/utils/playground";

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

      const companyVerificationLogRecord = await getCompanyVerificationLog(vendor_data);
      if (!companyVerificationLogRecord) {
        return c.json(actionFailure("Company verification log not found"), 404);
      }

      let isVerified = false;
      const verificationProofReference = session_id;

      if (
        status === "Approved" &&
        "decision" in body &&
        "id_verification" in body.decision &&
        "first_name" in body.decision.id_verification &&
        "last_name" in body.decision.id_verification) {
        const diditFirstName = body.decision.id_verification.first_name;
        const diditLastName = body.decision.id_verification.last_name;
        const storedFirstName = companyVerificationLogRecord.firstName;
        const storedLastName = companyVerificationLogRecord.lastName;

        if (diditFirstName && diditLastName && storedFirstName && storedLastName && normalizeName(diditFirstName) === normalizeName(storedFirstName) && normalizeName(diditLastName) === normalizeName(storedLastName)) {
          isVerified = true;
        }
      }

      // Open transaction
      await db.transaction(async (tx) => {
        await tx.update(companyVerificationLog).set({ status: isVerified ? "verified" : "rejected", verificationProofReference }).where(eq(companyVerificationLog.id, companyVerificationLogRecord.id));
        if (isVerified) {
          // Only update the company if the verification is approved
          await tx.update(companies).set({ isVerified, verificationProofReference }).where(eq(companies.id, companyVerificationLogRecord.companyId));
        }
      });

      // Update company SMP registrations if verification succeeded
      if (isVerified) {
        try {
          const company = await getCompanyById(companyVerificationLogRecord.companyId);
          if (company) {
            const teamExtension = await getTeamExtension(company.teamId);
            const useTestNetwork = teamExtension?.useTestNetwork ?? false;
            if (shouldRegisterWithSmp({ isPlayground: teamExtension?.isPlayground, useTestNetwork, isSmpRecipient: company.isSmpRecipient, isVerified: company.isVerified, verificationRequirements: teamExtension?.verificationRequirements ?? undefined })) {
              await upsertCompanyRegistrations({ companyId: company.id, useTestNetwork });
            }
          }
        } catch (error) {
          console.error(`Failed to register company ${companyVerificationLogRecord.companyId} with SMP after verification:`, error);
        }
      }

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

