// Shared agronomic reference data and rule engines used by several AgriSmart backend functions.
//
// HONESTY CONTRACT
// - CROP_PROFILES are "typical published requirement ranges" for common Indian field crops,
//   compiled for this demo's suitability scoring. They are extension-style guidance, not a
//   trained model, and they carry NO accuracy claim.
// - Irrigation logic is a transparent threshold rule engine. It is not machine learning.
// - Simulation helpers produce clearly labelled demo data. They never fabricate real sensor
//   measurements and never replace a failed real service call.

/* ------------------------------------------------------------------ *
 * Crop suitability scoring (rule-based)
 * ------------------------------------------------------------------ */

export const CROP_MODEL_ID = "agrismart-suitability-rules-v1";
export const CROP_MODEL_METHOD =
  "Rule-based suitability scoring: each input is compared with typical published requirement ranges for the crop and combined into a weighted 0-100 fit score. This is not machine learning and the score is not a probability of success.";
export const CROP_MODEL_LIMITATIONS =
  "Scores only compare seven soil and climate inputs against typical published ranges. They do not know your variety, irrigation availability, market prices, pest history, drainage or soil structure. Treat the ranking as a shortlist to discuss with your local agricultural extension officer or Krishi Vigyan Kendra.";

const FACTOR_WEIGHTS = { n: 0.12, p: 0.1, k: 0.1, ph: 0.18, temp: 0.18, humidity: 0.14, rainfall: 0.18 };
const FACTOR_LABELS = {
  n: "nitrogen",
  p: "phosphorus",
  k: "potassium",
  ph: "soil pH",
  temp: "temperature",
  humidity: "humidity",
  rainfall: "rainfall",
};

export const CROP_PROFILES = [
  { crop: "Rice", n: [80, 120], p: [40, 60], k: [40, 60], ph: [5.5, 7.0], temp: [22, 32], humidity: [70, 90], rainfall: [150, 300], seasons: ["kharif"] },
  { crop: "Wheat", n: [100, 150], p: [50, 70], k: [40, 60], ph: [6.0, 7.5], temp: [12, 25], humidity: [50, 70], rainfall: [40, 100], seasons: ["rabi"] },
  { crop: "Maize", n: [100, 150], p: [50, 70], k: [40, 60], ph: [5.5, 7.5], temp: [20, 32], humidity: [55, 80], rainfall: [60, 150], seasons: ["kharif", "rabi"] },
  { crop: "Cotton", n: [100, 150], p: [50, 70], k: [50, 80], ph: [6.0, 8.0], temp: [24, 35], humidity: [50, 75], rainfall: [50, 120], seasons: ["kharif"] },
  { crop: "Sugarcane", n: [150, 250], p: [60, 90], k: [80, 120], ph: [6.0, 7.5], temp: [24, 35], humidity: [65, 85], rainfall: [100, 200], seasons: ["perennial"] },
  { crop: "Groundnut", n: [20, 40], p: [40, 60], k: [30, 50], ph: [6.0, 7.5], temp: [25, 33], humidity: [55, 75], rainfall: [50, 120], seasons: ["kharif", "zaid"] },
  { crop: "Soybean", n: [25, 50], p: [40, 70], k: [40, 60], ph: [6.0, 7.5], temp: [22, 32], humidity: [60, 80], rainfall: [60, 150], seasons: ["kharif"] },
  { crop: "Chickpea", n: [20, 40], p: [40, 60], k: [30, 50], ph: [6.0, 8.0], temp: [15, 28], humidity: [45, 65], rainfall: [30, 80], seasons: ["rabi"] },
  { crop: "Pigeonpea", n: [20, 45], p: [40, 60], k: [30, 50], ph: [6.0, 7.5], temp: [24, 33], humidity: [55, 75], rainfall: [60, 150], seasons: ["kharif"] },
  { crop: "Pearl millet", n: [40, 80], p: [30, 50], k: [20, 40], ph: [6.5, 8.5], temp: [25, 35], humidity: [40, 65], rainfall: [30, 90], seasons: ["kharif", "zaid"] },
  { crop: "Sorghum", n: [60, 100], p: [30, 60], k: [30, 50], ph: [6.0, 8.0], temp: [25, 35], humidity: [45, 70], rainfall: [40, 100], seasons: ["kharif", "rabi"] },
  { crop: "Finger millet", n: [40, 60], p: [25, 45], k: [25, 40], ph: [5.5, 7.5], temp: [20, 30], humidity: [55, 75], rainfall: [60, 120], seasons: ["kharif"] },
  { crop: "Mustard", n: [60, 100], p: [30, 50], k: [30, 50], ph: [6.0, 7.5], temp: [10, 25], humidity: [45, 65], rainfall: [30, 70], seasons: ["rabi"] },
  { crop: "Potato", n: [100, 150], p: [50, 80], k: [100, 150], ph: [5.5, 6.5], temp: [15, 25], humidity: [60, 80], rainfall: [40, 100], seasons: ["rabi"] },
  { crop: "Tomato", n: [80, 120], p: [50, 80], k: [60, 100], ph: [6.0, 7.0], temp: [20, 30], humidity: [60, 80], rainfall: [40, 100], seasons: ["kharif", "rabi", "zaid"] },
  { crop: "Banana", n: [150, 250], p: [60, 100], k: [150, 250], ph: [6.0, 7.5], temp: [24, 35], humidity: [65, 85], rainfall: [100, 200], seasons: ["perennial"] },
  { crop: "Chilli", n: [60, 100], p: [40, 60], k: [50, 80], ph: [6.0, 7.0], temp: [20, 32], humidity: [55, 75], rainfall: [50, 120], seasons: ["kharif", "rabi"] },
];

