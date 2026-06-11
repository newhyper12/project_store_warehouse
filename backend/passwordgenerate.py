# backend/passwordgenerate.py
# generate_hash.py
import bcrypt

password = "SachaTop123"  # ← замените на свой
hashed = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
print(hashed.decode('utf-8'))