# CLAUDE.md — AI Assistant Guidelines for yuramanager

## Project Overview

**yuramanager** is a new project under active development. This file provides guidance for AI assistants working in this repository.

## Repository Status

This repository is in its initial setup phase. As the project grows, this document should be updated to reflect the current architecture, conventions, and workflows.

## Git Workflow

- **Default branch**: `main`
- **Feature branches**: Use descriptive branch names prefixed with the feature area (e.g., `feat/auth`, `fix/login-bug`)
- Write clear, concise commit messages in imperative mood (e.g., "Add user authentication endpoint")
- Keep commits atomic — one logical change per commit

## Development Guidelines

### General Conventions

- Keep code simple and readable; avoid over-engineering
- Follow the principle of least surprise in API and function design
- Write self-documenting code; add comments only where the intent is non-obvious
- Handle errors explicitly at system boundaries (user input, external APIs)

### Code Style

- Use consistent naming conventions throughout the codebase
- Keep functions small and focused on a single responsibility
- Prefer explicit over implicit behavior

### Testing

- Write tests for new functionality
- Run the full test suite before pushing changes
- Keep tests focused and independent of each other

## Project Structure

> **Note**: This section should be updated as the project structure takes shape.

```
yuramanager/
├── CLAUDE.md          # AI assistant guidelines (this file)
└── ...                # Project files to be added
```

## Commands Reference

> **Note**: Update this section as build tools and scripts are added.

| Task | Command |
|------|---------|
| Install dependencies | _TBD_ |
| Run tests | _TBD_ |
| Lint / format | _TBD_ |
| Build | _TBD_ |
| Start dev server | _TBD_ |

## Key Decisions & Context

Track important architectural and tooling decisions here as they are made:

- _No decisions recorded yet — project is in initial setup._

## Updating This File

Keep this CLAUDE.md current as the project evolves:

- Add new commands when build tooling is configured
- Document architectural patterns once code is written
- Record key technical decisions and their rationale
- Update the project structure section as directories are added
