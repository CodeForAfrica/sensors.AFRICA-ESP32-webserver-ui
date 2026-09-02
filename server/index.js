// Demo server for sensors-webserver-pages
import express from 'express';
import multer from 'multer';
import path, { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import process from 'node:process';

// Get the current file path and directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = process.env.PORT || 3030;
const HOST = '0.0.0.0';
// Directory containing compiled static frontend assets
const DIST_DIR = path.join(__dirname, '../dist');
// Base directory for downloadable sensor log files
const DEMO_FILES_ROOT = path.join(__dirname, 'demo-files');

// Temporary storage paths for device settings and sensor logs
const CONFIG_FILE = path.join('/tmp', 'device-config.json');
const DATA_FILE = path.join('/tmp', 'sensor-data.json');

// CONSTANTS & MOCK DATA
const DEFAULT_CONFIG = {
  ssid: 'Home WiFi',
  wifiPwd: 'password123',
  apn: 'internet',
  simPin: '1234',
  powerSaver: true,
  stagingUrl: 'https://demo-sensor-data-staging-api.vercel.app/v1/push-sensor-data',
  productionUrl: 'https://demo-sensor-data-production-api.vercel.app/v1/push-sensor-data',
  isLive: false,
  // Home Assistant MQTT configuration
  haEnabled: 0,
  haMqttBroker: '',
  haMqttPort: 1883,
  haMqttUsername: '',
  haMqttPassword: '',
  haDeviceName: '',
};

const DEMO_FILE_TREE = {
  SENSORSDATA: {
    '1970': { 'JAN.csv': 'file' },
    '2019': { 'NOV.csv': 'file' },
    '2026': {
      'JAN.csv': 'file',
      'FEB.csv': 'file',
      'MAR.csv': 'file',
    },
    'failed_send_payloads.txt': 'file',
  },
};

// HELPER FUNCTIONS
/**
 * Safely reads and parses a JSON file. If it doesn't exist, initializes it with fallback data.
 * @param {string} filePath - Absolute path to the file.
 * @param {Object|Array} fallback - Default data structures (e.g., {} or []).
 */
function readJsonFile(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(fallback, null, 2));
      return fallback;
    }
    const raw = fs.readFileSync(filePath, { encoding: 'utf8' });
    return JSON.parse(raw || JSON.stringify(fallback));
  } catch (err) {
    console.error(`Error reading file at ${filePath}:`, err);
    return fallback;
  }
}

/**
 * Safely serializes and saves data to a JSON file.
 * @param {string} filePath - Absolute path to the file.
 * @param {Object|Array} data - The data payload to save.
 */
function writeJsonFile(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error(`Error writing file at ${filePath}:`, err);
  }
}

// MIDDLEWARE SETUP
const app = express();
// Multer configuration for handling file uploads (e.g., Firmware OTA)
const upload = multer({ dest: '/tmp' });

console.log('Starting demo server...');
console.log(`Serving static files from: ${DIST_DIR}`);

// Serve static frontend files
app.use(express.static(DIST_DIR));

// ROUTES

// ==============
// UTILITY ROUTES
// ==============

// Health check endpoint
app.get('/ping', (_req, res) => {
  res.send('pong');
});

// Toggle between production and staging API URLs
app.post('/switch-mode', express.json(), (req, res) => {
  const { isLive } = req.body;
  const currentConfig = readJsonFile(CONFIG_FILE, DEFAULT_CONFIG);

  currentConfig.isLive = isLive;
  writeJsonFile(CONFIG_FILE, currentConfig);

  res.json({
    status: 'success',
    isLive: currentConfig.isLive,
    activeUrl: isLive ? currentConfig.productionUrl : currentConfig.stagingUrl
  });
});

// Endpoint for the demo server to ingest and store payload data
app.post('/v1/push-sensor-data', express.json(), (req, res) => {
  console.log('Sensor data received:', JSON.stringify(req.body, null, 2));

  const { software_version, sensordatavalues } = req.body;
  if (typeof software_version !== 'string' || !Array.isArray(sensordatavalues)) {
    return res.status(400).json({
      status: 'error',
      message: 'Invalid payload. Expected software_version and sensordatavalues array.',
    });
  }

  const existingData = readJsonFile(DATA_FILE, []);
  existingData.push({ software_version, sensordatavalues });
  writeJsonFile(DATA_FILE, existingData);

  return res.status(200).json({
    status: 'success',
    message: 'Sensor data saved',
    receivedAt: new Date().toISOString(),
  });
});

