import { getMinimalTeamMembers } from "@core/data/team-members";
import { sendEmail } from "@core/lib/email";
import { CompanyVerifiedNotification, subject } from "@peppol/emails/company-verified-notification";
import { getTeamExtension } from "@peppol/data/teams";
import React from "react";

export async function sendManualVerificationEmail({
  teamId,
  companyName,
}: {
  teamId: string;
  companyName: string;
}): Promise<void> {
  const teamExtension = await getTeamExtension(teamId);
  const supportEmailAddress = teamExtension?.supportEmailAddress?.trim();

  let userEmails: string[];
  if (supportEmailAddress) {
    userEmails = [supportEmailAddress];
  } else {
    const teamMembers = await getMinimalTeamMembers(teamId);
    userEmails = teamMembers.map((m) => m.user.email);
  }

  const allRecipients = [...new Set([...userEmails, "support@recommand.eu"])];

  if (allRecipients.length === 0) {
    return;
  }

  try {
    await sendEmail({
      to: allRecipients.join(", "),
      subject: subject({ companyName }),
      email: React.createElement(CompanyVerifiedNotification, { companyName }),
    });
  } catch (error) {
    console.error(`Failed to send manual verification email for company ${companyName}:`, error);
  }
}
