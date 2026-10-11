const React = require('react')
const relay = require('./relay')

const getTargetUrl = () => {
    const port = window.config ? window.config.get('plugin.forwarder.port', 9223) : 9223
    return `http://localhost:${port}/webhook/kancolle`
}

const relayEnabled = () => window.config.get('plugin.forwarder.relayEnabled', false)
const relayPort = () => window.config.get('plugin.forwarder.relayPort', 9224)

// ---- Track 1: KCSAPI ----
const onResponse = (e) => {
    const { path, body, postBody } = e.detail
    if (!path || !path.startsWith('/kcsapi/')) return

    fetch(getTargetUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            path,
            request: postBody,
            response: body,
            stage: 'response_received',
            timestamp: Date.now()
        })
    }).catch(() => { })

    try { if (relayEnabled()) relay.forward(path, body, postBody) }
    catch (err) { console.error('[relay]', err) }
}

// ---- Track 2: Map resources ----
const MAP_FILTER = { urls: ['*://*/kcs2/resources/map/*'] }

const getSession = () => {
    try {
        const { remote } = require('electron')
        return remote.getCurrentWindow().webContents.session
    } catch (e) { return null }
}

const registerMapInterceptor = () => {
    const session = getSession()
    if (!session) return
    session.webRequest.onBeforeRequest(MAP_FILTER, null)
    session.webRequest.onBeforeRequest(MAP_FILTER, (details, callback) => {
        fetch(getTargetUrl(), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                path: details.url,
                stage: 'going_to_send',
                timestamp: Date.now()
            })
        }).catch(() => { })
        callback({ cancel: false })
    })
}

const unregisterMapInterceptor = () => {
    const session = getSession()
    if (session) session.webRequest.onBeforeRequest(MAP_FILTER, null)
}

// ---- Settings UI ----
class ForwarderPlugin extends React.Component {
    constructor(props) {
        super(props)
        this.state = {
            port: window.config.get('plugin.forwarder.port', 9223),
            relayEnabled: relayEnabled(),
            relayPort: relayPort(),
        }
    }

    handlePortChange = (e) => {
        const newPort = parseInt(e.target.value, 10) || ''
        this.setState({ port: newPort })
        if (newPort) window.config.set('plugin.forwarder.port', newPort)
    }

    applyRelay = (enabled, port) => {
        window.config.set('plugin.forwarder.relayEnabled', enabled)
        window.config.set('plugin.forwarder.relayPort', port)
        relay.stop()
        if (enabled && port) relay.start(port)
    }

    handleRelayToggle = (e) => {
        const enabled = e.target.checked
        this.setState({ relayEnabled: enabled })
        this.applyRelay(enabled, this.state.relayPort)
    }

    handleRelayPortChange = (e) => {
        const p = parseInt(e.target.value, 10) || ''
        this.setState({ relayPort: p })
        if (p) this.applyRelay(this.state.relayEnabled, p)
    }

    render() {
        const h = React.createElement
        const inputStyle = {
            width: '90px', padding: '5px', fontSize: '13px', borderRadius: '4px',
            border: '1px solid #555', backgroundColor: '#222', color: '#fff'
        }
        return h('div', { style: { padding: '15px', fontFamily: 'sans-serif' } },
            h('h3', { style: { margin: '0 0 10px 0' } }, 'KanColle Dual-Track Forwarder'),
            h('p', { style: { margin: '5px 0', fontSize: '13px' } }, '● KCSAPI: Full payload forwarding active'),
            h('p', { style: { margin: '5px 0 15px 0', fontSize: '13px' } }, '● Map Resources: Real-time URL tracking active'),
            h('hr', { style: { border: '0', borderTop: '1px solid #ccc', margin: '15px 0' } }),

            h('label', { style: { fontWeight: 'bold', fontSize: '12px' } }, 'Target Webhook Port:'),
            h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px', margin: '8px 0 15px' } },
                h('span', { style: { fontSize: '13px', color: '#888' } }, 'http://localhost:'),
                h('input', { type: 'number', value: this.state.port, onChange: this.handlePortChange, min: 1024, max: 65535, style: inputStyle }),
                h('span', { style: { fontSize: '13px', color: '#888' } }, '/webhook/kancolle')
            ),

            h('hr', { style: { border: '0', borderTop: '1px solid #ccc', margin: '15px 0' } }),

            h('label', { style: { fontWeight: 'bold', fontSize: '12px', display: 'block', marginBottom: '8px' } },
                h('input', { type: 'checkbox', checked: this.state.relayEnabled, onChange: this.handleRelayToggle, style: { marginRight: '8px' } }),
                'Enable KC3 Relay'
            ),
            h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' } },
                h('span', { style: { fontSize: '13px', color: '#888' } }, 'http://127.0.0.1:'),
                h('input', { type: 'number', value: this.state.relayPort, onChange: this.handleRelayPortChange, min: 1024, max: 65535, style: inputStyle }),
                h('span', { style: { fontSize: '13px', color: '#888' } }, '/relay.html')
            )
        )
    }
}

const init = () => {
    if (window.__forwarderCleanup) window.__forwarderCleanup()

    window.addEventListener('game.response', onResponse)
    registerMapInterceptor()
    if (relayEnabled()) relay.start(relayPort())

    window.__forwarderCleanup = () => {
        window.removeEventListener('game.response', onResponse)
        unregisterMapInterceptor()
        relay.stop()
        window.__forwarderCleanup = null
    }
}
init()

// ---- Plugin interface ----
module.exports = {

    reactClass: ForwarderPlugin,
    settingsClass: ForwarderPlugin,
}