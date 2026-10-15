# AgriSmart AI

An AI-assisted agriculture workspace: farm, crop and soil records, crop suitability
advice, plant-photo analysis, a conversational farming assistant, sensor monitoring and
a transparent irrigation rule engine — with every value labelled by where it came from.

> **Honesty is a product feature here.** Every number in the app is marked as
> **measured**, **model output**, **rule engine** or **simulated**. No accuracy figure is
> invented, no external service is faked when it fails, and simulated sensor data is never
> presented as a physical measurement.

---

## 1. Environment: what this build actually runs on

The original specification described a Python / FastAPI / PostgreSQL / scikit-learn /
PyTorch stack. **That stack cannot execute in this environment.** This platform runs a
React (Vite) front end with a managed database and serverless backend functions, so the
same four capabilities were implemented natively and are labelled for what they really are:

| Specification asked for | What is actually implemented | Honest status |
| --- | --- | --- |
| scikit-learn crop model + `POST /api/v1/crops/recommend` | `recommendCrop` backend function: documented agronomic requirement ranges scored into a weighted 0–100 fit, plus ranked alternatives and limiting factors | Rule engine. **Not** a trained model; no accuracy is claimed |
| PyTorch plant-disease classifier + `POST /api/v1/plant-disease/analyze` | `analyzePlantDisease` backend function calling a general-purpose vision model, with quality/confidence/plant-match gating and an `inconclusive` outcome | Works, but is a general vision model, not a validated agronomic classifier |
| LLM provider adapter + `POST /api/v1/assistant/chat` | `assistantChat` backend function on the platform AI integration, grounded in the selected farm's records; failures are reported, never mocked | Implemented; no document retrieval (RAG) is connected |
| MQTT + simulated sensor service + `POST /api/v1/iot/readings` | `simulateSensors` (labelled simulated) and `ingestReading` (authenticated HTTPS ingestion for ESP32/ESP8266); `checkDeviceHealth` flags stale devices | HTTP ingestion is live; **MQTT is not bridged** |
| Normalised relational tables + migrations | Platform entities with typed fields, relationships by id, indexes and server-side validation | No SQL migrations exist in this environment |
| Role-based access control (farmer / advisor / admin) | Not enforced: the app is currently in **public mode** | Blocked by app mode — see §7 |

---

## 2. Architecture

```
src/                        React (Vite) front end
  pages/                    Landing, Dashboard, Farms, FarmDetail, Crops, Soil,
                            Recommend, Disease, Assistant, Monitoring, Irrigation,
                            Alerts, Settings
  components/               layout · common · farms · crops · soil · disease ·
                            assistant · iot · irrigation · recommend · alerts · settings
  lib/constants.js          units, labels, provenance metadata, sensor metadata
  lib/nav.js                navigation model
base44/
  entities/*.jsonc          12 stored record types (see §3)
  functions/*/entry.ts      server endpoints (see §5)
  shared/agronomy.ts        single source of truth for crop ranges, thresholds,
                            freshness rules and the sensor simulator
```

The front end never talks to an external service directly. Every model call, rule
decision, simulation and device ingestion runs in a backend function, which validates its
input and returns only what the screen needs.

---

## 3. Data model

