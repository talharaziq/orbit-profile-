# Orbit — GitHub Profile Studio

Orbit is an interactive GitHub developer dashboard built with Next.js, React, TypeScript, and CSS. It brings profile details, repository metrics, activity patterns, language distribution, collaboration metrics, and maintenance signals into one responsive interface.

**The dashboard does not use generated stats images or SVG charts.** Charts are drawn on an HTML canvas, contribution cells and language bars are HTML/CSS, and the profile README export is plain Markdown. No static profile-card images are generated.

> A live deployment is required for other people to use a shared dashboard link. GitHub itself does not run a React app inside a profile README; README Markdown links to the hosted interactive profile instead.

## Features

- Live lookup by GitHub username.
- Interactive date ranges: 30 days, 90 days, and 1 year.
- Canvas-based activity trend with pointer inspection.
- Keyboard-accessible daily activity calendar with per-day details.
- Public repository browser with search, filters, and sorting.
- Repository stars, forks, language, topics, license, releases, and archived status where available.
- Language breakdown by code bytes for a documented sample of repositories.
- Contribution, pull request, issue, review, and collaboration totals through GitHub GraphQL when a server-side token is configured.
- Streaks, activity highlights, repository maintenance signals, and data-coverage notes.
- Light/dark appearance, accent choices in the code-ready design system, and responsive layouts.
- Plain Markdown README generator and shareable profile URLs.
- Clearly labeled sample mode so the design can be explored before API setup.
- No database or user account is required. API tokens stay server-side.

## Run locally

### Requirements

- Node.js 20.9 or newer.
- npm (included with Node.js).
- A GitHub token is optional for trying the app and is recommended for full contribution metrics.

### Install

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The app starts in sample mode. Enter a public GitHub username in the lookup box to load live data.

On Windows PowerShell, create `.env.local` by copying `.env.example` in File Explorer or run:

```powershell
Copy-Item .env.example .env.local
```

### Enable full contribution metrics

The REST API can read public profile and repository metadata without a token, within GitHub's lower unauthenticated rate limit. The full contribution calendar, and accurate GraphQL totals for commits, issues, pull requests, reviews, and repositories committed to, require an authenticated GitHub GraphQL request.

1. Create a least-privilege GitHub token that can query public GitHub data. Do not grant private repository access for this project.
2. Put it in `.env.local`:

   ```dotenv
   GITHUB_TOKEN=your_server_side_token
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   ```

3. Restart the development server after editing environment variables.

`GITHUB_TOKEN` is read only by the server route and is never exposed through a `NEXT_PUBLIC_` variable. Orbit does not query private repository names or private code. Use a token approved by your GitHub account or organization policies.

Without a token, Orbit runs in **limited public mode**. It uses GitHub's recent public-events feed, which is not a complete contribution history. It labels this mode and does not present those event counts as full contributions.

## Deploy so others can use it

### Vercel

1. Push this folder to a new GitHub repository.
2. Import the repository into Vercel.
3. Set `GITHUB_TOKEN` in the project's Environment Variables if you want the full contribution calendar and collaboration metrics.
4. Set `NEXT_PUBLIC_SITE_URL` to the final HTTPS deployment URL, for example `https://your-project.vercel.app`.
5. Deploy (or redeploy after changing environment variables).
6. Open the deployed URL and look up a public GitHub username.

The app is a normal Next.js deployment; `vercel.json` selects the Next.js framework. Other Node hosts can run the same build and start commands.

### Other Node hosting

```bash
npm install
npm run build
npm run start
```

Provide `GITHUB_TOKEN` and `NEXT_PUBLIC_SITE_URL` as server/build environment variables in your hosting platform. Make sure the host supports Next.js App Router route handlers and server-side environment variables.

## Add it to a GitHub profile README

After deploying, create (or edit) the repository whose name exactly matches your GitHub username. Add a text link like this to its `README.md`, replacing both values:

```markdown
## GitHub at a glance

[Open my interactive developer profile](https://YOUR-DEPLOYMENT-URL/?username=YOUR_GITHUB_USERNAME)
```

You can also open the dashboard, choose **README export**, and copy the generated Markdown summary. It includes profile metrics and featured repository links without embedding static stats images.

The README link opens the hosted dashboard. It cannot embed the interactive React interface inline because GitHub profile READMEs do not execute arbitrary JavaScript from repository content.

## API behavior and data limits

- `GET /api/profile?username=octocat&range=year` returns the profile JSON used by the dashboard.
- Supported ranges are `30d`, `90d`, and `year`.
- Public REST data is cached by the server for about 15 minutes where supported by the host. Dashboard lookups request fresh API-route results, but upstream responses may remain cached within that window.
- GraphQL contribution data is only requested when `GITHUB_TOKEN` exists.
- Repository totals use the public repositories returned by the REST API. The initial version caps pagination at 1,000 repositories with a token and 300 without one, and labels partial coverage if the cap is hit.
- Language distributions use a sample: the 25 most-starred public repositories when GraphQL is enabled, or up to 8 popular owned repositories in limited REST mode. They are not an account-wide proficiency score.
- The public events feed only exposes recent events and can omit activity. In limited mode, its calendar is deliberately labeled as observed public events rather than a complete contributions calendar.
- Star and fork totals in the summary exclude forked repositories owned by the profile so that the total focuses on the person's original projects.
- GitHub's own API limits still apply. Add a token for the deployed service and avoid running high-volume lookups from a shared unauthenticated host.
- No data is written to a database. GitHub profile and repository data is fetched when requested.

## Project structure

```text
app/
  api/profile/route.ts    Server-only GitHub API adapter
  components.tsx          Canvas activity chart
  globals.css             Responsive design system and themes
  layout.tsx               App metadata and root layout
  page.tsx                 Interactive dashboard and README export
lib/
  demo.ts                  Clearly labeled sample profile data
  github.ts                REST + GraphQL data fetching and mapping
  metrics.ts               Date ranges, streaks, aggregates, formatting
  types.ts                 Shared TypeScript types
.github/workflows/ci.yml  Build/type-check workflow
```

## Development checks

```bash
npm run typecheck
npm run lint
npm run build
```

## Security notes

- Never commit `.env.local` or a real GitHub token.
- Never rename `GITHUB_TOKEN` to `NEXT_PUBLIC_GITHUB_TOKEN`.
- Orbit does not need private-repository access for its intended public-profile experience.
- The API route validates the username before calling GitHub.
- Don't expose GitHub response headers, authentication tokens, or raw server environment variables to the browser.

## License

MIT. See [LICENSE](./LICENSE).
