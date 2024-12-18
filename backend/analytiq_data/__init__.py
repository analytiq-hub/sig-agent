import os
import logging
from . import aws
from . import crypto
from . import llm
from . import log
from . import mongodb
from . import msg_handlers
from . import queue

# Import last since it depends on other modules
from . import common

# Initialize the global logger variable
from .log import init_logger

# Get log level from environment variable, default to INFO
log_level = os.getenv('LOG_LEVEL', 'INFO').upper()
level = getattr(logging, log_level, logging.INFO)  # Safely get log level, default to INFO if invalid

log = init_logger("analytiq-data", level=level)

