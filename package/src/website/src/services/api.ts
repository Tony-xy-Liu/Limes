import { RequestService, POST } from "./requests"
import { DEBUG } from "../config"

export abstract class ApiService {
    protected clientID: string
    protected firstname: string
    protected lastname: string
    private readonly requester: RequestService

    constructor() {
        // actually threading through server due to CORS security
        // does not significantly slow requests
        this.requester = new RequestService('api/d1')
        this.clientID = ''
        this.firstname = ''
        this.lastname = ''
    }

    private makeBody(body: any={}) {
        body.ClientID = this.clientID;
        return body
    }

    public LoggedIn() {
        return this.clientID !== ''
    }

    public Login(username: string, password: string): Promise<[boolean, string]> {
        const that = this
        return this.requester.POST({
            path: 'login',
            body: {
                Username: username,
                Password: password
            }
        })
        .then(raw => {
            const res = raw.data;
            switch(res.Code) {
                case 200:
                    that.clientID = res.ClientID
                    that.firstname = res.FirstName
                    that.lastname = res.LastName
                    console.log(`logged in as ${res.FirstName}`)
                    return [true, '']
                case 401:
                    return [false, 'Incorrect username/password']
                default:
                    return Promise.reject('Oops, something crashed...')
            }
        })
    }

    public BarcodeLookup(barcodes: string[]): Promise<any> {
        const b = this.makeBody({
            Barcodes: barcodes
        })
        return this.requester.POST({
            path: 'barcodes',
            body: b
        }).then(raw => {
            const res = raw.data.Results;
            return res;
        })
    }

    public GetStorages(): Promise<any> {
        const b = this.makeBody()
        return this.requester.POST({
            path: 'allstorages',
            body: b
        }).then(raw => {
            const res = raw.data.Results
            return res
        })
    }

    public GetSamplesByStorage(id: number): Promise<any> {
        const b = this.makeBody({
            StorageLayerID: id
        })
        return this.requester.POST({
            path: 'samplesbystorage',
            body: b
        }).then(raw => {
            const res = raw.data.Results
            return res
        })
    }

    public ReloadStorages() {
        const b = this.makeBody()
        return this.requester.POST({
            path: 'reloadcache',
            body: b
        }).then(raw => {
            return raw.status
        })
    }

    public PrintLabels(labels: any) {
        const b = this.makeBody(labels)
        b.Op = 'print'
        return this.requester.POST({
            path: 'printops',
            body: b
        }).then(raw => {
            return raw.data.ID
        })
    }

    public PollPrintInfo(id: string) {
        const b = this.makeBody({
            ID: id,
            Op: 'poll',
        })
        return this.requester.POST({
            path: 'printops',
            body: b
        }).then(raw=> {
            return raw.data
        })
    }

    public RefreshPrintInfo() {
        const b = this.makeBody({
            Op: 'refreshinfo',
        })
        return this.requester.POST({
            path: 'printops',
            body: b
        }).then(raw => {
            return raw.data.ID
        })
    }

    public AddMmapSample(Barcodes: string[]) {
        const b = this.makeBody({
            Barcodes: Barcodes,
        })
        return this.requester.POST({
            path: 'mmapadd',
            body: b
        }).then(raw => {
            const res = raw.data.responses;
            // console.log(raw.data)
            return res;
        })
    }

    public SetCache(key: string, data: any) {
        const b = this.makeBody({
            key: key,
            data: JSON.stringify(data),
            isSet: true
        })
        return this.requester.POST({
            path: 'cache',
            body: b
        }).then(raw => {
            const res = raw.data;
            return res;
        })
    }

    public GetCache(key: string) {
        const b = this.makeBody({
            key: key,
            isSet: false
        })
        return this.requester.POST({
            path: 'cache',
            body: b
        }).then(raw => {
            let res
            try {
                res = JSON.parse(raw.data.data)
            } catch (err) {
                res = raw.data.data
                console.log(`GetCache JSON failed | key:${key}`)
                console.log(res)
            } finally {
                return res;
            }
        })
    }
}

class Prod_ApiService extends ApiService {

}

export class ApiServiceFactory {
    private static I: ApiService

    public static GetApiService() {
        if(!this.I) {
            // this.I = DEBUG? new Dev_ApiService(): new Prod_ApiService()
            this.I = new Prod_ApiService()
        }

        return this.I
    }
}