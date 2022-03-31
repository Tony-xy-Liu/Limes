from __future__ import annotations

from limes_common import config
from limes_common.models import Model, provider as Models
from limes_common.models.provider import GenericResponse, ProviderRequest, ProviderResponse, Transaction, Primitive
from limes_common.models.http import GET, PATCH, POST, PUT

class Endpoints(Models.Endpoints):
    SequencingFacilityQuery = 'SequencingFacilityQuery'


class SequencingFacilityQuery(Transaction):
    class Request(ProviderRequest):
        status: str
        barcode: str
        def __init__(self) -> None:
            super().__init__(Endpoints.SequencingFacilityQuery, POST)
    class Response(ProviderResponse):
        collectionDate: str
        samplePreservationMethodology: str
        sampleType: str
        sampleName: str
        clientName: str
        siteName: str
        depth: float
        shippingCondition: str