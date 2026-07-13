const React = require('react')

const TARGET_URL = 'http://localhost:9223/webhook/kancolle'

// =====================================================================
// Track 1: Handle standard KCSAPI (Preserve full payload/body)
// =====================================================================
if (!window.hasKancolleResponseListener) {
    window.addEventListener('game.response', (e) => {
        const { path, body, postBody } = e.detail

        if (path && path.startsWith('/kcsapi/')) {
            fetch(TARGET_URL, {
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
try {
    const { remote } = require('electron')
    const session = remote.getCurrentWindow().webContents.session

    // Remove existing listener (if any) to prevent duplication during hot-reloads
    session.webRequest.onBeforeRequest({ urls: ['*://*/kcs2/resources/map/*'] }, null)

    // Register the optimized core network interceptor
    session.webRequest.onBeforeRequest({ urls: ['*://*/kcs2/resources/map/*'] }, (details, callback) => {
        const url = details.url
        console.log(`[Electron core catched] MAP URL: ${url}`)
        fetch(TARGET_URL, {
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

// =====================================================================
// 3. Plugin Interface Export (Vanilla JS style for lightweight execution)
// =====================================================================
module.exports = {
    reactClass: class ForwarderPlugin extends React.Component {
        render() {
            return React.createElement(
                'div',
                { style: { padding: '15px' } },
                React.createElement('h3', null, 'KanColle Dual-Track Forwarder'),
                React.createElement('p', null, '● KCSAPI: Full payload forwarding active'),
                React.createElement('p', null, '● Map Resources: Real-time URL tracking active')
            )
        }
    }
}