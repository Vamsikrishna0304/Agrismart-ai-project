import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import {
  CROP_MODEL_ID,
  CROP_MODEL_METHOD,
  CROP_MODEL_LIMITATIONS,
  scoreCrops,
  validateRecommendInput,
} from '../../shared/agronomy.ts';
import { writeAudit, personActor } from '../../shared/audit.ts';

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json().catch(() => ({}));
    const user = await base44.auth.me().catch(() => null);
    const { errors, input } = validateRecommendInput(payload);

    if (errors.length > 0) {
      return Response.json({ status: 'validation_error', errors }, { status: 400 });
    }

    const { ranked, explanation } = scoreCrops(input);
    const top = ranked[0];
    const shortlist = ranked.slice(0, 6);

    let savedId = null;
    let saveWarning = null;

    if (input.farm_id) {
      try {
        const farm = await base44.entities.Farm.get(input.farm_id);
        const saved = await base44.entities.CropRecommendation.create({
          farm_id: input.farm_id,
          farm_name: farm ? farm.name : '',
          nitrogen_kg_ha: input.nitrogen_kg_ha,
          phosphorus_kg_ha: input.phosphorus_kg_ha,
          potassium_kg_ha: input.potassium_kg_ha,
          ph: input.ph,
          temperature_c: input.temperature_c,
          humidity_percent: input.humidity_percent,
          rainfall_mm: input.rainfall_mm,
          season: input.season,
          location: input.location,
          inputs_source: input.inputs_source,
          climate_source: input.climate_source,
          top_crop: top.crop,
          top_score: top.score,
          ranking: shortlist,
          model_id: CROP_MODEL_ID,
          method: CROP_MODEL_METHOD,
          explanation,
          limitations: CROP_MODEL_LIMITATIONS,
        });
        savedId = saved.id;
      } catch (saveError) {
        saveWarning = `The recommendation was produced but could not be saved to the history: ${saveError.message}`;
      }
    }

    await writeAudit(base44, {
      ...personActor(user),
      action: 'crop_recommended',
      summary: `Crop recommendation produced for ${
        input.location || 'the values entered'
      }: ${top.crop} scored ${top.score} out of 100`,
      entity_name: 'CropRecommendation',
      record_id: savedId || undefined,
      record_label: top.crop,
      farm_id: input.farm_id || undefined,
      detail: `${CROP_MODEL_ID}; season ${input.season || 'not given'}; soil values ${
        input.inputs_source || 'user_entered'
      }; climate values ${input.climate_source || 'user_entered'}; saved to history: ${savedId ? 'yes' : 'no'}.`,
    });

    return Response.json({
      status: 'ok',
      model_id: CROP_MODEL_ID,
      method: CROP_MODEL_METHOD,
      limitations: CROP_MODEL_LIMITATIONS,
      explanation,
      top,
      ranked: shortlist,
      inputs: input,
      saved_recommendation_id: savedId,
      save_warning: saveWarning,
    });
  } catch (error) {
    return Response.json({ status: 'error', error: error.message }, { status: 500 });
  }
}