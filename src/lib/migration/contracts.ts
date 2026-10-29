export interface LegacyRecord { legacyId: string | number; [key: string]: unknown }
export interface ImportAdapter<T extends LegacyRecord, R> { source: string; transform(record:T): Promise<R>; validate(record:T): string[] }
export interface ImportRun { dryRun:boolean; mappings: Map<string,string>; errors:string[] }

export type LegacyCompetitionBinding = {
  season: string;
  competitionName: string;
  competitionType: "CHAMPIONSHIP" | "TOURNAMENT";
  divisionName: string;
  legacySeasonId: number;
};

export type LegacyPlayerProfile = LegacyRecord & {
  firstName: string;
  lastName: string;
  patronymic?: string;
  nativeName?: string;
  birthDate?: string;
  country?: string;
  birthPlace?: string;
  position?: string;
  stickHand?: string;
  heightCm?: number;
  weightKg?: number;
  qualification?: string;
  league?: string;
  photoUrl?: string;
  laureatePhotoUrl?: string;
  laureateAchievements?: string;
};

export type LegacyRosterAssignment = LegacyRecord & {
  playerLegacyId: number;
  teamLegacyId: number;
  legacySeasonId: number;
  number?: string;
  leadership?: "NONE" | "CAPTAIN" | "ASSISTANT";
};
