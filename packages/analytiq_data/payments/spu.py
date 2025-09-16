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

check_payment_limits = None
record_payment_usage = None

async def get_spu_cost(llm_model: str) -> int:
    """Get the SPU cost for a given LLM model"""
    return LLM_SPU_COSTS.get(llm_model, 1)

async def check_spu_limits(org_id: str, spus: int) -> bool:
    """Check if organization has hit usage limits and needs to upgrade"""
    logger.info(f"Checking spu limits for org_id: {org_id}")

    # If a hook is set, use it to check payment limits
    if check_payment_limits:
        return await check_payment_limits(org_id, spus)

    # Otherwise, payments are not enabled
    return True

async def record_spu_usage(org_id: str, spus: int, 
                          llm_provider: str = None,
                          llm_model: str = None,
                          prompt_tokens: int = None, 
                          completion_tokens: int = None, 
                          total_tokens: int = None, 
                          actual_cost: float = None) -> bool:
    """Record SPU usage with LLM metrics"""

    logger.info(f"Recording {spus} spu usage for org_id: {org_id}, provider: {llm_provider}, model: {llm_model}")

    # If a hook is set, use it to record payment usage
    if record_payment_usage:
        await record_payment_usage(org_id, spus, llm_provider, llm_model, prompt_tokens, completion_tokens, total_tokens, actual_cost)

    # Otherwise, payments are not enabled
    return True

def set_check_payment_limits_hook(check_payment_limits_func: Callable) -> None:
    """Set the function to check payment limits"""
    global check_payment_limits
    check_payment_limits = check_payment_limits_func

def set_record_payment_usage_hook(record_payment_usage_func: Callable) -> None:
    """Set the function to record payment usage"""
    global record_payment_usage
    record_payment_usage = record_payment_usage_func
