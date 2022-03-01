import React from 'react';
import { LoginProps } from '../models/props';
import { Modal, Grid, TextField, Button, CircularProgress, Fade, Typography, Card} from '@material-ui/core';
import { ApiService } from '../services/api';

import { DEBUG } from '../config'

interface LoginState {
    username: string
    password: string
    open: boolean
    error: boolean
    label: string
    loading: boolean
    tried: boolean
}

export abstract class LoginModal extends React.Component<LoginProps, LoginState> {
    protected passwordRef: any
    protected loginRef: any
    protected readonly defaultLabel = ""
    protected readonly elabService: ApiService

    constructor(props: LoginProps) {
        super(props)

        this.state = {
            username: "",
            password: "",
            open: true,
            error: false,
            label: this.defaultLabel,
            loading: false,
            tried: false,
        }

        this.elabService = props.elabService;
    }

    protected loginFailed(msg: string, tried: boolean=true) {
        this.setState({
            error: true,
            label: msg,
            loading: false,
            tried: tried,
        })
    }

    protected loginSuccess() {
        this.setState({ open: false, loading: false, tried: false })
    }

    protected login() {
        // console.log([this.state.username, this.state.password])
        if (this.state.tried) { return }
        this.setState({ label: '', loading: true})
        if (!(this.state.username && this.state.password)) {
            this.loginFailed('fields cannot be empty')
            return
        }

        this.elabService.Login(this.state.username, this.state.password)
            .then(([success, msg]) => {
                if (success) {
                    this.loginSuccess()
                } else {
                    this.loginFailed(msg)
                }
            }).catch(e => {
                console.error(e)
                this.loginFailed(typeof(e)==='string'? e: 'No response. Are you on the UBC network?', false)
            })
    }

    private onClose() { }

    render(): JSX.Element {
        const modalStyle: React.CSSProperties = {}
        const mainGridStyle: React.CSSProperties = {
            outline: 'transparent',
            height: '100%',
            // border: '1px solid red'
        }
        const cardStyle: React.CSSProperties = {
            outline: 'transparent',
            padding: '1em 2em 1.2em 2em', // t r b l
            width: '25em',
            // height: '20em',
        }
        const cardGridStyle: React.CSSProperties = {}
        const labelStyle: React.CSSProperties = {}
        const inputStyle: React.CSSProperties = {
            width: '100%',
            marginBottom: '1em',
            // border: '1px solid red'
        }
        const buttonStyle: React.CSSProperties = {
            width: '10em',
        }

        const textFields = [
            {
                name: "username",
                label: "Username",
                placeholder: "username",
                onchange: (e: any) => {
                    this.setState({
                        error: false,
                        tried: false,
                        username: e.target.value
                    })
                },
            },
            {
                name: "password",
                label: "Password",
                placeholder: "*****",
                type: "password",
                onchange: (e: any) => {
                    this.setState({
                        error: false,
                        tried: false,
                        password: e.target.value
                    })
                },
                onkeydown: (e: any) => { e.key === "Enter" && this.loginRef?.focus() },
            }
        ]

        return (
            <Modal open={this.state.open} onClose={this.onClose} style={modalStyle}>
                <Grid container spacing={0} direction="column" alignItems="center" justify="center" style={mainGridStyle}>
                    <Card style={cardStyle}>
                        <Grid container justify="center" direction="column" style={cardGridStyle} spacing={0}>
                            <Typography variant="h5" component="h2" align="center" style={labelStyle}>
                                Login
                            </Typography>
                            <Typography variant="subtitle1" align="center" color="error" style={labelStyle}>
                                {this.state.label}
                            </Typography>
                            <Grid item container justifyContent="center" direction="column">
                                <form>
                                    {textFields.map((f) => (
                                        <Grid item key={f.name}>
                                            <TextField
                                                label={f.label}
                                                name={f.name}
                                                placeholder={f.placeholder}
                                                style={inputStyle}
                                                type={f.type}
                                                error={this.state.error}
                                                onChange={f.onchange}
                                                onKeyDown={f.onkeydown}
                                            />
                                        </Grid>
                                    ))}
                                </form>
                            </Grid>
                            <Grid container justify="center" >
                                <Button
                                    variant="contained"
                                    color="primary"
                                    style={buttonStyle}
                                    disabled={this.state.loading}
                                    onClick={() => { this.login() }}
                                    ref={(e: any) => { this.loginRef = e }}>
                                    Login
                                    <Fade
                                        in={this.state.loading}>
                                        <CircularProgress size={20} thickness={5} style={{
                                            position: 'absolute'

                                        }}/>
                                    </Fade>
                                </Button>
                            </Grid>
                        </Grid>
                    </Card>
                </Grid>
            </Modal>
        )
    }
}

class Prod_LoginModal extends LoginModal {

}

// class Dev_LoginModal extends LoginModal {
//     constructor(props: LoginProps) {
//         super(props)

//         this.state = {
//             username: U,
//             password: P,
//             open: false,
//             error: false,
//             label: this.defaultLabel,
//             loading: false,
//             tried: false,
//         }
        
//     }
// }

// export const ConcreteLoginModal = DEBUG ? Dev_LoginModal : Prod_LoginModal
export const ConcreteLoginModal = Prod_LoginModal