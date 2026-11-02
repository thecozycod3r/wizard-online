# Compatibility entry point for the maintained desktop/phone board-click suite.
import pathlib
import subprocess
import sys

suite = pathlib.Path(__file__).with_name("browser.mjs")
url = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8766/catan/"
subprocess.run(["node", str(suite), url], check=True)
