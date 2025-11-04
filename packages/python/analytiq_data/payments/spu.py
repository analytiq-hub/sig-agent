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

    # If a hook is set, use it to check payment limits
    if check_payment_limits:
        return await check_payment_limits(org_id, spus)

    # Otherwise, payments are not enabled
    return True

async def record_spu_usage_llm(org_id: str, spus: int, 
                              llm_provider: str = None,
                              llm_model: str = None,
                              prompt_tokens: int = None, 
                              completion_tokens: int = None, 
                              total_tokens: int = None, 
                              actual_cost: float = None) -> bool:
    """Record SPU usage for LLM operations with 10x multiplier"""

    # Apply 10x multiplier for LLM usage
    spus = spus * 10

    logger.info(f"Recording {spus} spu usage (10x multiplier applied) for LLM, org_id: {org_id}, provider: {llm_provider}, model: {llm_model}")

    # If a hook is set, use it to record payment usage
    if record_payment_usage:
        await record_payment_usage(org_id, spus, llm_provider, llm_model, prompt_tokens, completion_tokens, total_tokens, actual_cost, operation="document_processing", source="backend")

    # Otherwise, payments are not enabled
    return True

async def record_spu_usage_mon(org_id: str, spus: int = 1, 
                              operation: str = "monitoring",
                              source: str = "monitoring") -> bool:
    """Record SPU usage for monitoring/logging operations"""
    
    logger.info(f"Recording {spus} spu usage for monitoring, org_id: {org_id}, operation: {operation}, source: {source}")

    # If a hook is set, use it to record payment usage
    if record_payment_usage:
        await record_payment_usage(org_id, spus, llm_provider=None, llm_model=None, operation=operation, source=source)

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
