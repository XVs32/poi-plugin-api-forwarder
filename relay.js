const http = require('http')

const RELAY_HTML = `<meta charset="utf-8"><script>
const q=[];let busy=false;
new EventSource('/events').onmessage=async e=>{
  q.push(JSON.parse(e.data)); if(busy)return; busy=true;
  while(q.length){const m=q.shift();
    await fetch(m.path,{method:'POST',
      headers:{'Content-Type':'application/x-www-form-urlencoded'},
      body:m.post}).then(r=>r.text()).catch(()=>{});}
  busy=false;};
</script>`

let server = null
const clients = new Set()
const pending = new Map()

const stop = () => {
    for (const c of clients) c.end()
    clients.clear()
    pending.clear()
    if (server) { server.close(); server = null }
}

const start = (port) => {
    stop()
    server = http.createServer((req, res) => {
        const path = req.url.split('?')[0]
        if (path === '/relay.html') {
            res.setHeader('content-type', 'text/html; charset=utf-8')
            return res.end(RELAY_HTML)
        }
        if (path === '/events') {
            res.writeHead(200, { 'content-type': 'text/event-stream' })
            clients.add(res)
            req.on('close', () => clients.delete(res))
            return
        }
        if (path.startsWith('/kcsapi/')) {
            req.resume()
            res.setHeader('content-type', 'text/plain; charset=utf-8')
            return res.end((pending.get(path) || []).shift() || '')
        }
        res.end()
    })
    server.on('error', (e) => console.error('[relay]', e.message))  // port 被佔用時不要讓 plugin 崩潰
    server.listen(port, '127.0.0.1')
}

const forward = (path, body, postBody) => {
    if (clients.size === 0) return
    if (!pending.has(path)) pending.set(path, [])
    pending.get(path).push('svdata=' + JSON.stringify({ api_result: 1, api_result_msg: '成功', api_data: body }))
    const msg = 'data: ' + JSON.stringify({
        path,
        post: new URLSearchParams(postBody).toString(),
    }) + '\n\n'
    for (const c of clients) c.write(msg)
}

module.exports = { start, stop, forward }