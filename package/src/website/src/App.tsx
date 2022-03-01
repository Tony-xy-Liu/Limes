// import logo from './logo.svg';
import React from 'react';
import './App.css';
import { MuiThemeProvider, createTheme } from '@material-ui/core/styles';
import { HeaderComponent } from './components/headers/header';
import { ConcreteLoginModal } from './popups/login';
import { MainFunctionsComponent } from './components/pages/mainFunctions';
import { PrintComponent } from './components/pages/print';
import { StorageSearchComponent } from './components/pages/storageSearch';

import { AppProps, MainFunctionCardSettings } from './models/props';
import { ApiService, ApiServiceFactory } from './services/api';
import { DEBUG } from './config'
import { ScannerComponent } from './components/pages/scanner';

import Chip from '@mui/material/Chip';

const theme = createTheme({
  palette: {
    primary: {
      main: '#00abab',
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: '#d32f2f',
    },
    contrastThreshold: 3,
    tonalOffset: 0.2,
  },
});

interface AppState {
  activeComponent: any
}

export class App extends React.Component<AppProps, AppState> {
  private defaultActiveComponent: any
  private elabService: ApiService

  constructor(props: AppProps) {
    super(props)
    this.elabService = ApiServiceFactory.GetApiService()

    const makePrintComponent = () => <PrintComponent elabService={this.elabService}/>
    const makeStorageSearchComponent = () => <StorageSearchComponent elabService={this.elabService} onPrintCallback={
      (samples) => {
        this.setState({
          activeComponent: <PrintComponent elabService={this.elabService} startingBarcodes={samples}/>
        })
      }
    }/>
    const makeScannerComponent = () => <ScannerComponent elabService={this.elabService} theme={theme}/>
    const mainFunctions: MainFunctionCardSettings[] = [
      {
        name: 'Print',
        disabled: false,
        makeNextPage: makePrintComponent,
      },
      {
        name: 'Search By Storage Location',
        disabled: false,
        makeNextPage: makeStorageSearchComponent,
      },
      {
        name: 'Scanner',
        disabled: false,
        makeNextPage: makeScannerComponent,
      }
    ]
    this.defaultActiveComponent = (
      <MainFunctionsComponent
        theme={theme}
        functions={mainFunctions}
        clicked={(settings: MainFunctionCardSettings) => this.toFunctionPage(settings)}
      />)
    this.state = {
      // activeComponent: DEBUG? <PrintComponent elabService={this.elabService} startingBarcodes={[
      //   9764829,
      //   9763563,
      //   9763564,
      // ]}/>: this.defaultActiveComponent,
      activeComponent: DEBUG? makeStorageSearchComponent() : this.defaultActiveComponent,
    }
  }

  private toFunctionPage(settings: MainFunctionCardSettings) {
    if (settings && settings.makeNextPage) {
      this.setState({activeComponent: settings.makeNextPage()})
    }
  }

  render(): JSX.Element {
    const fav: any = document.getElementById("favicon");
    fav.href = '/forcefavicon'
    return (
      <MuiThemeProvider theme={theme}>
        <div className='app-container'>
        <HeaderComponent onHome={() => {this.setState({activeComponent: this.defaultActiveComponent})}}/>
        <ConcreteLoginModal elabService={this.elabService}/>
        {this.state.activeComponent}
        </div>
      </MuiThemeProvider>
    )
  }
}