import { enrichCompiledChart, formatChartForLLM, type CompiledChartData } from '../services/chartCompiler';
import { getSupabaseAdmin } from '../lib/supabaseAdmin';
import { getOrFetchDailyTransits, isAstrologyApiConfigured } from '../services/astrologyApi';
import { sendReportReadyEmail } from '../services/email';
import {
  countWords,
  generateFollowUpQuestions,
} from '../services/geminiOrchestrator';
import {
  createOpenRouterCompletion,
  getConsultationModel,
  isOpenRouterConfiguredAsync,
} from '../services/openrouter';
import { generateReportPdfBuffer } from '../services/pdfGenerator';
import { CORE_COUNCIL_CONSTITUTION, resolvePromptModules } from '../services/promptDefaults';
import {
  getActiveRecipeBySlug,
  getResolvedOpenRouterRuntime,
} from '../services/platformSettings';
import type { ReportPromptStep } from '../services/reportDefaults';
import { scheduleBackgroundTask } from '../lib/backgroundTask';

export interface StepOutputRecord {
  stepNumber: number;
  title: string;
  content: string;
  completedAt: string;
}

const activeWorkers = new Set<string>();

export function enqueueReportOrder(
  orderId: string,
  appOrigin?: string,
  astrologyMode?: 'vedic' | 'western'
): void {
  if (activeWorkers.has(orderId)) return;
  activeWorkers.add(orderId);

  scheduleBackgroundTask(async () => {
    try {
      await processReportOrder(orderId, appOrigin, astrologyMode);
    } finally {
      activeWorkers.delete(orderId);
    }
  });
}

