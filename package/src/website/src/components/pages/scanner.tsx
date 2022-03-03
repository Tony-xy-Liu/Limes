import React from "react";
import BarcodeScannerComponent from "react-qr-barcode-scanner";
// import FormLabel from '@mui/material/FormLabel';
import { Typography, Grid, Card, Button, CircularProgress, Fade, Container, TextField } from '@material-ui/core';
import { ScannerProps } from '../../models/props';
import { ApiService } from "../../services/api";
import { DataGrid, GridColDef, GridRowParams, GridSelectionModel } from '@material-ui/data-grid';

// enum Modes {
//     ELAB, LINK
// }

enum ScanType {
    UNK, EXISTING
}

interface ScanInfo {
    barcode: string
    id: number
    info: string
    raw: any
    type: ScanType
}

interface ScannerState {
    scans: Map<number, ScanInfo>
    selectedScanIDs: GridSelectionModel
    lastID: number
    cardBorderColour: any
    lastScanTime: number
    lastBarInputTime: number,
    lastDelayTime: number,
    inputDelayInterval: number,
    w: number
    h: number
    // mode: Modes
    // actionButtonName: string
    actionDisabled: boolean
    working: boolean
    info: string
    infoColour: "inherit" | "primary" | "secondary"
    lastInfo: number
    useCamera: boolean
}

export class ScannerComponent extends React.Component<ScannerProps, ScannerState> {
    private apiService: ApiService
    private readonly NO_SCAN: string = "Nothing Scanned"
    private readonly SCAN_DELAY: number = 250
    private readonly DEFAULT_INFO: string = 'Double click on added rows to open in eLab'
    private readonly CACHE_KEY_SCAN: string = "scanner/scans"
    private readonly CACHE_KEY_INPUT_DELAY: string = "scanner/input_delay"
    private readonly DEFAULT_INPUT_DELAY = 450
    private readonly MIN_DELAY = 1
    private readonly MAX_DELAY = 10000

    constructor(props: ScannerProps) {
        super(props)
        this.apiService = props.elabService
        this.state = {
            scans: new Map(),
            selectedScanIDs: [],
            lastID: -1,
            cardBorderColour: 'transparent',
            lastScanTime: 0,
            lastBarInputTime: 0,
            lastDelayTime: 0,
            inputDelayInterval: this.DEFAULT_INPUT_DELAY,
            w: 300,
            h: 300,
            info: this.DEFAULT_INFO,
            infoColour: 'inherit',
            lastInfo: 0,
            // mode: Modes.ELAB,
            // actionButtonName: 'Open',
            actionDisabled: true,
            working: false,
            useCamera: false,
        }
    }

    public componentDidMount() {
        Promise.all([
            this.apiService.GetCache(this.CACHE_KEY_SCAN),
            this.apiService.GetCache(this.CACHE_KEY_INPUT_DELAY)
        ]).then(([scan_cache, input_delay]: any[]) => {
            let i = 0
            scan_cache = scan_cache? scan_cache : []
            let cachedScans = scan_cache.reduce((map: Map<number, ScanInfo>, x: any) => {
                const [_, info] = x;
                info.id = i;
                map.set(i, info)
                i++;
                return map;
            }, new Map<number, ScanInfo>());

            const [w, h] = [window.innerWidth, window.innerHeight]
            const l = w < h ? w : h
            let [nw, nh] = [w, h]
            if (l < this.state.w) {
                nw = w/10
                nh = h/100
                // ???
            }

            this.setState({
                scans: cachedScans,
                lastID: i,
                inputDelayInterval: input_delay? input_delay : this.DEFAULT_INPUT_DELAY,
            })

        })
    }