// Endpoint for the demo server to get all stored sensor data
app.get('/v1/get-sensor-data', (_req, res) => {
  const data = readJsonFile(DATA_FILE, []);
  res.json(data);
});

// =====================================
// ACTUAL ESP32 ASYNCWEBSERVER ENDPOINTS
// =====================================

// Returns the device identifier string
app.get('/device-id', (_req, res) => {
  res.type('text/plain').send('sensor‑ABC123');
});

// Returns current Real-time sensor readings
app.get('/sensor-data', (_req, res) => {
  res.json({
    DHT: { temperature: 22.5, humidity: 60 },
    PM: { 'PM1': 11, 'PM2.5': 20, 'PM10': 30 },
  });
});

// Returns the config page (frontend asset)
app.get('/config', (_req, res) => {
  res.sendFile(path.join(DIST_DIR, 'config.html'));
});

// Returns diagnostic info about GSM and WiFi connectivity
app.get('/device-details', (_req, res) => {
  res.json({
    gsm: {
      'Network Name': 'TelcoX',
      'Signal Strength': -72,
      'IMEI': '356789012345678',
      'Model': 'EC200U',
      'Firmware': 'EG91R9M0A03',
      "SIM CCID": '8914800000123456789',
    },
    wifi: {
      'SSID': 'Home WiFi',
      "BSSID": '00:11:22:33:44:55',
      'Signal Strength': -45,
      "IP Address": '192.168.1.100',
      'Encryption Type': 'WPA2',
    },
  });
});

// Returns list of discovered WiFi networks
app.get('/available-hotspots', (_req, res) => {
  res.json({
    'Home WiFi': { rssi: -45, encType: 'WPA2' },
    'Office WiFi': { rssi: -60, encType: 'WPA3' },
    'Coffee Shop': { rssi: -70, encType: 'Open' },
  });
});

// Filesystem traversal
app.get('/list-files', (_req, res) => {
  res.json(DEMO_FILE_TREE);
});

/**
 * Downloads a specific file from the server's filesystem.
 * Implements directory traversal protection.
 */
app.get('/download', (req, res) => {
  const requestedFile = req.query.file;
  if (typeof requestedFile !== 'string' || !requestedFile) {
    return res.status(400).json({ error: 'Missing file query parameter' });
  }

  const normalized = path.posix.normalize(requestedFile);
  const relativePath = normalized.replace(/^\/+/, '');
  if (!relativePath || relativePath.includes('..')) {
    return res.status(400).json({ error: 'Invalid file path' });
  }

  const absolutePath = path.resolve(DEMO_FILES_ROOT, relativePath);
  const rootWithSep = DEMO_FILES_ROOT.endsWith(path.sep) ? DEMO_FILES_ROOT : `${DEMO_FILES_ROOT}${path.sep}`;

  // Validate that the requested file exists within the allowed root directory
  if (!absolutePath.startsWith(rootWithSep)) {
    return res.status(400).json({ error: 'Invalid file path' });
  }

  return res.download(absolutePath, path.basename(absolutePath), (err) => {
    if (err && !res.headersSent) {
      if (err.code === 'ENOENT') return res.status(404).json({ error: 'File not found' });
      res.status(500).json({ error: 'Download failed' });
    }
  });
});

// Configuration management
app.get('/device-config.json', (_req, res) => {
  const currentConfig = readJsonFile(CONFIG_FILE, DEFAULT_CONFIG);
  res.json(currentConfig);
});

// Partial update of device configuration settings
app.post('/save-config', express.json(), (req, res) => {
  console.log('Received config data:', req.body);
  const currentConfig = readJsonFile(CONFIG_FILE, DEFAULT_CONFIG);

  const validUpdates = Object.fromEntries(
    Object.entries(req.body).filter(([_, value]) => value !== undefined)
  );

  const updatedConfig = { ...currentConfig, ...validUpdates };
  writeJsonFile(CONFIG_FILE, updatedConfig);

  res.json({ status: 'Config received and saved' });
});

// Firmware upload endpoint
app.post('/ota_upload', upload.single('firmware'), (req, res) => {
  console.log('Received OTA upload:', req.file);
  res.json({ status: 'success', message: 'Firmware uploaded (demo)' });
});

console.log("env: ", process.env.NODE_ENV);

// Start the server only if not in production mode
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, HOST, () => {
    console.log(`Demo server running at http://${HOST}:${PORT}`);
  });
}

export default app;
