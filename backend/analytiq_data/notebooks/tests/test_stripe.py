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

# %%

await api.payments.delete_all_stripe_customers(dryrun=True)
# %%


