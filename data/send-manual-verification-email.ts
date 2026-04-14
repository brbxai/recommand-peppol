import { getMinimalTeamMembers } from "@core/data/team-members";
import { sendEmail } from "@core/lib/email";
import { CompanyVerifiedNotification, subject as verifiedSubject } from "@peppol/emails/company-verified-notification";
import { CompanyVerificationRejectedNotification, subject as rejectedSubject } from "@peppol/emails/company-verification-rejected-notification";
import { getTeamExtension } from "@peppol/data/teams";
import React from "react";

async function getManualVerificationEmailRecipients(teamId: string): Promise<string[]> {
  const teamExtension = await getTeamExtension(teamId);
  const supportEmailAddress = teamExtension?.supportEmailAddress?.trim();

  let userEmails: string[];
  if (supportEmailAddress) {
    userEmails = [supportEmailAddress];
  } else {
    const teamMembers = await getMinimalTeamMembers(teamId);
    userEmails = teamMembers.map((m) => m.user.email);
  }

  return [...new Set([...userEmails, "support@recommand.eu"])];
}

export async function sendManualVerificationEmail({
  teamId,
  companyName,
}: {
  teamId: string;
  companyName: string;
}): Promise<void> {
  const allRecipients = await getManualVerificationEmailRecipients(teamId);

  if (allRecipients.length === 0) {
    return;
  }

  try {
    await sendEmail({
      to: allRecipients.join(", "),
      subject: verifiedSubject({ companyName }),
      email: React.createElement(CompanyVerifiedNotification, { companyName }),
    });
  } catch (error) {
    console.error(`Failed to send manual verification email for company ${companyName}:`, error);
  }
}

export async function sendManualVerificationDeclinedEmail({
  teamId,
  companyName,
}: {
  teamId: string;
  companyName: string;
}): Promise<void> {
  const allRecipients = await getManualVerificationEmailRecipients(teamId);

  if (allRecipients.length === 0) {
    return;
  }

  try {
    await sendEmail({
      to: allRecipients.join(", "),
      subject: rejectedSubject({ companyName }),
      email: React.createElement(CompanyVerificationRejectedNotification, { companyName }),
    });
  } catch (error) {
    console.error(`Failed to send manual verification declined email for company ${companyName}:`, error);
  }
}