async function processReportOrder(
  orderId: string,
  appOrigin?: string,
  passedMode?: 'vedic' | 'western'
): Promise<void> {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) return;

  const { data: order } = await supabaseAdmin
    .from('report_orders')
    .select('*')
    .eq('id', orderId)
    .maybeSingle();

  if (!order || order.status === 'completed' || order.status === 'failed') {
    return;
  }

  const mode: 'vedic' | 'western' =
    (order as { astrology_mode?: string }).astrology_mode === 'western' || passedMode === 'western'
      ? 'western'
      : 'vedic';
  const modeLabel = mode === 'western' ? 'Western' : 'Vedic';

  const refundOrderOnFailure = async (reason: string) => {
    await supabaseAdmin
      .from('report_orders')
      .update({
        status: 'failed',
        progress_step: 'Failed — credits refunded automatically',
        error_message: reason,
      })
      .eq('id', orderId);

    if (order.credits_charged > 0) {
      await supabaseAdmin.rpc('grant_user_credits', {
        p_user_id: order.user_id,
        p_amount: order.credits_charged,
        p_tx_type: 'refund',
        p_reference_id: orderId,
        p_description: 'Automatic refund: Research report synthesis failed',
      });
    }
  };

  if (!(await isOpenRouterConfiguredAsync())) {
    await refundOrderOnFailure('OPENROUTER_API_KEY is not configured on the server.');
    return;
  }

  try {
    const [{ data: profile }, { data: catalogItem }, { data: userRow }] = await Promise.all([
      supabaseAdmin.from('profiles').select('*').eq('id', order.profile_id).maybeSingle(),
      supabaseAdmin
        .from('report_catalog')
        .select('*')
        .eq('id', order.report_catalog_id)
        .maybeSingle(),
      supabaseAdmin
        .from('users')
        .select('id, email, full_name, default_language')
        .eq('id', order.user_id)
        .maybeSingle(),
    ]);

    if (!profile || !profile.is_activated || !profile.chart_text_context) {
      await refundOrderOnFailure('Target birth profile is missing or not yet activated.');
      return;
    }

    if (!catalogItem) {
      await refundOrderOnFailure('Report template not found in catalog.');
      return;
    }

    const steps = (
      Array.isArray(catalogItem.prompt_chain_json) && catalogItem.prompt_chain_json.length > 0
        ? catalogItem.prompt_chain_json
        : [
            {
              stepNumber: 1,
              title:
                mode === 'western'
                  ? 'Pass 1 · Comprehensive Tropical Chart & Transit Synthesis'
                  : 'Pass 1 · Comprehensive Chart & Dasha Synthesis',
              instruction:
                mode === 'western'
                  ? 'Deliver a complete Western Tropical & Placidus astrology synthesis grounded in the provided birth chart, planetary aspects, and active transits.'
                  : 'Deliver a complete multi-system Vedic astrology synthesis grounded in the provided birth chart and active Dashas.',
            },
          ]
    ) as ReportPromptStep[];

    // Resolve Western or Vedic chart context
    let activeChartText = String(profile.chart_text_context || '');
    if (mode === 'western' && profile.chart_json) {
      let resolvedJson = profile.chart_json as CompiledChartData;
      if (!resolvedJson.western && resolvedJson.planets?.length) {
        try {
          resolvedJson = enrichCompiledChart(resolvedJson).chartJson;
        } catch {
          // Keep original
        }
      }
      const westernFormatted = formatChartForLLM(resolvedJson, 'western');
      if (westernFormatted) {
        activeChartText = westernFormatted;
      }
    }

    let transitsText = '';
    if (isAstrologyApiConfigured()) {
      try {
        const gochar = await getOrFetchDailyTransits();
        transitsText =
          mode === 'western'
            ? gochar.westernTransitsText || ''
            : gochar.transitsText || '';
      } catch {
        transitsText = '';
      }
    }

    const runtime = await getResolvedOpenRouterRuntime();
    const customModelId = (catalogItem as { model_id?: string | null }).model_id;
    const baseModel =
      typeof customModelId === 'string' && customModelId.trim()
        ? customModelId.trim()
        : runtime.consultationModel || getConsultationModel();
    const languagePref = userRow?.default_language || 'English';
    const userQuestionsText = order.user_questions?.trim()
      ? `USER'S SPECIFIC QUESTIONS FOR THIS REPORT:\n${order.user_questions.trim()}`
      : 'USER QUESTIONS: None specified — cover the core domain comprehensively.';

    const stepOutputs: StepOutputRecord[] = [];
    let accumulatedContext = '';

    await supabaseAdmin
      .from('report_orders')
      .update({
        status: 'processing',
        progress_step: `Starting sequential analysis (${steps.length} passes · ${modeLabel})`,
      })
      .eq('id', orderId);

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const isFinalPass = i === steps.length - 1;

      await supabaseAdmin
        .from('report_orders')
        .update({
          progress_step: step.title || `Pass ${i + 1} of ${steps.length}`,
          step_outputs_json: stepOutputs,
        })
        .eq('id', orderId);

      // Assemble any attached Prompt Library slugs or Composable Recipe for this pass
      const assembledDirectiveParts: string[] = [];
      let stepModel = step.modelId?.trim() || baseModel;

      if (step.recipeSlug) {
        const recipe = await getActiveRecipeBySlug(step.recipeSlug);
        if (recipe) {
          if (!step.modelId && recipe.model_id) {
            stepModel = recipe.model_id;
          }
          const activeRecipeSteps = (recipe.steps_json || []).filter(
            (rs) => rs && rs.enabled !== false && rs.prompt_slug
          );
          if (activeRecipeSteps.length > 0) {
            const { bodies } = await resolvePromptModules(
              activeRecipeSteps.map((rs) => rs.prompt_slug)
            );
            for (const rs of activeRecipeSteps) {
              const body = rs.inline_override?.trim() || bodies[rs.prompt_slug];
              if (body) assembledDirectiveParts.push(body);
            }
          }
        }
      }

      if (Array.isArray(step.promptSlugs) && step.promptSlugs.length > 0) {
        const { bodies } = await resolvePromptModules(step.promptSlugs);
        for (const slug of step.promptSlugs) {
          if (bodies[slug]) assembledDirectiveParts.push(bodies[slug]);
        }
      }

      if (step.instruction?.trim()) {
        assembledDirectiveParts.push(step.instruction.trim());
      }

      const fullStepDirective = assembledDirectiveParts.join('\n\n---\n\n');

      const systemModeRule =
        mode === 'western'
          ? `ASTROLOGY SYSTEM REQUIREMENT (STRICT): Deliver this entire dossier strictly using **Western Astrology (Tropical Zodiac, Placidus Houses, Sun/Moon/Rising, Midheaven, Major Aspects, Elements & Modalities, and Tropical Transits)**. Translate any domain focus into authentic Western astrology methodology. Always label **(${modeLabel})** clearly in the main dossier header.`
          : `ASTROLOGY SYSTEM REQUIREMENT (STRICT): Deliver this dossier in **Vedic Astrology (Sidereal Lahiri Zodiac, Parashari, KP, Jaimini, Nakshatras & Vimshottari Dasha)**. Always label **(${modeLabel})** clearly in the main dossier header.`;

      const prompt = `REPORT: ${catalogItem.name} (${catalogItem.category}) — **(${modeLabel})**
CLIENT PROFILE: ${profile.name} (${profile.birth_date} ${profile.birth_time}, ${profile.birth_city}, ${profile.birth_country})
LANGUAGE: ${languagePref}

${systemModeRule}

${userQuestionsText}

${accumulatedContext ? `PREVIOUS SEQUENTIAL PASSES ALREADY COMPLETED:\n${accumulatedContext}\n\n---\n\n` : ''}
CURRENT ASSIGNMENT — ${step.title} (Pass ${i + 1} of ${steps.length}):
${fullStepDirective}

${
  isFinalPass
    ? `FINAL EDITORIAL REQUIREMENT: Assemble the definitive, publication-ready complete dossier in rich Markdown (# title including (${modeLabel}), ## major sections, clear tables where helpful, bulleted action takeaways). Preserve all exact planetary evidence, degrees, and ${mode === 'western' ? 'aspect/transit timing windows' : 'Dasha timing windows'} discovered in earlier passes, and explicitly answer every user question.`
    : mode === 'western'
    ? `Produce a dense, accurate technical & strategic working brief for this pass with exact Tropical signs, Placidus houses, degrees, major aspects, Chiron/Node placements, and transit dates.`
    : `Produce a dense, accurate technical & strategic working brief for this pass with exact planetary signs, houses, degrees, Nakshatras, KP sub-lords, and Dasha dates.`
}`;

      const completion = await createOpenRouterCompletion({
        model: stepModel,
        maxTokens: runtime.tokenLimits.report_pass,
        system: `${CORE_COUNCIL_CONSTITUTION}

SELECTED ASTROLOGY MODE: ${mode === 'western' ? 'Western Tropical (Placidus)' : 'Vedic Sidereal (Lahiri)'}

ACTIVE NATAL CHART CONTEXT (${modeLabel}):
${activeChartText}

${transitsText ? `\n${transitsText}` : ''}`,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.4,
      });

      const passText = completion.text.trim();
      if (!passText) {
        throw new Error(`Empty response on ${step.title}`);
      }

      const record: StepOutputRecord = {
        stepNumber: step.stepNumber || i + 1,
        title: step.title,
        content: passText,
        completedAt: new Date().toISOString(),
      };
      stepOutputs.push(record);

      accumulatedContext = stepOutputs
        .map((s) => `### ${s.title}\n${s.content}`)
        .join('\n\n');
    }

    const finalMarkdown = stepOutputs[stepOutputs.length - 1].content;

    await supabaseAdmin
      .from('report_orders')
      .update({
        status: 'generating_pdf',
        progress_step: 'Typesetting PDF dossier & creating Chat follow-up thread',
        step_outputs_json: stepOutputs,
        final_markdown: finalMarkdown,
      })
      .eq('id', orderId);

    // Build binary PDF & upload to Supabase Storage 'reports' bucket (best-effort)
    const birthSummary = `${profile.birth_date} ${profile.birth_time} · ${profile.birth_city}, ${profile.birth_country}`;
    const pdfModeLabel =
      mode === 'western' ? 'Western Astrology (Tropical)' : 'Vedic Astrology (Sidereal)';
    const pdfBuffer = await generateReportPdfBuffer({
      orderId,
      reportTitle: catalogItem.name,
      category: `${catalogItem.category} · ${pdfModeLabel}`,
      profileName: profile.name,
      birthSummary,
      generatedAt: new Date().toISOString(),
      finalMarkdown,
    });

    try {
      const storagePath = `${order.user_id}/${orderId}.pdf`;
      await supabaseAdmin.storage.createBucket('reports', { public: false }).catch(() => null);
      await supabaseAdmin.storage
        .from('reports')
        .upload(storagePath, pdfBuffer, {
          contentType: 'application/pdf',
          upsert: true,
        });
    } catch {
      // On-demand /api/reports/orders/:id/pdf endpoint always renders directly from final_markdown as fallback
    }

    // Automatic Report-to-Chat: create interactive follow-up conversation inside Chat
    let linkedConversationId: string | null = null;
    try {
      const introExcerpt = finalMarkdown.slice(0, 12000);
      const followups = await generateFollowUpQuestions({
        userQuestion:
          order.user_questions ||
          `Discuss key findings and timing windows in ${catalogItem.name}`,
        assistantAnswer: introExcerpt,
        modeSlug: 'general',
        languageSlug: languagePref,
        hasProfile: true,
      });

      const { data: convo } = await supabaseAdmin
        .from('conversations')
        .insert({
          user_id: order.user_id,
          profile_id: profile.id,
          linked_report_id: orderId,
          title: `${catalogItem.name} (${modeLabel}) — ${profile.name}`.slice(0, 85),
          mode_type: 'report_followup',
          use_full_profile_memory: true,
          total_word_count: countWords(introExcerpt),
        })
        .select('id')
        .single();

      if (convo?.id) {
        linkedConversationId = convo.id;
        await supabaseAdmin.from('messages').insert({
          conversation_id: convo.id,
          role: 'assistant',
          content: `Your **${catalogItem.name} (${modeLabel})** for **${profile.name}** is ready. Below is the complete dossier loaded into our consultation context so you can ask follow-up questions about any timeline, planetary combination, or decision.\n\n---\n\n${finalMarkdown}`,
          word_count: countWords(finalMarkdown),
          expert_used: mode === 'western' ? 'western_astrologer' : 'council_synthesis',
          mode_used: 'general',
          output_format_used: 'detailed',
          language_used: languagePref,
          followups_json: followups,
        });
      }
    } catch (chatErr) {
      console.warn('[reportWorker] Report-to-Chat link non-fatal error:', chatErr);
    }

    const pdfDownloadRoute = `/api/reports/orders/${orderId}/pdf`;

    await supabaseAdmin
      .from('report_orders')
      .update({
        status: 'completed',
        progress_step: 'Completed',
        step_outputs_json: stepOutputs,
        final_markdown: finalMarkdown,
        pdf_url: pdfDownloadRoute,
        linked_conversation_id: linkedConversationId,
        completed_at: new Date().toISOString(),
      })
      .eq('id', orderId);

    // Notify user via Resend email
    if (userRow?.email) {
      void sendReportReadyEmail({
        to: userRow.email,
        name: userRow.full_name,
        reportTitle: catalogItem.name,
        profileName: profile.name,
        appUrl: appOrigin || 'https://app.cosmiccouncil.pro',
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Report synthesis failed';
    await refundOrderOnFailure(message);
  }
}
