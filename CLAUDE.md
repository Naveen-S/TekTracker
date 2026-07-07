# TekTracker (Sprint Tracker) 

One fast, comprehensive view of an entire sprint — from roadmap to backlog — in one place,
without hunting through multiple Jira filters. Sprint Tracker sits *on top of* Jira and adds the
**software-development lifecycle (SDLC) granularity** that raw Jira status cannot express, plus
roll-ups that leadership can actually read.


## Context Files

Read the following to get the full context of the project:
- @context/project-overview.md
- @context/coding-standards.md
- @context/ai-interaction.md
- @context/current-feature.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Critical: Non-standard versions

This project uses **Next.js 16** and **Tailwind CSS v4** — both have breaking changes from versions in your training data. Before writing any code that touches routing, rendering, or styling APIs, read the relevant guide in `node_modules/next/dist/docs/`. Heed deprecation notices.

## Commands

```bash
yarn dev:all      # start dev server 
yarn build    # production build
npm run lint     # ESLint (eslint.config.mjs, Next.js ruleset)
```

There is no test suite yet.


## Stack (Note we are still in the migration phase from Vite to Next.js)

- **Next.js 16** (App Router) · **React 19** · **JavaScript**
- **Tailwind CSS v4** via `@tailwindcss/postcss` — configured in `postcss.config.mjs`, imported in `src/app/globals.css` with `@import "tailwindcss"`; no `tailwind.config.*` file

## Structure

All source lives under `src/app/` using the App Router file conventions:

- `layout.jsx` — root layout; 
- `page.jsx` — home page
- `globals.css` — global styles (currently only the Tailwind import)
