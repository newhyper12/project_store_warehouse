import bcrypt

# Хэш из твоей базы (я скопировал из твоего вывода)
stored_hash = "$2b$12$wHFvlKGF6We2vou7JPF1Feflc3MVG.sLeMjmXVsOv9Dpwt44Sq08S"

# Проверяем пароль
result = bcrypt.checkpw("123456".encode('utf-8'), stored_hash.encode('utf-8'))
print(f"Пароль '123456' подходит: {result}")
