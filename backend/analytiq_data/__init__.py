from . import log
from . import mongodb

# Import last since it depends on other modules
from . import common

# Initialize the global logger variable
from .log import init_logger
log = init_logger("analytiq-data")

