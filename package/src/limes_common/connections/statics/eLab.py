from typing import Tuple, Union
import numpy as np

from limes_common import config
from limes_common import models
from limes_common.connections import T
from limes_common.connections.http import HttpConnection
from limes_common.models import Model, elab as Models, provider as ProviderModels
from limes_common.models.mmap import SequencingFacilityQuery as MmapQuery

class Storages:
    def __init__(self, storages: Union[list[Models.Storage], None] = None) -> None:
        if storages is None:
            try:
                loaded = np.load(file=config.ELAB_CACHE, allow_pickle=True)
                storages = [Models.Storage.Parse(s) for s in loaded]
            except FileNotFoundError:
                storages = []
        else:
            np.save(file=config.ELAB_CACHE, arr=[s.ToDict() for s in storages])

        S = Models.Storage
        self._byName: dict[str, list[S]] = {}
        self._byParentId: dict[int, list[S]] = {}
        self._byStorageId: dict[int, S] = {}
        self._byLayerId: dict[int, S] = {}

        def addToList(k, v, d:dict):
            similarLayers = d.get(k, [])
            similarLayers.append(v)
            d[k] = similarLayers

        for item in storages:
            item.link = ' %smembers/inventory/browser/?initStorageLayer=%s ' % (config.ELAB_URL, item.storageLayerID)
            addToList(item.name.lower(), item, self._byName)
            addToList(item.parentStorageLayerID, item, self._byParentId)
            self._byStorageId[item.storageID] = item
            self._byLayerId[item.storageLayerID] = item

