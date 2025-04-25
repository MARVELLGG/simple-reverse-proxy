const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

// Import Main App
const app = require(path.join(__dirname, 'MainApp.js'));

// Middleware global compression
app.use(compression());

// Middleware rate limit (100 req per 10 detik per IP)
const limiter = rateLimit({
    windowMs: 10 * 1000, // 10 detik
    max: 100, // Maks 100 request
    message: "Too many requests, please slow down."
});
app.use(limiter);

// HTTPS Options
const httpsOptions = {
    key: fs.readFileSync(path.join(__dirname, 'certs', '_.growplus.asia', 'cdn.growplus.asia-key.pem')),
    cert: fs.readFileSync(path.join(__dirname, 'certs', '_.growplus.asia', 'cdn.growplus.asia-crt.pem')),
    ca: fs.readFileSync(path.join(__dirname, 'certs', '_.growplus.asia', 'cdn.growplus.asia-chain.pem')),
    // Waktu koneksi
    requestTimeout: 30000, // 30 detik
    keepAliveTimeout: 10000 // 10 detik
};

// Start HTTPS Server on Port 444
const httpsServer = https.createServer(httpsOptions, app);

httpsServer.listen(444, () => {
    console.log("HTTPS Server with SNI support started on port 444");
});

httpsServer.on('tlsClientError', (err, socket) => {
    console.error("HTTPS TLS Client Error:", err.message);
    socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
});

httpsServer.on('clientError', (err, socket) => {
    console.error("HTTPS Client Error:", err.message);
    socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
});

httpsServer.on('error', (err) => {
    console.error("HTTPS Server Error:", err.message);
});

// HTTP fallback for debugging or local
const httpPort = 88;
http.createServer(app).listen(httpPort, () => {
    console.log(`HTTP Server started on port ${httpPort}`);
});
