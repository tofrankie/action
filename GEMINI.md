# GEMINI Project Context: @tofrankie/action

This project is a dual-purpose tool (GitHub Action and CLI) designed for changelog-based software releases. It automates GitHub Release management and NPM publishing by parsing `CHANGELOG.md` entries.

## Project Overview

- **Purpose**: Automate GitHub Releases and NPM publishing based on git tags and changelogs.
- **Key Technologies**: TypeScript (Node.js 20+), `pnpm`, `vitest` (testing), `tsdown` (bundling), `octokit` (GitHub API), `commander` & `inquirer` (CLI UX).
- **Core Features**:
  - Idempotent GitHub Release creation/updates.
  - Automatic changelog entry extraction (supports single and monorepo).
  - Optional NPM publishing with skipped-if-exists logic.
  - Consistency checks between tags and refs.

## Architecture

- `src/core/`: Contains the platform-agnostic business logic.
  - `publish-service.ts`: The orchestrator for the release process.
  - `github-client.ts`: Abstraction layer for GitHub API operations.
  - `package-resolver.ts`: Logic for detecting monorepo structures and resolving package directories.
  - `changelog.ts`: Heuristic-based parsing of `CHANGELOG.md`.
- `src/action.ts`: Entry point for the GitHub Action.
- `src/cli.ts`: Entry point for the `tofrankie-release` (alias `tfr`) command-line tool.

## Building and Running

### Development Commands
- **Install dependencies**: `pnpm install`
- **Run tests**: `pnpm test` (uses Vitest)
- **Linting**: `pnpm lint` (ESLint + Prettier + Type-check)
- **Type-check only**: `pnpm run check`
- **Build CLI**: `pnpm run npm:build`
- **Build Action**: `pnpm run action:build`

### CLI Usage (Local)
```bash
# Run local CLI for testing
node bin/cli.js --tag v1.0.0 --publish-npm
```

## Development Conventions

- **Modular Core**: Always keep business logic in `src/core`. Entry points (`action.ts`, `cli.ts`) should only handle I/O and configuration.
- **Error Handling**: Use `DomainError` from `@/core/errors.ts` for expected failures. It supports `code`, `hint`, and `context` for better user feedback.
- **Monorepo Support**: The tool must remain compatible with both standard `package.json` workspaces and `pnpm-workspace.yaml`.
- **Changelog Parsing**: Rules are strictly based on H2 (`##`) headings. Versions must follow semver.
- **Testing**: Every core feature must have a corresponding test in `tests/core/`. Use `vi.mock` for external dependencies like `execa` or `@actions/github`.
- **NPM Publishing**: Do not handle auth tokens internally. Rely on the environment's `.npmrc` or `NODE_AUTH_TOKEN`.
- **Coding Style**: Adhere to the provided ESLint and Prettier configurations. Standard imports use `@/` alias defined in `tsconfig.json`.
