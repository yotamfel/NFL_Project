# NFL Project — Development Log

This document tracks the goals, decisions, and progress of this project. It's
written as a narrative log rather than a command-by-command history, so it can
double as a portfolio piece showing the reasoning behind each step.

## Overview

*(To be filled in: what this project is, what problem it solves, who it's for.)*

## Tech Stack

- **Database**: PostgreSQL (existing `NFL_project` database)
- *(More to be added as decisions are made)*

## Log

### Setup — Database Connection
Connected to an existing PostgreSQL database (`NFL_project`) containing 14
tables of NFL statistics — passing, rushing/offense, defense, kicking, punting,
returns, draft, and combine data, both per-season and career totals.

To avoid storing credentials in the repo or shell history, authentication is
handled via a local `.pgpass` file (PostgreSQL's standard credential store),
which `psql` reads automatically. This keeps secrets out of version control
while still allowing password-based connections from the command line.

