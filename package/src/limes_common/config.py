from pytz import timezone

_DEBUG = True

TIME_ZONE = timezone('Canada/Pacific')
ENCODING = 'utf-8'
if _DEBUG:
    HTTP_TIMEOUT = 10
else:
    HTTP_TIMEOUT = 5

CSRF_NAME = 'X-CSRFToken'

# ELAB_URL = 'https://us.elabjournal.com/'
ELAB_URL = 'https://elab.msl.ubc.ca/'
ELAB_API = '%sapi/v1/' % ELAB_URL

SERVER_API_VER = 'd1'
if _DEBUG:
    SERVER_BIND = '127.0.0.1:8001'
else:
    SERVER_BIND = '206.12.92.193:8001'
SERVER_API_ENDPOINT = '/api/%s/' % (SERVER_API_VER)
SERVER_URL = 'http://%s/api/%s/' % (SERVER_BIND, SERVER_API_VER)
SERVER_SECRET_KEY_PATH = 'server/credentials/secret_key'

# PROVIDER_STATICS_PATH = 'limes_core/example_static_providers.json'
PROVIDER_STATICS_PATH = 'server/static_providers.json'
PROVIDER_DEFAULT_TRANSACTION_TIMEOUT = 5
PROVIDER_DEFAULT_CONNECTION_TIMEOUT = 60

ELAB_CACHE = 'elab_cache.npy'

# MMAP_URL = 'https://bgcmmapapim.azure-api.net/mmapkoonkieapiqa/'
MMAP_URL = 'https://bgcmmapapim.azure-api.net/mmapkoonkieapiprod/'