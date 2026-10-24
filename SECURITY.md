# Security policy

Please do not open public issues with credentials, private profile details, or exploitable vulnerabilities.

Report a security concern privately to the repository owner using GitHub's **Report a vulnerability** feature when it is enabled. If that feature is unavailable, contact the maintainer through the contact method listed on their GitHub profile.

## Token handling

- Store `GITHUB_TOKEN` only in local environment files or the deployment's server-side environment settings.
- Never add tokens to a README, client component, `NEXT_PUBLIC_` variable, browser storage, or committed file.
- Use the least permissions needed to read public GitHub data.
- Do not enable private repository access for this public-profile dashboard.
