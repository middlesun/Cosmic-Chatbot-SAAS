import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  DEFAULT_COMPANION_TEMPERATURE,
  normalizeCompanionTemperature,
  normalizePersonalityV2,
} from './lib/companionV2Schema';
import {
  buildChatStyleInstruction,
  buildPresetCompanionSystemPrompt,
  analyzeCompanionTurnContext,
} from './server/services/companionEngine';
import { ensureCompanionV2Initialized } from './server/services/companionV2Mapper';
import {
  formatAnalystNotesForCompanion,
  isAstrologicalInterpretationText,
  mergeUserAndProfileContextForPrompt,
} from './server/services/lifeContextGuard';
import { redactDiagnosticSecrets, redactDiagnosticString } from './server/services/pipelineLogger';
import { enrichCompiledChart, type CompiledChartData } from './server/services/chartCompiler';
import type { CompanionPresetRecord } from './server/services/companionPresets';
import { DEFAULT_PROFILE_MEMORY_EXTRACTOR_PROMPT } from './server/services/enginePromptDefaults';

function makeBasePreset(overrides: Partial<CompanionPresetRecord> = {}): CompanionPresetRecord {
  const base: CompanionPresetRecord = {
    id: 'test-id',
    slug: 'acharya_dev',
    legacy_id: null,
    name: 'Acharya Dev',
    age: 48,
    sex: 'M',
    tagline: 'Scholarly Parashari & KP Jyotish practitioner',
    card_subtitle: 'Parashari & KP Astrologer',
    short_bio: 'Direct, analytical Vedic astrologer.',
    full_bio: 'Direct, analytical Vedic astrologer.',
    how_conversations_feel: 'Crisp, candid, chart-grounded.',
    primary_expertise: 'Vedic Astrologer',
    secondary_expertise: ['KP Astrology'],
    category_tag: 'astrology',
    companion_group: 'spiritual_guides',
    advisory_mode: 'esoteric_guide',
    chart_access: {
      vedic: true,
      western: false,
      tarot: false,
      numerology: false,
      past_life: false,
      council_notes: false,
    },
    formula_cartridge_slugs: [],
    max_output_tokens: 1800,
    discoverable_tags: [],
    situation_tags: [],
    specialization_slugs: ['vedic_astrology'],
    override_group_rules: false,
    cultural_fluency: 'English · Crisp Scholarly',
    avatar_url: null,
    monogram_palette: { bg: '#EAE3D7', ring: '#B8965A', ink: '#3D3830' },
    welcome_messages: ['Share your question cleanly.'],
    system_prompt: '',
    backstory: '',
    soul_consciousness: '',
    hard_rules: 'Stay dry, precise, and unsparingly honest.',
    soft_rules: 'Avoid pleasantries unless useful.',
    autonomy_level: 'free',
    override_global_rules: true,
    skill_level: 'vedic_soft',
    chat_style: 'chat_bubbles',
    model_id: null,
    tts_voice_profile: { rate: 1, pitch: 1 },
    supports_listening_cue: false,
    suggestions_enabled: true,
    is_active: false,
    sort_order: 1,
    core_identity_locked: true,
    personality_v2_json: normalizePersonalityV2({
      core_identity_capsule: 'Dry, scholarly Parashari & KP practitioner. Speaks directly without sugarcoating.',
      character_essence: 'Analytical, unhurried, allergic to platitudes.',
      specialist_expertise: 'Parashari dashas, KP sub-lords, natal strength.',
      signature_methodology: 'Evaluate Lagna lord first, then active Dasha and transit trigger.',
      astrology_entry_rule: 'always_available',
      verification_mode: 'methodology_neutral',
      shared_analysis_memory_mode: 'independent',
      temperature: null,
    }),
    ...overrides,
  };
  return base;
}

