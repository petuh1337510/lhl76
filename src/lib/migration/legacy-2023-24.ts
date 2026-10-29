import type { LegacyCompetitionBinding } from "./contracts";

export const legacySeason2023_24: LegacyCompetitionBinding[] = [
  { legacySeasonId: 2220, season: "2023/24", competitionName: "Чемпионат ЛХЛ-76", competitionType: "CHAMPIONSHIP", divisionName: "Любитель Спорт" },
  { legacySeasonId: 2476, season: "2023/24", competitionName: "Чемпионат ЛХЛ-76", competitionType: "CHAMPIONSHIP", divisionName: "Любитель Плюс" },
  { legacySeasonId: 2477, season: "2023/24", competitionName: "Чемпионат ЛХЛ-76", competitionType: "CHAMPIONSHIP", divisionName: "Любитель" },
  { legacySeasonId: 3029, season: "2023/24", competitionName: "Памяти Локомотива 2023", competitionType: "TOURNAMENT", divisionName: "Любитель Плюс" },
  { legacySeasonId: 3026, season: "2023/24", competitionName: "Памяти Локомотива 2023", competitionType: "TOURNAMENT", divisionName: "Любитель" },
  { legacySeasonId: 6780, season: "2023/24", competitionName: "Апрельский 2024", competitionType: "TOURNAMENT", divisionName: "Любитель Плюс" },
  { legacySeasonId: 6781, season: "2023/24", competitionName: "Апрельский 2024", competitionType: "TOURNAMENT", divisionName: "Любитель" },
];

/** Field 9 (legacy player status) is deliberately absent. */
export const legacyPlayerFieldMap = {
  personal: {
    firstName: "first_name",
    lastName: "last_name",
    patronymic: "short_name",
    nativeName: "home_name",
  },
  extra: {
    birthDate: 1,
    country: 2,
    birthPlace: 3,
    position: 4,
    stickHand: 5,
    heightCm: 6,
    weightKg: 7,
    rosterNumberFallback: 8,
    qualification: 10,
    league: 14,
    laureatePhotoUrl: 15,
    laureateAchievements: 16,
  },
  primaryPhoto: "vdw_gallery_id",
} as const;

export function groupLegacyCompetitions(bindings = legacySeason2023_24) {
  const grouped = new Map<string, LegacyCompetitionBinding[]>();
  for (const binding of bindings) {
    const key = `${binding.season}:${binding.competitionType}:${binding.competitionName}`;
    grouped.set(key, [...(grouped.get(key) ?? []), binding]);
  }
  return grouped;
}
