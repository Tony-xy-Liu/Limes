from typing import Tuple, Union
import os
import json

from limes_common.connections.statics.eLab import ELabConnection
from limes_common.models import server as Models

from server.clientManager import Client, ClientManager, ClientType

class ClientManger:
    def __init__(self, elab: ELabConnection) -> None:
        self._clients = ClientManager.GetInstance()
        self._elab = elab

    def _checkStaticLogins(self, username: str, password: str) -> bool:
        CRED = './server/secrets/credentials.json'
        if os.path.isfile(CRED):
            with open(CRED, 'r') as f:
                try:
                    creds: dict = json.loads('\n'.join(f.readlines()))
                    for u, p in creds.items():
                        u, p = str(u), str(p)
                        if username.lower() == u.lower() and password == p:
                            return True
                except:
                    pass
        return False

    def Login(self, raw: Union[bytes, list[str]]) -> Models.Login.Response:
        MODEL = Models.Login
        req = MODEL.Request.Parse(raw)

        isStatic = self._checkStaticLogins(req.Username, req.Password)
        e_res = None
        loggedIn = isStatic
        if not isStatic:
            e_res = self._elab.Login(req.Username, req.Password)
            loggedIn = e_res.token is not None and e_res.token != ''

        res = MODEL.Response()
        if loggedIn:
            if not isStatic and e_res is not None:
                client: Client = Client(e_res.user.firstName, e_res.user.lastName, e_res.token)
            else:
                client: Client = Client(req.Username, '', '', ClientType.OTHER)
            self._clients.RegisterClient(client)
            res.FirstName = client.FirstName
            res.LastName = client.LastName
            res.ClientID = client.ClientID
            res.ElabToken = client.Token
            res.Success = True
            res.Code = 200
        else:
            res.Success = False
            res.Code = e_res.Code if e_res is not None else 401

        self._elab.Logout()
        return res

    def Authenticate(self, ClientID: str) -> Models.Authenticate.Response:
        MODEL = Models.Authenticate
        client = self._clients.Get(ClientID)

        res = MODEL.Response()
        if client is not None:
            res.Success = True
            res.Token = client.Token
            res.FirstName = client.FirstName
            res.LastName = client.LastName
        else:
            res.Success = False
        return res

    def SetCache(self, ClientID: str, key:str, data: str):
        client = self._clients.Get(ClientID)
        if client is not None:
            client.Cache[key] = data
            return 200
        else:
            return 404

    def GetCache(self, ClientID: str, key:str, default=None) -> Union[str, None]:
        client = self._clients.Get(ClientID)
        if client is not None:
            return client.Cache.get(key, default)
        else:
            return default

