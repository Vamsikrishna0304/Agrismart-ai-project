import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { writeAudit, personActor } from '../../shared/audit.ts';

const MODEL_ID = 'platform-vision-model';
const ANALYSIS_METHOD =
  'General-purpose vision model called through the platform AI integration over your uploaded photo. This is not a crop-specific trained plant-disease classifier and not a validated diagnostic tool.';
const BASE_LIMITATIONS =
  'Image classification cannot confirm a diagnosis the way a laboratory test or a field inspection can. No pesticide or fungicide dose is given here on purpose: confirm any chemical treatment with your local agricultural extension officer or Krishi Vigyan Kendra.';

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    image_quality: { type: 'string', enum: ['good', 'fair', 'poor'] },
    plant_identified: { type: 'boolean' },
    identified_plant: { type: 'string' },
    condition_named_by_model: { type: 'string' },
    confidence_percent: { type: 'number' },
    observations: { type: 'string' },
    recommended_actions: { type: 'array', items: { type: 'string' } },
    limitations_of_this_analysis: { type: 'string' },
  },
  required: [
    'image_quality',
    'plant_identified',
    'identified_plant',
    'condition_named_by_model',
    'confidence_percent',
    'observations',
    'recommended_actions',
    'limitations_of_this_analysis',
  ],
};

function firstWord(text) {
  return String(text || '')
    .trim()
    .toLowerCase()
    .split(/[\s(]/)[0];
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json().catch(() => ({}));
    const user = await base44.auth.me().catch(() => null);

    const plantType = String(payload.plant_type || '').trim();
    const imageUri = String(payload.image_uri || '').trim();

    if (!imageUri) {
      return Response.json({ status: 'validation_error', error: 'An uploaded image is required.' }, { status: 400 });
    }
    if (!plantType) {
      return Response.json({ status: 'validation_error', error: 'Select which plant the photo shows.' }, { status: 400 });
    }

    let signed;
    try {
      signed = await base44.asServiceRole.integrations.Core.CreateFileSignedUrl({ file_uri: imageUri, expires_in: 900 });
    } catch (signError) {
      return Response.json(
        { status: 'error', error: `The uploaded image could not be opened for analysis: ${signError.message}` },
        { status: 500 }
      );
    }

    const prompt = [
      'You are analysing ONE photograph of a plant for a farm record. Be strictly honest and never invent details you cannot see.',
      `The farmer says the photo shows: ${plantType}.`,
      'Judge the image quality first. If it is blurred, too dark, too close, or you cannot confidently see plant tissue, set image_quality to "poor" or "fair" and say what would make a better photo.',
      'Only name a plant or a condition you can actually support from what is visible. If the visible plant is not the one the farmer stated, set plant_identified to true but report the plant you actually see in identified_plant.',
      'Name at most one most-likely condition in condition_named_by_model, with a calibrated confidence_percent (0-100) that reflects uncertainty rather than optimism. Use a low number when unsure.',
      'List 2-4 practical, non-chemical first actions in recommended_actions (inspection, isolation, sanitation, airflow, water management, photographing the underside of leaves, contacting an extension officer).',
      'Never give chemical, pesticide or fungicide product names or dosages. Never claim a laboratory confirmation.',
      'Describe what you can see in observations, and state clearly in limitations_of_this_analysis what this photo cannot tell.',
      'Answer in clear, simple English a farmer can follow.',
    ].join('\n');

    let analysis;
    try {
      analysis = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt,
        file_urls: [signed.signed_url],
        response_json_schema: RESPONSE_SCHEMA,
      });
    } catch (providerError) {
      return Response.json(
        {
          status: 'provider_error',
          error: `The image model could not be reached, so no analysis was produced. Reported error: ${providerError.message}`,
        },
        { status: 502 }
      );
    }

    const quality = ['good', 'fair', 'poor'].includes(analysis.image_quality) ? analysis.image_quality : 'fair';
    const confidence = Number.isFinite(Number(analysis.confidence_percent))
      ? Math.max(0, Math.min(100, Number(analysis.confidence_percent)))
      : null;
    const identifiedPlant = String(analysis.identified_plant || '').trim();
    const mismatch =
      identifiedPlant && firstWord(plantType) && !identifiedPlant.toLowerCase().includes(firstWord(plantType));

    let outcome = 'conclusive';
    let outcomeNote = '';
    if (quality === 'poor' || analysis.plant_identified === false) {
      outcome = 'inconclusive';
      outcomeNote = 'The photo did not show the plant clearly enough for a reliable read.';
    } else if (mismatch) {
      outcome = 'unsupported';
      outcomeNote = `The selected plant was ${plantType}, but the photo looks like ${identifiedPlant}. The model was not asked to treat this as a ${plantType} result.`;
    } else if (confidence !== null && confidence < 60) {
      outcome = 'inconclusive';
      outcomeNote = 'Confidence was too low to treat this as a conclusive result.';
    }

    const record = await base44.entities.DiseaseAnalysis.create({
      farm_id: payload.farm_id || '',
      farm_name: payload.farm_name || '',
      crop_name: payload.crop_name || '',
      plant_type: plantType,
      image_uri: imageUri,
      outcome,
      identified_plant: identifiedPlant,
      predicted_condition: outcome === 'conclusive' ? String(analysis.condition_named_by_model || '') : '',
      confidence_percent: confidence === null ? undefined : confidence,
      image_quality: quality,
      observations: String(analysis.observations || ''),
      recommended_actions: Array.isArray(analysis.recommended_actions) ? analysis.recommended_actions.slice(0, 6) : [],
      model_id: MODEL_ID,
      analysis_method: ANALYSIS_METHOD,
      limitations: [BASE_LIMITATIONS, analysis.limitations_of_this_analysis, outcomeNote].filter(Boolean).join(' '),
      notes: payload.notes || '',
    });

    await writeAudit(base44, {
      ...personActor(user),
      action: 'disease_analysed',
      summary: `Plant photo analysed for ${plantType}: ${outcome}`,
      entity_name: 'DiseaseAnalysis',
      record_id: record.id,
      record_label: `${plantType} photo`,
      farm_id: payload.farm_id || undefined,
      farm_name: payload.farm_name || undefined,
      detail: `${MODEL_ID}; image quality ${quality}; identified as ${
        identifiedPlant || 'not clear enough to name'
      }; confidence ${confidence === null || confidence === undefined ? 'not reported' : `${confidence}%`}. The photo itself is held privately and is not part of this history.`,
    });

    return Response.json({
      status: 'ok',
      analysis_id: record.id,
      outcome,
      outcome_note: outcomeNote,
      image_quality: quality,
      identified_plant: identifiedPlant,
      predicted_condition: outcome === 'conclusive' ? String(analysis.condition_named_by_model || '') : '',
      confidence_percent: confidence,
      observations: String(analysis.observations || ''),
      recommended_actions: Array.isArray(analysis.recommended_actions) ? analysis.recommended_actions.slice(0, 6) : [],
      model_id: MODEL_ID,
      analysis_method: ANALYSIS_METHOD,
      limitations: record.limitations,
    });
  } catch (error) {
    return Response.json({ status: 'error', error: error.message }, { status: 500 });
  }
}