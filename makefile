setup:
	# Create and activate virtual environment if it doesn't exist
	if [ ! -d ".venv" ]; then \
		echo "Creating virtual environment..." ; \
		python3 -m venv .venv ; \
	fi
	source .venv/bin/activate ; \
	# Install uv if not already installed
	if ! command -v uv &> /dev/null; then \
		echo "Installing uv..." ; \
		curl -LsSf https://astral.sh/uv/install.sh | sh ; \
	fi ; \
	# Install build dependencies
	uv pip install hatchling ; \
	uv pip install -e packages/docrouter_sdk ; \
	uv pip install -e packages/docrouter_mcp ; \

dev: setup
	./start-all.sh

tests: setup
	. .venv/bin/activate && pytest -s packages/tests/

.PHONY: dev tests setup