    private onScan(code: string) {
        if (code.trim() === "") return

        const newscans = this.state.scans
        return new Promise<void>((resolve, reject) => {
            this.setState({
                cardBorderColour: this.props.theme.palette.primary.main,
                lastScanTime: Date.now(),
                working: true,
            }, () => resolve());

            const DELAY = this.SCAN_DELAY+50
            const setcol = (col: any, t: number) => {
                return new Promise<void>((r, j) => {
                    setTimeout(() => {
                        const lastT = this.state.lastScanTime
                        if (Date.now() - lastT >= DELAY) {
                            this.setState({
                                cardBorderColour: col
                            });
                        }
                        r();
                    }, t);
                })
            }

            
            setcol('transparent', DELAY+50)
                // .then(() => setcol(this.props.theme.palette.primary.main, 60))
                // .then(() => setcol('transparent', 500))

        }).then(() => {
            const ID = this.state.lastID+1

            const searchCache = (): Promise<ScanInfo|undefined> => {
                let foundScan: ScanInfo | null = null
                for (let [id, info] of newscans) {
                    if (info.barcode === code) {
                        foundScan = info
                        newscans.delete(id)
                        break
                    }
                }
                return Promise.resolve(foundScan? foundScan : undefined)
            }

            const searchELab = (): Promise<ScanInfo|undefined> => {
                return this.apiService.BarcodeLookup([code]).then((results) => {
                    const remote = Object.keys(results).filter((c) => c === code)
                    const result = remote.length > 0 ? results[remote[0]] : null
                    if (result) {
                        const newinfo: ScanInfo = {
                            barcode: code,
                            id: ID,
                            info: result.name,
                            type: ScanType.EXISTING,
                            raw: result,
                        }
                        return newinfo
                    }
                })
            }

            const methods = [searchCache, searchELab]

            const attempt = (i: number) => {
                return methods[i]()
            }

            const attemptAll = (i: number): Promise<ScanInfo> => {
                return attempt(i).then((result) => {
                    if (result) {
                        return result
                    } else if (i+1 < methods.length) {
                        return attemptAll(i+1)
                    } else {
                        const unk: ScanInfo = {
                            barcode: code,
                            id: ID,
                            info: "Unknown",
                            type: ScanType.UNK,
                            raw: {},
                        }
                        return unk
                    }
                })
            }
            return attemptAll(0)
        }).then((newinfo: ScanInfo) => {
            newscans.set(newinfo.id, newinfo)
            this.setState({
                scans: newscans,
                working: false,
                lastID: Math.max(newinfo.id, this.state.lastID),
            })
        }).then(() => {
            return this.cacheScans()
        }).then(() => {
            return this.updateInfo()
        })
    }

    private updateInfo() {
        return Promise.resolve();
        // currently not used
        // for future feedback of actions
    }

    private updateCanAct() {
        const selected = this.state.selectedScanIDs
        const scans = this.state.scans
        let canAct: boolean = false

        canAct = selected
        .map((i) => scans.get(Number(i)))
        .reduce((p: boolean, c) => p || c?.type === ScanType.UNK, false)

        this.setState({
            actionDisabled: !canAct
        })
    }

    private tryNavigateRow(row: GridRowParams) {
        const scans = this.state.scans
        const info = scans.get(Number(row.id))
        if (info?.type === ScanType.EXISTING && !!info?.raw?.link) {
            window.open(info.raw.link, "_blank")
        } else {
            const DELAY = 3000
            this.setState({
                info: `${info?.barcode} not in eLab!`,
                infoColour: 'secondary',
                lastInfo: Date.now(),
            })
            setTimeout(() => {
                const lastT = this.state.lastInfo
                if (Date.now() - lastT >= DELAY) {
                    this.setState({
                        info: this.DEFAULT_INFO,
                        infoColour: 'inherit'
                    })
                }
            }, DELAY);
        }
    }

    private onAct() {
        const barcodes: string[] = this.state.selectedScanIDs
            .map((selected) => this.state.scans.get(Number(selected)))
            .filter((info) => !!info?.barcode && info?.type == ScanType.UNK)
            .map((info) => !!info ? info.barcode : "") // nulls should have been filtered out...
        this.setState({working: true})
        this.apiService.AddMmapSample(barcodes).then((r) => {
            const prevInfos = this.state.scans
            const newInfos = new Map<number, ScanInfo>()
            prevInfos.forEach((info: ScanInfo, i: number) => {
                if (info.barcode in r) {
                    const returnedData = r[info.barcode]
                    if (returnedData.Code == 200) {
                        info.type = ScanType.EXISTING
                        info.info = Object.entries(returnedData).filter(([k, val]) => {
                            return !(k === 'Code' || k === 'Type')
                        }).map(([k, val]) => {
                            return val
                        }).join(", ")
                        info.raw = returnedData
                    } else {
                        info.info = returnedData.Code === 404? "MMAP didn't recognize barcode" : returnedData.Error
                        info.raw = returnedData
                    }
                    newInfos.set(i, info)
                } else {
                    newInfos.set(i, info)
                }
            })

            this.setState({
                scans: newInfos,
                working: false
            })

            return this.cacheScans()
        })
    }

