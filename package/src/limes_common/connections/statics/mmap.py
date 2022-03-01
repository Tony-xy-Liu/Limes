from limes_common import config
from limes_common import models
from limes_common.connections.http import HttpConnection
from limes_common.models import Model, mmap as Models, provider as ProviderModels

class MmapConnection(HttpConnection):
    def __init__(self, oask: str) -> None:
        super().__init__(config.MMAP_URL)
        self._OASK = oask

    def _makeHeader(self):
        return {'Ocp-Apim-Subscription-Key': self._OASK}

    def SequencingFacilityQuery(self, barcode:str, status):
        transaction = Models.SequencingFacilityQuery
        req = transaction.Request()
        req.status = status
        req.barcode = barcode

        if barcode.lower().startswith('test'):
            print(f"test mmap query <{barcode}>")
            try:
                num = int(barcode.replace('test', ''))
            except:
                num = 0
            res = transaction.Response()
            res.Code = 200
            res.collectionDate = f"day {num}"
            res.depth = num*10
            res.samplePreservationMethodology = f"preservation method {num}"
            res.shippingCondition = f"shipping conditon {num}"
            res.sampleType = f"test sample"
            return res

        try:
            res = self._makeParseRequest(
                req,
                transaction.Response.Parse,
                transaction.Response()
            )
        except:
            res = transaction.Response()
            res.Code = 500
            res.Error = "MMAP query failed"
        return res
