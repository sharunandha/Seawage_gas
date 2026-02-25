// Simple HTTP Server for Sewage Gas Dashboard
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = 8000;
const PUBLIC_DIR = __dirname;

// ThingSpeak Configuration
const THINGSPEAK_CHANNEL_ID = '3277165';
const THINGSPEAK_READ_API_KEY = 'MWUXOBPOKXDK7TI5';

const server = http.createServer((req, res) => {
    // API Proxy endpoint for ThingSpeak
    if (req.url.startsWith('/api/thingspeak')) {
        const url = `https://api.thingspeak.com/channels/${THINGSPEAK_CHANNEL_ID}/feeds.json?api_key=${THINGSPEAK_READ_API_KEY}&results=100`;
        
        console.log('📡 Fetching data from ThingSpeak...');
        
        https.get(url, (tsRes) => {
            let data = '';
            
            tsRes.on('data', (chunk) => {
                data += chunk;
            });
            
            tsRes.on('end', () => {
                console.log('✅ ThingSpeak data received');
                res.writeHead(200, { 
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                });
                res.end(data);
            });
        }).on('error', (err) => {
            console.error('❌ ThingSpeak Error:', err.message);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Failed to fetch ThingSpeak data' }));
        });
        
        return;
    }
    
    // Default to index.html for root path
    let filePath = req.url === '/' ? '/index.html' : req.url;
    filePath = path.join(PUBLIC_DIR, filePath);

    // Get file extension
    const extname = String(path.extname(filePath)).toLowerCase();
    
    // MIME types
    const mimeTypes = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.wav': 'audio/wav',
        '.mp4': 'video/mp4',
        '.woff': 'application/font-woff',
        '.ttf': 'application/font-ttf',
        '.eot': 'application/vnd.ms-fontobject',
        '.otf': 'application/font-otf',
        '.wasm': 'application/wasm'
    };

    const contentType = mimeTypes[extname] || 'application/octet-stream';

    // Check if file exists
    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/html' });
                res.end('<h1>404 - File Not Found</h1>', 'utf-8');
            } else {
                res.writeHead(500);
                res.end('Sorry, check with the site admin for error: ' + error.code + ' ..\n');
            }
        } else {
            // Success
            res.writeHead(200, { 'Content-Type': contentType, 'Access-Control-Allow-Origin': '*' });
            res.end(content, 'utf-8');
        }
    });
});

server.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║     🌐 SEWAGE GAS SAFETY DASHBOARD - SERVER RUNNING       ║
║                                                            ║
║     📱 Open your browser and go to:                        ║
║     👉 http://localhost:${PORT}                              ║
║                                                            ║
║     ✅ Server is listening on port ${PORT}                  ║
║     Press Ctrl+C to stop the server                        ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
    `);
});

process.on('SIGINT', () => {
    console.log('\n✋ Server stopped.');
    process.exit(0);
});
