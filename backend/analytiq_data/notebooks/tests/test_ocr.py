# %%
try:
    get_ipython().run_line_magic('load_ext', 'autoreload')
    get_ipython().run_line_magic('autoreload', '2')
except:
    # Not running in IPython/Jupyter
    pass

# %%
import sys
sys.path.append("../../..")

import os
from datetime import datetime, UTC
import analytiq_data as ad
import asyncio
from bson import ObjectId

# %%
# Initialize the client
analytiq_client = ad.common.get_analytiq_client(env="dev")
aws_client = ad.aws.get_aws_client(analytiq_client)

# %%
msg = {
    "_id": "672839809af076d2a5f1d2e5",
    "document_id": "6733dbbfbb562a660a6cc28d",
}

# %%
await ad.msg_handlers.process_ocr_msg(analytiq_client, aws_client, msg, force=True)

# %%
