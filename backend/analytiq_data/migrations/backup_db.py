#! /usr/bin/env python3

import sys
import argparse
from pymongo import MongoClient

def backup_database(src_uri: str, dest_uri: str, source_db_name: str, target_db_name: str) -> None:
    """
    Backup MongoDB database to another database.
    
    Args:
        src_uri: Source MongoDB connection URI
        dest_uri: Destination MongoDB connection URI
        source_db_name: Name of the source database
        target_db_name: Name of the target database to create
    """
    src_client = None
    dest_client = None
    
    try:
        # Connect to MongoDB servers
        src_client = MongoClient(src_uri)
        dest_client = MongoClient(dest_uri)
        
        # Get source and target database references
        source_db = src_client[source_db_name]
        target_db = dest_client[target_db_name]
        
        # Get list of all collections in source database
        collections = source_db.list_collection_names()
        
        print(f"Starting backup from '{source_db_name}' to '{target_db_name}'")
        print(f"Source URI: {src_uri}")
        print(f"Destination URI: {dest_uri}")
        print(f"Found {len(collections)} collections to backup")
        
        # Copy each collection
        for collection_name in collections:
            print(f"Backing up collection: {collection_name}")
            
            # Get all documents from source collection
            docs = list(source_db[collection_name].find())
            
            if docs:
                # Insert documents into target collection
                target_db[collection_name].insert_many(docs)
                print(f"✓ Copied {len(docs)} documents")
            else:
                print("✓ Collection is empty")
        
        print("\nBackup completed successfully!")
        
    except Exception as e:
        print(f"Error during backup: {str(e)}")
        sys.exit(1)
    finally:
        if src_client:
            src_client.close()
        if dest_client:
            dest_client.close()

def main():
    parser = argparse.ArgumentParser(description='Backup MongoDB database to another database.')
    parser.add_argument('--src-uri', required=True, help='Source MongoDB connection URI')
    parser.add_argument('--dest-uri', help='Destination MongoDB connection URI (defaults to source URI if not specified)')
    parser.add_argument('--src', required=True, help='Source database name')
    parser.add_argument('--dest', required=True, help='Destination database name')
    
    args = parser.parse_args()
    
    if args.src == args.dest and args.src_uri == (args.dest_uri or args.src_uri):
        print("Error: Source and destination databases must be different when using the same MongoDB instance")
        sys.exit(1)
    
    # Use source URI as destination URI if not specified
    dest_uri = args.dest_uri or args.src_uri
    
    backup_database(args.src_uri, dest_uri, args.src, args.dest)

if __name__ == "__main__":
    main() 