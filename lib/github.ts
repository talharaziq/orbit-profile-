import type { ActivityDay, DataMode, DeveloperProfile, GitHubRepoRest, GitHubUserRest, LanguageStat, RangeKey, Repository } from "./types";
import { countActiveDays, getCurrentStreak, getLongestStreak, getRangeStart, toMonthlyActivity } from "./metrics";
const API = "https://api.github.com";
const GRAPHQL = "https://api.github.com/graphql";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

interface GraphLanguageEdge { size: number; node: { name: string; color: string | null } }
interface GraphRepository {
  name: string; nameWithOwner: string; description: string | null; url: string; stargazerCount: number; forkCount: number;
  updatedAt: string; pushedAt: string | null; createdAt: string; isFork: boolean; isArchived: boolean;
  primaryLanguage: { name: string; color: string | null } | null;
  languages: { edges: GraphLanguageEdge[] };
  licenseInfo: { name: string } | null;
  issues: { totalCount: number };
  pullRequests: { totalCount: number };
  releases: { nodes: Array<{ tagName: string; publishedAt: string | null }> };
  repositoryTopics: { nodes: Array<{ topic: { name: string } }> };
}
interface GraphCalendar { weeks: Array<{ contributionDays: Array<{ date: string; contributionCount: number }> }>; totalContributions: number }
interface GraphContributions {
  totalCommitContributions: number; totalIssueContributions: number; totalPullRequestContributions: number;
  totalPullRequestReviewContributions: number; totalRepositoriesWithContributedCommits: number; contributionCalendar: GraphCalendar;
}
interface GraphResult {
  user: {
    period: GraphContributions;
    year: GraphContributions;
    repos: { nodes: GraphRepository[] };
  } | null;
  errors?: Array<{ message: string }>;
}

export class GitHubProfileError extends Error {
  status: number;
  constructor(message: string, status = 500) { super(message); this.status = status; }
}

async function rest<T>(url: string): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "orbit-github-profile",
    "X-GitHub-Api-Version": "2022-11-28"
  };
  if (GITHUB_TOKEN) headers.Authorization = `Bearer ${GITHUB_TOKEN}`;
  const response = await fetch(url, { headers, next: { revalidate: 900 } });
  if (response.status === 404) throw new GitHubProfileError("That GitHub username was not found. Check the spelling and try again.", 404);
  if (response.status === 403 || response.status === 429) {
    const reset = response.headers.get("x-ratelimit-reset");
    const resetHint = reset ? ` Rate limit reset: ${new Date(Number(reset) * 1000).toLocaleTimeString()}.` : "";
    throw new GitHubProfileError(`GitHub API rate limit reached.${resetHint} Add GITHUB_TOKEN to your deployment for a higher limit.`, 429);
  }
  if (!response.ok) throw new GitHubProfileError(`GitHub API returned ${response.status}. Try again shortly.`, response.status);
  return response.json() as Promise<T>;
}

async function getAllPublicRepos(username: string, expectedTotal: number): Promise<{ repos: GitHubRepoRest[]; capped: boolean }> {
  const pageSize = 100;
  const maxPages = GITHUB_TOKEN ? 10 : 3;
  const all: GitHubRepoRest[] = [];
  for (let page = 1; page <= maxPages; page += 1) {
    const repos = await rest<GitHubRepoRest[]>(`${API}/users/${encodeURIComponent(username)}/repos?type=owner&sort=updated&direction=desc&per_page=${pageSize}&page=${page}`);
    all.push(...repos);
    if (repos.length < pageSize) break;
  }
  return { repos: all, capped: expectedTotal > all.length };
}

