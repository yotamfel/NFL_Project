"""
Recovery functions for Excel-induced data corruption found in the raw source CSVs.

Two distinct corruption patterns were identified (see PROJECT_LOG.md for the
investigation): small integers and "W-L-T" record strings were misinterpreted
by Excel as dates and serialized back out as date strings. Both are
deterministically reversible.
"""
import re
from datetime import date

import pandas as pd

_DATE_RE = re.compile(r"^(\d{1,2})/(\d{1,2})/((?:19|20)\d{2})$")
_EXCEL_EPOCH = date(1899, 12, 31)


def _parse_corrupted_date(value):
    m = _DATE_RE.match(str(value))
    if not m:
        return None
    return int(m.group(1)), int(m.group(2)), int(m.group(3))


def fix_corrupted_count(series: pd.Series) -> pd.Series:
    """Recover integer counts that Excel reinterpreted as date serial numbers.

    e.g. the integer 4 was stored, displayed as a date (day 4 of Excel's epoch),
    and exported back out as the literal string '04/01/1900'. Reversing this
    means treating the displayed date as a calendar date and computing its
    Excel serial-day-number, which equals the original integer.
    """
    def recover(value):
        parsed = _parse_corrupted_date(value)
        if parsed is None:
            return value
        dd, mm, yyyy = parsed
        if dd == 0:
            return 0
        try:
            return (date(yyyy, mm, dd) - _EXCEL_EPOCH).days
        except ValueError:
            return value

    return pd.to_numeric(series.map(recover), errors="coerce")


_NAME_UNDERSCORE_RE = re.compile(r"([a-z])_([A-Z])")


def fix_corrupted_name(series: pd.Series) -> pd.Series:
    """Recover compound surnames whose hyphen was replaced with an underscore
    (e.g. 'Cam Taylor_Britt' -> 'Cam Taylor-Britt').

    Player names never legitimately contain an underscore - every underscore
    found in player_name across the dataset sits between a lowercase and an
    uppercase letter, the exact signature of a hyphen lost to a find-and-replace
    during the prior Power BI edit. Restoring the hyphen is unambiguous.
    """
    return series.str.replace(_NAME_UNDERSCORE_RE, r"\1-\2", regex=True)


def fix_mojibake_name(series: pd.Series) -> pd.Series:
    """Recover names double-encoded as UTF-8-bytes-read-as-Latin-1
    (e.g. 'JuliÃ©n Davenport' -> 'Julién Davenport').

    Found only in the raw draft CSVs (2 of 5871 rows) - a one-off export
    encoding mismatch, distinct from the Power BI corruptions above. Re-encoding
    as Latin-1 and decoding as UTF-8 reverses it exactly; names without the
    'Ã' signature are passed through untouched.
    """
    def recover(value):
        if not isinstance(value, str) or "Ã" not in value:
            return value
        try:
            return value.encode("latin-1").decode("utf-8")
        except (UnicodeEncodeError, UnicodeDecodeError):
            return value

    return series.map(recover)


def fix_qbrec(series: pd.Series) -> pd.Series:
    """Recover 'W-L-T' QB record strings that Excel reinterpreted as dates.

    e.g. '9-8-0' was parsed as month=9/day=8/year=2000 and exported back out
    as '09/08/2000'. The three components map directly back to W-L-T (with the
    2-digit year giving T). Values that were never corrupted (because W or L
    fell outside a valid date range, e.g. '13-4-0') are passed through as-is.
    """
    def recover(value):
        if pd.isna(value):
            return value
        parsed = _parse_corrupted_date(value)
        if parsed is None:
            return value
        w, l, yyyy = parsed
        return f"{w}-{l}-{yyyy % 100}"

    return series.map(recover)
