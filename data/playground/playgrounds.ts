import { completeOnboardingStep } from "@core/data/onboarding";
import { teamMembers, teams } from "@core/db/schema";
import { teamExtensions } from "@peppol/db/schema";
import { db } from "@recommand/db";
import { and, eq } from "drizzle-orm";
import type { ExtendedTeam } from "../teams";

export async function getPlayground(
  teamId: string
): Promise<ExtendedTeam | null> {
  const playgrounds = await db
    .select()
    .from(teams)
    .innerJoin(teamExtensions, eq(teams.id, teamExtensions.id))
    .where(and(eq(teamExtensions.isPlayground, true), eq(teams.id, teamId)));
  if (playgrounds.length === 0) {
    return null;
  }
  return {
    ...playgrounds[0].teams,
    ...playgrounds[0].peppol_team_extensions,
  };
}

export async function createPlayground(
  userId: string,
  teamName: string,
  teamDescription: string = "Playground"
): Promise<ExtendedTeam> {
  const res = await db.transaction(async (tx) => {
    // Create a new team
    const [newTeam] = await tx
      .insert(teams)
      .values({
        name: teamName,
        teamDescription,
      })
      .returning();

    // Add the user as a member
    await tx.insert(teamMembers).values({
      userId,
      teamId: newTeam.id,
    });

    // Create a new playground extension
    const [newExtension] = await tx.insert(teamExtensions).values({
      id: newTeam.id,
      isPlayground: true,
    }).returning();

    
    return {
      ...newTeam,
      ...newExtension,
    };
  });
  
  // Complete the peppol.billing and peppol.subscription onboarding steps as we don't need to bill or subscribe to anything for playgrounds
  await completeOnboardingStep(userId, res.id, "peppol.billing");
  await completeOnboardingStep(userId, res.id, "peppol.subscription");

  return res;
}