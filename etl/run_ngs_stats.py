"""Runner: loads NGS passing + rushing stats into Neon DB."""
import sys
from pathlib import Path

# Load DATABASE_URL from server/.env and monkey-patch db.get_engine
_root = Path(__file__).parent.parent
_env  = _root / "server" / ".env"
if _env.exists():
    for line in _env.read_text().splitlines():
        if line.startswith("DATABASE_URL="):
            import os
            os.environ["DATABASE_URL"] = line.split("=", 1)[1].strip()
            break

import db as _db
_orig = _db.get_engine
def _patched():
    import os
    from sqlalchemy import create_engine
    url = os.environ.get("DATABASE_URL")
    if not url:
        return _orig()
    return create_engine(url)
_db.get_engine = _patched

sys.path.insert(0, str(Path(__file__).parent))
from load_ngs_stats import load_ngs_stats

if __name__ == "__main__":
    load_ngs_stats()
