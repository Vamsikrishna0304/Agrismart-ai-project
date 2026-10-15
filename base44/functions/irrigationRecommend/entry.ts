import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import {
  IRRIGATION_LIMITATIONS,
  IRRIGATION_METHOD,
  IRRIGATION_RULE_VERSION,
  freshnessOf,
  getRuleForCrop,
  readingAgeMinutes,
  round1,
  asList,
} from '../../shared/agronomy.ts';
import { fetchLiveWeather } from '../../shared/weather.ts';
import { writeAudit, personActor } from '../../shared/audit.ts';

const STAGE_ADJUSTED = ['flowering', 'fruiting'];

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json().catch(() => ({}));
    const user = await base44.auth.me().catch(() => null);

    const farmId = String(payload.farm_id || '').trim();
    if (!farmId) {
      return Response.json({ status: 'validation_error', error: 'Select a farm.' }, { status: 400 });
    }

    const farm = await base44.entities.Farm.get(farmId).catch(() => null);
    if (!farm) {
      return Response.json({ status: 'validation_error', error: 'That farm could not be found.' }, { status: 404 });
    }

    let crop = null;
    if (payload.crop_id) {
      crop = await base44.entities.Crop.get(payload.crop_id).catch(() => null);
      if (!crop) {
        // Never silently assess a different crop than the one asked for.
        return Response.json(
          { status: 'validation_error', error: 'That crop record could not be found. Pick a crop again, or add it to the farm first.' },
          { status: 404 }
        );
      }
    }
    if (!crop) {
      const crops = asList(await base44.entities.Crop.filter({ farm_id: farmId, status: 'active' }, { sort: '-created_date', limit: 1 }));
      crop = crops.length ? crops[0] : null;
    }
    if (!crop) {
      return Response.json(
        { status: 'validation_error', error: 'No active crop is recorded for this farm. Add a crop first so the thresholds can be matched.' },
        { status: 400 }
      );
    }

    const ruleRows = asList(await base44.entities.IrrigationRule.filter({ crop_name: crop.crop_name, active: true }, { limit: 1 }));
    const configured = ruleRows.length ? ruleRows[0] : null;
    const rule = getRuleForCrop(crop.crop_name, configured || undefined);

    // Where does the soil-moisture value come from?
    let moisture = null;
    let moistureSource = null;
    let readingAt = null;
    const manual = Number(payload.soil_moisture_percent);

    if (Number.isFinite(manual) && manual >= 0 && manual <= 100 && payload.soil_moisture_percent !== undefined && payload.soil_moisture_percent !== '') {
      moisture = manual;
      moistureSource = 'manual';
      readingAt = new Date().toISOString();
    } else {
      const sensors = asList(await base44.entities.SensorReading.filter(
        { farm_id: farmId, sensor_type: 'soil_moisture' },
        { sort: '-recorded_at', limit: 1 }
      ));
      if (sensors.length) {
        moisture = sensors[0].value;
        moistureSource = 'sensor';
        readingAt = sensors[0].recorded_at;
      } else {
        const soils = asList(await base44.entities.SoilSample.filter({ farm_id: farmId }, { sort: '-sampled_on', limit: 1 }));
        const withMoisture = soils.find((s) => Number.isFinite(Number(s.moisture_percent)));
        if (withMoisture) {
          moisture = Number(withMoisture.moisture_percent);
          moistureSource = 'soil_sample';
          readingAt = new Date(withMoisture.sampled_on).toISOString();
        }
      }
    }

    // Rainfall: a figure typed in wins; otherwise the live forecast for the farm's location is
    // used, and the reasoning text always names which of the two it used.
    const manualRain = Number(payload.rain_forecast_mm);
    const hasManualRain =
      payload.rain_forecast_mm !== undefined &&
      payload.rain_forecast_mm !== '' &&
      Number.isFinite(manualRain) &&
      manualRain >= 0;

    let rainForecast = null;
    let forecastKind = 'none';
    let forecastSource = 'No forecast available';
    let forecastPlace = '';

    if (hasManualRain) {
      rainForecast = manualRain;
      forecastKind = 'hand';
      forecastSource = 'Entered by hand, not a live feed';
    } else {
      const live = await fetchLiveWeather({ location: farm.location, region: farm.region });
      if (live.ok) {
        rainForecast = live.rain.next_24h_mm;
        forecastKind = 'live';
        forecastPlace = live.place.name;
        forecastSource = `Live ${live.provider.label} forecast for ${live.place.name}, covering the next 24 hours, fetched ${live.fetched_at}`;
      } else {
        forecastSource = `No forecast available (${live.error === 'no_location' ? 'the farm has no location recorded' : live.error})`;
      }
    }

    const hasForecast = rainForecast !== null && Number.isFinite(rainForecast);
    const rainSourceNote =
      forecastKind === 'live'
        ? `live forecast for ${forecastPlace}, covering the next 24 hours`
        : 'the figure entered by hand';

    const base = {
      farm_id: farmId,
      farm_name: farm.name,
      crop_id: crop.id,
      crop_name: crop.crop_name,
      growth_stage: crop.growth_stage || '',
      soil_moisture_percent: moisture === null ? undefined : round1(moisture),
      soil_moisture_source: moistureSource || 'manual',
      reading_timestamp: readingAt || undefined,
      rain_forecast_mm: hasForecast ? round1(rainForecast) : undefined,
      forecast_source: forecastSource,
      threshold_percent: rule.min_soil_moisture_percent,
      rule_version: IRRIGATION_RULE_VERSION,
      method: IRRIGATION_METHOD,
      limitations: IRRIGATION_LIMITATIONS,
    };

    // No usable measurement: say so instead of inventing one.
    if (moisture === null) {
      const reason =
        'No soil-moisture reading is available for this farm yet. Add a soil sample or run the sensor simulator, then ask again.';
      const saved = await base44.entities.IrrigationRecommendation.create({
        ...base,
        decision: 'insufficient_data',
        urgency: 'unknown',
        data_freshness: 'stale',
        forecast_kind: forecastKind,
        reason,
      });
      await writeAudit(base44, {
        ...personActor(user),
        action: 'irrigation_decided',
        summary: `Irrigation advice for ${crop.crop_name} at ${farm.name}: no usable soil-moisture value, so no instruction was given`,
        entity_name: 'IrrigationRecommendation',
        record_id: saved.id,
        record_label: `${farm.name} · ${crop.crop_name}`,
        farm_id: farmId,
        farm_name: farm.name,
        detail: `${IRRIGATION_RULE_VERSION}; ${reason}`,
      });

      return Response.json({
        status: 'ok',
        farm_name: farm.name,
        crop_name: crop.crop_name,
        growth_stage: crop.growth_stage || '',
        decision: 'insufficient_data',
        urgency: 'unknown',
        data_freshness: 'stale',
        reason,
        record: saved,
      });
    }

    const ageMinutes = readingAgeMinutes(readingAt);
    const freshness = freshnessOf(ageMinutes, rule.max_reading_age_minutes);

    if (freshness === 'stale') {
      const reason =
        `The newest soil-moisture value is ${ageMinutes} minutes old (${moistureSource === 'sensor' ? 'from a sensor' : 'from a soil sample'}), which is older than the ${rule.max_reading_age_minutes}-minute freshness limit. ` +
        'A stale value is not a current field condition, so no irrigation instruction is given. Take a fresh reading first.';
      const saved = await base44.entities.IrrigationRecommendation.create({
        ...base,
        decision: 'insufficient_data',
        urgency: 'unknown',
        data_freshness: 'stale',
        reading_age_minutes: ageMinutes,
        forecast_kind: forecastKind,
        reason,
      });
      await writeAudit(base44, {
        ...personActor(user),
        action: 'irrigation_decided',
        summary: `Irrigation advice for ${crop.crop_name} at ${farm.name}: the newest reading is stale, so no instruction was given`,
        entity_name: 'IrrigationRecommendation',
        record_id: saved.id,
        record_label: `${farm.name} · ${crop.crop_name}`,
        farm_id: farmId,
        farm_name: farm.name,
        detail: `${IRRIGATION_RULE_VERSION}; reading age ${ageMinutes} minutes; ${reason}`,
      });

      return Response.json({
        status: 'ok',
        farm_name: farm.name,
        crop_name: crop.crop_name,
        growth_stage: crop.growth_stage || '',
        decision: 'insufficient_data',
        urgency: 'unknown',
        data_freshness: 'stale',
        reading_age_minutes: ageMinutes,
        reason,
        record: saved,
      });
    }

    let threshold = rule.min_soil_moisture_percent;
    let stageNote = '';
    if (STAGE_ADJUSTED.includes(crop.growth_stage)) {
      threshold = threshold + 5;
      stageNote = ` The crop is at ${crop.growth_stage}, the most water-sensitive stage, so the minimum was raised by 5 points to ${threshold} percent.`;
    }
    const criticalFloor = threshold - (rule.critical_offset_percent || 8);

    let decision;
    let urgency;
    let reason;

    if (hasForecast && rainForecast >= rule.rain_skip_mm) {
      decision = 'wait';
      urgency = 'low';
      reason =
        `Expected rainfall of ${round1(rainForecast)} mm (${rainSourceNote}) meets the ${rule.rain_skip_mm} mm skip threshold for ${crop.crop_name}, and soil moisture is ${round1(moisture)} percent against a ${threshold} percent minimum.` +
        stageNote +
        ' Irrigating now would be wasted water and risks waterlogging.';
    } else if (moisture < criticalFloor) {
      decision = 'irrigate_now';
      urgency = 'high';
      reason =
        `Soil moisture is ${round1(moisture)} percent, more than ${rule.critical_offset_percent} points below the ${threshold} percent minimum for ${crop.crop_name}.` +
        (hasForecast
          ? ` Only ${round1(rainForecast)} mm of rain is expected (${rainSourceNote}), below the ${rule.rain_skip_mm} mm skip threshold.`
          : ' No rainfall figure is available to wait for.') +
        stageNote +
        ' Irrigate today and re-check moisture afterwards.';
    } else if (moisture < threshold) {
      decision = 'irrigate_soon';
      urgency = 'medium';
      reason =
        `Soil moisture is ${round1(moisture)} percent, below the ${threshold} percent minimum for ${crop.crop_name}.` +
        stageNote +
        (hasForecast
          ? ` Expected rainfall of ${round1(rainForecast)} mm (${rainSourceNote}) is below the ${rule.rain_skip_mm} mm skip threshold.`
          : ' No rainfall forecast was available.') +
        ' Plan irrigation within the next day.';
    } else if (moisture < rule.target_soil_moisture_percent) {
      decision = 'monitor';
      urgency = 'low';
      reason =
        `Soil moisture is ${round1(moisture)} percent, above the ${threshold} percent minimum but below the ${rule.target_soil_moisture_percent} percent target for ${crop.crop_name}.` +
        stageNote +
        ' No irrigation needed yet — keep watching the readings.';
    } else {
      decision = 'wait';
      urgency = 'low';
      reason =
        `Soil moisture is ${round1(moisture)} percent, at or above the ${rule.target_soil_moisture_percent} percent target for ${crop.crop_name}.` +
        stageNote +
        ' No irrigation is needed now.';
    }

    const saved = await base44.entities.IrrigationRecommendation.create({
      ...base,
      threshold_percent: threshold,
      decision,
      urgency,
      data_freshness: freshness,
      reading_age_minutes: ageMinutes,
      reason,
    });

    let alertId = null;
    if (decision === 'irrigate_now') {
      const alert = await base44.entities.Alert.create({
        farm_id: farmId,
        farm_name: farm.name,
        severity: 'critical',
        title: `Irrigation needed now at ${farm.name}`,
        message: reason,
        source: `${IRRIGATION_RULE_VERSION} (threshold rule engine, not machine learning)`,
        related_type: 'IrrigationRecommendation',
        related_id: saved.id,
        status: 'open',
      });
      alertId = alert.id;
    }

    await writeAudit(base44, {
      ...personActor(user),
      action: 'irrigation_decided',
      summary: `Irrigation advice for ${crop.crop_name} at ${farm.name}: ${decision}`,
      entity_name: 'IrrigationRecommendation',
      record_id: saved.id,
      record_label: `${farm.name} · ${crop.crop_name}`,
      farm_id: farmId,
      farm_name: farm.name,
      detail: `${IRRIGATION_RULE_VERSION}; urgency ${urgency}; data freshness ${freshness}; alert raised: ${
        alertId ? 'yes' : 'no'
      }; ${reason}`,
    });

    return Response.json({
      status: 'ok',
      farm_name: farm.name,
      crop_name: crop.crop_name,
      growth_stage: crop.growth_stage || '',
      decision,
      urgency,
      data_freshness: freshness,
      reading_age_minutes: ageMinutes,
      soil_moisture_percent: round1(moisture),
      soil_moisture_source: moistureSource,
      threshold_percent: threshold,
      rain_forecast_mm: hasForecast ? round1(rainForecast) : null,
      forecast_kind: forecastKind,
      forecast_source: forecastSource,
      reason,
      rule_version: IRRIGATION_RULE_VERSION,
      method: IRRIGATION_METHOD,
      limitations: IRRIGATION_LIMITATIONS,
      alert_id: alertId,
      record: saved,
    });
  } catch (error) {
    return Response.json({ status: 'error', error: error.message }, { status: 500 });
  }
}