const React = require('react')

// =====================================================================
// Helper: Dynamically resolve the target URL using poi's config manager
// =====================================================================
const getTargetUrl = () => {
    // Default to 9223 if no port is configured in poi settings yet
    const port = (window.config) ? window.config.get('plugin.forwarder.port', 9223) : 9223
    return `http://localhost:${port}/webhook/kancolle`
}

// =====================================================================
// Track 1: Handle standard KCSAPI (Preserve full payload/body)
// =====================================================================
if (!window.hasKancolleResponseListener) {
    window.addEventListener('game.response', (e) => {
        const { path, body, postBody } = e.detail

        if (path && path.startsWith('/kcsapi/')) {
            const url = getTargetUrl()
            fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    path: path,
                    request: postBody,
                    response: body,
                    stage: 'response_received',
                    timestamp: Date.now()
                })
            }).catch(() => { }) // Mute errors to prevent console spam when backend is offline
        }
    })
    window.hasKancolleResponseListener = true
}

// =====================================================================
// Track 2: Handle Map Resources (Capture URL immediately, bypass cache)
// =====================================================================
const registerMapInterceptor = () => {
    try {
        const { remote } = require('electron')
        const session = remote.getCurrentWindow().webContents.session

        // Remove existing listener (if any) to prevent duplication during hot-reloads or config updates
        session.webRequest.onBeforeRequest({ urls: ['*://*/kcs2/resources/map/*'] }, null)

        // Register the optimized core network interceptor with the latest dynamic URL config
        session.webRequest.onBeforeRequest({ urls: ['*://*/kcs2/resources/map/*'] }, (details, callback) => {
            const url = details.url
            console.log(`[Electron core catched] MAP URL: ${url}`)

            const targetUrl = getTargetUrl()
            fetch(targetUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    path: details.url,
                    stage: 'going_to_send',
                    timestamp: Date.now()
                })
            }).catch(() => { }) // Mute errors

            callback({ cancel: false })
        })
    } catch (e) {
        // Silently fail if Electron remote context is unavailable
    }
}

// Run once on initial plugin load
registerMapInterceptor()

// =====================================================================
// 3. Plugin Interface Export (Vanilla JS style with Settings UI)
// =====================================================================
module.exports = {
    reactClass: class ForwarderPlugin extends React.Component {
        constructor(props) {
            super(props)
            // Load initial port from config or fallback to 9223
            const initialPort = (window.config) ? window.config.get('plugin.forwarder.port', 9223) : 9223
            this.state = {
                port: initialPort
            }
        }

        handlePortChange = (e) => {
            const newPort = parseInt(e.target.value, 10) || ''
            this.setState({ port: newPort })

            // Save configuration directly to poi's global config system
            if (window.config && newPort) {
                window.config.set('plugin.forwarder.port', newPort)

                // Re-register Electron interceptor to apply the new Port instantly
                registerMapInterceptor()
            }
        }

        render() {
            return React.createElement(
                'div',
                { style: { padding: '15px', fontFamily: 'sans-serif' } },

                // Header
                React.createElement('h3', { style: { margin: '0 0 10px 0' } }, 'KanColle Dual-Track Forwarder'),

                // Status Indicators
                React.createElement('p', { style: { margin: '5px 0', fontSize: '13px' } }, '● KCSAPI: Full payload forwarding active'),
                React.createElement('p', { style: { margin: '5px 0 15px 0', fontSize: '13px' } }, '● Map Resources: Real-time URL tracking active'),

                // Divider line
                React.createElement('hr', { style: { border: '0', borderTop: '1px solid #ccc', margin: '15px 0' } }),

                // Settings Section
                React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } },
                    React.createElement('label', { style: { fontWeight: 'bold', fontSize: '12px' } }, 'Target Webhook Port:'),
                    React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' } },
                        React.createElement('span', { style: { fontSize: '13px', color: '#888' } }, 'http://localhost:'),
                        React.createElement('input', {
                            type: 'number',
                            value: this.state.port,
                            onChange: this.handlePortChange,
                            min: 1024,
                            max: 65535,
                            style: {
                                width: '90px',
                                padding: '5px',
                                fontSize: '13px',
                                borderRadius: '4px',
                                border: '1px solid #555',
                                backgroundColor: '#222',
                                color: '#fff'
                            }
                        }),
                        React.createElement('span', { style: { fontSize: '13px', color: '#888' } }, '/webhook/kancolle')
                    ),
                    React.createElement('p', { style: { fontSize: '11px', color: '#999', margin: '5px 0 0 0' } },
                        '* Changes are saved and applied automatically in real time (Default: 9223).'
                    )
                )
            )
        }
    }
}