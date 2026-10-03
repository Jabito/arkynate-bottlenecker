# Contributing to Bottlenecker

Thanks for your interest in contributing! Here's how to get started.

## Getting Started

1. **Fork** the repository
2. **Clone** your fork locally
3. **Install dependencies**: `npm install` (Node 22, see `.nvmrc`)
4. **Run in dev mode**: `npm run dev`
5. **Create a branch** for your change: `git checkout -b my-feature`

## Making Changes

- Keep PRs focused — one feature or fix per PR
- Follow the existing TypeScript and ESLint conventions
- Before opening a PR, run `npm run lint`, `npm run typecheck` and `npm test` (CI runs the same checks plus a build on every PR)
- Engine changes need a test in `src/engine/*.test.ts`
- Use the theme tokens in `src/index.css` for colours, so Light and Matrix keep working
- Test your changes in the browser before submitting
- Update the README if your change affects usage

## Submitting a Pull Request

1. Push your branch to your fork
2. Open a PR against `main`
3. Describe **what** you changed and **why**
4. Include a screenshot if it's a visual change

## Reporting Bugs

Open an issue with:
- Steps to reproduce
- Expected vs actual behavior
- Browser and OS

## Suggesting Features

Open an issue with the `enhancement` label. Describe the use case — especially what system architecture scenario it helps model.

## Code of Conduct

Be respectful and constructive. We follow the [Contributor Covenant](https://www.contributor-covenant.org/version/2/1/code_of_conduct/).
