# Webserver API Documentation

This document describes the HTTP endpoints exposed by the ESP32 Quectel firmware webserver.
Most resources are served from the LittleFS filesystem and some operations operate on the SD card.

---

## Static Assets

| Method | Path                      | Description                                                      |
| ------ | ------------------------- | ---------------------------------------------------------------- |
| GET    | `/`                       | Home page (`index.html`)                                         |
| GET    | `/config`                 | Configuration page. Add `?skip` to mark captive portal accessed. |
| GET    | `/device-details.html`    | Device details page                                              |
| GET    | `/ota.html`               | OTA firmware update page                                         |
| GET    | `/file-system.html`       | File viewer page                                                 |
| GET    | `/advanced-settings.html` | Advanced settings UI                                             |
| GET    | `/style.css`              | Stylesheet                                                       |
| GET    | `/style.min.css`          | Minified stylesheet                                              |
| GET    | `/script.min.js`          | Main JavaScript module                                           |
| GET    | `/images/sensor_logo.png` | Sensor logo image                                                |
| GET    | `/sensors_logo.png`       | Inline PNG asset from header                                     |
| GET    | `/icons/{name}.svg`       | Individual icon files (wifi, simcard, lock, cell_tower)          |


---

## Device & Configuration Endpoints

### `/device-id` (GET)

- **Response:** plain text containing the current device ID (e.g. `ESP32-94255ABA2010`).

### `/device-info.json` (GET)

- **Response:** JSON object from `getDeviceConfig()` containing the stored device configuration.

### `/available-hotspots` (GET)

- **Response:** JSON object mapping SSID strings to info objects:
    ```json
    {
    	"mywifi": { "rssi": -42, "encType": 3 },
    	"neighbour": { "rssi": -80, "encType": 0 }
    }
    ```

### `/save-config` (POST)

- **Payload:** JSON body representing new configuration.
- **Behavior:** validates JSON, calls `saveConfig()`, marks captive portal accessed.
- **Response:** `{ "status":"Config received" }`

**Example**

```bash
curl -X POST http://192.168.4.1/save-config \
  -H "Content-Type: application/json" \
  -d '{"wifi_ssid":"MyNet","wifi_pass":"pw","device_name":"sensor-1"}'
```

```json
{ "status": "Config received" }
```

---

## Sensor & Firmware Endpoints

### `/sensor-data` (GET)

- **Response:** JSON object obtained from `getCurrentSensorData()`:
    ```json
    { "PM": {"PM1":..,"PM2.5":..,"PM10":..}, "DHT": {"temperature":..,"humidity":..} }
    ```

**Example**

```bash
curl http://192.168.4.1/sensor-data
```

```json
{
	"PM": { "PM1": 5, "PM2.5": 12, "PM10": 18 },
	"DHT": { "temperature": 23.4, "humidity": 55 }
}
```

### `/upload-firmware` (POST)

- **Description:** used by the OTA page to upload a binary file.
- **Behavior:** stream write to LittleFS; returns status messages at start/end.
- **Response:** immediate `{"status":"Upload started"}` then `{"status":"Upload successful"}` on completion or errors.

**Example**

```bash
curl -F "firmware=@build/firmware.bin" http://192.168.4.1/upload-firmware
```

---

## File System Endpoints

### `/list-files` (GET)

- **Response:** JSON tree of files under `ROOT_DIR` on the SD card. Example:
    ```json
    {
    	"SENSORSDATA": {
    		"2026": { "JAN.csv": "file", "FEB.csv": "file" },
    		"1970": { "JAN.csv": "file" }
    	},
    	"failed_send_payloads.txt": "file"
    }
    ```

**Example**

```bash
curl http://192.168.4.1/list-files | jq
```

```json
{
  "SENSORSDATA": {"2026":{...}},
  "failed_send_payloads.txt": "file"
}
```

### `/download` (GET)

- **Parameters:** `file` (URL-encoded path relative to SD root).
- **Behavior:** decodes path, normalizes slashes, attempts several variants (with/without leading slash, prefixed by `ROOT_DIR`), serves matching file from SD with `application/octet-stream` and `Content-Disposition: attachment` header.
- **Errors:** `400` for missing/invalid path, `404` if file not found.

**Example**

```bash
curl -OJ "http://192.168.4.1/download?file=%2FSENSORSDATA%2F2026%2FMAR.csv"
```

### `/device-details` (GET)

- **Response:** JSON representation of `device_info` document, identical to `/device-info.json`

- **Response:** JSON object containing device details
```json
{
    "gsm": {
        "Network Name": "TelcoX",
        "Signal Strength": -72,
        "SIM ICCID": "8914800000123456789",
        "Model ID": "Quectel‑EG91",
        "Firmware Version": "EG91R9M0A03",
        "IMEI": "356789012345678"
    },
    "wifi": {
        "SSID": "Home WiFi",
        "Signal Strength": -45,
        "Encryption Type": "WPA2"
    }
}
```

### Captive Portal

- All unknown routes trigger a `server.onNotFound` handler:
    - If `DeviceConfigState.captivePortalAccessed` is false, the user is redirected to `/config`.
    - Otherwise responds with `404 Not found`.

---

## Notes

- The backend uses `AsyncWebServer` and LittleFS/SD;
- File paths are case-sensitive.
- Static assets are baked into the `data/` folder and uploaded via `uploadfs`.

---

_Generated  from `src/webserver/asyncserver.cpp` on 2026-03-07._
