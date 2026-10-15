import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { asList } from '../../shared/agronomy.ts';
import { fetchLiveWeather, WEATHER_PROVIDER_LABEL } from '../../shared/weather.ts';

const SETTING_KEY = 'weather_provider';

// The integrations panel reports what the provider really did on the last attempt, so the
// state is written from the live result rather than assumed.
function providerPatch(result) {
  if (result.ok) {
    return {
      state: 'connected',
      detail: `${WEATHER_PROVIDER_LABEL} supplies live conditions and rainfall forecasts and needs no API key. An irrigation decision uses the rainfall forecast from this feed unless a figure is typed in, which is then labelled as hand-entered. Every weather value is model output for the nearest grid cell, not an instrument in the field.`,
    };
  }
  if (result.error === 'provider_unavailable') {
    return {
      state: 'temporarily_unavailable',
      detail: `${WEATHER_PROVIDER_LABEL} could not be reached on the last attempt (${result.detail || 'no detail returned'}). No figure is invented to fill the gap: the irrigation engine falls back to a hand-entered rainfall value and labels it as such.`,
    };
  }
  return null;
}

async function recordProviderState(base44, result) {
  const patch = providerPatch(result);
  if (!patch) return;

  const rows = asList(await base44.entities.IntegrationSetting.filter({ key: SETTING_KEY }, { limit: 1 }));
  const checkedAt = new Date().toISOString();

  if (!rows.length) {
    await base44.entities.IntegrationSetting.create({
      key: SETTING_KEY,
      label: 'Live weather provider',
      ...patch,
      checked_at: checkedAt,
    });
    return;
  }
  await base44.entities.IntegrationSetting.update(rows[0].id, { ...patch, checked_at: checkedAt });
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json().catch(() => ({}));

    let location = String(payload.location || '');
    let region = String(payload.region || '');
    let farmName = '';

    if (payload.farm_id) {
      const farm = await base44.entities.Farm.get(String(payload.farm_id)).catch(() => null);
      if (!farm) {
        return Response.json({ status: 'validation_error', error: 'That farm could not be found.' }, { status: 404 });
      }
      farmName = farm.name || '';
      location = farm.location || '';
      region = farm.region || '';
    }

    if (!String(location).trim()) {
      return Response.json(
        {
          status: 'validation_error',
          error:
            'This farm has no village or district recorded, so no coordinates can be found for it. Add the location to the farm, or type the rainfall figure in by hand.',
        },
        { status: 400 }
      );
    }

    const result = await fetchLiveWeather({ location, region });

    // Bookkeeping for the integrations panel must never break the weather answer itself.
    await recordProviderState(base44, result).catch(() => null);

    if (!result.ok) {
      if (result.error === 'location_not_found') {
        return Response.json(
          {
            status: 'location_not_found',
            error: `No place was found for "${location}"${region ? `, ${region}` : ''}. Check the spelling of the village or district, or type the rainfall figure in by hand.`,
          },
          { status: 404 }
        );
      }
      return Response.json(
        { status: 'provider_unavailable', error: result.detail || 'The live weather service could not be reached.' },
        { status: 502 }
      );
    }

    return Response.json({ status: 'ok', farm_name: farmName, ...result });
  } catch (error) {
    return Response.json({ status: 'error', error: error.message }, { status: 500 });
  }
}