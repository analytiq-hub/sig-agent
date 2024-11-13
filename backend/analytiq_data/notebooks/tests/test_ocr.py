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
    "msg": {
        "document_id": "6734e4c1f1e37af49b8dc649",
    }
}

# %%
await ad.msg_handlers.process_ocr_msg(analytiq_client, aws_client, msg, force=True)

# %%
ad.common.get_ocr_dict(analytiq_client, "6734e4c1f1e37af49b8dc649")