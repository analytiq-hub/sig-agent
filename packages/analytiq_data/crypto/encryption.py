from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend
import base64
import hashlib
import os
import logging

logger = logging.getLogger(__name__)

def get_secret() -> str:
    """Get NEXTAUTH_SECRET from environment"""
    secret = os.getenv("NEXTAUTH_SECRET")
    if not secret:
        raise ValueError("NEXTAUTH_SECRET not found in environment")
    return secret

def get_cipher():
    """Create AES cipher using NEXTAUTH_SECRET"""
    # Use NEXTAUTH_SECRET as key, pad to 32 bytes for AES-256
    key = get_secret().encode().ljust(32, b'0')[:32]
    # Use a fixed IV derived from NEXTAUTH_SECRET
    iv = hashlib.sha256(key).digest()[:16]
    cipher = Cipher(
        algorithms.AES(key),
        modes.CFB(iv),
        backend=default_backend()
    )
    return cipher, iv

def encrypt_token(token: str) -> str:
    """Encrypt a token using AES with fixed IV"""
    try:
        cipher, iv = get_cipher()
        encryptor = cipher.encryptor()
        # Ensure we're working with bytes
        token_bytes = token.encode('utf-8')
        ciphertext = encryptor.update(token_bytes) + encryptor.finalize()
        encrypted_token = base64.urlsafe_b64encode(ciphertext).decode('ascii')
        return encrypted_token
    except Exception as e:
        raise ValueError(f"Encryption failed: {str(e)}")

def decrypt_token(encrypted_token: str) -> str:
    """Decrypt a token using AES with fixed IV"""
    try:
        cipher, iv = get_cipher()
        decryptor = cipher.decryptor()
        # Use urlsafe_b64decode to handle URL-safe base64 encoding
        ciphertext = base64.urlsafe_b64decode(encrypted_token.encode('ascii'))
        decrypted_bytes = decryptor.update(ciphertext) + decryptor.finalize()
        # Use 'utf-8' with error handling
        decrypted_token = decrypted_bytes.decode('utf-8', errors='strict')
        return decrypted_token
    except UnicodeDecodeError as e:
        raise ValueError(f"Decryption resulted in invalid UTF-8 data: {str(e)}")
    except Exception as e:
        raise ValueError(f"Decryption failed: {str(e)}") 