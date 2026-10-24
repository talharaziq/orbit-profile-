"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import { ActivityChart, type TrendPoint } from "./components";
import { createDemoProfile } from "@/lib/demo";
import { colorForCount, formatDate, formatNumber, relativeDate, totalActivity } from "@/lib/metrics";
import type { DeveloperProfile, RangeKey, Repository } from "@/lib/types";

const accents = [
  { name: "Violet", value: "#9B87F5", rgb: "155, 135, 245" },
  { name: "Cyan", value: "#65D9E8", rgb: "101, 217, 232" },
  { name: "Lime", value: "#B9ED70", rgb: "185, 237, 112" },
  { name: "Coral", value: "#FF947D", rgb: "255, 148, 125" }
];
const dateRanges: Array<{ key: RangeKey; label: string }> = [
  { key: "30d", label: "30 days" },
  { key: "90d", label: "90 days" },
  { key: "year", label: "1 year" }
];

type RepoFilter = "all" | "original" | "forks" | "archived";
type RepoSort = "updated" | "stars" | "forks";

function makeTrend(activity: DeveloperProfile["activity"], range: RangeKey): TrendPoint[] {
  const daysBack = range === "30d" ? 30 : range === "90d" ? 90 : 365;
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - (daysBack - 1));
  const startKey = start.toISOString().slice(0, 10);
  const selected = activity.filter((day) => day.date >= startKey);
  const buckets = new Map<string, { label: string; total: number }>();
  for (const day of selected) {
    const date = new Date(`${day.date}T00:00:00Z`);
    let key: string;
    let label: string;
    if (range === "30d") {
      const dayOfWeek = (date.getUTCDay() + 6) % 7;
      date.setUTCDate(date.getUTCDate() - dayOfWeek);
      key = date.toISOString().slice(0, 10);
      label = date.toLocaleDateString("en", { month: "short", day: "numeric", timeZone: "UTC" });
    } else {
      key = day.date.slice(0, 7);
      label = date.toLocaleDateString("en", { month: "short", timeZone: "UTC" });
    }
    const bucket = buckets.get(key) ?? { label, total: 0 };
    bucket.total += day.count;
    buckets.set(key, bucket);
  }
  return [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, value]) => value);
}

function initialFor(profile: DeveloperProfile): string {
  return (profile.name || profile.login || "G").trim().slice(0, 1).toUpperCase();
}

function markdownFor(profile: DeveloperProfile, range: RangeKey, dashboardUrl: string): string {
  const observedEvents = totalActivity(profile.activity.filter((day) => {
    const back = range === "30d" ? 30 : range === "90d" ? 90 : 365;
    const start = new Date(); start.setUTCHours(0, 0, 0, 0); start.setUTCDate(start.getUTCDate() - back + 1);
    return day.date >= start.toISOString().slice(0, 10);
  }));
  const firstMetric = profile.contributionCalendarAvailable
    ? `Contributions in selected period | ${formatNumber(profile.stats.contributions)}`
    : `Recent public events observed | ${formatNumber(observedEvents)}`;
  const introduction = profile.dataMode === "demo"
    ? "> This is sample data for preview. Load a live GitHub username in Orbit before using these metrics as your own.\n\n" + (profile.bio || `I'm ${profile.login} on GitHub.`)
    : (profile.bio || `I'm ${profile.login} on GitHub.`);
  const rows = [
    `| ${firstMetric.split(" | ")[0]} | ${firstMetric.split(" | ")[1]} |`,
    `| Public repositories | ${formatNumber(profile.stats.publicRepos)} |`,
    `| Stars received on owned repositories | ${formatNumber(profile.stats.starsReceived)} |`,
    `| Followers | ${formatNumber(profile.stats.followers)} |`
  ];
  const featured = profile.repositories.filter((repo) => !repo.isFork && !repo.isArchived).sort((a, b) => b.stars - a.stars).slice(0, 4);
  return [
    `## Hey, I'm ${profile.name || profile.login} 👋`,
    "",
    introduction,
    "",
    "### GitHub at a glance",
    "",
    "| Metric | Value |",
    "| --- | ---: |",
    ...rows,
    "",
    "### Featured projects",
    "",
    ...(featured.length ? featured.map((repo) => `- [${repo.name}](${repo.url}) — ${repo.description || "No description provided."} · ★ ${formatNumber(repo.stars)} · ${repo.language || "Unspecified language"}`) : ["- Add a few public repositories to feature them here."]),
    "",
    `**[Open my interactive developer profile](${dashboardUrl})**`,
    "",
    "<!-- Generated with Orbit GitHub Profile Studio. This README uses plain Markdown, not static stats images. -->"
  ].join("\n");
}

function MetricCard({ label, value, note, glyph, tone = "violet", onClick }: { label: string; value: string; note: string; glyph: string; tone?: string; onClick: () => void }) {
  return (
    <button type="button" className="metric-card" onClick={onClick} aria-label={`${label}: ${value}. ${note}`}>
      <div className={`metric-glyph ${tone}`} aria-hidden="true">{glyph}</div>
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
      <div className="metric-note">{note}</div>
    </button>
  );
}

