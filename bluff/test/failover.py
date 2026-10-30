"""Host drops mid-game -> takeover -> host rejoins from a phone -> laptop returns -> game finishes (driver: shared/test/kit_failover.py).
    python3 bluff/test/failover.py [base_url]
"""
import sys
from pathlib import Path

HOOK, MAX = "__bluff", 8
sys.argv[0] = __file__
exec(open(Path(__file__).resolve().parents[2] / "shared/test/kit_failover.py").read())
