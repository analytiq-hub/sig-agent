from .client import SigAgentClient

try:
    from importlib.metadata import version, PackageNotFoundError
    try:
        __version__ = version("sigagent-sdk")
    except PackageNotFoundError:
        __version__ = "0.0.0"
except Exception:
    __version__ = "0.0.0"

__all__ = ["SigAgentClient", "__version__"]