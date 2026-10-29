export type MatchResult = {
  home: string;
  away: string;
  homeGoals: number;
  awayGoals: number;
  homePenaltyMinutes?: number;
  awayPenaltyMinutes?: number;
  technicalWinner?: string | null;
  excludeGoals?: boolean;
};

export type Standing = {
  team: string;
  games: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
  penaltyMinutes: number;
};

const goalDifference = (row: Standing) => row.goalsFor - row.goalsAgainst;

export function calculateStandings(results: MatchResult[]): Standing[] {
  const table = new Map<string, Standing>();
  const get = (team: string) => table.get(team) ?? (table.set(team, { team, games: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, points: 0, penaltyMinutes: 0 }), table.get(team)!);

  for (const result of results) {
    const home = get(result.home);
    const away = get(result.away);
    home.games++; away.games++;
    if (!result.excludeGoals) {
      home.goalsFor += result.homeGoals; home.goalsAgainst += result.awayGoals;
      away.goalsFor += result.awayGoals; away.goalsAgainst += result.homeGoals;
    }
    if (result.technicalWinner) {
      const winner = result.technicalWinner === result.home ? home : away;
      const loser = winner === home ? away : home;
      winner.wins++; winner.points += 2; loser.losses++;
    }
    else {
      home.penaltyMinutes += result.homePenaltyMinutes ?? 0;
      away.penaltyMinutes += result.awayPenaltyMinutes ?? 0;
      if (result.homeGoals === result.awayGoals) { home.draws++; away.draws++; home.points++; away.points++; }
      else { const winner = result.homeGoals > result.awayGoals ? home : away; const loser = winner === home ? away : home; winner.wins++; winner.points += 2; loser.losses++; }
    }
  }

  const base = [...table.values()].sort((a, b) => b.points - a.points);
  const ordered: Standing[] = [];
  for (let start = 0; start < base.length;) {
    const end = base.findIndex((row, index) => index > start && row.points !== base[start].points);
    const group = base.slice(start, end === -1 ? base.length : end);
    if (group.length === 1) ordered.push(group[0]);
    else {
      const tiedTeams = new Set(group.map((row) => row.team));
      const directByTeam = new Map(group.map((row) => [row.team, { ...row, games: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, points: 0, penaltyMinutes: 0 }]));
      for (const result of results.filter((item) => tiedTeams.has(item.home) && tiedTeams.has(item.away))) {
        const home = directByTeam.get(result.home)!; const away = directByTeam.get(result.away)!;
        home.games++; away.games++;
        if (!result.excludeGoals) { home.goalsFor += result.homeGoals; home.goalsAgainst += result.awayGoals; away.goalsFor += result.awayGoals; away.goalsAgainst += result.homeGoals; }
        if (result.technicalWinner) { const winner = result.technicalWinner === result.home ? home : away; const loser = winner === home ? away : home; winner.wins++; winner.points += 2; loser.losses++; }
        else if (result.homeGoals === result.awayGoals) { home.draws++; away.draws++; home.points++; away.points++; }
        else { const winner = result.homeGoals > result.awayGoals ? home : away; const loser = winner === home ? away : home; winner.wins++; winner.points += 2; loser.losses++; }
      }
      group.sort((a, b) => {
        // A: points in direct meetings between all teams tied on points.
        const directPoints = (directByTeam.get(b.team)?.points ?? 0) - (directByTeam.get(a.team)?.points ?? 0);
        if (directPoints) return directPoints;
        // B: goal difference in all matches.
        const allDifference = goalDifference(b) - goalDifference(a);
        if (allDifference) return allDifference;
        // C: goal difference in direct meetings.
        const directDifference = goalDifference(directByTeam.get(b.team) ?? b) - goalDifference(directByTeam.get(a.team) ?? a);
        if (directDifference) return directDifference;
        // D, E, F: total goals, wins, then fewer penalty minutes.
        return b.goalsFor - a.goalsFor || b.wins - a.wins || a.penaltyMinutes - b.penaltyMinutes || a.team.localeCompare(b.team, "ru");
      });
      ordered.push(...group);
    }
    start = end === -1 ? base.length : end;
  }
  return ordered;
}