async function getGraphData(username: string, range: RangeKey): Promise<GraphResult | null> {
  if (!GITHUB_TOKEN) return null;
  const now = new Date();
  const to = new Date(now); to.setUTCHours(23, 59, 59, 999);
  const from = getRangeStart(range, now);
  const yearFrom = getRangeStart("year", now);
  const query = `query OrbitProfile($login: String!, $from: DateTime!, $yearFrom: DateTime!, $to: DateTime!) {
    user(login: $login) {
      period: contributionsCollection(from: $from, to: $to) {
        totalCommitContributions totalIssueContributions totalPullRequestContributions totalPullRequestReviewContributions
        totalRepositoriesWithContributedCommits contributionCalendar { totalContributions }
      }
      year: contributionsCollection(from: $yearFrom, to: $to) {
        contributionCalendar { totalContributions weeks { contributionDays { date contributionCount } } }
      }
      repos: repositories(first: 25, privacy: PUBLIC, ownerAffiliations: OWNER, orderBy: { field: STARGAZERS, direction: DESC }) {
        nodes {
          name nameWithOwner description url stargazerCount forkCount updatedAt pushedAt createdAt isFork isArchived
          primaryLanguage { name color }
          languages(first: 10, orderBy: { field: SIZE, direction: DESC })
          licenseInfo { name }
          issues(states: OPEN) { totalCount }
          pullRequests(states: OPEN) { totalCount }
          releases(first: 1, orderBy: { field: CREATED_AT, direction: DESC }) { nodes { tagName publishedAt } }
          repositoryTopics(first: 5) { nodes { topic { name } } }
        }
      }
    }
  }`;
  const response = await fetch(GRAPHQL, {
    method: "POST",
    headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, "Content-Type": "application/json", "User-Agent": "orbit-github-profile" },
    body: JSON.stringify({ query, variables: { login: username, from: from.toISOString(), yearFrom: yearFrom.toISOString(), to: to.toISOString() } }),
    cache: "no-store"
  });
  if (!response.ok) throw new GitHubProfileError(`GitHub GraphQL API returned ${response.status}. Check the configured token.`, response.status);
  const result = await response.json() as GraphResult;
  if (result.errors?.length) throw new GitHubProfileError(`GitHub GraphQL query failed: ${result.errors[0].message}`);
  return result;
}

async function getPublicEvents(username: string): Promise<ActivityDay[]> {
  type Event = { created_at: string };
  const events = await rest<Event[]>(`${API}/users/${encodeURIComponent(username)}/events/public?per_page=100`);
  const counts = new Map<string, number>();
  for (const event of events) {
    const key = event.created_at.slice(0, 10);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const activity: ActivityDay[] = [];
  for (let offset = 89; offset >= 0; offset -= 1) {
    const date = new Date(); date.setUTCHours(0, 0, 0, 0); date.setUTCDate(date.getUTCDate() - offset);
    const key = date.toISOString().slice(0, 10);
    activity.push({ date: key, count: counts.get(key) ?? 0 });
  }
  return activity;
}

async function getPublicLanguages(repos: GitHubRepoRest[]): Promise<LanguageStat[]> {
  const candidates = repos.filter((repo) => !repo.fork).sort((a, b) => b.stargazers_count - a.stargazers_count).slice(0, GITHUB_TOKEN ? 12 : 8);
  const totals = new Map<string, LanguageStat>();
  let cursor = 0;
  const worker = async () => {
    while (cursor < candidates.length) {
      const index = cursor++;
      const repo = candidates[index];
      try {
        const languageBytes = await rest<Record<string, number>>(`${API}/repos/${repo.full_name}/languages`);
        for (const [name, bytes] of Object.entries(languageBytes)) {
          const item = totals.get(name) ?? { name, bytes: 0, color: languageColor(name) };
          item.bytes += bytes;
          totals.set(name, item);
        }
      } catch {
        // Partial language coverage is called out in the UI; one unavailable repo should not fail the profile.
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, candidates.length) }, () => worker()));
  return [...totals.values()].sort((a, b) => b.bytes - a.bytes).slice(0, 8);
}

function languageColor(name: string): string {
  const known: Record<string, string> = {
    TypeScript: "#3178c6", JavaScript: "#f1e05a", Python: "#3572A5", Java: "#b07219", Go: "#00ADD8",
    Rust: "#dea584", Ruby: "#701516", PHP: "#4F5D95", C: "#555555", "C++": "#f34b7d", CSS: "#663399",
    HTML: "#e34c26", Shell: "#89e051", Swift: "#F05138", Kotlin: "#A97BFF", Dart: "#00B4AB", Vue: "#41b883"
  };
  return known[name] ?? "#8a93a6";
}

function mapRepo(repo: GitHubRepoRest, graph?: GraphRepository): Repository {
  const release = graph?.releases.nodes[0];
  return {
    name: repo.name,
    fullName: repo.full_name,
    description: repo.description,
    url: repo.html_url,
    stars: repo.stargazers_count,
    forks: repo.forks_count,
    openIssues: graph ? graph.issues.totalCount : null,
    openPullRequests: graph ? graph.pullRequests.totalCount : null,
    language: graph?.primaryLanguage?.name ?? repo.language,
    languageColor: graph?.primaryLanguage?.color ?? languageColor(repo.language ?? ""),
    updatedAt: repo.updated_at,
    pushedAt: repo.pushed_at,
    createdAt: repo.created_at,
    isFork: repo.fork,
    isArchived: repo.archived,
    license: graph?.licenseInfo?.name ?? repo.license?.name ?? null,
    releaseTag: release?.tagName ?? null,
    releaseDate: release?.publishedAt ?? null,
    topics: graph?.repositoryTopics.nodes.map((item) => item.topic.name) ?? repo.topics ?? []
  };
}