export const CROP_NAMES = CROP_PROFILES.map((p) => p.crop);

const RECOMMEND_FIELDS = [
  { key: "nitrogen_kg_ha", label: "Nitrogen (kg/ha)", min: 0, max: 400 },
  { key: "phosphorus_kg_ha", label: "Phosphorus (kg/ha)", min: 0, max: 300 },
  { key: "potassium_kg_ha", label: "Potassium (kg/ha)", min: 0, max: 500 },
  { key: "ph", label: "Soil pH", min: 3, max: 10 },
  { key: "temperature_c", label: "Temperature (°C)", min: -10, max: 60 },
  { key: "humidity_percent", label: "Humidity (%)", min: 0, max: 100 },
  { key: "rainfall_mm", label: "Rainfall (mm)", min: 0, max: 5000 },
];

export function validateRecommendInput(payload) {
  const body = payload || {};
  const errors = [];
  const input = {
    farm_id: body.farm_id || null,
    season: typeof body.season === "string" ? body.season.toLowerCase() : "",
    location: typeof body.location === "string" ? body.location : "",
    inputs_source: body.inputs_source === "soil_sample" ? "soil_sample" : "user_entered",
    climate_source: body.climate_source === "live_weather" ? "live_weather" : "user_entered",
  };
  for (const field of RECOMMEND_FIELDS) {
    const raw = body[field.key];
    const value = typeof raw === "string" && raw.trim() !== "" ? Number(raw) : raw;
    if (typeof value !== "number" || !Number.isFinite(value)) {
      errors.push(`${field.label} is required and must be a number`);
      continue;
    }
    if (value < field.min || value > field.max) {
      errors.push(`${field.label} must be between ${field.min} and ${field.max} (received ${value})`);
      continue;
    }
    input[field.key] = value;
  }
  return { errors, input };
}

function factorFit(value, range) {
  const [min, max] = range;
  if (value >= min && value <= max) return 1;
  const span = Math.max(max - min, 0.001);
  const distance = value < min ? min - value : value - max;
  return Math.max(0, 1 - distance / (span * 0.75));
}

export function scoreCrops(input) {
  const values = {
    n: input.nitrogen_kg_ha,
    p: input.phosphorus_kg_ha,
    k: input.potassium_kg_ha,
    ph: input.ph,
    temp: input.temperature_c,
    humidity: input.humidity_percent,
    rainfall: input.rainfall_mm,
  };
  const season = input.season || "";

  const ranked = CROP_PROFILES.map((profile) => {
    let weighted = 0;
    const strong = [];
    const limiting = [];
    for (const key of Object.keys(FACTOR_WEIGHTS)) {
      const fit = factorFit(values[key], profile[key]);
      weighted += fit * FACTOR_WEIGHTS[key];
      if (fit >= 0.85) strong.push(`${FACTOR_LABELS[key]} is in the usual range`);
      else if (fit < 0.7) {
        limiting.push(
          `${FACTOR_LABELS[key]} is outside the usual ${profile[key][0]}-${profile[key][1]} range (yours: ${values[key]})`
        );
      }
    }
    let score = weighted * 100;
    if (season && profile.seasons && !profile.seasons.includes(season)) {
      score *= 0.8;
      limiting.push(`not a typical ${season} crop`);
    }
    return {
      crop: profile.crop,
      score: Math.round(score * 10) / 10,
      supports: strong.slice(0, 3).join("; ") || "partial fit only",
      limiting: limiting.slice(0, 4).join("; ") || "no major limiting factor found",
    };
  }).sort((a, b) => b.score - a.score);

  const top = ranked[0];
  const second = ranked[1];
  const explanation =
    `Top match: ${top.crop} with a fit score of ${top.score} of 100. ` +
    (second ? `${second.crop} scored ${second.score}. ` : "") +
    `Each of your seven inputs was compared with typical published requirement ranges, weighted with soil pH, temperature and rainfall carrying the most influence.` +
    (season ? ` Season filter applied: ${season}.` : "");

  return { ranked, explanation };
}