class ELabConnection(HttpConnection):
    def __init__(self) -> None:
        super().__init__(config.ELAB_API)
        self._storages = Storages()

    def _makeHeader(self):
        return {'authorization': self._token}

    def LoggedIn(self) -> bool:
        return self._token != ''

    def GetSchema(self) -> ProviderModels.Schema:
        s = ProviderModels.Schema()
        s.Code = 503
        s.Error = 'please visit https://elab.msl.ubc.ca/docs/api/ for eLab api documentation'
        return s

    def Search(self, query: str) -> ProviderModels.Search.Response:
        samples = self.SearchSamples(query)
        storages = self.SearchStorages(query)
        res = ProviderModels.Search.Response()
        t_samples = str(Models.Sample)
        t_storages = str(Models.Storage)
        def makeHit(x, t):
            hit = ProviderModels.Search.Hit()
            hit.DataType = t
            if x is None: return hit
            hit.Data = [i.ToDict() for i in x]
            return hit
        res.Hits = {
            'samples': makeHit(samples.data, t_samples),
            'storages': makeHit(storages, t_storages)
        }
        res.Code = 200
        return res

    def Login(self, username: str, password: str):
        transaction = Models.Login
        req = transaction.Request()
        req.username = username
        req.password = password
        res = self._makeParseRequest(
            req,
            transaction.Response.Parse,
            transaction.Response()
        )
        if res.Code == 200:
            self.SetAuth(res.token)
        return res

    def Logout(self):
        self._token = ''

    def SearchSamples(self, query: str):
        query = query.lower()
        transaction = Models.GetSamples
        req = transaction.Request({"search": query})
        return self._makeParseRequest(
            req,
            transaction.Response.Parse,
            transaction.Response()
        )

    def GetSample(self, sampleID: int):
        transaction = Models.GetSampleById
        req = transaction.Request(sampleID)
        return self._makeParseRequest(
            req,
            transaction.Response.Parse,
            transaction.Response()
        )

    def GetSampleByStorage(self, storagelayerID: int):
        transaction = Models.GetSampleByStorage
        req = transaction.Request(storagelayerID)
        return self._makeParseRequest(
            req,
            transaction.Response.Parse,
            transaction.Response()
        )

    def MmapAdd(self, entries: dict[str, MmapQuery.Response]) -> dict:
        """@entries is dict of barcode: mmapQ"""

        bres = self.LookupBarcodes(list(entries.keys()))
        def tryAdd(bar: str, mr: MmapQuery.Response):
            transaction = Models.MmapAddSample
            if mr.Code != 200:
                res = transaction.Response()
                res.Code, res.Error = mr.Code, mr.Error
                return res
            # try:
            type, pres, depth, col, cond = (mr.sampleType, mr.samplePreservationMethodology,
            mr.depth, mr.collectionDate, mr.shippingCondition)
            req = transaction.Request()
            req.storageLayerID = 784675
            req.sampleTypeID = 33687
            req.altID = bar

            btoks = bar.split('-')
            if len(btoks) < 3:
                if "test" in bar.lower():
                    cc = bar
                else:
                    cc = bar[-3:]
            else:
                cc = [t[-1] for t in btoks[:3]]
            req.name = f"{type} [{cc}]"

            res = self._makeParseRequest(
                req,
                transaction.Response.Parse,
                transaction.Response()
            )

            err_res = transaction.Response()
            err_res.Code = 400
            err_res.Error = "Barcode exists"
            if bres[bar] is not None: return err_res
            if 'raw' not in res.Body: return err_res

            sampleID = res.Body['raw']
            res = self.GetSample(sampleID)

            # add meta fields
            metas = [
                {'sampleDataType': 'TEXT', 'key': 'Type', 'value': type, 'sampleTypeMetaID': 215089},
                {'sampleDataType': 'TEXT', 'key': 'Preservation Methodology', 'value': pres, 'sampleTypeMetaID': 215090},
                {'sampleDataType': 'TEXT', 'key': 'Depth', 'value': depth, 'sampleTypeMetaID': 215091},
                {'sampleDataType': 'TEXT', 'key': 'Collection Date', 'value': col, 'sampleTypeMetaID': 215092},
                {'sampleDataType': 'TEXT', 'key': 'Shipping Condition', 'value': cond, 'sampleTypeMetaID': 215093},
            ]
            for m in metas:
                transaction = Models.AddSampleMeta
                mreq = transaction.Request(sampleID, m)
                self._makeParseRequest(mreq, transaction.Response.Parse, transaction.Response())
            return res
            # except:
            #     err_res = transaction.Response()
            #     err_res.Code = 500
            #     err_res.Error = "Failed to add to eLab"
            #     return err_res

        return dict([(bar, tryAdd(bar, mr)) for bar, mr in entries.items()])

    def ReloadStorages(self):
        transaction = Models.AllStorages
        req = transaction.Request()
        res = self._makeParseRequest(
            req,
            transaction.Response.Parse,
            transaction.Response()
        )
        self._storages = Storages(res.data)
        return res

    def SearchStorages(self, query: str):
        query = query.lower()
        results: list[Models.Storage] = []
        d = self._storages._byName
        for n in d.keys():
            if query in n:
                results += d[n]
        return results
    
    def GetStorage(self, layerID: int, withPath=False):
        # default = Models.Storage()
        default = None
        res = self._storages._byLayerId.get(layerID, default)
        if withPath and res is not None:
            res.path = self.GetFullStoragePath(layerID)
        return res

    def GetAllStorages(self):
        return list(self._storages._byLayerId.values())
    
    def GetStorageSimple(self, layerID: int):
        raw = self.GetStorage(layerID)
        if raw is not None:
            res = Models.StorageSimple()
            res.name = raw.name
            res.storageLayerID = raw.storageLayerID
            res.parentStorageLayerID = raw.parentStorageLayerID
            res.storageLayerDefinitionID = raw.storageLayerDefinitionID
            return res
        else:
            return raw

    def GetFullStoragePath(self, layerID: int) -> list[Models.StorageSimple]:
        layer = self.GetStorageSimple(layerID)
        path = []
        while layer is not None:
            path.append(layer)
            layer = self.GetStorageSimple(layer.parentStorageLayerID)
        return path

    def LookupBarcodes(self, barcodes: list[str]):
        SAMPLE_PRE = '005'
        samples = []
        res = {}
        BARCODE_L = 15
        PREFIX_L = 3 # 005<ID>

        def toBar(s: str):
            if not s.isnumeric():
                return s

            while len(s) < BARCODE_L - PREFIX_L:
                s = '0%s' % s
            if len(s) == BARCODE_L - PREFIX_L:
                s = '%s%s' % (SAMPLE_PRE, s)
            while len(s) < BARCODE_L:
                s = '0%s' % s
            return s

        for b in barcodes:
            b = toBar(b)
            try:
                code = int(b[PREFIX_L:])
            except:
                code = 0
            storage = self.GetStorage(code, withPath=True)
            res[b] = storage
            if storage is None:
                samples.append(b)

        if len(samples) > 0:
            transaction = Models.GetSamples
            s_req = transaction.Request({"barcodes": ','.join(samples)})
            s_res = self._makeParseRequest(
                s_req,
                transaction.Response.Parse,
                transaction.Response())
            # print(s_res.ToDict())
            if s_res.Code == 200:
                for v in s_res.data:
                    key = v.altID if v.altID is not None else v.barcode
                    res[key] = v
        return res

    def SetAltID(self, barcode: str, altID: str) -> Tuple[int, Models.Sample]:
        res = self.LookupBarcodes([barcode])
        if len(res) < 0: return 404, Models.Sample()
        sample: Models.Sample = res[barcode]
        
        # print(sample.ToDict())

        transaction = Models.UpdateSample
        s_req = transaction.Request()
        s_req.altID = altID
        s_req.TargetEndpoint += '/%s' %(sample.sampleID)
        s_res = self._makeParseRequest(
            s_req,
            transaction.Response.Parse,
            transaction.Response())
        
        # print(s_req.ToDict())
        # print(s_res.ToDict())

        return s_res.Code, sample
