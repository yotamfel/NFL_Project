"""
Pydantic models for the shapes the data layer returns.

Only `players` has a small, stable, underscore-free set of columns, so it's
the one thing modeled strictly. Everything else here — the six box-score
categories, draft picks, combine prospects — carries either a different
column set per category or PFR's digit-prefixed names (`_40yd`, `_1d`, ...),
which clash with Pydantic's leading-underscore-means-private convention.
Forcing those into strict models would mean fighting aliases for read-only
data with no real type-safety win, so they travel as plain dicts — the same
choice DB_SCHEMA.md already documents for why *_career excludes rate columns:
match the model to what the data actually looks like, not what's convenient.
"""
from typing import Any, Optional

from pydantic import BaseModel


class Player(BaseModel):
    player_id: str
    player_name: str
    pos: Optional[str] = None
    first_season: Optional[int] = None
    last_season: Optional[int] = None
    n_seasons: Optional[int] = None


class CategoryStats(BaseModel):
    """One box-score category's data for one player: seasons + career totals."""
    category: str
    seasons: list[dict[str, Any]]
    career: Optional[dict[str, Any]] = None


class PlayerProfile(BaseModel):
    player: Player
    categories: list[CategoryStats]
    draft: Optional[dict[str, Any]] = None
    combine: Optional[dict[str, Any]] = None
