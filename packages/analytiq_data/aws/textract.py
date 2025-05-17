import boto3, botocore
from collections import defaultdict
import json
import re
import time
import asyncio
from datetime import datetime
import uuid
import logging
import analytiq_data as ad

logger = logging.getLogger(__name__)

async def run_textract(analytiq_client,
                       blob: bytes,
                       feature_types: list = [],
                       query_list: list = None) -> dict:
    """
    Run textract on a blob and return the blocks formatted as a dict.

    Args:
        analytiq_client: Analytiq client
        doc_blob: Bytes to be textracted
        feature_types: List of feature types, e.g. ["TABLES", "FORMS", "QUERIES"]
        query_list: List of queries

    Returns:
        Textract blocks formatted as a dict
    """
    # Get the AWS client. This will give None for textract if the AWS keys are not set.
    aws_client = ad.aws.get_aws_client(analytiq_client)
    if aws_client.textract is None:
        raise Exception(f"AWS textract client not created. Cannot run OCR.")

    textract = aws_client.textract
    s3_bucket_name = aws_client.s3_bucket_name

    # Create a random s3 key
    s3_key = f"textract/tmp/{datetime.now().strftime('%Y-%m-%d')}/{uuid.uuid4()}"

    # Save the blob to s3
    aws_client.s3.put_object(Bucket=s3_bucket_name, Key=s3_key, Body=blob)

    try:
        if query_list is not None and len(query_list) > 0:
            query_list = [{'Text': '{}'.format(q)} for q in query_list]
            response = textract.start_document_analysis(
                DocumentLocation={
                    'S3Object': {
                        'Bucket': s3_bucket_name,
                        'Name': s3_key
                    }
                },
                FeatureTypes=feature_types + ["QUERIES"],
                QueriesConfig = {'Queries': query_list}
            )
            textract_get_completion= textract.get_document_analysis
        elif len(feature_types) > 0:
            response = textract.start_document_analysis(
                DocumentLocation={
                    'S3Object': {
                        'Bucket': s3_bucket_name,
                        'Name': s3_key
                    }
                },
                FeatureTypes=feature_types,
            )
            textract_get_completion=textract.get_document_analysis
        else:
            response = textract.start_document_text_detection(
                DocumentLocation={
                    'S3Object': {
                        'Bucket': s3_bucket_name,
                        'Name': s3_key
                    }
                }
            )
            textract_get_completion = textract.get_document_text_detection

        job_id = response['JobId']

        # Check completion status
        idx = 0
        while True:
            status_response = textract_get_completion(JobId=job_id)
            status = status_response['JobStatus']
            logger.info(f"{analytiq_client.name}: ocr step {idx}: {status}")
            idx += 1

            if status in ["SUCCEEDED", "FAILED"]:
                break

            await asyncio.sleep(1)

        if status == "SUCCEEDED":
            blocks = []

            next_token = None
            while True:
                # Add a next_token if more results are available
                if next_token:
                    response = textract_get_completion(JobId=job_id, NextToken=next_token)
                else:
                    response = textract_get_completion(JobId=job_id)

                blocks.extend(response['Blocks'])

                # Check for more results
                next_token = response.get('NextToken', None)
                if not next_token:
                    break

            return blocks
        else:
            raise Exception(f"Textract document analysis failed: {status} for s3://{s3_bucket_name}/{s3_key}")
    except Exception as e:
        logger.error(f"Error running textract: {e}")
        raise e
    finally:
        # Delete the s3 object
        aws_client.s3.delete_object(Bucket=s3_bucket_name, Key=s3_key)    

def get_block_map(blocks: list) -> dict:
    """
    Construct a map of blocks

    Args:
        blocks : dict
            Textract blocks

    Returns:
        dict
            Block map
    """
    block_map = {}
    for block in blocks:
        block_id = block['Id']
        block_map[block_id] = block
    return block_map
    

def get_kv_map(blocks: list) -> dict:
    """
    Construct a map of keys and values parsed by textract

    Args:
        blocks: Textract blocks

    Returns:
        Key and value map
    """
    key_map = {}
    value_map = {}
    for block in blocks:
        block_id = block['Id']
        if block['BlockType'] == "KEY_VALUE_SET":
            if 'KEY' in block['EntityTypes']:
                key_map[block_id] = block
            else:
                value_map[block_id] = block

    return key_map, value_map


