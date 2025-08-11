import { db } from "@recommand/db";
import { eq } from "drizzle-orm";
import { teamExtensions } from "@peppol/db/schema";
import { teams } from "@core/db/schema";

export type TeamExtension = Partial<typeof teamExtensions.$inferSelect>; // Partial because we don't always have a team extension

export type ExtendedTeam = typeof teams.$inferSelect & TeamExtension;

export async function getExtendedTeam(
  teamId: string
): Promise<ExtendedTeam | null> {
  const team = await db
    .select()
    .from(teams)
    .leftJoin(teamExtensions, eq(teams.id, teamExtensions.id))
    .where(eq(teams.id, teamId));
  if (team.length === 0) {
    return null;
  }
  return {
    ...team[0].teams,
    ...team[0].peppol_team_extensions,
  };
}

export async function getTeamExtension(
  teamId: string
): Promise<TeamExtension | null> {
  const team = await db
    .select()
    .from(teamExtensions)
    .where(eq(teamExtensions.id, teamId));
  if (team.length === 0) {
    return null;
  }
  return team[0];
}

export async function isPlayground(teamId: string): Promise<boolean> {
  const team = await getTeamExtension(teamId);
  return team?.isPlayground ?? false;
}