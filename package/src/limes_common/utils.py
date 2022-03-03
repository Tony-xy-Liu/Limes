import datetime, time
from . import config

def current_milli_time() -> int:
    return round(time.time() * 1000)

def current_sec_time() -> float:
    return current_milli_time() / 1000

def current_time() -> float:
    return time.time()

def format_from_utc(ts) -> str:
    return datetime.datetime.fromtimestamp(ts, tz=config.TIME_ZONE).strftime("%Y-%b-%d %I:%M:%S %p")