dev:
	./start-all.sh

tests:
	. .venv/bin/activate && pytest -s packages/tests/

.PHONY: dev tests