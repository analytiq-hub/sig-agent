import importlib
import pkgutil


def main() -> None:
    sdk = importlib.import_module("sigagent_sdk")
    from sigagent_sdk import SigAgentClient
    from sigagent_sdk.models.document import ListDocumentsResponse  # noqa: F401

    client = SigAgentClient(base_url="http://example")

    # Verify sub-APIs are present
    assert hasattr(client, "documents"), "missing documents API"
    assert hasattr(client, "ocr"), "missing ocr API"
    assert hasattr(client, "llm"), "missing llm API"
    assert hasattr(client, "schemas"), "missing schemas API"
    assert hasattr(client, "prompts"), "missing prompts API"
    assert hasattr(client, "tags"), "missing tags API"

    # Verify typing marker is packaged
    assert pkgutil.get_data("sigagent_sdk", "py.typed") is not None, "py.typed missing"

    print("SDK smoke test OK", getattr(sdk, "__version__", "no __version__"))


if __name__ == "__main__":
    main()


