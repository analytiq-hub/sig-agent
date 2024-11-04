# %%
# Setup imports and environment
%load_ext autoreload
%autoreload 2

import sys
sys.path.append("../../..")

import os
from datetime import datetime, UTC
import analytiq_data as ad
import asyncio
from bson import ObjectId

# %%
# Initialize the client
analytiq_client = ad.common.get_client(env="dev")
db_name = analytiq_client.env
db = analytiq_client.mongodb[db_name]
QUEUE_NAME = "test_queue"

# Remove the queue collection if it exists
if QUEUE_NAME in db.list_collection_names():
    db.drop_collection(QUEUE_NAME)

# %%
# Send 10 test messages
async def send_test_messages():
    msg_ids = []
    for i in range(10):
        msg_id = await ad.common.send_msg(
            analytiq_client,
            QUEUE_NAME,
            msg_type="test",
            msg={"test_number": i}
        )
        msg_ids.append(msg_id)
        print(f"Sent message {i+1}: {msg_id}")
    return msg_ids

msg_ids = await send_test_messages()

# %%
# Receive and process 10 messages
async def receive_messages():
    received_msgs = []
    for i in range(10):
        msg = await ad.common.recv_msg(analytiq_client, QUEUE_NAME)
        if msg:
            print(f"Received message {i+1}: {msg['_id']} with msg: {msg.get('msg')}")
            received_msgs.append(msg)
            # Mark as completed
            await ad.common.delete_msg(analytiq_client, QUEUE_NAME, str(msg['_id']))
        else:
            print("No more messages available")
            break
    return received_msgs

received_msgs = await receive_messages()

# %%
# Verify results
print(f"Sent messages: {len(msg_ids)}")
print(f"Received messages: {len(received_msgs)}")

# Check if all sent messages were received
sent_ids = set(msg_ids)
received_ids = set(str(msg['_id']) for msg in received_msgs)
assert sent_ids == received_ids
print(f"All messages received: {sent_ids == received_ids}")
