const React = require('react')

// 1. 監聽全域的遊戲回應事件
window.addEventListener('game.response', (e) => {
    const { path, body, postBody } = e.detail

    // 你的後端接收 API 網址 (請自行替換)
    const targetUrl = 'http://localhost:9223/webhook/kancolle'

    // 過濾掉不必要的靜態資源，只抓取 /kcsapi/ 開頭的遊戲數據
    if (path && (path.startsWith('/kcsapi/') || path.includes('kcs2/resources/map'))) {
        console.log(`[轉發器] 偵測到 API: ${path}`)

        fetch(targetUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                path: path,         // 例如 "/kcsapi/api_port/port"
                request: postBody,  // 玩家發送給伺服器的參數
                response: body,     // 伺服器回傳的 JSON 數據
                timestamp: Date.now()
            })
        })
            .then(res => console.log(`[轉發器] ${path} 轉發成功`))
            .catch(err => console.error(`[轉發器] 轉發失敗:`, err))
    }
})

// 2. 導出介面 (改用純 JS 寫法，避免 JSX 造成 SyntaxError)
module.exports = {
    reactClass: class ForwarderPlugin extends React.Component {
        render() {
            return React.createElement(
                'div',
                { style: { padding: '15px' } },
                React.createElement('h3', null, 'API 轉發插件已啟用'),
                React.createElement('p', null, '正在背景側錄 /kcsapi/ 流量並轉發中...')
            )
        }
    }
}