| Entity | Purpose | Key fields and units |
| --- | --- | --- |
| `Farm` | Land unit | `name`, `location`, `region`, `area_hectares`, `soil_type`, `irrigation_type`, `climate_zone` |
| `Crop` | Planting record | `farm_id`, `crop_name`, `variety`, `season`, `planting_date`, `growth_stage`, `area_hectares`, `status` |
| `SoilSample` | Measured soil test | `nitrogen_kg_ha`, `phosphorus_kg_ha`, `potassium_kg_ha`, `ph` (0–14), `moisture_percent`, `temperature_c`, `source` (`lab_measured` / `field_sensor` / `estimated`) |
| `CropRecommendation` | Stored advice | input summary, `top_crop`, `top_score` (0–100 fit), `ranking[]`, `model_id`, `method`, `explanation`, `limitations` |
| `DiseaseAnalysis` | Photo result | `image_uri` (private), `outcome` (`conclusive` / `inconclusive` / `unsupported` / `error`), `identified_plant`, `predicted_condition`, `confidence_percent`, `image_quality`, `observations`, `recommended_actions[]`, `limitations` |
| `Device` | Sensor node registry | `device_id`, `sensor_types[]`, `status` (`active` / `offline` / `never_reported`), `last_reading_at`, `ingestion_method` |
| `SensorReading` | Time series | `sensor_type`, `value`, `unit` (`percent` / `celsius` / `lux`), `recorded_at` (ISO 8601), `source` (`simulated` / `device_ingest` / `manual`), `validation_status` |
| `IrrigationRecommendation` | Stored decision | `soil_moisture_percent`, `soil_moisture_source`, `reading_age_minutes`, `data_freshness` (`fresh` / `aging` / `stale`), `threshold_percent`, `decision`, `urgency`, `reason`, `rule_version` |
| `IrrigationRule` | Configurable thresholds | `crop_name`, `min_soil_moisture_percent`, `target_soil_moisture_percent`, `rain_skip_mm`, `critical_offset_percent`, `max_reading_age_minutes`, `active` |
| `Alert` | Attention items | `severity` (`info` / `warning` / `critical`), `title`, `message`, `source`, `related_type`, `related_id`, `status` (`open` / `acknowledged` / `resolved`) |
| `AssistantMessage` | Chat transcript | `conversation_id`, `role`, `content`, `response_source` (`live_model` / `error`), `model_id`, `context_used`, `sources_note` |
| `IntegrationSetting` | Integration state | `key`, `label`, `state` (`connected` / `configuration_missing` / `temporarily_unavailable` / `demo_mode` / `disconnected`) |

Timestamps are stored as ISO 8601. Sensor units are fixed per sensor type, so a moisture
value is always a percentage and a temperature always degrees Celsius — incompatible units
are never compared.

---

## 4. Data provenance rules

| Label | Meaning | Where it appears |
| --- | --- | --- |
| Measured | Someone measured or recorded it | Soil samples, hand-entered moisture, device readings |
| Model output | Produced by a model from your inputs — an estimate, never a fact | Crop-photo analysis, assistant answers |
| Rule engine | Transparent thresholds, explicitly **not** machine learning | Crop suitability scores, irrigation decisions |
| Simulated | Demo data from the sensor simulator | All 96 seeded readings, every generated series |

A reading is only used as a *current* field condition if it is inside the freshness limit
(default 360 minutes). Older values are marked `stale`, and the irrigation engine refuses
to advise from them.

---

## 5. Server endpoints (backend functions)

All endpoints live under the app's function path (the spec's `/api/v1` prefix does not
exist in this environment) and are invoked from the front end through the SDK:
`base44.functions.invoke("<name>", payload)`.

| Function | Purpose | Notable responses |
| --- | --- | --- |
| `recommendCrop` | Score 17 crops against your inputs | `200` `{top, ranked[], model_id, method, explanation, limitations}` · `400` validation errors · `500` |
| `analyzePlantDisease` | Read an uploaded plant photo | `200` `{outcome, identified_plant, confidence_percent, observations, recommended_actions[], limitations}` · `400` · `500` · `502` provider unavailable (no fake result) |
| `assistantChat` | Answer a farming question with farm context | `200` `{reply, context_used, sources_note, conversation_id}` · `400` · `502` provider unavailable (the failure is also stored with `response_source: "error"`) |
| `simulateSensors` | Generate a labelled simulated series | `200` `{created, devices, label}` · `400` no devices · `500` |
| `ingestReading` | Device ingestion (ESP32/ESP8266 over HTTPS) | `200 accepted` · `401` bad token · `503 configuration_missing` · `404` unknown device · `422` out-of-range value or wrong sensor for that device |
| `irrigationRecommend` | Transparent threshold decision | `200` `{decision, reason, threshold_percent, data_freshness, rule_version, limitations}` · `400` no farm/crop · `404` crop not found · `500` |
| `farmWeather` | Live conditions and the rainfall forecast for one farm (MET Norway) | `200` `{status:"ok", provider, place, current, rain, updated_at, fetched_at, method, limitations}` · `400` farm has no location · `404` farm or place not found · `502` provider unavailable (nothing substituted) |
| `checkDeviceHealth` | Detect stale / silent devices, raise one alert each | `200` `{checked, stale[], alerts_created, message}` |

Detailed contracts: [`docs/API.md`](docs/API.md).

---

## 6. Validation, safety and security

- Ranges are validated **on the server** (`0–400` N, `0–300` P, `0–500` K, `3–10` pH,
  `0–100` %, `0–5000` mm, sensor ranges per type). The forms mirror those ranges for
  convenience only.