function makeSyntheticChart(): CompiledChartData {
  const raw: CompiledChartData = {
    meta: {
      name: 'Test Native',
      birthDate: '1993-08-19',
      birthTime: '06:42',
      location: {
        city: 'Bengaluru',
        country: 'India',
        latitude: 12.9716,
        longitude: 77.5946,
        timezoneOffset: 5.5,
      },
      ayanamsha: 'Lahiri',
      generatedAt: new Date().toISOString(),
    },
    planets: [
      { name: 'Ascendant', fullDegree: 138.23, sign: 'Leo', signIndex: 4, degreeInSign: 18.23, house: 1, nakshatra: 'Purva Phalguni', pada: 2, isRetrograde: false },
      { name: 'Sun', fullDegree: 122.68, sign: 'Leo', signIndex: 4, degreeInSign: 2.68, house: 1, nakshatra: 'Magha', pada: 1, isRetrograde: false },
      { name: 'Moon', fullDegree: 159.63, sign: 'Virgo', signIndex: 5, degreeInSign: 9.63, house: 2, nakshatra: 'Uttara Phalguni', pada: 4, isRetrograde: false },
      { name: 'Mars', fullDegree: 165.1, sign: 'Virgo', signIndex: 5, degreeInSign: 15.1, house: 2, nakshatra: 'Hasta', pada: 2, isRetrograde: false },
      { name: 'Mercury', fullDegree: 130.5, sign: 'Leo', signIndex: 4, degreeInSign: 10.5, house: 1, nakshatra: 'Magha', pada: 4, isRetrograde: false },
      { name: 'Jupiter', fullDegree: 171.2, sign: 'Virgo', signIndex: 5, degreeInSign: 21.2, house: 2, nakshatra: 'Hasta', pada: 4, isRetrograde: false },
      { name: 'Venus', fullDegree: 85.4, sign: 'Gemini', signIndex: 2, degreeInSign: 25.4, house: 11, nakshatra: 'Punarvasu', pada: 2, isRetrograde: false },
      { name: 'Saturn', fullDegree: 304.8, sign: 'Aquarius', signIndex: 10, degreeInSign: 4.8, house: 7, nakshatra: 'Dhanishta', pada: 4, isRetrograde: true },
      { name: 'Rahu', fullDegree: 224.2, sign: 'Scorpio', signIndex: 7, degreeInSign: 14.2, house: 4, nakshatra: 'Anuradha', pada: 4, isRetrograde: true },
      { name: 'Ketu', fullDegree: 44.2, sign: 'Taurus', signIndex: 1, degreeInSign: 14.2, house: 10, nakshatra: 'Rohini', pada: 2, isRetrograde: true },
    ],
    vargas: {},
    kp: { cusps: [], significators: [] },
    jaimini: { karakas: [], karakamshaSign: 'Gemini' },
    ashtakavarga: { signs: [], bhinnashtakavarga: {}, sarvashtakavarga: {} } as never,
    vimshottari: {
      timeline: [],
      currentStack: {
        mahadasha: 'Jupiter',
        antardasha: 'Saturn',
        pratyantardasha: 'Mercury',
        mdEnd: '2030-05-01',
        adEnd: '2027-03-01',
        pdEnd: '2026-12-15',
      },
    },
  };
  return enrichCompiledChart(raw).chartJson;
}

const chartJson = makeSyntheticChart();
const sampleTransits = {
  transitsText: 'SIDEREAL GOCHAR: Saturn in Pisces 12°; Jupiter in Taurus 18°.',
  westernTransitsText: 'TROPICAL TRANSITS: Saturn in Aries 04°; Jupiter in Cancer 02°.',
};

// 1. Universal Vedic + Western chart availability across practitioner configurations
for (const [label, chartAccess] of [
  ['Vedic only checkbox', { vedic: true, western: false, tarot: false, numerology: false, past_life: false, council_notes: false }],
  ['Western only checkbox', { vedic: false, western: true, tarot: false, numerology: false, past_life: false, council_notes: false }],
  ['Tarot only checkbox', { vedic: false, western: false, tarot: true, numerology: false, past_life: false, council_notes: false }],
  ['Numerology only checkbox', { vedic: false, western: false, tarot: false, numerology: true, past_life: false, council_notes: false }],
  ['All checkboxes false (esoteric_guide)', { vedic: false, western: false, tarot: false, numerology: false, past_life: false, council_notes: false }],
] as const) {
  const preset = makeBasePreset({ chart_access: { ...chartAccess } });
  const built = buildPresetCompanionSystemPrompt({
    preset,
    languageSlug: 'English',
    turnCount: 0,
    userPrompt: 'Busy morning today, just checking in.',
    userDefaultProfile: {
      name: 'Aarav',
      has_birth_chart: true,
      birth_date: '1993-08-19',
      birth_time: '06:42',
      birth_city: 'Bengaluru',
      birth_country: 'India',
      current_city: 'Mumbai',
      current_country: 'India',
      chart_json: chartJson,
    },
    dailyTransits: sampleTransits,
  });
  assert.equal(built.turnAnalysis.universal_chart_available, true, `${label}: universal_chart_available`);
  assert.equal(built.turnAnalysis.active_astrological_intent, false, `${label}: casual turn should keep active_astrological_intent false`);
  assert.equal(built.assemblyManifest.vedicChartInjected, true, `${label}: vedicChartInjected`);
  assert.equal(built.assemblyManifest.westernChartInjected, true, `${label}: westernChartInjected`);
  assert.equal(built.assemblyManifest.vedicTransitsInjected, true, `${label}: vedicTransitsInjected`);
  assert.equal(built.assemblyManifest.westernTransitsInjected, true, `${label}: westernTransitsInjected`);
  assert.ok(built.systemInstruction.includes('SIDEREAL GOCHAR'), `${label}: Vedic transits missing`);
  assert.ok(built.systemInstruction.includes('TROPICAL TRANSITS'), `${label}: Western transits missing`);
  assert.ok(built.systemInstruction.includes('Mumbai'), `${label}: Current location missing`);
}

