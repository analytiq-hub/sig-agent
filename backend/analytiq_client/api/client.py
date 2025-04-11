import requests
import base64
from typing import Dict, List, Any, Optional, Union
from datetime import datetime
import json

class AnalytiqClient:
    """Client for interacting with the Analytiq API"""
    
    def __init__(self, base_url: str, api_token: str = None):
        """
        Initialize the client
        
        Args:
            base_url: The base URL of the API
            api_token: The API token to use for authentication
        """
        self.base_url = base_url.rstrip("/")
        self.api_token = api_token
        self.session = requests.Session()
        
        # Import API modules here to avoid circular imports
        from .api.documents import DocumentsAPI
        from .api.ocr import OCRAPI
        from .api.llm import LLMAPI
        from .api.schemas import SchemasAPI
        from .api.prompts import PromptsAPI
        from .api.tags import TagsAPI
        
        # Initialize API modules
        self.documents = DocumentsAPI(self)
        self.ocr = OCRAPI(self)
        self.llm = LLMAPI(self)
        self.schemas = SchemasAPI(self)
        self.prompts = PromptsAPI(self)
        self.tags = TagsAPI(self)
    
    def request(self, method: str, path: str, **kwargs) -> Any:
        """
        Make a request to the API
        
        Args:
            method: The HTTP method to use
            path: The path to request
            **kwargs: Additional arguments to pass to requests
            
        Returns:
            The response data
        """
        url = f"{self.base_url}{path}"
        
        # Add Authorization header if token is available
        headers = kwargs.pop("headers", {})
        if self.api_token:
            headers["Authorization"] = f"Bearer {self.api_token}"
        
        # Make the request
        response = self.session.request(method, url, headers=headers, **kwargs)
        
        # Check for errors
        try:
            response.raise_for_status()
        except requests.exceptions.HTTPError as err:
            # Try to extract the API error message
            try:
                error_detail = response.json().get("detail", str(err))
                raise Exception(f"API Error ({response.status_code}): {error_detail}")
            except (ValueError, KeyError):
                # If parsing fails, raise the original error
                raise err
                
        # Parse the response
        if response.content and response.headers.get("content-type") == "application/json":
            return response.json()
        
        # For text content type, return the text
        if response.content and response.headers.get("content-type") == "text/plain":
            return response.text
            
        # Return raw response for binary data
        return response.content
