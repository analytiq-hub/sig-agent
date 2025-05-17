dev:
	./start-all.sh

tests:
	. .venv/bin/activate && pytest -s backend/tests/

.PHONY: dev tests