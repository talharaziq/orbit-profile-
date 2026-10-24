import type { DeveloperProfile, RangeKey, Repository } from "./types";
import { countActiveDays, getCurrentStreak, getLongestStreak, toMonthlyActivity, totalActivity } from "./metrics";

const demoRepoData = [
  ["orbit-ui", "A flexible design system for fast-moving product teams.", 482, 61, "TypeScript", "#8B7BFF", 8, "MIT", ["design-system", "react", "components"]],
  ["next-shift", "A lightweight toolkit for planning work across time zones.", 216, 24, "TypeScript", "#8B7BFF", 20, "MIT", ["nextjs", "productivity"]],
  ["prism-query", "Typed query utilities built for readable data access.", 184, 19, "Python", "#5DADE2", 36, "Apache-2.0", ["python", "data"]],
  ["git-journal", "A local-first journal for notes connected to commits.", 157, 13, "Rust", "#D49A73", 59, "MIT", ["git", "cli", "rust"]],
  ["tiny-observer", "Small observability helpers with a minimal footprint.", 94, 8, "Go", "#69C8D5", 91, "MIT", ["observability", "go"]],
  ["color-syntax", "Accessible syntax colors for editors and terminals.", 72, 11, "CSS", "#D5B95E", 180, "MIT", ["accessibility", "themes"]],
  ["mdx-notes", "A simple Markdown workspace for technical notes.", 51, 5, "JavaScript", "#D5B95E", 230, "MIT", ["markdown", "notes"]],
  ["old-prototype", "An archived experiment in browser-based data tools.", 28, 3, "JavaScript", "#D5B95E", 580, null, ["experiment"]]
] as const;

function dateAtOffset(daysAgo: number): string {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - daysAgo);
  return date.toISOString().slice(0, 10);
}

export function createDemoProfile(range: RangeKey = "year"): DeveloperProfile {
  const activity = Array.from({ length: 365 }, (_, index) => {
    const daysAgo = 364 - index;
    const seed = (index * 37 + (index % 9) * 17 + Math.floor(index / 7) * 23) % 101;
    const weekend = new Date(`${dateAtOffset(daysAgo)}T00:00:00Z`).getUTCDay();
    const count = seed < 32 || (weekend === 0 && seed < 64) ? 0 : seed < 49 ? 1 : seed < 70 ? 2 : seed < 88 ? 4 : 7 + (seed % 8);
    return { date: dateAtOffset(daysAgo), count };
  });
  const daysBack = range === "30d" ? 30 : range === "90d" ? 90 : 365;
  const period = activity.slice(-daysBack);
  const contributions = totalActivity(period);
  const repositories: Repository[] = demoRepoData.map((repo, index) => {
    const [name, description, stars, forks, language, languageColor, daysAgo, license, topics] = repo;
    const updatedAt = new Date(Date.now() - daysAgo * 86_400_000).toISOString();
    return {
      name,
      fullName: `dev-horizon/${name}`,
      description,
      url: `https://github.com/search?q=${encodeURIComponent(name)}&type=repositories`,
      stars,
      forks,
      openIssues: [5, 2, 4, 1, 0, 2, 3, 0][index],
      openPullRequests: [2, 0, 1, 1, 0, 0, 0, 0][index],
      language,
      languageColor,
      updatedAt,
      pushedAt: updatedAt,
      createdAt: new Date(Date.now() - (780 + index * 140) * 86_400_000).toISOString(),
      isFork: index === 6,
      isArchived: index === 7,
      license,
      releaseTag: index < 4 ? `v${index + 1}.${index + 2}.0` : null,
      releaseDate: index < 4 ? updatedAt : null,
      topics: [...topics]
    };
  });
  const langTotals = new Map<string, { bytes: number; color: string }>();
  const langColor: Record<string, string> = { TypeScript: "#8B7BFF", Python: "#5DADE2", Rust: "#D49A73", Go: "#69C8D5", CSS: "#D5B95E", JavaScript: "#D5B95E" };
  for (const repo of repositories.filter((item) => !item.isFork)) {
    const weight = repo.stars * 520 + 40_000;
    if (!repo.language) continue;
    const current = langTotals.get(repo.language) ?? { bytes: 0, color: langColor[repo.language] ?? "#9AA5B5" };
    current.bytes += weight;
    langTotals.set(repo.language, current);
  }
  const languages = [...langTotals.entries()].map(([name, value]) => ({ name, ...value })).sort((a, b) => b.bytes - a.bytes);
  const activeDays = countActiveDays(period);
  const currentStreak = getCurrentStreak(activity);
  const longestStreak = getLongestStreak(activity);
  const commits = Math.round(contributions * 0.57);
  const pullRequests = Math.round(contributions * 0.14);
  const issues = Math.round(contributions * 0.1);
  const reviews = Math.round(contributions * 0.19);
  return {
    login: "dev-horizon",
    name: "Alex Morgan",
    bio: "Building thoughtful developer tools, clean interfaces, and small things that make work feel lighter.",
    company: "Independent",
    location: "Remote",
    websiteUrl: null,
    twitterUsername: null,
    createdAt: "2018-04-12T00:00:00Z",
    profileUrl: "https://github.com/search?q=dev-horizon&type=users",
    stats: {
      contributions,
      commits,
      pullRequests,
      issues,
      reviews,
      contributedRepos: 21,
      publicRepos: 42,
      starsReceived: 1_284,
      forksReceived: 164,
      followers: 628,
      following: 214,
      activeDays,
      currentStreak,
      longestStreak
    },
    activity,
    monthlyActivity: toMonthlyActivity(activity),
    languages,
    repositories,
    contributionCalendarAvailable: true,
    contributionCalendarNote: "Illustrative sample contribution data. Search a GitHub username to load live public data.",
    repoCoverageNote: "Sample project list. The live profile uses public repository metadata.",
    dataMode: "demo",
    lastUpdated: new Date().toISOString(),
    range
  };
}
