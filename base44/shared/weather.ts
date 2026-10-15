// Live weather for a farm, shared by the farmWeather endpoint and the irrigation rules.
//
// HONESTY CONTRACT
// - Every value comes from a live provider request made at the moment of the call.
//   Nothing here is cached, simulated or interpolated by this app.
// - The numbers describe the nearest forecast grid cell, NOT an instrument in the farmer's
//   field, and a forecast is model output rather than a measurement.
// - A failed request is reported as a failure. It is never filled in with invented numbers.

import { round1 } from './agronomy.ts';

export const WEATHER_PROVIDER_ID = "met-no";
export const WEATHER_PROVIDER_LABEL = "MET Norway";
export const WEATHER_ATTRIBUTION = "Weather data from MET Norway (api.met.no)";

export const WEATHER_METHOD =
  "Live request to the MET Norway location forecast service, the public weather API of the Norwegian Meteorological Institute. The farm's village or district is resolved to coordinates, then current conditions and the hour-by-hour rainfall forecast are read for that point.";

export const WEATHER_LIMITATIONS =
  "These figures describe the nearest forecast grid cell, not an instrument in your field: a shower can soak one plot and miss the next inside the same cell. The forecast is model output refreshed a few times a day, so treat it as guidance for planning rather than a measurement of your land.";

const FORECAST_URL = "https://api.met.no/weatherapi/locationforecast/2.0/compact";
// MET Norway asks every client to identify itself in the User-Agent header.
const USER_AGENT = "AgriSmartAI/1.0 (farm weather integration)";
const FETCH_TIMEOUT_MS = 12000;

function clean(value) {
  return String(value === null || value === undefined ? "" : value).trim();
}

function num(value) {
  return typeof value === "number" && Number.isFinite(value) ? round1(value) : null;
}

// "Village, District" reads better to the place search than either part on its own.
export function locationQuery(location, region) {
  const place = clean(location);
  const area = clean(region);
  if (!place) return "";
  if (!area || place.toLowerCase().includes(area.toLowerCase())) return place;
  return `${place}, ${area}`;
}