/* ------------------------------------------------------------------ *
 * Crops, irrigation thresholds and freshness
 * ------------------------------------------------------------------ */

const CROP_ALIASES = {
  paddy: "rice",
  "pearl millet": "pearlmillet",
  bajra: "pearlmillet",
  jowar: "sorghum",
  ragi: "fingermillet",
  tur: "pigeonpea",
  arhar: "pigeonpea",
  chilly: "chilli",
  "ground nut": "groundnut",
};

export function cropKey(name) {
  const base = String(name || "").trim().toLowerCase();
  const resolved = CROP_ALIASES[base] || base;
  return resolved.replace(/[^a-z]/g, "");
}

const DEFAULT_IRRIGATION_RULES = {
  default: { min_soil_moisture_percent: 40, target_soil_moisture_percent: 60, rain_skip_mm: 15, critical_offset_percent: 8, max_reading_age_minutes: 360 },
  rice: { min_soil_moisture_percent: 55, target_soil_moisture_percent: 75, rain_skip_mm: 25 },
  wheat: { min_soil_moisture_percent: 40, target_soil_moisture_percent: 60, rain_skip_mm: 15 },
  maize: { min_soil_moisture_percent: 40, target_soil_moisture_percent: 60, rain_skip_mm: 15 },
  cotton: { min_soil_moisture_percent: 35, target_soil_moisture_percent: 55, rain_skip_mm: 15 },
  sugarcane: { min_soil_moisture_percent: 45, target_soil_moisture_percent: 65, rain_skip_mm: 20 },
  groundnut: { min_soil_moisture_percent: 35, target_soil_moisture_percent: 55, rain_skip_mm: 15 },
  soybean: { min_soil_moisture_percent: 40, target_soil_moisture_percent: 60, rain_skip_mm: 15 },
  chickpea: { min_soil_moisture_percent: 30, target_soil_moisture_percent: 50, rain_skip_mm: 12 },
  pigeonpea: { min_soil_moisture_percent: 30, target_soil_moisture_percent: 50, rain_skip_mm: 12 },
  pearlmillet: { min_soil_moisture_percent: 25, target_soil_moisture_percent: 45, rain_skip_mm: 10 },
  sorghum: { min_soil_moisture_percent: 28, target_soil_moisture_percent: 48, rain_skip_mm: 12 },
  fingermillet: { min_soil_moisture_percent: 30, target_soil_moisture_percent: 50, rain_skip_mm: 12 },
  mustard: { min_soil_moisture_percent: 30, target_soil_moisture_percent: 50, rain_skip_mm: 12 },
  potato: { min_soil_moisture_percent: 45, target_soil_moisture_percent: 65, rain_skip_mm: 15 },
  tomato: { min_soil_moisture_percent: 45, target_soil_moisture_percent: 65, rain_skip_mm: 15 },
  banana: { min_soil_moisture_percent: 50, target_soil_moisture_percent: 70, rain_skip_mm: 18 },
  chilli: { min_soil_moisture_percent: 40, target_soil_moisture_percent: 60, rain_skip_mm: 15 },
};

export const IRRIGATION_RULE_VERSION = "agrismart-irrigation-rules-v1";
export const IRRIGATION_METHOD =
  "Transparent threshold rule engine comparing the latest soil moisture with a crop-specific minimum, adjusted for growth stage and expected rainfall. This is not machine learning.";
export const IRRIGATION_LIMITATIONS =
  "The engine uses one soil-moisture value and simple thresholds. It does not model soil water-holding capacity, root depth, salinity, evaporation or field variability. It never switches a pump on: any physical actuation must be done by an authorised operator with a manual override.";

export function getRuleForCrop(cropName, override) {
  const key = cropKey(cropName);
  return {
    ...DEFAULT_IRRIGATION_RULES.default,
    ...(DEFAULT_IRRIGATION_RULES[key] || {}),
    ...(override || {}),
  };
}

