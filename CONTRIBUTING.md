# Contributing

Thanks for helping improve Orbit.

## Before opening a pull request

1. Open an issue for substantial changes so the direction can be discussed.
2. Keep tokens and real user data out of commits, screenshots, fixtures, and logs.
3. Keep visualizations interactive and CSS/canvas-based; do not introduce generated SVG statistics cards.
4. Add clear labels whenever a metric is incomplete, sampled, estimated, or unavailable.
5. Test the narrow layout as well as desktop.

## Local checks

```bash
npm install
npm run typecheck
npm run lint
npm run build
```

## Pull requests

Describe the user-facing change, data source, API-limit implications, and how you tested it. Include a screenshot only if it is useful; never include private user data.