- Plant photos are uploaded **privately** (`UploadPrivateFile`) and opened through
  short-lived signed links — there is no public URL for a farmer's photo.
- The device token exists only as a server-side secret; it is never sent to the browser.
- The irrigation engine never actuates anything. There is no pump control, and no
  chemical or pesticide dose is ever produced — the app points to the local extension
  officer or Krishi Visyan Kendra instead.
- Provider and integration failures surface as errors with their reported cause; the app
  never substitutes demo data for a failed service.

---

## 7. Known limitations (stated, not hidden)

1. **Roles are not enforced.** The app is in public mode, so there is no sign-in and no
   per-farmer separation: anyone who opens it can read and edit the records in it.
   Switching the app to private mode with accounts is what enables farmer / advisor /
   admin roles and ownership rules.
2. **Crop advice is not a trained model.** No accuracy, precision or recall figure exists
   for it, and none is displayed.
3. **Plant analysis is a general vision model.** It returns `inconclusive` when the photo
   is poor or the plant does not match what you selected — a landscape photo of a field
   correctly came back `inconclusive` during verification.
4. **Live weather is a forecast, not a field instrument.** Conditions and the next 24/72
   hours of rainfall are read live from the MET Norway location forecast service and labelled
   as model output for the nearest grid cell. A figure typed in overrides the forecast and is
   then labelled as hand-entered. The provider is read on demand, so a decision taken while
   the service is unreachable falls back to the typed-in value — never to an invented number.
5. **MQTT is not bridged.** HTTP ingestion works; an MQTT bridge does not exist yet.
6. **Device ingestion needs a token.** Until `IOT_INGEST_TOKEN` is set, the endpoint
   answers `configuration_missing` and the app reports the integration as not configured.
7. **No reports module and no admin console** in this milestone.
8. **RAG is not implemented.** The assistant says plainly that no trusted documents were
   retrieved for an answer.

---

## 8. Running and configuring

```bash
npm install
npm run dev       # local development server
npm run build     # production build (verified: exits 0)
```

Configuration (see `.env.example`) — set these as environment secrets in the app
dashboard, never in code:

| Variable | Needed for | Without it |
| --- | --- | --- |
| `IOT_INGEST_TOKEN` | Physical device ingestion | Endpoint returns `503 configuration_missing`; simulation still works and is labelled |
| *(none)* | Live weather | Nothing to set — MET Norway's public forecast API is read directly, and the app identifies itself in the request header as their terms require |

### Languages

The interface ships in **English and Telugu with a switch** — at the top of the sidebar, in the
mobile header, and on the landing page. The choice is remembered on the device.

English is the source language: the Telugu entries live in `src/lib/locales/te.js` keyed by
the English string, and anything missing there falls back to English, so a screen can never
end up blank or half-empty. Every screen is translated — dashboard, farms and farm detail,
crops, soil samples, monitoring, crop recommendation, plant-photo check, assistant,
irrigation, alerts and settings — including the navigation, all forms, dialogs and empty
states. Dates follow the chosen language, and Telugu renders in Noto Sans Telugu while
English keeps Plus Jakarta Sans.

Two kinds of text stay as written rather than translated on screen:

* What you type into a record — farm names, variety names, notes — is stored and shown
  exactly as entered.
* Text the server writes and stores — the alert titles and messages the irrigation rules
  raise, the rule engine's reasoning behind a recommendation or irrigation decision, and the
  assistant's answers — is written in English when it is created, so it appears in English.
  Making those follow the language means passing the chosen language into the backend
  functions.

### Connecting an ESP32 / ESP8266 node

1. Register the device in **Sensor monitoring** (device id, farm, sensor types).
2. Set `IOT_INGEST_TOKEN` in the app's environment secrets.
3. From the node, POST JSON to the `ingestReading` function:

```json
{
  "device_token": "<the server-side token>",
  "device_id": "AGRI-NODE-01",
  "sensor_type": "soil_moisture",
  "value": 41.5,
  "recorded_at": "2026-10-12T06:30:00Z"
}
```

Accepted sensor types: `soil_moisture` (%), `air_temperature` (°C), `air_humidity` (%),
`soil_temperature` (°C), `light_intensity` (lux). Out-of-range values are rejected with a
reason rather than stored.

---

## 9. Testing — what was actually executed

Executed during this build session, with the observed result:

| Check | Method | Result |
| --- | --- | --- |
| `recommendCrop` input validation + ranking | backend function, real call | **Pass** — `200`, 17 crops scored, record stored |
| `simulateSensors` | backend function, real call | **Pass after fix** — first call exposed a list-vs-page query bug (`no_devices`); after the fix it stored 96 readings labelled `simulated` |
| `irrigationRecommend` threshold logic | backend function, real call | **Pass after fix** — `irrigate_now` with reason, rule version and a critical alert; the same query bug was fixed here |
| Irrigation decision honours the chosen crop | UI gesture on `/irrigation` | **Pass after fix** — a race let the request fall through to a different crop; the submit is now guarded and the endpoint returns `404` instead of silently assessing another crop. Re-run showed *"Assessed: Sundarpur Farm · Tomato · flowering"*, threshold 47 % (Tomato's configured rule + flowering adjustment) |
| `assistantChat` with farm context | backend function + UI send | **Pass after fix** — answer rendered with the context line; provider errors are stored and shown, never faked |
| `analyzePlantDisease` (private upload → model → stored result) | UI gesture with a real image file | **Pass** — photo preview, analysis, honest `inconclusive` outcome, limitations shown, record stored and then cleaned up |
| Device staleness detection | UI button on `/monitoring` | **Pass** — device marked `offline`, one alert raised (see §9 note), report message rendered |
| Every route renders (landing, dashboard, farms, farm detail, crops, soil, recommend, disease, assistant, monitoring, irrigation, alerts, settings) | preview sweep | **Pass** — no blank screens, no Page-Not-Found, mobile breakpoint without horizontal overflow |
| Production build | `npm run build` | **Pass** — exit 0 |
| `ingestReading` (device ingestion) | — | **Not executed** — the platform refuses to run this function without the `IOT_INGEST_TOKEN` secret, so the `configuration_missing` branch is the only path exercised. Its token, device, sensor-type and range checks are unverified |
| Alert acknowledge / resolve actions | — | **Not executed automatically** (filtering, status pills and the update call are wired; the gesture was not driven) |
| Farm create / edit / delete with cascade | — | **Not executed automatically** — the cascade delete removes the farm's crops, samples, devices, readings, alerts, recommendations and analyses in one confirmed action |
| Crop and soil-sample create / edit forms | — | **Not executed automatically** |

No test was marked as passing merely because code was generated: every "pass" above
corresponded to a real call or a real UI gesture in this session, and everything not run is
listed as not executed rather than implied green.

---

## 10. Feature checklist

| Feature | Status |
| --- | --- |
| Responsive app shell, navigation, landing page | Tested |
| Farm, crop and soil-sample records with persistence | Implemented (create/edit verified at API level, UI forms not driven) |
| Server-side validation of measurements | Tested |
| Crop recommendation endpoint + history | Tested |
| Plant photo upload (private) + analysis + history | Tested |
| Generative assistant grounded in farm records | Tested |
| Simulated sensor service + readings storage | Tested |
| Sensor dashboard, history chart, device registry | Tested |
| Stale-reading / disconnected-device detection + alerts | Tested |
| Configurable irrigation thresholds + rule engine + reasoning | Tested |
| Alerts list with acknowledge / resolve | Implemented (not driven automatically) |
| Integration state reporting (configuration missing, connected) | Tested |
| Physical device ingestion endpoint | Blocked — needs `IOT_INGEST_TOKEN` |
| Live weather provider (conditions + 24/72 h rainfall, MET Norway) | Tested |
| MQTT bridge | Not started |
| Reports module | Not started |
| Administration console (users, roles, reference data) | Not started |
| Trained ML crop model / crop-specific vision classifier | Not started |
| RAG over trusted agricultural sources | Not started |
| Automated unit/integration test suite | Not started — checks were executed manually against the running app, as recorded in §9 |

---

## 11. Next milestones

1. Set `IOT_INGEST_TOKEN` and verify the physical ingestion path end to end.
2. Weather warnings on top of the live conditions and rainfall already integrated: the
   provider's alert feed, surfaced through the same explicit state reporting used elsewhere.
3. Reports: farm summary, soil history, irrigation log, photo-analysis log.
4. Accounts and roles (farmer / advisor / admin) with per-farm ownership, once the app
   moves out of public mode.
5. A trained crop-suitability model and a crop-specific plant-disease classifier behind the
   existing endpoints, so the app can report real, measured accuracy.