// 2. Non-esoteric companion ('never') keeps chart gated off
const nonAstroPreset = makeBasePreset({
  advisory_mode: 'friend',
  skill_level: 'none_emotional',
  chart_access: { vedic: false, western: false, tarot: false, numerology: false, past_life: false, council_notes: false },
  personality_v2_json: normalizePersonalityV2({ astrology_entry_rule: 'never' }),
});
const nonAstroBuilt = buildPresetCompanionSystemPrompt({
  preset: nonAstroPreset,
  languageSlug: 'English',
  turnCount: 0,
  userPrompt: 'Hey how are you?',
  userDefaultProfile: { name: 'Aarav', has_birth_chart: true, chart_json: chartJson },
  dailyTransits: sampleTransits,
});
assert.equal(nonAstroBuilt.turnAnalysis.universal_chart_available, false);
assert.equal(nonAstroBuilt.assemblyManifest.vedicChartInjected, false);
assert.equal(nonAstroBuilt.assemblyManifest.westernChartInjected, false);

// 3. Missing chart non-speculative notice
const missingChartBuilt = buildPresetCompanionSystemPrompt({
  preset: makeBasePreset(),
  languageSlug: 'English',
  turnCount: 0,
  userPrompt: 'What does my Saturn return say?',
  userDefaultProfile: { name: 'Aarav', has_birth_chart: false },
});
assert.equal(missingChartBuilt.turnAnalysis.active_astrological_intent, true);
assert.ok(
  /no verified birth chart/i.test(missingChartBuilt.systemInstruction) &&
    /never guess or invent/i.test(missingChartBuilt.systemInstruction),
  'Missing chart should include non-speculative notice'
);

// 4. Independent vs Shared Analysis Memory isolation + fact guardrails
assert.equal(isAstrologicalInterpretationText('User is in Jupiter-Saturn Dasha facing 10th-house pressure.'), true);
assert.equal(isAstrologicalInterpretationText('Senior Product Designer based in Bengaluru considering a role change.'), false);
assert.ok(DEFAULT_PROFILE_MEMORY_EXTRACTOR_PROMPT.includes('NEVER extract or save astrological'));

const mergedIndep = mergeUserAndProfileContextForPrompt({
  userLivingContext: { career_role: 'Product Designer', core_stress_areas: ['Sleep schedule', 'Saturn Mahadasha tension'] },
  userDeepProfile: {
    practical_reality: ['Navigating a startup acquisition.'],
    behavioral_patterns: ['Ketu in 1st house causes detachment.'],
  },
  independentAnalysisMode: true,
});
assert.deepEqual(mergedIndep.life_context_json?.core_stress_areas, ['Sleep schedule']);
assert.deepEqual(mergedIndep.deep_profile_json?.behavioral_patterns, []);

const formattedNote = formatAnalystNotesForCompanion([
  {
    id: 'n1',
    summary: 'Venus 11th supports gradual network gains.',
    system_label: 'Vedic astrologer',
    system_slug: 'vedic_astrologer',
    conversation_id: null,
    captured_at: '2026-11-26T00:00:00.000Z',
  },
]);
assert.ok(formattedNote.includes('Prior interpretation by Vedic astrologer'));

const indepBuilt = buildPresetCompanionSystemPrompt({
  preset: makeBasePreset(),
  languageSlug: 'English',
  turnCount: 2,
  userPrompt: 'Look at my career chart carefully.',
  userDefaultProfile: {
    name: 'Aarav',
    has_birth_chart: true,
    chart_json: chartJson,
    life_context_json: { career_role: 'Product Designer' },
    analyst_notes_json: [
      {
        id: 'n1',
        summary: 'EXTERNAL_ASTRO_OPINION_12345',
        system_label: 'Vedic astrologer',
        system_slug: 'vedic_astrologer',
        conversation_id: null,
        captured_at: '2026-11-26T00:00:00.000Z',
      },
    ],
  },
  councilReadingNotesText: 'EXTERNAL_READING_NOTE_67890',
  crossThreadSnippets: 'Aarav: We discussed Q4 deadlines last week.',
  bond: {
    companion_slug: 'acharya_dev',
    companion_name: 'Acharya Dev',
    memory_summary: 'User prefers blunt technical clarity.',
    relationship_state: {
      familiarity_level: 3,
      total_turns: 8,
      inside_references: ['Q4 acquisition milestone'],
      user_slang_cues: [],
      tone_preferences: ['direct'],
    },
    last_interaction_at: '2026-11-20T10:00:00.000Z',
  },
});
assert.equal(indepBuilt.sharedAnalysisMemoryMode, 'independent');
assert.equal(indepBuilt.systemInstruction.includes('EXTERNAL_ASTRO_OPINION_12345'), false);
assert.equal(indepBuilt.systemInstruction.includes('EXTERNAL_READING_NOTE_67890'), false);
assert.equal(indepBuilt.systemInstruction.includes('Q4 acquisition milestone'), true);
assert.equal(indepBuilt.systemInstruction.includes('We discussed Q4 deadlines last week'), true);

