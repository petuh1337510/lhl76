/** Every season-team membership has a historical role, not only players. */
export type TeamMemberRole = "PLAYER" | "COACH" | "TEAM_ADMIN";
export type LeadershipRole = "NONE" | "CAPTAIN" | "ASSISTANT";
/** Classification belongs to Player. Jersey number and leadership belong to this precise competition entry. */
export type PlayerCompetitionAssignment = {
  playerId: string;
  competitionId: string;
  divisionId: string;
  teamId: string;
  jerseyNumber?: string;
  leadership: LeadershipRole;
  joinedAt: Date;
  leftAt?: Date;
};
export type TeamEntryMembership = { personId:string; teamEntryId:string; role:TeamMemberRole; joinedAt:Date; leftAt?:Date };
