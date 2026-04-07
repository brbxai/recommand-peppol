import { callWebhooks } from "./webhooks";

export type CompanyVerificationWebhookStatus = "verified" | "rejected" | "error";

export async function sendCompanyVerificationWebhook({
  teamId,
  companyId,
  status,
  errorMessage,
}: {
  teamId: string;
  companyId: string;
  status: CompanyVerificationWebhookStatus;
  errorMessage?: string | null;
}): Promise<void> {
  const payload = Object.fromEntries(
    Object.entries({
      companyId,
      teamId,
      status,
      errorMessage: errorMessage ?? undefined,
    }).filter(([, value]) => value !== undefined)
  ) as Record<string, string>;

  await callWebhooks(teamId, companyId, "company.verification", payload);
}
