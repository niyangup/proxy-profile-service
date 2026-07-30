# Issue tracker: GitHub

Issues and PRDs for this repo live as GitHub issues. Use the `gh` CLI for all operations.

## Conventions

- **Create an issue**: `gh issue create --title "..." --body "..."`
- **Read an issue**: `gh issue view <number> --comments`
- **List issues**: use `gh issue list` with suitable state and label filters
- **Comment**: `gh issue comment <number> --body "..."`
- **Apply/remove labels**: use `gh issue edit`
- **Close**: `gh issue close <number> --comment "..."`

Infer the repository from `git remote -v`; `gh` does this automatically inside the clone.

## Pull requests as a triage surface

**PRs as a request surface: no.**

GitHub shares one number space across issues and PRs. Resolve ambiguous references using `gh pr view <number>`, then fall back to `gh issue view <number>`.

## When a skill says “publish to the issue tracker”

Create a GitHub issue.

## When a skill says “fetch the relevant ticket”

Run `gh issue view <number> --comments`.

## Wayfinding operations

- A map is a GitHub issue labelled `wayfinder:map`.
- Child tickets use `wayfinder:<type>` labels.
- Prefer GitHub sub-issues and native issue dependencies.
- Where unavailable, use task lists and `Blocked by: #<number>` references.
- Claim work with `gh issue edit <number> --add-assignee @me`.
- Resolve by commenting with the result and closing the issue.