export default function HomePage() {
  const [profile, setProfile] = useState<DeveloperProfile>(() => createDemoProfile("year"));
  const [username, setUsername] = useState("");
  const [range, setRange] = useState<RangeKey>("year");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [toast, setToast] = useState("");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [accentIndex, setAccentIndex] = useState(0);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("overview");
  const [repoQuery, setRepoQuery] = useState("");
  const [repoFilter, setRepoFilter] = useState<RepoFilter>("all");
  const [repoSort, setRepoSort] = useState<RepoSort>("updated");
  const [showAllRepos, setShowAllRepos] = useState(false);
  const [readmeOpen, setReadmeOpen] = useState(false);
  const [readmeText, setReadmeText] = useState("");

  const accent = accents[accentIndex];
  const rootStyle = {
    "--accent": accent.value,
    "--accent-rgb": accent.rgb
  } as CSSProperties;
  const dashboardUrl = useMemo(() => {
    if (typeof window === "undefined") return `https://your-deployment.example/?username=${profile.login}`;
    const base = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
    if (profile.dataMode === "demo") return base.replace(/\/$/, "");
    return `${base.replace(/\/$/, "")}/?username=${encodeURIComponent(profile.login)}&range=${range}`;
  }, [profile.login, profile.dataMode, range]);
  const trend = useMemo(() => makeTrend(profile.activity, range), [profile.activity, range]);
  const maxDayCount = useMemo(() => Math.max(1, ...profile.activity.map((day) => day.count)), [profile.activity]);
  const filteredPeriodDays = useMemo(() => {
    const daysBack = range === "30d" ? 30 : range === "90d" ? 90 : 365;
    const start = new Date(); start.setUTCHours(0, 0, 0, 0); start.setUTCDate(start.getUTCDate() - (daysBack - 1));
    return profile.activity.filter((day) => day.date >= start.toISOString().slice(0, 10));
  }, [profile.activity, range]);
  const liveActivityValue = profile.contributionCalendarAvailable ? profile.stats.contributions : totalActivity(filteredPeriodDays);
  const modeText = profile.dataMode === "demo" ? "Interactive sample" : profile.dataMode === "graphql" ? "Live GitHub data" : "Limited public data";

  const loadProfile = useCallback(async (name: string, selectedRange: RangeKey) => {
    const trimmed = name.trim().replace(/^@/, "");
    if (!trimmed) { setErrorMessage("Enter a GitHub username first."); return; }
    setLoading(true);
    setErrorMessage("");
    setToast("");
    try {
      const response = await fetch(`/api/profile?username=${encodeURIComponent(trimmed)}&range=${selectedRange}`, { cache: "no-store" });
      const payload = await response.json() as DeveloperProfile | { error?: string };
      if (!response.ok || "error" in payload) throw new Error((payload as { error?: string }).error || "Could not load this profile.");
      const nextProfile = payload as DeveloperProfile;
      setProfile(nextProfile);
      setUsername(nextProfile.login);
      setRange(nextProfile.range);
      setRepoQuery("");
      setRepoFilter("all");
      setShowAllRepos(false);
      if (typeof window !== "undefined") {
        const query = new URLSearchParams(window.location.search);
        query.set("username", nextProfile.login);
        query.set("range", nextProfile.range);
        window.history.replaceState(null, "", `${window.location.pathname}?${query.toString()}`);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to load GitHub data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
  
  useEffect(() => {
    try {
      const savedTheme = window.localStorage.getItem("orbit-theme");
      if (savedTheme === "light" || savedTheme === "dark") {
        window.setTimeout(() => setTheme(savedTheme), 0);
      }

      const savedAccent = window.localStorage.getItem("orbit-accent");
      const savedAccentIndex = accents.findIndex((item) => item.name === savedAccent);
      if (savedAccentIndex >= 0) {
        window.setTimeout(() => setAccentIndex(savedAccentIndex), 0);
      }
    } catch {
      // Local storage may be disabled; the dashboard remains usable without saved preferences.
    }

    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get("username");
    const rangeParam = params.get("range");
    const validRange = dateRanges.some((item) => item.key === rangeParam)
      ? rangeParam as RangeKey
      : "year";

    if (fromUrl) {
      setUsername(fromUrl);
      setRange(validRange);
      void loadProfile(fromUrl, validRange);
    }
  }, [loadProfile]);


  useEffect(() => {
    try { window.localStorage.setItem("orbit-theme", theme); } catch { /* Optional preference only. */ }
  }, [theme]);

  useEffect(() => {
    try { window.localStorage.setItem("orbit-accent", accents[accentIndex].name); } catch { /* Optional preference only. */ }
  }, [accentIndex]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  async function copyText(value: string, message: string) {
    try {
      await navigator.clipboard.writeText(value);
      setToast(message);
    } catch {
      const field = document.createElement("textarea");
      field.value = value;
      field.style.position = "fixed";
      field.style.opacity = "0";
      document.body.appendChild(field);
      field.select();
      const copied = document.execCommand("copy");
      field.remove();
      setToast(copied ? message : "Copy was blocked by the browser. Select and copy the text manually.");
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void loadProfile(username, range);
  }

  function handleRangeChange(nextRange: RangeKey) {
    if (nextRange === range && profile.dataMode !== "demo") return;
    if (profile.dataMode === "demo") {
      setRange(nextRange);
      setProfile(createDemoProfile(nextRange));
      return;
    }
    void loadProfile(profile.login, nextRange);
  }

  function useDemo() {
    setProfile(createDemoProfile(range));
    setUsername("");
    setErrorMessage("");
    setRepoQuery("");
    setRepoFilter("all");
    setShowAllRepos(false);
    if (typeof window !== "undefined") window.history.replaceState(null, "", window.location.pathname);
    setToast("Sample dashboard loaded");
  }

  function openReadme() {
    setReadmeText(markdownFor(profile, range, dashboardUrl));
    setReadmeOpen(true);
  }

  const filteredRepos = useMemo(() => {
    let results = [...profile.repositories];
    if (repoFilter === "original") results = results.filter((repo) => !repo.isFork && !repo.isArchived);
    if (repoFilter === "forks") results = results.filter((repo) => repo.isFork);
    if (repoFilter === "archived") results = results.filter((repo) => repo.isArchived);
    const needle = repoQuery.trim().toLowerCase();
    if (needle) results = results.filter((repo) => `${repo.name} ${repo.description ?? ""} ${repo.language ?? ""} ${repo.topics.join(" ")}`.toLowerCase().includes(needle));
    results.sort((a, b) => repoSort === "stars" ? b.stars - a.stars : repoSort === "forks" ? b.forks - a.forks : new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    return results;
  }, [profile.repositories, repoFilter, repoQuery, repoSort]);
  const repoDisplay = showAllRepos ? filteredRepos : filteredRepos.slice(0, 6);

  const contributionMonths = useMemo(() => {
    const months: string[] = [];
    let previous = "";
    for (const day of profile.activity) {
      const date = new Date(`${day.date}T00:00:00Z`);
      const key = date.toLocaleDateString("en", { month: "short", timeZone: "UTC" });
      if (key !== previous) { months.push(key); previous = key; }
    }
    return months;
  }, [profile.activity]);

  const strongestDay = useMemo(() => profile.activity.reduce((best, day) => day.count > (best?.count ?? -1) ? day : best, profile.activity[0]), [profile.activity]);
  const busiestMonth = useMemo(() => profile.monthlyActivity.reduce((best, month) => month.total > (best?.total ?? -1) ? month : best, profile.monthlyActivity[0]), [profile.monthlyActivity]);
  const bestRepo = useMemo(() => profile.repositories.filter((repo) => !repo.isFork).sort((a, b) => b.stars - a.stars)[0], [profile.repositories]);
  const archivedCount = profile.repositories.filter((repo) => repo.isArchived).length;
  const unlicensedCount = profile.repositories.filter((repo) => !repo.license && !repo.isFork && !repo.isArchived).length;
  const staleCount = profile.repositories.filter((repo) => !repo.isArchived && (Date.now() - new Date(repo.pushedAt ?? repo.updatedAt).getTime()) > 180 * 86_400_000).length;
  const joinYear = new Date(profile.createdAt).getUTCFullYear();

  return (
    <div className={`app-shell ${theme === "light" ? "theme-light" : ""}`} style={rootStyle}>
      <aside className="sidebar">
        <a href="#overview" className="brand" onClick={() => setActiveSection("overview")} aria-label="Orbit home">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /><i /></span>
          <span className="brand-name">orbit<span>.</span></span>
          <span className="brand-tag">PROFILE STUDIO</span>
        </a>

        <div className="sidebar-label">WORKSPACE</div>
        <nav className="side-nav" aria-label="Dashboard sections">
          {[
            { id: "overview", glyph: "◫", label: "Overview" },
            { id: "activity", glyph: "⌁", label: "Activity" },
            { id: "repositories", glyph: "⌘", label: "Repositories" },
            { id: "languages", glyph: "{ }", label: "Languages" },
            { id: "collaboration", glyph: "↗", label: "Open source" },
            { id: "highlights", glyph: "✳", label: "Highlights" }
          ].map((item) => (
            <a key={item.id} href={`#${item.id}`} className={`nav-link ${activeSection === item.id ? "active" : ""}`} onClick={() => setActiveSection(item.id)}>
              <span className="nav-glyph" aria-hidden="true">{item.glyph}</span><span>{item.label}</span>
            </a>
          ))}
        </nav>

        <div className="sidebar-label profile-label">PROFILE PREVIEW</div>
        <div className="mini-profile">
          <div className="avatar-orbit">{initialFor(profile)}</div>
          <div className="mini-profile-copy">
            <strong>{profile.name || profile.login}</strong>
            <span>@{profile.login}</span>
          </div>
          <span className={`status-dot ${profile.dataMode === "demo" ? "sample" : ""}`} title={modeText} />
        </div>
        <p className="sidebar-note">A clearer view of your work, built from the public parts of GitHub.</p>
        <div className="sidebar-bottom">
          <div className="sidebar-label">APPEARANCE</div>
          <button type="button" className="appearance-button" onClick={() => setTheme((value) => value === "dark" ? "light" : "dark")}>
            <span className="appearance-glyph">{theme === "dark" ? "☼" : "☾"}</span>
            <span>{theme === "dark" ? "Light appearance" : "Dark appearance"}</span>
            <span className="shortcut">{theme === "dark" ? "☼" : "☾"}</span>
          </button>
          <a className="sidebar-github" href="https://github.com" target="_blank" rel="noreferrer"><span>↗</span> Powered by GitHub data</a>
          <div className="sidebar-version">ORBIT STUDIO <span>v1.0.0</span></div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb"><span>Workspace</span><span className="crumb-slash">/</span><strong>{profile.login}</strong></div>
          <div className="topbar-actions">
            <span className={`mode-pill ${profile.dataMode}`}>{profile.dataMode === "demo" ? "✦" : profile.dataMode === "graphql" ? "●" : "◌"} {modeText}</span>
            <button className="icon-button" type="button" aria-label="Refresh profile data" title="Refresh profile data" disabled={loading || profile.dataMode === "demo"} onClick={() => void loadProfile(profile.login, range)}>{loading ? <span className="spinner" /> : "↻"}</button>
            <div className="palette-control">
              <button className="palette-trigger" type="button" title="Choose accent color" aria-label="Choose accent color" aria-expanded={paletteOpen} onClick={() => setPaletteOpen((open) => !open)}><span style={{ background: accent.value }} />⌄</button>
              {paletteOpen && <div className="palette-popover" role="group" aria-label="Accent colors">{accents.map((item, index) => <button key={item.name} type="button" className={`palette-choice ${accentIndex === index ? "selected" : ""}`} title={item.name} aria-label={`${item.name} accent`} onClick={() => { setAccentIndex(index); setPaletteOpen(false); }}><span style={{ background: item.value }} /></button>)}</div>}
            </div>
            <button className="icon-button theme-top-button" type="button" aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} appearance`} title={`Switch to ${theme === "dark" ? "light" : "dark"} appearance`} onClick={() => setTheme((value) => value === "dark" ? "light" : "dark")}>{theme === "dark" ? "☼" : "☾"}</button>
            <button className="top-share-button" type="button" onClick={() => void copyText(dashboardUrl, "Profile link copied")}>Share profile <span>↗</span></button>
          </div>
        </header>

        <div className="page-inner">
          <section className="welcome-row" id="overview">
            <div className="welcome-copy">
              <div className="eyebrow"><span className="eyebrow-line" /> DEVELOPER ANALYTICS, REIMAGINED</div>
              <h1>Your work,<br /><span>in motion.</span></h1>
              <p>A living, interactive snapshot of your GitHub journey. Your projects, patterns, and progress in one place.</p>
              <div className="welcome-meta"><span className="meta-avatar">{initialFor(profile)}</span><span>Exploring <strong>@{profile.login}</strong></span><span className="meta-divider" /><span>Member since {joinYear || "—"}</span>{profile.location && <><span className="meta-divider" /><span>⌖ {profile.location}</span></>}{profile.company && <><span className="meta-divider" /><span>◫ {profile.company}</span></>}{profile.websiteUrl && <><span className="meta-divider" /><a href={profile.websiteUrl} target="_blank" rel="noreferrer" className="profile-website">{profile.websiteUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")} ↗</a></>}</div>
            </div>
            <div className="search-panel">
              <div className="search-panel-heading"><div><div className="search-overline">PROFILE LOOKUP</div><strong>Make it yours</strong></div><span className="search-glyph">⌕</span></div>
              <p>Enter any public GitHub username to build a live dashboard.</p>
              <form className="lookup-form" onSubmit={handleSubmit}>
                <span className="input-prefix">@</span>
                <input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="github-username" aria-label="GitHub username" autoComplete="off" maxLength={39} />
                <button type="submit" disabled={loading}>{loading ? <span className="spinner" /> : "Build profile"}</button>
              </form>
              <div className="search-bottom"><span><span className="green-dot" /> Public data only</span><button type="button" onClick={useDemo}>Explore sample ↗</button></div>
            </div>
          </section>

          {errorMessage && <div className="notice error-notice" role="alert"><span className="notice-glyph">!</span><div><strong>Couldn’t load that profile</strong><p>{errorMessage} The dashboard below remains a clearly labeled sample until a live profile loads.</p></div><button className="notice-close" type="button" onClick={() => setErrorMessage("")} aria-label="Dismiss error">×</button></div>}
          {profile.dataMode === "public-rest" && <div className="notice limited-notice"><span className="notice-glyph">i</span><div><strong>Live profile loaded in limited mode</strong><p>Public repositories, stars, followers, and recent public events are available. Add <code>GITHUB_TOKEN</code> to your server environment to unlock the full contribution calendar and pull request, issue, and review metrics.</p></div><a href="#data-quality">Details ↘</a></div>}

          <section className="section-block metrics-section" aria-label="Profile summary metrics">
            <div className="section-head compact-head"><div><span className="section-kicker">AT A GLANCE</span><h2>The big picture</h2></div><div className="range-switcher" role="group" aria-label="Activity date range">{dateRanges.map((item) => <button key={item.key} type="button" className={range === item.key ? "selected" : ""} onClick={() => handleRangeChange(item.key)} disabled={loading}>{item.label}</button>)}</div></div>
            <div className="metric-grid">
              <MetricCard label={profile.contributionCalendarAvailable ? "Contributions" : "Public events seen"} value={formatNumber(liveActivityValue)} note={profile.contributionCalendarAvailable ? `Across the last ${range === "30d" ? "30 days" : range === "90d" ? "90 days" : "year"}` : "Recent event feed · not full history"} glyph="⌁" tone="violet" onClick={() => document.getElementById("activity")?.scrollIntoView({ behavior: "smooth" })} />
              <MetricCard label="Stars received" value={formatNumber(profile.stats.starsReceived)} note="Across owned public repositories" glyph="✳" tone="gold" onClick={() => document.getElementById("repositories")?.scrollIntoView({ behavior: "smooth" })} />
              <MetricCard label="Public repositories" value={formatNumber(profile.stats.publicRepos)} note={`${profile.stats.forksReceived.toLocaleString()} forks received on owned originals`} glyph="⌘" tone="blue" onClick={() => document.getElementById("repositories")?.scrollIntoView({ behavior: "smooth" })} />
              <MetricCard label="Followers" value={formatNumber(profile.stats.followers)} note={`${formatNumber(profile.stats.following)} accounts followed`} glyph="◉" tone="green" onClick={() => window.open(profile.profileUrl, "_blank", "noopener,noreferrer")} />
            </div>
          </section>

          <section className="section-block activity-section" id="activity">
            <div className="section-head"><div><span className="section-kicker">CONSISTENCY OVER INTENSITY</span><h2>Activity rhythm</h2><p className="section-subtitle">Patterns and momentum across your selected window.</p></div><span className="section-index">01 / ACTIVITY</span></div>
            <div className="activity-grid">
              <div className="panel trend-panel">
                <div className="panel-heading"><div><h3>{profile.contributionCalendarAvailable ? "Contribution trend" : "Observed public activity"}</h3><p>{profile.dataMode === "public-rest" ? "Recent events visible to the public REST API" : range === "30d" ? "Grouped by week" : range === "90d" ? "Grouped by month · last 90 days" : "Monthly activity · last 12 months"}</p></div><span className="panel-menu">•••</span></div>
                <ActivityChart data={trend} caption="Move across the chart to inspect each period" />
                <div className="chart-footer"><span><span className="legend-dot" /> {profile.contributionCalendarAvailable ? "Contributions" : "Public events observed"}</span><span>Source: GitHub API <span className="source-check">✓</span></span></div>
              </div>
              <div className="panel streak-panel">
                <div className="panel-heading"><div><h3>Consistency</h3><p>Small steps add up</p></div><span className="streak-icon">↗</span></div>
                <div className="streak-main"><div className="streak-number">{profile.stats.currentStreak}<span> days</span></div><div className="streak-caption">Current contribution streak</div></div>
                <div className="streak-rule" />
                <div className="streak-row"><span><span className="streak-bullet violet-bullet" />Longest streak</span><strong>{profile.stats.longestStreak} days</strong></div>
                <div className="streak-row"><span><span className="streak-bullet cyan-bullet" />Active days</span><strong>{formatNumber(profile.stats.activeDays)}</strong></div>
                <div className="streak-row"><span><span className="streak-bullet lime-bullet" />Peak day</span><strong>{strongestDay?.count ?? 0} events</strong></div>
                <p className="small-muted">Streaks are calculated from the activity data available to this dashboard. In limited mode, the event feed may undercount activity.</p>
              </div>
            </div>

            <div className="panel calendar-panel">
              <div className="panel-heading"><div><h3>Contribution calendar</h3><p>{profile.activity.length > 100 ? "A year of daily activity, at a glance" : "Recent public events currently visible to the API"}</p></div><div className="heatmap-legend"><span>Less</span>{[0, 1, 2, 3, 4].map((item) => <i key={item} className={`heat-cell heat-${item}`} />)}<span>More</span></div></div>
              <div className="calendar-months" aria-hidden="true">{contributionMonths.map((month, index) => <span key={`${month}-${index}`}>{month}</span>)}</div>
              <div className="calendar-scroll"><div className="heatmap-grid" role="group" aria-label="Daily activity calendar">{profile.activity.map((day) => <button key={day.date} className="heat-cell" style={{ backgroundColor: colorForCount(day.count, maxDayCount) }} title={`${day.date}: ${day.count} ${profile.contributionCalendarAvailable ? "contributions" : "public events observed"}`} aria-label={`${day.date}: ${day.count} ${profile.contributionCalendarAvailable ? "contributions" : "public events observed"}`} onClick={() => setToast(`${day.date} · ${day.count} ${profile.contributionCalendarAvailable ? "contributions" : "public events observed"}`)} />)}</div></div>
              <div className="calendar-footer"><span>{profile.contributionCalendarAvailable ? `${formatNumber(totalActivity(profile.activity))} contributions across the calendar shown` : `${formatNumber(totalActivity(profile.activity))} public events represented in this limited feed`}</span><span>{profile.activity.length} days shown <span className="footer-dot">·</span> Summary metrics use the selected period <span className="footer-dot">·</span> Tap a cell for details</span></div>
            </div>
          </section>

          <section className="section-block portfolio-section" id="repositories">
            <div className="section-head"><div><span className="section-kicker">WHAT YOU SHIP</span><h2>Repository portfolio</h2><p className="section-subtitle">The projects behind the numbers.</p></div><a href={`${profile.profileUrl}?tab=repositories`} target="_blank" rel="noreferrer" className="text-link">View on GitHub <span>↗</span></a></div>
            <div className="portfolio-summary"><div><span className="summary-label">Owned repos loaded</span><strong>{profile.repositories.filter((repo) => !repo.isFork).length}</strong></div><div><span className="summary-label">Stars received</span><strong>{formatNumber(profile.stats.starsReceived)}</strong></div><div><span className="summary-label">Archived projects</span><strong>{archivedCount}</strong></div><div className="portfolio-hint"><span className="hint-glyph">✳</span><span>Star counts are grouped across owned, non-fork repositories.</span></div></div>
            <div className="repo-toolbar">
              <label className="repo-search"><span>⌕</span><input value={repoQuery} onChange={(event) => setRepoQuery(event.target.value)} placeholder="Search projects, topics, languages…" aria-label="Search repositories" /></label>
              <div className="repo-toolbar-right"><div className="repo-filters" role="group" aria-label="Filter repositories">{(["all", "original", "forks", "archived"] as RepoFilter[]).map((filter) => <button key={filter} type="button" className={repoFilter === filter ? "selected" : ""} onClick={() => { setRepoFilter(filter); setShowAllRepos(false); }}>{filter === "all" ? "All" : filter === "original" ? "Original" : filter === "forks" ? "Forks" : "Archived"}</button>)}</div><select className="sort-select" value={repoSort} onChange={(event) => setRepoSort(event.target.value as RepoSort)} aria-label="Sort repositories"><option value="updated">Recently active</option><option value="stars">Most stars</option><option value="forks">Most forks</option></select></div>
            </div>
            {repoDisplay.length ? <div className="repo-grid">{repoDisplay.map((repo) => <RepositoryCard key={repo.fullName} repo={repo} />)}</div> : <div className="empty-state"><span>⌕</span><strong>No projects match that filter.</strong><p>Try another search term or filter.</p></div>}
            {filteredRepos.length > 6 && <div className="repo-view-all"><button type="button" className="secondary-button" onClick={() => setShowAllRepos((value) => !value)}>{showAllRepos ? "Show fewer projects" : `View all ${formatNumber(filteredRepos.length)} projects`} <span>{showAllRepos ? "↑" : "↓"}</span></button></div>}
            <p className="data-footnote">{profile.repoCoverageNote}</p>
          </section>

          <section className="section-block technical-section" id="languages">
            <div className="section-head"><div><span className="section-kicker">TOOLS OF THE TRADE</span><h2>Technical footprint</h2><p className="section-subtitle">A snapshot of the languages in your projects.</p></div><span className="section-index">02 / STACK</span></div>
            <div className="technical-grid">
              <div className="panel language-panel">
                <div className="panel-heading"><div><h3>Language distribution</h3><p>Share of detected code by bytes</p></div><span className="subtle-badge">BYTES</span></div>
                {profile.languages.length ? <>
                  <div className="language-bar">{profile.languages.map((language) => <span key={language.name} style={{ width: `${Math.max(1, language.bytes / profile.languages.reduce((sum, item) => sum + item.bytes, 0) * 100)}%`, background: language.color }} title={`${language.name}: ${Math.round(language.bytes / profile.languages.reduce((sum, item) => sum + item.bytes, 0) * 100)}%`} />)}</div>
                  <div className="language-list">{profile.languages.map((language) => {
                    const sum = profile.languages.reduce((total, item) => total + item.bytes, 0) || 1;
                    const share = Math.round(language.bytes / sum * 100);
                    return <div className="language-row" key={language.name}><span className="language-swatch" style={{ background: language.color }} /><span className="language-name">{language.name}</span><span className="language-track"><i style={{ width: `${share}%`, background: language.color }} /></span><strong>{share}%</strong></div>;
                  })}</div>
                </> : <div className="empty-state compact-empty">Language data is not available for this profile yet.</div>}
                <p className="panel-footnote">{profile.dataMode === "graphql" ? "Calculated from the 25 most-starred public repositories returned by the language query. This is a sample of the overall code footprint." : "Calculated from the most-starred owned repositories available to the public REST API. This is a sample, not a complete account-wide language history."}</p>
              </div>
              <div className="panel stack-panel">
                <div className="panel-heading"><div><h3>Your stack, in context</h3><p>What the repository data can tell you</p></div><span className="stack-symbol">{"{ }"}</span></div>
                <div className="stack-stat"><span className="stack-stat-icon purple-icon">{"{ }"}</span><div><strong>{profile.languages.length}</strong><span>Detected languages</span></div><span className="stack-stat-end">Across sampled repos</span></div>
                <div className="stack-stat"><span className="stack-stat-icon cyan-icon">⌘</span><div><strong>{profile.repositories.filter((repo) => !repo.isFork).length}</strong><span>Original projects loaded</span></div><span className="stack-stat-end">Public</span></div>
                <div className="stack-stat"><span className="stack-stat-icon lime-icon">↗</span><div><strong>{profile.repositories.filter((repo) => repo.releaseTag).length}</strong><span>Projects with a visible release</span></div><span className="stack-stat-end">Top projects</span></div>
                <p className="panel-footnote">Language share is not a proficiency score. The sample depends on repository visibility and API coverage.</p>
              </div>
            </div>
          </section>

          <section className="section-block collaboration-section" id="collaboration">
            <div className="section-head"><div><span className="section-kicker">BEYOND YOUR OWN REPOS</span><h2>Open-source collaboration</h2><p className="section-subtitle">The work you do with other projects and people.</p></div><span className="section-index">03 / COMMUNITY</span></div>
            {profile.contributionCalendarAvailable ? <div className="collab-grid">
              <div className="collab-metric"><span className="collab-icon commit-icon">⌁</span><div><span>Commits</span><strong>{formatNumber(profile.stats.commits)}</strong><small>In the selected period</small></div></div>
              <div className="collab-metric"><span className="collab-icon pull-icon">↗</span><div><span>Pull requests opened</span><strong>{formatNumber(profile.stats.pullRequests)}</strong><small>In the selected period</small></div></div>
              <div className="collab-metric"><span className="collab-icon issue-icon">◎</span><div><span>Issues opened</span><strong>{formatNumber(profile.stats.issues)}</strong><small>In the selected period</small></div></div>
              <div className="collab-metric"><span className="collab-icon review-icon">✓</span><div><span>Reviews submitted</span><strong>{formatNumber(profile.stats.reviews)}</strong><small>In the selected period</small></div></div>
              <div className="collab-metric"><span className="collab-icon repo-icon">⌘</span><div><span>Repos committed to</span><strong>{formatNumber(profile.stats.contributedRepos)}</strong><small>In the selected period</small></div></div>
            </div> : <div className="connect-panel"><div className="connect-art"><span>⌘</span><span>↗</span><span>✓</span></div><div><h3>Unlock the full collaboration picture</h3><p>GitHub requires an authenticated GraphQL request for the full contribution calendar and contribution breakdown. Add a server-side <code>GITHUB_TOKEN</code> to your deployment. The token is never sent to the browser.</p><a href="#data-quality" className="text-link">View setup instructions <span>↘</span></a></div></div>}
          </section>

          <section className="section-block highlight-section" id="highlights">
            <div className="section-head"><div><span className="section-kicker">THE SMALL DETAILS</span><h2>Highlights & milestones</h2><p className="section-subtitle">A few moments worth noticing.</p></div><span className="section-index">04 / MILESTONES</span></div>
            <div className="highlight-grid">
              <div className="highlight-card feature-highlight"><div className="highlight-top"><span className="highlight-icon star-highlight">✳</span><span className="highlight-tag">TOP PROJECT</span></div><h3>{bestRepo?.name || "No repository yet"}</h3><p>{bestRepo?.description || "Public projects will appear here."}</p><div className="highlight-bottom"><span>★ {formatNumber(bestRepo?.stars ?? 0)} stars</span><a href={bestRepo?.url || profile.profileUrl} target="_blank" rel="noreferrer">Explore <span>↗</span></a></div></div>
              <div className="highlight-card"><div className="highlight-top"><span className="highlight-icon calendar-highlight">▦</span><span className="highlight-tag">PEAK DAY</span></div><div className="highlight-big">{strongestDay?.count ?? 0}<span> activities</span></div><p>{strongestDay ? formatDate(strongestDay.date) : "No data"} had your highest recorded activity.</p><div className="highlight-bottom"><span>Based on available history</span><span className="highlight-spark">⌁ ⌁ ⌁</span></div></div>
              <div className="highlight-card"><div className="highlight-top"><span className="highlight-icon flame-highlight">↗</span><span className="highlight-tag">CONSISTENCY</span></div><div className="highlight-big">{profile.stats.longestStreak}<span> days</span></div><p>Your longest consecutive run of days with activity in the available calendar.</p><div className="highlight-bottom"><span>Current streak: {profile.stats.currentStreak} days</span><span className="highlight-spark">✳ ✳ ✳</span></div></div>
              <div className="highlight-card"><div className="highlight-top"><span className="highlight-icon month-highlight">▤</span><span className="highlight-tag">BUSIEST MONTH</span></div><div className="highlight-big">{busiestMonth?.label ?? "—"}</div><p>{formatNumber(busiestMonth?.total ?? 0)} recorded activity events in this month.</p><div className="highlight-bottom"><span>{profile.dataMode === "public-rest" ? "Visible public events only" : "Based on contribution counts"}</span><span className="highlight-spark">⌁ ⌁ ⌁</span></div></div>
            </div>
          </section>

          <section className="section-block data-quality-section" id="data-quality">
            <div className="section-head"><div><span className="section-kicker">TRANSPARENCY BY DEFAULT</span><h2>Data quality & project health</h2><p className="section-subtitle">Metrics should explain their limits.</p></div><span className="section-index">05 / DATA</span></div>
            <div className="data-quality-grid">
              <div className="panel quality-panel">
                <div className="panel-heading"><div><h3>Data coverage</h3><p>What this profile can currently see</p></div><span className={`quality-status ${profile.dataMode === "graphql" ? "good" : profile.dataMode === "demo" ? "sample" : "limited"}`}>{profile.dataMode === "graphql" ? "CONNECTED" : profile.dataMode === "demo" ? "SAMPLE" : "LIMITED"}</span></div>
                <div className="quality-row"><span className={profile.dataMode === "demo" ? "quality-pending" : "quality-check"}>{profile.dataMode === "demo" ? "·" : "✓"}</span><div><strong>Public profile & social counts</strong><p>{profile.dataMode === "demo" ? "Illustrative sample values. Search a username to load live public profile data." : "Name, bio, followers, following, and public repository count from GitHub."}</p></div><span className={`coverage-tag ${profile.dataMode === "demo" ? "pending-tag" : "good-tag"}`}>{profile.dataMode === "demo" ? "Sample values" : "Available"}</span></div>
                <div className="quality-row"><span className={profile.contributionCalendarAvailable ? "quality-check" : "quality-pending"}>{profile.contributionCalendarAvailable ? "✓" : "·"}</span><div><strong>Contribution calendar & activity totals</strong><p>{profile.contributionCalendarNote}</p></div><span className={`coverage-tag ${profile.contributionCalendarAvailable ? "good-tag" : "pending-tag"}`}>{profile.contributionCalendarAvailable ? "Available" : "Needs token"}</span></div>
                <div className="quality-row"><span className={profile.dataMode === "demo" ? "quality-pending" : "quality-check"}>{profile.dataMode === "demo" ? "·" : "✓"}</span><div><strong>Repository metrics</strong><p>{profile.repoCoverageNote}</p></div><span className={`coverage-tag ${profile.dataMode === "demo" ? "pending-tag" : "good-tag"}`}>{profile.dataMode === "demo" ? "Sample values" : "Loaded"}</span></div>
                <div className="quality-updated"><span className="green-dot" /> Last updated {new Date(profile.lastUpdated).toLocaleString("en", { dateStyle: "medium", timeStyle: "short" })}</div>
              </div>
              <div className="panel maintenance-panel">
                <div className="panel-heading"><div><h3>Repository maintenance</h3><p>Signals to review, not grades.</p></div><span className="maintenance-glyph">⌘</span></div>
                <div className="maintenance-number-row"><div><strong>{staleCount}</strong><span>Not pushed in 180+ days</span></div><div><strong>{unlicensedCount}</strong><span>Without a detected license</span></div></div>
                <div className="maintenance-note"><span>i</span><p>Older projects and missing licenses are not necessarily problems. These signals can help you decide what to review.</p></div>
                <div className="maintenance-source">Based on {profile.repositories.length} loaded repositories <span>·</span> archived projects excluded from staleness</div>
              </div>
            </div>
          </section>

          <footer className="app-footer"><a href="#overview" className="footer-brand"><span className="brand-mark tiny-mark" aria-hidden="true"><i /><i /><i /><i /></span> orbit<span>.</span></a><span>Made for people who build things.</span><div><a href={profile.profileUrl} target="_blank" rel="noreferrer">GitHub profile ↗</a><span className="footer-dot">·</span><button type="button" onClick={openReadme}>README export</button></div></footer>
        </div>
      </main>

      {toast && <div className="toast-message" role="status"><span>✓</span>{toast}</div>}
      {readmeOpen && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setReadmeOpen(false); }}>
        <div className="readme-modal" role="dialog" aria-modal="true" aria-labelledby="readme-title">
          <div className="modal-header"><div><span className="section-kicker">PLAIN MARKDOWN · NO IMAGE CARDS</span><h2 id="readme-title">README export</h2><p>Copy this into the README of your GitHub profile repository.</p></div><button type="button" className="icon-button modal-close" onClick={() => setReadmeOpen(false)} aria-label="Close README export">×</button></div>
          <textarea className="readme-textarea" value={readmeText} onChange={(event) => setReadmeText(event.target.value)} spellCheck={false} aria-label="Generated README Markdown" />
          <div className="modal-footer"><span>Uses text and Markdown links. The interactive charts stay on your hosted dashboard.</span><div><button type="button" className="secondary-button" onClick={() => setReadmeOpen(false)}>Close</button><button type="button" className="primary-button" onClick={() => void copyText(readmeText, "README Markdown copied")}>Copy Markdown <span>⧉</span></button></div></div>
        </div>
      </div>}
    </div>
  );
}

function RepositoryCard({ repo }: { repo: Repository }) {
  return (
    <article className="repo-card">
      <div className="repo-card-top"><span className="repo-folder" aria-hidden="true">⌘</span><div className="repo-title-wrap"><a href={repo.url} target="_blank" rel="noreferrer" className="repo-title">{repo.name}<span>↗</span></a><div className="repo-owner">{repo.fullName.split("/")[0]}</div></div><span className="repo-visibility">Public</span></div>
      <p className="repo-description">{repo.description || "No description provided."}</p>
      {repo.topics.length > 0 && <div className="repo-topics">{repo.topics.slice(0, 3).map((topic) => <span key={topic}>{topic}</span>)}</div>}
      <div className="repo-meta"><span className="repo-language"><i style={{ background: repo.languageColor }} />{repo.language || "No language"}</span><span title="Stars">✳ {formatNumber(repo.stars)}</span><span title="Forks">⑂ {formatNumber(repo.forks)}</span><span title="Last updated">↻ {relativeDate(repo.updatedAt)}</span>{repo.openPullRequests !== null && <span title="Open pull requests">↗ {repo.openPullRequests} PR</span>}{repo.openIssues !== null && <span title="Open issues">◎ {repo.openIssues} issues</span>}</div>
      {(repo.isFork || repo.isArchived || repo.releaseTag || repo.license) && <div className="repo-footer-tags">{repo.isFork && <span>Fork</span>}{repo.isArchived && <span className="archived-tag">Archived</span>}{repo.license && <span>{repo.license}</span>}{repo.releaseTag && <span className="release-tag">Release {repo.releaseTag}</span>}</div>}
    </article>
  );
}