def get_kv_relationship(key_map: dict, value_map: dict, block_map: dict) -> dict:
    """
    Get the key and value relationships

    Args:
        key_map: Key map
        value_map: Value map
        block_map: Block map

    Returns:
        Key and value relationships
    """
    kvs = defaultdict(list)
    for _, key_block in key_map.items():
        value_block = find_value_block(key_block, value_map)
        key = get_text(key_block, block_map)
        val = get_text(value_block, block_map)
        kvs[key].append(val)
    return kvs

def find_value_block(key_block: dict, value_map: dict) -> dict:
    for relationship in key_block['Relationships']:
        if relationship['Type'] == 'VALUE':
            for value_id in relationship['Ids']:
                value_block = value_map[value_id]
    return value_block


def get_text(block: dict, blocks_map: dict) -> str:
    text = ''
    if 'Relationships' in block:
        for relationship in block['Relationships']:
            if relationship['Type'] == 'CHILD':
                for child_id in relationship['Ids']:
                    word = blocks_map[child_id]
                    if word['BlockType'] == 'WORD':
                        text += word['Text'] + ' '
                    if word['BlockType'] == 'SELECTION_ELEMENT':
                        if word['SelectionStatus'] == 'SELECTED':
                            text += 'X '

    return text

def get_query_map(block_map: dict) -> dict:
    """
    Get the query map

    Args:
        block_map: Block map

    Returns:
        Query map
    """
    query_map = {}

    for _, block in block_map.items():
        if block["BlockType"] == "QUERY":
            query_text = block["Query"]["Text"]
            query_map[query_text] = None
            for relationship in block.get("Relationships", []):
                if relationship["Type"] == "ANSWER":
                    for value_id in relationship["Ids"]:
                        value_block = block_map[value_id]
                        answer_text = value_block["Text"]
                        query_map[query_text] = answer_text
    return query_map

def search_value(kvs: dict, search_key: str) -> list:
    """
    Search for a key in the key and value map

    Args:
        kvs: Key and value map
        search_key: Search key

    Returns:
        List of values
    """
    for key, value in kvs.items():
        if re.search(search_key, key, re.IGNORECASE):
            return value
        

def get_tables(block_map: dict) -> list:
    """
    Get the tables

    Args:
        block_map: Block map

    Returns:
        List of tables
    """
    tables = []
    for _, block in block_map.items():
        if block['BlockType'] == 'TABLE':
            table = {}
            for relationship in block.get('Relationships', []):
                if relationship['Type'] == 'CHILD':
                    for child_id in relationship['Ids']:
                        cell = next(b for _, b in block_map.items() if b['Id'] == child_id)
                        row_index = cell['RowIndex']
                        col_index = cell['ColumnIndex']
                        text = ''

                        for relationship2 in cell.get('Relationships', []):
                            if relationship2['Type'] == 'CHILD':
                                for child_id2 in relationship2['Ids']:
                                    child_block2 = block_map.get(child_id2, None)
                                    if child_block2 and 'Text' in child_block2:
                                        if text == "":
                                            text = child_block2['Text']
                                        else:
                                            text += " "
                                            text += child_block2['Text']

                        # print(json.dumps(cell))
                        # print(text)

                        # Save the cell text to the table
                        table.setdefault(row_index, {})[col_index] = text
            
            # Save the table to the list of tables
            tables += [table]

            #for row in sorted(table.keys()):
            #    print([table[row].get(col, '') for col in sorted(table[row].keys())])

    return tables

def get_page_text_map(block_map: dict) -> dict:
    """
    Get the page text map

    Args:
        block_map: Block map

    Returns:
        Page text map
    """
    page_text_map = {}
    for _, block in block_map.items():
        if block['BlockType'] == 'LINE':
            page = block['Page']
            if page not in page_text_map:
                page_text_map[page] = ""
            page_text_map[page] += block['Text'] + "\n"
    
    if len(page_text_map) == 0:
        return page_text_map

    max_page = max(page_text_map.keys())

    for page in range(1, max_page+1):
        if page not in page_text_map:
            page_text_map[page] = ""

    page_text_map = dict(sorted(page_text_map.items()))

    return page_text_map