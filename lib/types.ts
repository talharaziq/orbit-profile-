export type RangeKey = "30d" | "90d" | "year";
export type DataMode = "demo" | "graphql" | "public-rest";

export interface ActivityDay {
  date: string;
  count: number;
}

export interface LanguageStat {
  name: string;
  bytes: number;
  color: string;
}

export interface Repository {
  name: string;
  fullName: string;
  description: string | null;
  url: string;
  stars: number;
  forks: number;
  openIssues: number | null;
  openPullRequests: number | null;
  language: string | null;
  languageColor: string;
  updatedAt: string;
  pushedAt: string | null;
  createdAt: string;
  isFork: boolean;
  isArchived: boolean;
  license: string | null;
  releaseTag: string | null;
  releaseDate: string | null;
  topics: string[];
}

export interface ProfileStats {
  contributions: number | null;
  commits: number | null;
  pullRequests: number | null;
  issues: number | null;
  reviews: number | null;
  contributedRepos: number | null;
  publicRepos: number;
  starsReceived: number;
  forksReceived: number;
  followers: number;
  following: number;
  activeDays: number;
  currentStreak: number;
  longestStreak: number;
}

export interface DeveloperProfile {
  login: string;
  name: string | null;
  bio: string | null;
  company: string | null;
  location: string | null;
  websiteUrl: string | null;
  twitterUsername: string | null;
  createdAt: string;
  profileUrl: string;
  stats: ProfileStats;
  activity: ActivityDay[];
  monthlyActivity: Array<{ label: string; total: number; commits?: number }>;
  languages: LanguageStat[];
  repositories: Repository[];
  contributionCalendarAvailable: boolean;
  contributionCalendarNote: string;
  repoCoverageNote: string;
  dataMode: DataMode;
  lastUpdated: string;
  range: RangeKey;
  errorNotice?: string;
}

export interface GitHubUserRest {
  login: string;
  name: string | null;
  bio: string | null;
  company: string | null;
  location: string | null;
  blog: string | null;
  twitter_username: string | null;
  created_at: string;
  html_url: string;
  public_repos: number;
  followers: number;
  following: number;
}

export interface GitHubRepoRest {
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  language: string | null;
  updated_at: string;
  pushed_at: string | null;
  created_at: string;
  fork: boolean;
  archived: boolean;
  license: { name: string } | null;
  topics?: string[];
}