    private onDeleteSelected() {
        const selected = new Set(this.state.selectedScanIDs)
        const scans = this.state.scans
        for (let selected of this.state.selectedScanIDs) {
            scans.delete(Number(selected))
        }
        this.setState({
            scans: scans
        }, () => this.updateInfo().then(() => {
            this.cacheScans()
        }))
    }

    private onToClipboard() {
        const rows: any[] = [...this.state.scans.values()].filter((scanInfo) => {
            return this.state.selectedScanIDs.includes(scanInfo.id)
        })
        if (rows.length === 0) return
        let headers = [
            "barcode", "name", "sampleType", "collectionDate", "shippingCondition", "samplePreservationMethodology", "depth", "link"
        ]
        const headersKnownSet = headers.reduce((p, h) => p.add(h), new Set<string>())
        const headersSet = new Set<string>()
        const newRows: any[] = []
        for (let i=0; i<rows.length; i++) {
            let row: any = rows[i];
            let originalBarcode = row.barcode
            row = row.raw
            let filterFn;
            let newRow: any = {}
            if (!!row.barcode) {
                filterFn = (k: any) => ['barcode', 'name', 'sampleType', 'link'].includes(k)
                newRow.sampleType = row.sampleType.name
                newRow.barcode = row.altID? row.altID : row.barcode
            } else {
                newRow.barcode = originalBarcode
                filterFn = (k: any) => !(['Code', 'Type'].includes(k))
            }
            
            for (let k of Object.keys(row).filter(filterFn)) {
                if (!headersKnownSet.has(k)) headersSet.add(k)
                newRow[k] = row[k]
            }
            newRows[i] = row
        }

        headers = headers.concat(Array.from(headersSet))
        const table = newRows.reduce((p, row: any) => {
            let line = headers.map((val: string, i) => {
                return row[val]
            })
            return `${p}\n${line.join('\t')}`
        }, headers.map((h) => h.toUpperCase()).join("\t"))
        navigator.clipboard.writeText(table)
    }

    private cacheScans() {
        return this.apiService.SetCache(this.CACHE_KEY_SCAN, Array.from(this.state.scans))
    }

    private onBarcodeChange(e: any) {
        const delayInterval = this.state.inputDelayInterval
        const newScan = e.target.value
        this.setState({
            lastBarInputTime: Date.now()
        }, () => {
            setTimeout(() => {
                if (Date.now() - this.state.lastBarInputTime >= delayInterval) {
                    this.onScan(newScan)
                    e.target.value = ''
                }
            }, delayInterval+50);
        })
    }

    private onSetInputDelay(e: any) {
        const save = () => {
            this.apiService.SetCache(this.CACHE_KEY_INPUT_DELAY, this.state.inputDelayInterval)
        }

        if (this.state.inputDelayInterval < this.MIN_DELAY ||
            this.state.inputDelayInterval > this.MAX_DELAY) {
                this.setState({
                    inputDelayInterval: this.DEFAULT_INPUT_DELAY
                }, save)
        } else {
            const val = +e.target.value
            this.setState({
                inputDelayInterval: val+1
            }, () => {this.setState({
                inputDelayInterval: val
            }, save)})
        }
    }

