import analytiq_data as ad
from openai import AsyncOpenAI
import json


async def run_llm(analytiq_client, 
                  document_id: str,
                  prompt_id: str = "document_info") -> dict:
    """
    Run the LLM for the given document and prompt.
    
    Args:
        analytiq_client: The AnalytiqClient instance
        document_id: The document ID
        prompt_id: The prompt ID
    
    Returns:
        dict: The LLM result
    """
    llm_key = await ad.llm.get_llm_key(analytiq_client)
    ocr_text = ad.common.get_ocr_text(analytiq_client, document_id)
    
    client = AsyncOpenAI(api_key=llm_key)
    
    prompt = f"""Extract the document type, company name and address from the following text. 
    Return the result in JSON format.
    
    Examples:
    Input: "INVOICE ABC Corp. 123 Business St, New York, NY 10001 Invoice #12345"
    Output: {{
        "document_type": "invoice",
        "company_name": "ABC Corp.",
        "address": "123 Business St, New York, NY 10001"
    }}
    
    Input: "Purchase Order XYZ Industries 456 Industrial Ave, Chicago, IL 60601"
    Output: {{
        "document_type": "purchase_order",
        "company_name": "XYZ Industries",
        "address": "456 Industrial Ave, Chicago, IL 60601"
    }}
    
    Input: "Statement of Account Global Trading Co. 789 Commerce Rd, Los Angeles, CA 90001"
    Output: {{
        "document_type": "statement",
        "company_name": "Global Trading Co.",
        "address": "789 Commerce Rd, Los Angeles, CA 90001"
    }}
    
    Now extract from this text: {ocr_text}"""

    response = await client.chat.completions.create(
        model="gpt-4-turbo-preview",
        messages=[
            {"role": "system", "content": "You are a helpful assistant that extracts document information into JSON format."},
            {"role": "user", "content": prompt}
        ],
        temperature=0.1,
        response_format={ "type": "json_object" }
    )
    
    resp_json = response.choices[0].message.content

    # Convert to dict
    resp_dict = json.loads(resp_json)

    return resp_dict

async def save_llm_result(analytiq_client, 
                          document_id: str,
                          prompt_id: str, 
                          llm_result: dict) -> str:
    """
    Save the LLM result to MongoDB.
    
    Args:
        analytiq_client: The AnalytiqClient instance
        document_id: The document ID
        prompt_id: The prompt ID
        llm_result: The LLM result
    """

    db_name = analytiq_client.env
    db = analytiq_client.mongodb_async[db_name]
    queue_collection_name = f"llm.runs"
    queue_collection = db[queue_collection_name]

    element = {
        "prompt_id": prompt_id,
        "document_id": document_id,
        "llm_result": llm_result
    }

    # Save the result, return the ID
    result = await queue_collection.insert_one(element)
    return str(result.inserted_id)