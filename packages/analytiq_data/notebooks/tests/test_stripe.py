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

# Source the .env file
load_dotenv(dotenv_path="../../.env", override=True)

await api.payments.init_payments_env()

# %%

#await api.payments.delete_all_stripe_customers(dryrun=True)
# %%
user_id = "679533ee39604beca2b2803a"
email = "iubica2@yahoo.com"
name = "Andrei Radulescu-Banu"

# %%
await api.payments.get_or_create_payments_customer(user_id=user_id, email=email, name=name)

# %%
await api.payments.record_usage(user_id=user_id, pages_processed=10, operation="test")

# %%


# %%