async function getJson(url, headers) {
  const response = await fetch(url, { headers: headers || {}, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!response.ok) throw new Error(`the service replied ${response.status}`);
  return await response.json();
}

// Two independent place-name services, tried in order, so one of them being busy does not
// stop the lookup.
const GEOCODERS = [
  {
    url: (query) =>
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=en&format=json`,
    read: (data, query) => {
      const hit = data && Array.isArray(data.results) ? data.results[0] : null;
      if (!hit) return null;
      return {
        name: hit.name || query,
        region: hit.admin1 || "",
        country: hit.country || "",
        latitude: hit.latitude,
        longitude: hit.longitude,
      };
    },
  },
  {
    url: (query) => `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=1`,
    read: (data, query) => {
      const hit = data && Array.isArray(data.features) ? data.features[0] : null;
      const coords = hit && hit.geometry ? hit.geometry.coordinates : null;
      if (!Array.isArray(coords) || coords.length < 2) return null;
      const props = hit.properties || {};
      return {
        name: props.name || props.city || query,
        region: props.state || "",
        country: props.country || "",
        latitude: coords[1],
        longitude: coords[0],
      };
    },
  },
];

// Tries the full "village, district" query first, then the village alone, then the district
// alone. Whatever was actually matched is reported back, so the app can say which point the
// figures describe instead of pretending it found the farm itself.
export async function geocodePlace(location, region) {
  const full = locationQuery(location, region);
  const place = clean(location);
  const area = clean(region);

  const attempts = [];
  if (full) attempts.push({ query: full, matchedOn: "farm location" });
  if (place && place !== full) attempts.push({ query: place, matchedOn: "farm location" });
  if (area && area !== place && area !== full) attempts.push({ query: area, matchedOn: "region only" });

  for (const geocoder of GEOCODERS) {
    for (const attempt of attempts) {
      const data = await getJson(geocoder.url(attempt.query));
      const hit = geocoder.read(data, attempt.query);
      if (hit && Number.isFinite(hit.latitude) && Number.isFinite(hit.longitude)) {
        return {
          ok: true,
          place: {
            ...hit,
            matched_on: attempt.matchedOn,
            query: attempt.query,
          },
        };
      }
    }
  }

  return { ok: false, error: "location_not_found" };
}

function entryAt(series, nowMs) {
  let chosen = series[0];
  for (const entry of series) {
    const at = new Date(entry.time).getTime();
    if (!Number.isFinite(at)) continue;
    if (at <= nowMs) chosen = entry;
    else break;
  }
  return chosen;
}

// Sums the rainfall the provider forecast for the periods that fit inside the window, so a
// six-hour block is never counted as if it were entirely in the next day.
function rainWithin(series, nowMs, hours) {
  const limit = nowMs + hours * 3600000;
  let total = 0;
  let counted = false;

  for (const entry of series) {
    const start = new Date(entry.time).getTime();
    if (!Number.isFinite(start)) continue;
    if (start + 3600000 < nowMs) continue;
    if (start >= limit) break;

    const data = entry.data || {};
    const oneHour = data.next_1_hours && data.next_1_hours.details ? data.next_1_hours.details : null;
    const sixHours = data.next_6_hours && data.next_6_hours.details ? data.next_6_hours.details : null;
    const amount = oneHour ? oneHour.precipitation_amount : sixHours ? sixHours.precipitation_amount : null;
    const span = oneHour ? 1 : 6;

    if (typeof amount !== "number" || !Number.isFinite(amount)) continue;
    if (start + span * 3600000 > limit) break;

    total += amount;
    counted = true;
  }

  return counted ? round1(total) : null;
}

export async function fetchLiveWeather({ location, region }) {
  const place = clean(location);
  if (!place) return { ok: false, error: "no_location", detail: "No village or district is recorded." };

  let point;
  try {
    point = await geocodePlace(place, region);
  } catch (error) {
    return { ok: false, error: "provider_unavailable", detail: `The place search could not be reached (${error.message}).` };
  }

  if (!point.ok) {
    return {
      ok: false,
      error: "location_not_found",
      detail: `No place matched "${locationQuery(place, region)}".`,
    };
  }

  let data;
  try {
    data = await getJson(`${FORECAST_URL}?lat=${point.place.latitude}&lon=${point.place.longitude}`, {
      "User-Agent": USER_AGENT,
    });
  } catch (error) {
    return { ok: false, error: "provider_unavailable", detail: `The weather service could not be reached (${error.message}).` };
  }

  const properties = data && data.properties ? data.properties : {};
  const series = Array.isArray(properties.timeseries) ? properties.timeseries : [];
  if (!series.length) {
    return { ok: false, error: "provider_unavailable", detail: "The weather service replied without a usable forecast." };
  }

  const nowMs = Date.now();
  const currentEntry = entryAt(series, nowMs);
  const details = currentEntry && currentEntry.data && currentEntry.data.instant ? currentEntry.data.instant.details : null;
  if (!details || typeof details.air_temperature !== "number") {
    return {
      ok: false,
      error: "provider_unavailable",
      detail: "The weather service replied without usable current conditions.",
    };
  }

  return {
    ok: true,
    provider: {
      id: WEATHER_PROVIDER_ID,
      label: WEATHER_PROVIDER_LABEL,
      attribution: WEATHER_ATTRIBUTION,
    },
    place: point.place,
    current: {
      temperature_c: num(details.air_temperature),
      humidity_percent: num(details.relative_humidity),
      wind_kmh: typeof details.wind_speed === "number" ? round1(details.wind_speed * 3.6) : null,
      at: currentEntry.time,
    },
    rain: {
      next_24h_mm: rainWithin(series, nowMs, 24),
      next_72h_mm: rainWithin(series, nowMs, 72),
    },
    updated_at: properties.meta ? properties.meta.updated_at : null,
    fetched_at: new Date().toISOString(),
    method: WEATHER_METHOD,
    limitations: WEATHER_LIMITATIONS,
  };
}