"""
Когда вебапп открывается внутри Telegram, он получает строку initData —
в ней зашифрована информация о пользователе (id, имя и т.д.).
Наша задача — проверить, что эту строку действительно сгенерировал Telegram,
а не подделал кто-то посторонний. Алгоритм проверки описан в официальной
документации Telegram:
https://core.telegram.org/bots/webapps#validating-data-received-via-the-web-app

Если объяснять по-простому: мы берём секретный ключ, полученный из токена
бота, и с его помощью пересчитываем "подпись" (hash) переданных данных.
Если наша подпись совпала с той, что прислал Telegram — данные подлинные.
"""

import hashlib
import hmac
from urllib.parse import parse_qsl
import json


def validate_init_data(init_data: str, bot_token: str) -> dict | None:
    try:
        parsed = dict(parse_qsl(init_data, strict_parsing=True))
    except ValueError:
        return None

    received_hash = parsed.pop("hash", None)
    if not received_hash:
        return None

    # Строка для проверки строится из всех полей, отсортированных по алфавиту
    data_check_string = "\n".join(
        f"{k}={v}" for k, v in sorted(parsed.items())
    )

    secret_key = hmac.new(
        key=b"WebAppData", msg=bot_token.encode(), digestmod=hashlib.sha256
    ).digest()

    calculated_hash = hmac.new(
        key=secret_key, msg=data_check_string.encode(), digestmod=hashlib.sha256
    ).hexdigest()

    if calculated_hash != received_hash:
        return None

    user_json = parsed.get("user")
    if not user_json:
        return None

    return json.loads(user_json)