const sharedBuilt = buildPresetCompanionSystemPrompt({
  preset: makeBasePreset({
    personality_v2_json: normalizePersonalityV2({
      ...makeBasePreset().personality_v2_json,
      shared_analysis_memory_mode: 'shared_interpretations',
    }),
  }),
  languageSlug: 'English',
  turnCount: 2,
  userPrompt: 'Look at my career chart carefully.',
  userDefaultProfile: {
    name: 'Aarav',
    has_birth_chart: true,
    chart_json: chartJson,
    analyst_notes_json: [
      {
        id: 'n1',
        summary: 'EXTERNAL_ASTRO_OPINION_12345',
        system_label: 'Vedic astrologer',
        system_slug: 'vedic_astrologer',
        conversation_id: null,
        captured_at: '2026-11-26T00:00:00.000Z',
      },
    ],
  },
  councilReadingNotesText: 'EXTERNAL_READING_NOTE_67890',
});
assert.equal(sharedBuilt.sharedAnalysisMemoryMode, 'shared_interpretations');
assert.equal(sharedBuilt.systemInstruction.includes('EXTERNAL_ASTRO_OPINION_12345'), true);
assert.equal(sharedBuilt.systemInstruction.includes('EXTERNAL_READING_NOTE_67890'), true);
assert.ok(/Prior interpretation by|independent judgment/i.test(sharedBuilt.systemInstruction));

// 5. No forced companion-first prose in practitioner prompt or chat styles
for (const forbidden of [
  'warm texting friend',
  'soft comforting presence',
  'warm, genuine, unscripted friend',
  'never overwhelm with long lists',
]) {
  assert.equal(
    indepBuilt.systemInstruction.toLowerCase().includes(forbidden),
    false,
    `Unexpected companion-first phrase found: ${forbidden}`
  );
}
const bubblesCompStyle = buildChatStyleInstruction('chat_bubbles', { isCouncil: false });
assert.ok(bubblesCompStyle.includes('headings') && bubblesCompStyle.includes('tables'));
const bubblesCouncilStyle = buildChatStyleInstruction('chat_bubbles', { isCouncil: true });
assert.ok(bubblesCouncilStyle.includes('COUNCIL'));

// 6. Temperature clamping & default
assert.equal(DEFAULT_COMPANION_TEMPERATURE, 0.45);
assert.equal(normalizeCompanionTemperature(null), null);
assert.equal(normalizeCompanionTemperature(2.7), 2);
assert.equal(normalizeCompanionTemperature(-0.4), 0);
assert.equal(normalizeCompanionTemperature(0.85), 0.85);
assert.equal(indepBuilt.effectiveTemperature, 0.45);

// 7. V2 initialization defaults for esoteric guide without explicit astrology_entry_rule
const initializedV2 = ensureCompanionV2Initialized(
  makeBasePreset({ personality_v2_json: undefined })
);
assert.equal(initializedV2.astrology_entry_rule, 'always_available');
assert.equal(initializedV2.verification_mode, 'methodology_neutral');
assert.equal(initializedV2.shared_analysis_memory_mode, 'independent');

// 8. Secret redaction in diagnostics
const redactedStr = redactDiagnosticString('Authorization: Bearer sk-or-v1-abcdef1234567890abcdef');
assert.equal(redactedStr.includes('sk-or-v1-abcdef1234567890abcdef'), false);
const redactedObj = redactDiagnosticSecrets({
  api_key: 'super_secret_val',
  nested: { model: 'anthropic/claude', token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.abc.def' },
});
assert.equal(redactedObj.api_key, '[REDACTED]');
assert.equal(redactedObj.nested.token.includes('eyJhbGci'), false);

// 9. Verify §12 exclusions untouched on disk
const astraBench = fs.readFileSync('./server/services/astraMoonBenchmark.ts', 'utf8');
assert.ok(astraBench.includes('ASTRA_V2_PERSONALITY'));

console.log('ALL_VERIFICATION_CHECKS_PASSED');
