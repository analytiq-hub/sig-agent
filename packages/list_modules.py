#!/usr/bin/env python3
"""
Script to list all Python modules in requirements.txt without their versions.
"""

import re
import os
import sys
from pathlib import Path

def get_package_name(requirement_line):
    """Extract package name from a requirements.txt line."""
    # Handle lines with version specifiers and comments
    match = re.match(r'^([a-zA-Z0-9_\-\.]+).*', requirement_line)
    if match:
        return match.group(1)
    return None

def main():
    # Get the directory where this script is located
    script_dir = Path(os.path.dirname(os.path.abspath(__file__)))
    
    # Try to find requirements.txt in the same directory as the script
    requirements_path = script_dir / "requirements.txt"
    
    # If not found, try one directory up (assuming script is in a subdirectory like 'packages')
    if not requirements_path.exists():
        requirements_path = script_dir.parent / "requirements.txt"
        
    # If still not found, try current working directory
    if not requirements_path.exists():
        requirements_path = Path("requirements.txt")
        
    if not requirements_path.exists():
        print("ERROR: Could not find requirements.txt", file=sys.stderr)
        return 1
    
    # Read current requirements
    with open(requirements_path, "r") as f:
        requirements = f.readlines()
    
    package_names = []
    
    for req in requirements:
        req = req.strip()
        if not req or req.startswith("#"):
            # Skip empty lines and comments
            continue
        
        # Extract package name
        package_name = get_package_name(req)
        if package_name:
            package_names.append(package_name)
    
    # Print all package names
    for package in sorted(package_names):
        print(package)
    
    return 0

if __name__ == "__main__":
    sys.exit(main()) 