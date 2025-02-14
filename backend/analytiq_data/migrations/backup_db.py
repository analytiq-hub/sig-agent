#! /usr/bin/env python3

import sys
import argparse
from pymongo import MongoClient

def backup_database(mongodb_uri: str, source_db_name: str, target_db_name: str) -> None:
    """
    Backup MongoDB database to a new database on the same server.
    
    Args:
        mongodb_uri: MongoDB connection URI
        source_db_name: Name of the source database
        target_db_name: Name of the target database to create
    """
    try:
        # Connect to MongoDB
        client = MongoClient(mongodb_uri)
        
        # Get source and target database references
        source_db = client[source_db_name]
        target_db = client[target_db_name]
        
        # Get list of all collections in source database
        collections = source_db.list_collection_names()
        
        print(f"Starting backup from '{source_db_name}' to '{target_db_name}'")
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
        client.close()

def main():
    parser = argparse.ArgumentParser(description='Backup MongoDB database to another database.')
    parser.add_argument('--uri', required=True, help='MongoDB connection URI')
    parser.add_argument('--src', required=True, help='Source database name')
    parser.add_argument('--dest', required=True, help='Destination database name')
    
    args = parser.parse_args()
    
    if args.src == args.dest:
        print("Error: Source and destination databases must be different")
        sys.exit(1)
    
    backup_database(args.uri, args.src, args.dest)

if __name__ == "__main__":
    main() 