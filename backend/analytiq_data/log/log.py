# Logger setup
import logging
import sys

def init_logger(logger_name, level=logging.DEBUG) -> logging.Logger:
    """
    Initialize the system logger

    Args:
        logger_name: The name of the logger.
        level: The logging level. Defaults to logging.DEBUG.
        log_thread_name: Whether to log the thread name. Defaults to False.

    Returns:
        The logger.
    """
    global log
    log = logging.getLogger(logger_name)

    # Remove old handlers
    for handler in log.handlers:
        log.removeHandler(handler)

    # Add a formatter
    console_handler = logging.StreamHandler(sys.stdout)
    formatter = logging.Formatter(
        f"%(asctime)s - [{logger_name}] - %(levelname)s: %(message)s"
    )
    console_handler.setFormatter(formatter)
    log.addHandler(console_handler)

    # Set the logging level
    log.setLevel(level)

    # Save the logger to the global variable
    return log