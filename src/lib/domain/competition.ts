export type CompetitionType = "CHAMPIONSHIP" | "TOURNAMENT";
export type CompetitionStageType = "GROUP_STAGE" | "QUARTERFINAL" | "SEMIFINAL" | "FINAL" | "THIRD_PLACE" | "OTHER";
export type CompetitionTeamEntry = {
  competitionId: string;
  divisionId: string;
  teamId: string;
  joinedAt: Date;
  leftAt?: Date;
};
