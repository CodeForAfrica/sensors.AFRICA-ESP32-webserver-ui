### API & Routing
- [ ] Create a `GET /config-data` endpoint that returns current configurations as JSON.
- [ ] Create a `POST /switch-mode` endpoint to switch the active api url.
- [ ] Implement code to persist the active environment state (Staging vs Production) to non-volatile memory.

### Web Server UI & Interactivity
- [x] Add a call to request current configurations from `/config-data`.
- [x] Write logic to autofill the existing input fields with the fetched data.
- [x] Create a DOM notification banner that unhides only when valid configurations are detected on load.
- [x] Ensure input fields allow manual text overrides and send updated data via a `POST` request.

### Environment Switching ("GO LIVE") Logic
- [x] Add a visual toggle switch and button labeled "GO LIVE" to the UI.
- [x] Bind the toggle switch to trigger `POST /switch-mode` instantly when clicked.
- [ ] Write a C++ helper function `String getActiveApiUrl()` that returns the correct URL based on the environment state.
- [ ] Update the sensor data upload routine to call `getActiveApiUrl()` dynamically before every HTTP transmission.
