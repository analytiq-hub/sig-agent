# %%

import sys
sys.path.append("../../..")

import os
from datetime import datetime, UTC
import analytiq_data as ad
import asyncio
from bson import ObjectId
from dotenv import load_dotenv
import api.payments

# %%

ad.common.setup()

# %%

# Source the .env file
await api.payments.init_payments_env()

# %%

await api.payments.delete_all_stripe_customers(dryrun=False)
# %%
org_id = "6795345439604beca2b2808d"

# %%
await api.payments.sync_payments_customer(org_id=org_id)

# %%
await api.payments.record_usage(user_id=user_id, pages_processed=10, operation="test")

# %%


# %%


