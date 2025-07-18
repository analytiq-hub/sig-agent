import asyncio
import analytiq_data as ad
import logging
from typing import Dict, Any, Callable

logger = logging.getLogger(__name__)


LLM_SPU_COSTS = {
    "gpt-4o-mini": 1,
    "gpt-4.1-2025-04-14": 2,
    "claude-3-5-sonnet-latest": 3,
    # ... etc ...
}

check_subscription_limits = None
record_subscription_usage = None

async def get_spu_cost(llm_model: str) -> int:
    """Get the SPU cost for a given LLM model"""
    return LLM_SPU_COSTS.get(llm_model, 1)

async def check_spu_limits(org_id: str, spus: int) -> bool:
    """Check if organization has hit usage limits and needs to upgrade"""
    logger.info(f"Checking spu limits for org_id: {org_id}")

    # If a hook is set, use it to check subscription limits
    if check_subscription_limits:
        return await check_subscription_limits(org_id, spus)

    # Otherwise, payments are not enabled
    return True

async def record_spu_usage(org_id: str, spus: int) -> bool:
    """Check if organization has hit usage limits and needs to upgrade"""

    logger.info(f"Recording {spus} spu usage for org_id: {org_id}")

    # If a hook is set, use it to record subscription usage
    if record_subscription_usage:
        await record_subscription_usage(org_id, spus)

    # Otherwise, payments are not enabled
    return True

def set_check_subscription_limits_hook(check_subscription_limits_func: Callable) -> None:
    """Set the function to check subscription limits"""
    global check_subscription_limits
    check_subscription_limits = check_subscription_limits_func

def set_record_subscription_usage_hook(record_subscription_usage_func: Callable) -> None:
    """Set the function to record subscription usage"""
    global record_subscription_usage
    record_subscription_usage = record_subscription_usage_func