    render(): JSX.Element {
        const outerStyle: React.CSSProperties = {
            marginTop: '5vh',
            justifyContent: 'center',
            alignItems: 'center',
            alignContent: 'center',
            // border: '1px solid orange'
        }

        const cardStyle: React.CSSProperties = {
            // border: '1px solid green',
            width: '90%',
            padding: '2em 0 2em 0',
            border: '5px solid',
            borderColor: this.state.cardBorderColour,
        }
        const buttonStyle: React.CSSProperties = {
            margin: '1em 1em 0 1em',
            // width: '6em',
        }

        const makeScanner = () => {
            return <BarcodeScannerComponent
                delay={this.SCAN_DELAY}
                width={this.state.w}
                height={this.state.h}
                facingMode="environment"
                onUpdate={(err, result) => {
                    if (result) {
                        this.onScan(result.getText());
                    }
                }}
            />
        }

        return (
            <Grid container justifyContent='center' style={outerStyle}>
                <Card style={cardStyle}>
                    <Grid container direction="column" spacing={0}>
                        <Grid item>
                            <Typography variant="h5" component="h2" align="center" gutterBottom={false} style={{}}>
                                Scanner
                            </Typography>
                        </Grid>
                        <Grid item>
                            <Container style={{
                                // margin: '-3em 0 -3em 0',
                            }}>
                                {this.state.useCamera? makeScanner() : ""}
                            </Container>
                        </Grid>
                        <Grid item>
                            <TextField
                                    label="Enter Barcode Here"
                                    variant="outlined"
                                    style={{ width: '15em', margin: '1em' }}
                                    // onChange={handleChange}
                                    onChange={(e) => { this.onBarcodeChange(e) }}
                                    autoFocus
                                >
                            </TextField>
                            <TextField
                                    label="Delay (ms)"
                                    type="number"
                                    variant="outlined"
                                    style={{ width: '8em', margin: '1em' }}
                                    // onChange={handleChange}
                                    onChange={(e) => {this.setState({
                                        inputDelayInterval: +e.target.value
                                    })}}
                                    value={this.state.inputDelayInterval}
                                    error={this.state.inputDelayInterval < this.MIN_DELAY ||
                                         this.state.inputDelayInterval > this.MAX_DELAY}
                                    helperText={this.state.inputDelayInterval < this.MIN_DELAY ||
                                        this.state.inputDelayInterval > this.MAX_DELAY ? `valid range is ${this.MIN_DELAY} to ${this.MAX_DELAY}`: ""}
                                    onBlur={(e) => {this.onSetInputDelay(e)}}
                                >
                            </TextField>
                            <Button
                                variant="contained"
                                color="primary"
                                style={{ height: '4em', marginTop: '1.1em', marginLeft: '1em'}}
                                onClick={() => { this.setState({
                                    useCamera: !this.state.useCamera
                                })}}
                            >
                                Toggle Camera
                            </Button>
                        </Grid>
                        <Grid item>
                            <Typography
                                color={this.state.infoColour}
                                style={{
                                    marginBottom: '0.4em'
                                }}>
                                {this.state.info}
                            </Typography>
                        </Grid>
                        <Grid item>
                            <Container style={{
                                // margin: '-3em 0 -3em 0',
                                // height: '48em'
                            }}>
                                <DataGrid
                                    rows={[...this.state.scans.values()].map((o: ScanInfo) => {
                                        let row: any = o
                                        if (o.type == ScanType.UNK) {
                                            row.inElab = !!o.raw?.Code ? '❌' : ''
                                        } else {
                                            row.inElab = o.type == ScanType.EXISTING ? '✔' : ''
                                        }
                                        return row
                                    }).reverse()}
                                    columns={[
                                        // { field: 'disabled', hide: true },
                                        { field: 'id', headerName: 'ID', hide: true },
                                        { field: 'barcode', headerName: 'Barcode', width: 200, sortable: false },
                                        { field: 'inElab', headerName: 'Added?', width: 85, sortable: false },
                                        { field: 'info', headerName: 'Info', width: 700, sortable: false },
                                        // { field: 'addText', headerName: 'Additional Text', width: 600, sortable: false },
                                    ]}
                                    rowsPerPageOptions={[100]}
                                    onPageSizeChange={() => {}}
                                    // isRowSelectable={(params: GridRowParams) => !params.row.disabled}
                                    onSelectionModelChange={(ids: GridSelectionModel) => {
                                        this.setState({
                                            selectedScanIDs: ids,
                                        }, () => this.updateCanAct())
                                    }}
                                    onRowDoubleClick={(row) => this.tryNavigateRow(row)}
                                    disableSelectionOnClick
                                    checkboxSelection={true}
                                    disableColumnMenu
                                    disableColumnFilter
                                    disableColumnSelector
                                    style={{
                                            opacity: this.state.working? 0.25: 1,
                                            minHeight: `${12+this.state.scans.size*4}em`,
                                            maxHeight: '48em'
                                    }}
                                />
                            </Container>
                        </Grid>
                        <Grid item>
                            <Button
                                variant="contained"
                                color="secondary"
                                style={buttonStyle}
                                onClick={() => this.onDeleteSelected()}
                            >
                                Remove Selected
                            </Button>
                            <Button
                                variant="contained"
                                color="primary"
                                style={buttonStyle}
                                disabled={this.state.actionDisabled}
                                onClick={()=> this.onAct()}
                            >
                                {/* {this.state.actionButtonName} */}
                                Confirm Recieve
                                <Fade in={this.state.working} style={{position: 'absolute'}}>
                                    <CircularProgress size={30}/>
                                </Fade>
                            </Button>
                            <Button
                                variant="contained"
                                color="primary"
                                style={buttonStyle}
                                // style={{ marginTop: '1em' }}
                                onClick={() => { this.onToClipboard() }}
                            >
                                Copy to Clipboard
                            </Button>
                        </Grid>
                    </Grid>
                </Card >
            </Grid >
        )
    }
}