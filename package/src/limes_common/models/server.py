from __future__ import annotations

from limes_common.models import Model, Primitive, elab, provider as Models
from limes_common.models import provider
from limes_common.models.provider import Transaction
from limes_common.models.elab import MmapAddSample
from limes_common.models.mmap import SequencingFacilityQuery
from limes_common.models.http import GET, POST

class Endpoints(provider.Endpoints):
    LOGIN = 'login'
    AUTHENTICATE = 'authenticate'
    INIT = 'init'
    # ADD = 'add'
    LIST = 'list'
    CALL = 'call'
    SEARCH = 'search'
    RELOAD_PROVIDERS = 'reloadproviders'
    RELOAD_CACHE = 'reloadcache'
    BARCODES= 'barcodes'
    SET_ALT_ID= 'setaltid'
    PRINT='printops'
    ALL_STORAGES='allstorages'
    SAMPLES_BY_STORAGE='samplesbystorage'
    MMAP_ADD = 'mmapadd'
    CACHE = 'cache'

class ServerRequest(Models.ProviderRequest):
    ClientID: str

class ServerResponse(Models.ProviderResponse):
    pass

class Init(Transaction):
    class Request(ServerRequest):
        def __init__(self) -> None:
            super().__init__(Endpoints.INIT, GET)
    class Response(ServerResponse):
        CsrfToken: str
        def __init__(self, token: str = '') -> None:
            self.CsrfToken = token

class Authenticate(Transaction):
    class Request(ServerRequest):
        def __init__(self) -> None:
            super().__init__(Endpoints.AUTHENTICATE, POST)

    class Response(ServerResponse):
        Success: bool
        Token: str
        FirstName: str
        LastName: str

class Login(Transaction):
    class Request(ServerRequest):
        Username: str
        Password: str
        def __init__(self) -> None:
            super().__init__(Endpoints.LOGIN, POST)

    class Response(ServerResponse):
        Success: bool
        FirstName: str
        LastName: str
        ClientID: str
        ElabToken: str
        def __init__(self, success: bool=False) -> None:
            super().__init__()
            self.Success = success


class ProviderInfo(Model):
    Name: str
    Schema: provider.Schema

class List(Transaction):
    class Request(ServerRequest):
        def __init__(self) -> None:
            super().__init__(Endpoints.LIST, GET)

    class Response(ServerResponse):
        Providers: list[ProviderInfo]
        def __init__(self) -> None:
            super().__init__()
            self.Providers = []

class ReloadProviders(Transaction):
    class Request(ServerRequest):
        def __init__(self) -> None:
            super().__init__(Endpoints.RELOAD_PROVIDERS, POST)

    class Response(List.Response):
        pass

class ReloadCache(Transaction):
    class Request(ServerRequest):
        def __init__(self) -> None:
            super().__init__(Endpoints.RELOAD_CACHE, POST)

    class Response(ServerResponse):
        def __init__(self, code: int=0) -> None:
            super().__init__()
            self.Code = code

class CallProvider(Transaction):
    class Request(ServerRequest):
        ProviderName: str
        # Endpoint: str
        RequestPayload: Models.GenericRequest
        def __init__(self) -> None:
            super().__init__(Endpoints.CALL, POST)

    class Response(ServerResponse):
        ResponsePayload: Models.GenericResponse

class Search(Transaction):
    class Request(ServerRequest, Models.Search.Request):
        def __init__(self) -> None:
            super().__init__(Endpoints.SEARCH, POST)

    class Response(Models.Search.Response):
        pass

class BarcodeLookup(Transaction):
    class Request(ServerRequest):
        Barcodes: list[str]
        def __init__(self) -> None:
            super().__init__(Endpoints.BARCODES, POST)

    class Response(ServerResponse):
        Results: dict

class LinkBarcode(Transaction):
    class Request(ServerRequest):
        AltBarcode: str
        SampleBarcode: str
        def __init__(self) -> None:
            super().__init__(Endpoints.SET_ALT_ID, POST)

    class Response(ServerResponse):
        Sample: elab.Sample
        mcode: int

class MmapAdd(Transaction):
    class Request(ServerRequest):
        Barcodes: list[str]
        def __init__(self) -> None:
            super().__init__(Endpoints.MMAP_ADD, POST)

    class Response(ServerResponse):
        responses: dict[str, SequencingFacilityQuery.Response]


class Cache(Transaction):
    class Request(ServerRequest):
        isSet: bool
        key: str
        data: str
        def __init__(self) -> None:
            super().__init__(Endpoints.CACHE, POST)

    class Response(ServerResponse):
        data: str

class AllStorages(Transaction):
    class Request(ServerRequest):
        def __init__(self) -> None:
            super().__init__(Endpoints.ALL_STORAGES, POST)

    class Response(ServerResponse):
        Results: list[elab.Storage]

class SamplesByStorage(Transaction):
    class Request(ServerRequest):
        StorageLayerID: int
        def __init__(self) -> None:
            super().__init__(Endpoints.SAMPLES_BY_STORAGE, POST)
        
    class Response(ServerResponse):
        Results: list[elab.Sample]

class LabelData(Model):
    Barcode: str
    Texts: list[str]

class PrintOp:
    PRINT = 'print'
    REFRESH_INFO = 'refreshinfo'
    POLL = 'poll'

class Printing(Transaction):
    class BaseRequest(ServerRequest):
        Op: str
        def __init__(self, op: str='') -> None:
            self.Op = op
            super().__init__(Endpoints.PRINT, POST)
    class PrintRequest(Model):
        Labels: list[LabelData]
        PrinterName: str
        TemplateName: str
        ID: str

    class RefreshInfo(BaseRequest):
        def __init__(self) -> None:
            super().__init__(PrintOp.REFRESH_INFO)

    class PollReport(BaseRequest):
        ID: str
        def __init__(self) -> None:
            super().__init__(PrintOp.POLL)

    class Report(ServerResponse):
        Data: dict
        Success: bool

    class Response(ServerResponse):
        ID: str