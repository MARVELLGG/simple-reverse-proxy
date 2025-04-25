const router = require("express").Router();
const fetch = require("node-fetch");
const https = require("https");
const os = require("os");
const zlib = require("zlib");

// Disable SSL verify (for internal use only)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

// In-memory cache
const responseCache = new Map();
const CACHE_EXPIRATION = 30 * 60 * 1000; // 30 minutes

const blacklist = [
    "ezdekauti8338.xml", "dongoautis333.xml", "sigmabangget.xml",
    "mangeak9449.xml", "netrohtf99.xml", "gtps777.xml",
    "gtp2929.xml", "gtps3333.xml"
];

// Memory checker
const checkMemoryUsage = () => {
    const total = os.totalmem();
    const free = os.freemem();
    const usedPercent = ((total - free) / total) * 100;

    console.log(`Memory usage: ${usedPercent.toFixed(2)}%`);
    if (usedPercent > 80) {
        console.log("High memory usage, clearing cache...");
        responseCache.clear();
    }
};

// Clean expired cache
setInterval(() => {
    const now = Date.now();
    for (const [key, value] of responseCache.entries()) {
        if (now > value.expiry) responseCache.delete(key);
    }
}, 5 * 60 * 1000);

// Proxy handler
router.get("/:ip/cache/*", async (req, res, next) => {
    if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(req.params.ip)) return next();

    const fullUrl = req.originalUrl;
    const cacheKey = `${req.method}:${fullUrl}`;
    const isBlacklisted = blacklist.some(item => fullUrl.includes(item));
    if (isBlacklisted) {
        console.log("Blocked:", fullUrl);
        return res.status(403).send("Forbidden");
    }

    try {
        checkMemoryUsage();

        // Serve cache
        const now = Date.now();
        const cached = responseCache.get(cacheKey);
        if (cached && now < cached.expiry) {
            console.log("Cache HIT:", cacheKey);
            res.status(cached.status);
            for (const [key, value] of Object.entries(cached.headers)) {
                res.setHeader(key, value);
            }
            return res.send(cached.body);
        }

        // Clean headers
        delete req.headers["content-length"];
        delete req.headers["transfer-encoding"];
        req.headers["host"] = "www.growtopia1.com";

        const agent = new https.Agent({ rejectUnauthorized: false });

        const fetchOptions = {
            method: req.method,
            headers: req.headers,
            agent: agent,
            timeout: 10000 // 10s timeout
        };

        if (req.method === "POST" || req.method === "PUT") {
            let bodyData = '';
            for await (const chunk of req) bodyData += chunk;
            fetchOptions.body = bodyData;
        }

        const response = await fetch("https:/" + fullUrl, fetchOptions);

        // Set headers
        const headers = {};
        response.headers.forEach((value, key) => {
            if (!["content-length", "transfer-encoding"].includes(key.toLowerCase())) {
                headers[key] = value;
                res.setHeader(key, value);
            }
        });

        res.status(response.status);
        const buffer = await response.buffer();

        // Optional: auto gzip compress if client accepts it
        if (req.headers["accept-encoding"]?.includes("gzip")) {
            res.setHeader("Content-Encoding", "gzip");
            zlib.gzip(buffer, (err, zipped) => {
                if (!err) res.send(zipped);
                else res.send(buffer);
            });
        } else {
            res.send(buffer);
        }

        // Cache only if 200 OK and small file (e.g., < 500 KB)
        if (response.status === 200 && buffer.length < 512000) {
            responseCache.set(cacheKey, {
                status: response.status,
                headers,
                body: buffer,
                expiry: Date.now() + CACHE_EXPIRATION
            });
        }

    } catch (err) {
        console.error("Proxy Error:", err.message);
        res.status(500).send("Internal Server Error");
    }
});

module.exports = router;
