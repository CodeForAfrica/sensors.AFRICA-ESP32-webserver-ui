// Demo server for sensors-webserver-pages
import express from 'express';
import multer from 'multer';
import path, { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const upload = multer({ dest: 'uploads/' });
const app = express();
const PORT = process.env.PORT || 3030;
const demoFilesRoot = path.join(__dirname, 'demo-files');
const demoFileTree = {
	SENSORSDATA: {
		'1970': {
			'JAN.csv': 'file',
		},
		'2019': {
			'NOV.csv': 'file',
		},
		'2026': {
			'JAN.csv': 'file',
			'FEB.csv': 'file',
			'MAR.csv': 'file',
		},
		'failed_send_payloads.txt': 'file',
	},
};
console.log('Starting demo server...');
console.log(`Serving static files from: ${join(__dirname, '../dist')}`);

// Serve static files from dist directory
app.use(express.static(path.join(__dirname, '../dist')));

// Demo endpoints

// GET /device-id
app.get('/device-id', (_req, res) => {
	// Returns the device ID as plain text
	res.type('text/plain').send('sensor‑ABC123');
});

// GET /list-files
app.get('/list-files', (_req, res) => {
	res.json(demoFileTree);
});

// GET /download?file=/SENSORSDATA/2026/MAR.csv
app.get('/download', (req, res) => {
	const requestedFile = req.query.file;
	if (typeof requestedFile !== 'string' || requestedFile.length === 0) {
		return res.status(400).json({ error: 'Missing file query parameter' });
	}

	const normalized = path.posix.normalize(requestedFile);
	const relativePath = normalized.replace(/^\/+/, '');
	if (!relativePath || relativePath.includes('..')) {
		return res.status(400).json({ error: 'Invalid file path' });
	}

	const absolutePath = path.resolve(demoFilesRoot, relativePath);
	const rootWithSep = demoFilesRoot.endsWith(path.sep)
		? demoFilesRoot
		: `${demoFilesRoot}${path.sep}`;
	if (!absolutePath.startsWith(rootWithSep)) {
		return res.status(400).json({ error: 'Invalid file path' });
	}

	return res.download(absolutePath, path.basename(absolutePath), (err) => {
		if (err && !res.headersSent) {
			if (err.code === 'ENOENT') {
				res.status(404).json({ error: 'File not found' });
				return;
			}
			res.status(500).json({ error: 'Download failed' });
		}
	});
});

// GET /sensor-data
app.get('/sensor-data', (_req, res) => {
	res.json({
		DHT: {
			temperature: 22.5,
			humidity: 60,
		},
		PM: {
			'PM1': 11,
			'PM2.5': 20,
			'PM10': 30,
		},
	});
});

// Single endpoint for all device details
app.get('/device-details', (_req, res) => {
	res.json({
		gsm: {
			'Network Name': 'TelcoX',
			'Signal Strength': -72,
			'SIM ICCID': '8914800000123456789',
			'Model ID': 'Quectel‑EG91',
			'Firmware Version': 'EG91R9M0A03',
			'IMEI': '356789012345678',
		},
		wifi: {
			'SSID': 'Home WiFi',
			'Signal Strength': -45,
			'Encryption Type': 'WPA2',
		},
	});
});

// available hotspots endpoint
app.get('/available-hotspots', (_req, res) => {
	res.json({
		'Home WiFi': {
			rssi: -45,
			encType: 'WPA2',
		},
		'Office WiFi': {
			rssi: -60,
			encType: 'WPA3',
		},
		'Coffee Shop': {
			rssi: -70,
			encType: 'Open',
		},
	});
});

// Save OTA upload files to a temporary directory (for demo purposes only)
app.post('/ota_upload', upload.single('firmware'), (req, res) => {
	console.log('Received OTA upload:', req.file);
	res.json({ status: 'success', message: 'Firmware uploaded (demo)' });
});

// save config endpoint
app.post('/save-config', express.json(), (req, res) => {
	console.log('Received config data:', req.body);
	res.json({ status: 'Config received' });
});

app.listen(PORT, () => {
	console.log(`Demo server running at http://localhost:${PORT}`);
});
