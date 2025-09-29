# Create a ~/.pypirc file with the following content:
#
# [testpypi]
#  username = __token__
#  password = <testpypi-token>

# To install from testpypi:
# pip install --index-url https://test.pypi.org/simple/ --extra-index-url https://pypi.org/simple/ docrouter-sdk --force-reinstall

.PHONY: build clean testinstall install-deps

# Install build dependencies
install-deps:
	pip install build twine

# Clean previous builds
clean:
	rm -rf dist/ build/ *.egg-info/

# Build the package
build: clean
	python -m build

# Upload to TestPyPI and install from there
testinstall: build
	@echo "Uploading to TestPyPI..."
	twine upload --repository testpypi dist/*
	@echo "Creating local virtual environment .venv-docrouter-sdk..."
	python -m venv .venv-docrouter-sdk
	@echo "Installing from TestPyPI into .venv-docrouter-sdk..."
	. .venv-docrouter-sdk/bin/activate; pip install --upgrade pip
	. .venv-docrouter-sdk/bin/activate; pip install --index-url https://test.pypi.org/simple/ --extra-index-url https://pypi.org/simple/ docrouter-sdk --force-reinstall

# Upload to production PyPI
upload: build
	@echo "Uploading to production PyPI..."
	twine upload dist/*

# Install locally in development mode
dev-install:
	pip install -e .

# Run tests
test:
	python -m pytest tests/ -v

help:
	@echo "Available targets:"
	@echo "  install-deps  - Install build dependencies (build, twine)"
	@echo "  clean         - Remove build artifacts"
	@echo "  build         - Build the package"
	@echo "  testinstall   - Build, upload to TestPyPI, and install into .venv-docrouter-sdk"
	@echo "  upload        - Build and upload to production PyPI"
	@echo "  dev-install   - Install locally in development mode"
	@echo "  test          - Run tests"