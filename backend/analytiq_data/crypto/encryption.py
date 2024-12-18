from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend
import base64
import hashlib
import os

def get_jwt_secret() -> str:
    """Get JWT_SECRET from environment"""
    jwt_secret = os.getenv("JWT_SECRET")
    if not jwt_secret:
        raise ValueError("JWT_SECRET not found in environment")
    return jwt_secret

def get_cipher():
    """Create AES cipher using JWT_SECRET"""
    # Use JWT_SECRET as key, pad to 32 bytes for AES-256
    key = get_jwt_secret().encode().ljust(32, b'0')[:32]
    # Use a fixed IV derived from JWT_SECRET
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
        return base64.urlsafe_b64encode(ciphertext).decode('ascii')
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
        return decrypted_bytes.decode('utf-8', errors='strict')
    except UnicodeDecodeError as e:
        raise ValueError(f"Decryption resulted in invalid UTF-8 data: {str(e)}")
    except Exception as e:
        raise ValueError(f"Decryption failed: {str(e)}") 