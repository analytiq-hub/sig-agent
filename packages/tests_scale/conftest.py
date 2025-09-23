import sys
from pathlib import Path

# Ensure the `packages` directory is on sys.path so we can import `tests.conftest`
_this_file = Path(__file__).resolve()
_packages_dir = _this_file.parents[1]
if str(_packages_dir) not in sys.path:
    sys.path.insert(0, str(_packages_dir))

pytest_plugins = [
    "tests.conftest",
]


