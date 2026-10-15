# AgriSmart AI — endpoint contracts

Every endpoint is a backend function invoked from the front end as
`base44.functions.invoke("<name>", payload)`, or over HTTPS from a device for
`ingestReading`. Responses are JSON. Validation happens on the server; the browser's checks
are convenience only.

Field-source vocabulary used below: **M** measured · **R** rule-engine output ·
**P** model prediction · **S** simulated · **E** user-entered.

---

## `recommendCrop`

Scores 17 field crops against soil and climate values.

**Request**

```json
{
  "farm_id": "6acc6cf1e1713c1f247a56d8",
  "nitrogen_kg_ha": 95, "phosphorus_kg_ha": 48, "potassium_kg_ha": 72,
  "ph": 6.8, "temperature_c": 27, "humidity_percent": 62, "rainfall_mm": 85,
  "season": "rabi", "location": "Nashik", "inputs_source": "soil_sample"
}
```

| Field | Type | Unit | Range | Source |
| --- | --- | --- | --- | --- |
| `nitrogen_kg_ha` | number | kg/ha | 0–400 | M or E |
| `phosphorus_kg_ha` | number | kg/ha | 0–300 | M or E |
| `potassium_kg_ha` | number | kg/ha | 0–500 | M or E |
| `ph` | number | pH | 3–10 | M or E |
| `temperature_c` | number | °C | −10–60 | M or E |
| `humidity_percent` | number | % | 0–100 | M or E |
| `rainfall_mm` | number | mm | 0–5000 | M or E |
| `season` | string | — | `kharif`/`rabi`/`zaid`/`perennial` | E |
| `farm_id` | string | — | optional; storing the result needs it | — |
| `climate_source` | string | — | `user_entered`/`live_weather` | E or live weather |

`climate_source: "live_weather"` records that temperature and humidity were filled from the
live weather feed for the farm. Rainfall is always a season total the farmer enters: the
live panel's recent and forecast rain is context, not that value.

**Responses**

- `200` `{status:"ok", model_id:"agrismart-suitability-rules-v1", method, limitations, explanation, top:{crop,score,supports,limiting}, ranked:[6], inputs, saved_recommendation_id, save_warning}`
  - `top_score` is a **0–100 fit against published requirement ranges — not a probability of success**.
- `400` `{status:"validation_error", errors:[…]}` — one message per invalid field.
- `500` `{status:"error", error}`.

---

## `analyzePlantDisease`

Analyses one uploaded photo. The image must already be stored privately; the function signs
it server-side for the model.

**Request** `{ "farm_id", "farm_name", "crop_name", "plant_type", "image_uri", "notes" }`
(`image_uri` and `plant_type` required; `image_uri` is the private file uri returned by
`UploadPrivateFile`.)

**Responses**

- `200` `{status:"ok", analysis_id, outcome, outcome_note, image_quality, identified_plant, predicted_condition, confidence_percent, observations, recommended_actions[], model_id:"platform-vision-model", analysis_method, limitations}`
  - `outcome` = `conclusive` | `inconclusive` | `unsupported`. It is forced to
    `inconclusive` when photo quality is *poor* or the plant is not identifiable, to
    `unsupported` when the visible plant is not the selected one, and to `inconclusive`
    when confidence is below 60. `predicted_condition` is empty unless the outcome is
    `conclusive`.
- `400` missing image or plant selection.
- `500` the stored image could not be opened.
- `502` the vision model could not be reached — **no substitute result is returned.**

The response never contains a chemical or pesticide dose, by design.

---

## `assistantChat`

Answers a farming question, grounded in the selected farm's records.

**Request** `{ "conversation_id", "farm_id", "message" }` (`message` ≤ 2000 characters).

**Context assembled server-side** (never from the client): farm profile, up to 6 crop
records, latest soil sample, latest reading per sensor type with age and source, the last
irrigation decision, the last 3 photo analyses, plus the previous 8 messages of the
conversation.

**Responses**

- `200` `{status:"ok", conversation_id, reply, model_id, context_used, message_id, sources_note}`
  - `sources_note` states plainly that no trusted documents were retrieved.
- `400` empty or oversized question.
- `502` `{status:"provider_error", error, conversation_id}` — the failure is also stored as
  a message with `response_source:"error"` so it is visible in the transcript.
- `500`.

Both the question and the answer are stored as `AssistantMessage` records.

---

## `simulateSensors`

Generates a plausible, clearly labelled simulated series for a farm's registered devices.

**Request** `{ "farm_id", "device_id?", "hours": 24, "interval_minutes": 60 }`
(`hours` 1–72, `interval_minutes` ≥ 15, at most 500 readings stored per call.)

**Responses**

- `200` `{status:"ok", created, devices[], hours, interval_minutes, points_per_sensor, model_id:"agrismart-iot-simulator-v1", label, source:"simulated"}`
  - every stored reading carries `source:"simulated"` and the label text.
- `400` no farm / no devices / devices with no supported sensor types.
- `404` farm not found · `500`.

---

## `ingestReading` (device ingestion)

