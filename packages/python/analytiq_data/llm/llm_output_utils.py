import re
import json
from typing import Optional


def process_groq_resp_content(resp_content: str) -> str:
    """
    Process Groq LLM response to extract valid JSON.
    
    Groq doesn't support response_format parameter, so it may return responses
    with <think> tags, markdown code blocks, or other formatting that needs
    to be cleaned up before JSON parsing.
    
    Args:
        resp_content: Raw response content from Groq
        
    Returns:
        str: Cleaned JSON string ready for parsing
    """
    # Remove <think> tags (Groq sometimes includes reasoning before JSON)
    resp_content = re.sub(r'<think>.*?</think>', '', resp_content, flags=re.DOTALL)
    
    # Strip whitespace
    resp_content = resp_content.strip()
    
    # Try to extract JSON from various formats
    # First, try to find JSON in markdown code blocks
    if resp_content.startswith("```json"):
        resp_content = resp_content[7:]
        resp_content = resp_content.split("```")[0]
        resp_content = resp_content.strip()
    elif "```json" in resp_content:
        # Find the start and end of the JSON code block
        start = resp_content.find("```json") + 7
        end = resp_content.find("```", start)
        if end != -1:
            resp_content = resp_content[start:end].strip()
    
    # If we still don't have valid JSON, try to find JSON object in the content
    if not resp_content.startswith('{'):
        # Look for the first { and last } to extract JSON
        start = resp_content.find('{')
        end = resp_content.rfind('}')
        if start != -1 and end != -1 and end > start:
            resp_content = resp_content[start:end+1]
    
    return resp_content


def process_llm_resp_content(resp_content: str, llm_provider: str) -> str:
    """
    Process LLM response based on the provider to extract valid JSON.
    
    Args:
        resp_content: Raw response content from LLM
        llm_provider: The LLM provider (e.g., "groq", "openai", "anthropic")
        
    Returns:
        str: Cleaned JSON string ready for parsing
    """
    if llm_provider == "groq":
        return process_groq_resp_content(resp_content)
    
    # For other providers, return as-is (they typically support response_format)
    return resp_content.strip()