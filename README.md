# SBHC Security

Static GitHub Pages site for SBHC Security: a personal home, formal research
log, project journal, and informal blog.

The production site is published from the repository's `master` branch through
the pinned GitHub Pages workflow in `.github/workflows/pages.yml`.

## Security boundary

- The build emits static HTML, CSS, images, and narrow self-hosted decorative
  modules. There is no backend.
- No forms, analytics, cookies, external fonts, embeds, service workers, or
  third-party runtime code.
- Runtime networking is blocked by Content Security Policy (`connect-src
  'none'`). Decorative modules operate entirely on local page state.
- Never source the site from experiment custody, raw locks, provider responses,
  ledgers, credentials, or private evidence paths.
- Never commit secrets, private documents, credentials, device data, or generated logs.

## Local preview

Use the pinned Node and pnpm versions from `package.json` and `pnpm-lock.yaml`:

```sh
pnpm install --frozen-lockfile
pnpm run dev
```

Before publication:

```sh
pnpm run check
pnpm run build
pnpm run validate
```

## Adding entries

- Formal research notes live in `src/content/research/`.
- Project entries live in `src/content/projects/`.
- Informal writing lives in `src/content/blog/`; copy `_template.md`, write the
  note, and set `draft: false` when it is ready to appear.

The site is designed for GitHub Pages at `sbhcsecurity.com`. Publishing remains
an explicit owner-approved release action.
