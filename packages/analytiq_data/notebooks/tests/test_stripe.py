# %%

import sys
sys.path.append("../../..")

import os
from datetime import datetime, UTC
import analytiq_data as ad
import asyncio
from bson import ObjectId
from dotenv import load_dotenv
import docrouter_app.payments

# %%

ad.common.setup()

# %%

# Source the .env file
await docrouter_app.payments.init_payments_env()

# %%

await docrouter_app.payments.delete_all_payments_customers(dryrun=False)
# %%
org_id = "6795345439604beca2b2808d"
#org_id = "67b00800e1dd3da6cb64f77d"

# %%
await docrouter_app.payments.sync_payments_customer(org_id=org_id)

# %%
await docrouter_app.payments.record_usage(user_id=user_id, pages_processed=10, operation="test")

# %%


# %%