Called by a physical node over HTTPS. The device holds no user session; it presents a shared
token that exists only as a server-side secret.

**Request**

```json
{
  "device_token": "<IOT_INGEST_TOKEN>",
  "device_id": "AGRI-NODE-01",
  "sensor_type": "soil_moisture",
  "value": 41.5,
  "recorded_at": "2026-10-12T06:30:00Z"
}
```

| Sensor type | Unit | Valid range |
| --- | --- | --- |
| `soil_moisture` | percent | 0–100 |
| `air_temperature` | celsius | −10–60 |
| `soil_temperature` | celsius | 0–60 |
| `air_humidity` | percent | 0–100 |
| `light_intensity` | lux | 0–120 000 |

**Responses**

- `200` `{status:"accepted", reading_id, device_id, farm_id, sensor_type, unit, source:"device_ingest"}`
- `401` missing or wrong token.
- `503` `configuration_missing` — no `IOT_INGEST_TOKEN` secret is set.
- `404` unknown device (the device must be registered first).
- `422` value outside the range for that sensor, or a sensor type the device is not
  registered for.
- `400` malformed payload / invalid `recorded_at` · `500`.

---

## `irrigationRecommend`

Transparent threshold decision. Never actuates anything.

**Request** `{ "farm_id", "crop_id?", "soil_moisture_percent?", "rain_forecast_mm?" }`

Rainfall resolution: a `rain_forecast_mm` you pass is used as-is and labelled
`Entered by hand, not a live feed`. When it is omitted, the live forecast for the farm's
location is read (MET Norway) and the decision states the provider and the place; if the
provider cannot be reached the record says no forecast was available rather than assuming
zero.

Soil-moisture resolution order: the value you passed → the newest `soil_moisture` sensor
reading → the newest soil sample with a moisture value. Threshold resolution order: your
`IrrigationRule` for that crop → the built-in default for that crop → the generic default.

**Decision logic** (recorded as `rule_version: agrismart-irrigation-rules-v1`)

1. No usable moisture value → `insufficient_data`, no instruction.
2. Reading older than the freshness limit (`stale`) → `insufficient_data`, no instruction.
3. Growth stage `flowering` or `fruiting` raises the minimum by 5 points.
4. Expected rain over the next 24 hours (live forecast, or the figure you passed) ≥
   `rain_skip_mm` → `wait`.
5. Moisture below `minimum − critical_offset` → `irrigate_now` (and one critical alert).
6. Below the minimum → `irrigate_soon`.
7. Below the target → `monitor`. Otherwise → `wait`.

**Responses**

- `200` `{status:"ok", farm_name, crop_name, growth_stage, decision, urgency, data_freshness, reading_age_minutes, soil_moisture_percent, soil_moisture_source, threshold_percent, rain_forecast_mm, forecast_kind, forecast_source, reason, rule_version, method, limitations, alert_id, record}`
  - `decision` = `irrigate_now` | `irrigate_soon` | `monitor` | `wait` | `insufficient_data`
  - `forecast_kind` = `live` | `hand` | `none` — where the rainfall figure came from;
    `forecast_source` spells it out with the provider, place and fetch time.
  - `reason` always states the numbers and the rule that produced the decision.
- `400` no farm, or no active crop on the farm.
- `404` the `crop_id` supplied does not exist (the app never silently assesses a different
  crop).
- `500`.

---

## `farmWeather`

Live conditions and the rainfall forecast for one farm, read on demand from MET Norway's
public location forecast API (no API key). The farm's village or district is resolved to
coordinates first, and the point that was actually used is reported back.

**Request** `{ "farm_id" }` or `{ "location", "region" }`

**Responses**

- `200` `{status:"ok", provider:{id:"met-no", label, attribution}, place:{name, region, country, latitude, longitude, matched_on, query}, current:{temperature_c, humidity_percent, wind_kmh, at}, rain:{next_24h_mm, next_72h_mm}, updated_at, fetched_at, method, limitations}`
  - `matched_on` = `farm location` | `region only`. `region only` means the village name was
    not found and the district centre was used instead — the screen says so.
  - Every value is **model output for the nearest forecast grid cell**, never a measurement
    taken in the field. `updated_at` is the provider's model run time.
- `400` the farm has no village or district recorded.
- `404` the farm was not found, or no place matched the name.
- `502` the provider could not be reached — **no figure is substituted.**

The same read updates the `weather_provider` integration row, so Settings reports what the
provider actually answered.

---

## `checkDeviceHealth`

Detects stale readings and silent devices; raises at most one open alert per device, and
re-marks device status.

**Request** `{ "farm_id?" }` (omit to check every device).

**Responses** `200` `{status:"ok", checked, stale_minutes:360, stale:[{device_id, farm_name, last_reading_at, age_minutes}], alerts_created, message}`
· `200` `{status:"no_devices", checked:0, message}` · `500`.

Alert text states the reading's age against the freshness limit and that the value is not a
current field condition.

---

## Error shape

Every endpoint returns `{ "status": "error", "error": "<safe message>" }` with an
appropriate HTTP status on unexpected failure. Messages are safe to display: they describe
the cause without exposing credentials or internals.