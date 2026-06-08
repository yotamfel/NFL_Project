"""Helpers shared across the data-layer modules."""


def career_rate(numerator, denominator, scale: float = 100.0) -> float | None:
    """
    Recompute a career-level rate from summed counts.

    *_career views deliberately exclude rate columns (passer rating, catch %,
    field-goal %, ...) — summing a per-season rate across seasons of
    different lengths is meaningless (see DB_SCHEMA.md §3, §6.3). The correct
    figure is always (scale * sum(numerator) / sum(denominator)), e.g.
    career_cmp_pct = career_rate(cmp, att).
    """
    if not denominator:
        return None
    return round(scale * float(numerator) / float(denominator), 1)