export function readingAgeMinutes(iso, now) {
  const at = new Date(iso).getTime();
  const reference = (now ? new Date(now) : new Date()).getTime();
  if (!Number.isFinite(at)) return null;
  return Math.max(0, Math.round((reference - at) / 60000));
}

export function freshnessOf(ageMinutes, maxAgeMinutes) {
  if (ageMinutes === null || ageMinutes === undefined) return "stale";
  if (ageMinutes <= 120) return "fresh";
  if (ageMinutes <= (maxAgeMinutes || 360)) return "aging";
  return "stale";
}

/* ------------------------------------------------------------------ *
 * Sensors: units, valid ranges, simulated series
 * ------------------------------------------------------------------ */

export const SENSOR_DEFS = {
  soil_moisture: { label: "Soil moisture", unit: "percent", min: 0, max: 100 },
  air_temperature: { label: "Air temperature", unit: "celsius", min: -10, max: 60 },
  air_humidity: { label: "Air humidity", unit: "percent", min: 0, max: 100 },
  soil_temperature: { label: "Soil temperature", unit: "celsius", min: 0, max: 60 },
  light_intensity: { label: "Light intensity", unit: "lux", min: 0, max: 120000 },
};

export const SENSOR_TYPES = Object.keys(SENSOR_DEFS);

export const SIM_MODEL_ID = "agrismart-iot-simulator-v1";
export const SIM_LABEL =
  "Simulated series generated by the AgriSmart demo sensor simulator. These values are demo data, not measurements from a physical sensor.";

export function validateSensorValue(sensorType, value) {
  const def = SENSOR_DEFS[sensorType];
  if (!def) return { ok: false, error: `Unsupported sensor type "${sensorType}"` };
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return { ok: false, error: "value must be a finite number" };
  }
  if (value < def.min || value > def.max) {
    return {
      ok: false,
      error: `${def.label} value ${value} is outside the valid ${def.min}-${def.max} ${def.unit} range`,
    };
  }
  return { ok: true };
}

export function round1(n) {
  return Math.round(n * 10) / 10;
}

// Entity list calls made with an options object return a page ({ items, has_more }),
// while some paths return a bare array. Normalise both.
export function asList(result) {
  if (Array.isArray(result)) return result;
  if (result && Array.isArray(result.items)) return result.items;
  return [];
}

function seededRandom(seedText) {
  let h = 2166136261;
  for (let i = 0; i < seedText.length; i++) {
    h ^= seedText.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let state = h >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MOISTURE_BASE = {
  drip: 48,
  sprinkler: 46,
  canal: 44,
  borewell: 42,
  rainfed: 36,
  other: 40,
};

export function simulateSensorSeries({ sensor_type, hours = 24, interval_minutes = 60, now = new Date(), soil_type = "loamy", irrigation_type = "rainfed", device_id = "device" }) {
  const def = SENSOR_DEFS[sensor_type];
  if (!def) return [];
  const points = Math.max(2, Math.floor((hours * 60) / interval_minutes));
  const random = seededRandom(`${device_id}-${sensor_type}-${soil_type}-${irrigation_type}`);
  const base = MOISTURE_BASE[irrigation_type] || MOISTURE_BASE.other;
  const series = [];
  for (let i = points - 1; i >= 0; i--) {
    const at = new Date(now.getTime() - i * interval_minutes * 60000);
    const hourOfDay = at.getHours() + at.getMinutes() / 60;
    let value;
    if (sensor_type === "soil_moisture") {
      const drying = ((points - 1 - i) / points) * 13;
      value = base - drying + (random() - 0.5) * 2.6;
    } else if (sensor_type === "air_temperature") {
      value = 26 + 7 * Math.sin(((hourOfDay - 9) / 24) * 2 * Math.PI) + (random() - 0.5) * 1.6;
    } else if (sensor_type === "soil_temperature") {
      value = 25 + 4 * Math.sin(((hourOfDay - 11) / 24) * 2 * Math.PI) + (random() - 0.5) * 0.8;
    } else if (sensor_type === "air_humidity") {
      value = 62 - 14 * Math.sin(((hourOfDay - 9) / 24) * 2 * Math.PI) + (random() - 0.5) * 4;
    } else {
      const daylight = Math.max(0, Math.sin(((hourOfDay - 6) / 12) * Math.PI));
      value = daylight * 78000 + (random() - 0.5) * 2500;
    }
    series.push({
      value: round1(Math.min(def.max, Math.max(def.min, value))),
      recorded_at: at.toISOString(),
    });
  }
  return series;
}