export async function getGitHubProfile(username: string, range: RangeKey): Promise<DeveloperProfile> {
  const user = await rest<GitHubUserRest>(`${API}/users/${encodeURIComponent(username)}`);
  const [repoResult, graphResult] = await Promise.all([
    getAllPublicRepos(username, user.public_repos),
    getGraphData(username, range)
  ]);
  const graphUser = graphResult?.user ?? null;
  if (GITHUB_TOKEN && !graphUser) throw new GitHubProfileError("GitHub did not return a public profile for that username.", 404);

  const graphRepos = new Map((graphUser?.repos.nodes ?? []).map((repo) => [repo.nameWithOwner.toLowerCase(), repo]));
  const repositories = repoResult.repos.map((repo) => mapRepo(repo, graphRepos.get(repo.full_name.toLowerCase())));
  const originalRepos = repoResult.repos.filter((repo) => !repo.fork);
  const starsReceived = originalRepos.reduce((sum, repo) => sum + repo.stargazers_count, 0);
  const forksReceived = originalRepos.reduce((sum, repo) => sum + repo.forks_count, 0);
  const activity = graphUser ? graphUser.year.contributionCalendar.weeks.flatMap((week) => week.contributionDays.map((day) => ({ date: day.date, count: day.contributionCount }))).sort((a, b) => a.date.localeCompare(b.date)) : await getPublicEvents(username);
  const periodDays = graphUser ? activity.filter((day) => day.date >= getRangeStart(range).toISOString().slice(0, 10)) : activity;
  const period = graphUser?.period;
  const languagesMap = new Map<string, LanguageStat>();
  if (graphUser) {
    for (const repo of graphUser.repos.nodes.filter((item) => !item.isFork)) {
      for (const edge of repo.languages.edges) {
        const name = edge.node.name;
        const current = languagesMap.get(name) ?? { name, bytes: 0, color: edge.node.color ?? languageColor(name) };
        current.bytes += edge.size;
        languagesMap.set(name, current);
      }
    }
  }
  const languages = graphUser ? [...languagesMap.values()].sort((a, b) => b.bytes - a.bytes).slice(0, 8) : await getPublicLanguages(repoResult.repos);
  const returnedRepoCount = repoResult.repos.length;
  const repoCoverageNote = repoResult.capped
    ? `Loaded ${returnedRepoCount} of ${user.public_repos} public repositories. Repository totals are partial because the API page cap was reached.`
    : `Repository totals cover ${returnedRepoCount} public repositories owned by this account; forks are excluded from stars received.`;
  const contributionCalendarNote = graphUser
    ? "Contribution counts come from GitHub's contribution calendar for public data available to this service."
    : "Limited mode: GitHub's recent public events feed is not a full contribution history. Add GITHUB_TOKEN to unlock the contribution calendar and PR, issue, and review totals.";
  const dataMode: DataMode = graphUser ? "graphql" : "public-rest";
  const activeDays = countActiveDays(periodDays);
  return {
    login: user.login,
    name: user.name,
    bio: user.bio,
    company: user.company,
    location: user.location,
    websiteUrl: user.blog ? (user.blog.startsWith("http") ? user.blog : `https://${user.blog}`) : null,
    twitterUsername: user.twitter_username,
    createdAt: user.created_at,
    profileUrl: user.html_url,
    stats: {
      contributions: period ? period.contributionCalendar.totalContributions : null,
      commits: period?.totalCommitContributions ?? null,
      pullRequests: period?.totalPullRequestContributions ?? null,
      issues: period?.totalIssueContributions ?? null,
      reviews: period?.totalPullRequestReviewContributions ?? null,
      contributedRepos: period?.totalRepositoriesWithContributedCommits ?? null,
      publicRepos: user.public_repos,
      starsReceived,
      forksReceived,
      followers: user.followers,
      following: user.following,
      activeDays,
      currentStreak: getCurrentStreak(activity),
      longestStreak: getLongestStreak(activity)
    },
    activity,
    monthlyActivity: toMonthlyActivity(activity),
    languages,
    repositories: repositories.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    contributionCalendarAvailable: Boolean(graphUser),
    contributionCalendarNote,
    repoCoverageNote,
    dataMode,
    lastUpdated: new Date().toISOString(),
    range
  };
}
