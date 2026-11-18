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
  isOpenRouterConfigured,
} from '../services/openrouter';
import { generateReportPdfBuffer } from '../services/pdfGenerator';
import { CORE_COUNCIL_CONSTITUTION } from '../services/promptDefaults';
import type { ReportPromptStep } from '../services/reportDefaults';
import { scheduleBackgroundTask } from '../lib/backgroundTask';

export interface StepOutputRecord {
  stepNumber: number;
  title: string;
  content: string;
  completedAt: string;
}

const activeWorkers = new Set<string>();

export function enqueueReportOrder(orderId: string, appOrigin?: string): void {
  if (activeWorkers.has(orderId)) return;
  activeWorkers.add(orderId);

  scheduleBackgroundTask(async () => {
    try {
      await processReportOrder(orderId, appOrigin);
    } finally {
      activeWorkers.delete(orderId);
    }
  });
}

async function processReportOrder(orderId: string, appOrigin?: string): Promise<void> {
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
        p_description: 'Automatic refund: Deep Research report synthesis failed',
      });
    }
  };

  if (!isOpenRouterConfigured()) {
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
              title: 'Pass 1 · Comprehensive Chart & Dasha Synthesis',
              instruction:
                'Deliver a complete multi-system Vedic astrology synthesis grounded in the provided birth chart and active Dashas.',
            },
          ]
    ) as ReportPromptStep[];

    let gocharText = '';
    if (isAstrologyApiConfigured()) {
      try {
        const gochar = await getOrFetchDailyTransits();
        gocharText = gochar.transitsText;
      } catch {
        gocharText = '';
      }
    }

    const model = getConsultationModel();
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
        progress_step: `Starting sequential analysis (${steps.length} passes)`,
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

      const prompt = `REPORT: ${catalogItem.name} (${catalogItem.category})
CLIENT PROFILE: ${profile.name} (${profile.birth_date} ${profile.birth_time}, ${profile.birth_city}, ${profile.birth_country})
LANGUAGE: ${languagePref}

${userQuestionsText}

${accumulatedContext ? `PREVIOUS SEQUENTIAL PASSES ALREADY COMPLETED:\n${accumulatedContext}\n\n---\n\n` : ''}
CURRENT ASSIGNMENT — ${step.title} (Pass ${i + 1} of ${steps.length}):
${step.instruction}

${
  isFinalPass
    ? `FINAL EDITORIAL REQUIREMENT: Assemble the definitive, publication-ready complete dossier in rich Markdown (# title, ## major sections, clear tables where helpful, bulleted action takeaways). Preserve all exact planetary evidence, degrees, and Dasha timing windows discovered in earlier passes, and explicitly answer every user question.`
    : `Produce a dense, accurate technical & strategic working brief for this pass with exact planetary signs, houses, degrees, Nakshatras, KP sub-lords, and Dasha dates.`
}`;

      const completion = await createOpenRouterCompletion({
        model,
        system: `${CORE_COUNCIL_CONSTITUTION}

ACTIVE NATAL CHART CONTEXT:
${profile.chart_text_context}

${gocharText ? `\n${gocharText}` : ''}`,
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
        progress_step: 'Typesetting Observatory PDF & creating Chat follow-up thread',
        step_outputs_json: stepOutputs,
        final_markdown: finalMarkdown,
      })
      .eq('id', orderId);

    // Build binary PDF & upload to Supabase Storage 'reports' bucket (best-effort)
    const birthSummary = `${profile.birth_date} ${profile.birth_time} · ${profile.birth_city}, ${profile.birth_country}`;
    const pdfBuffer = await generateReportPdfBuffer({
      orderId,
      reportTitle: catalogItem.name,
      category: catalogItem.category,
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

    // Automatic Report-to-Chat: create interactive follow-up conversation inside Chat Studio
    let linkedConversationId: string | null = null;
    try {
      const introExcerpt = finalMarkdown.slice(0, 12000);
      const followups = await generateFollowUpQuestions({
        userQuestion:
          order.user_questions ||
          `Discuss key findings and timing windows in ${catalogItem.name}`,
        assistantAnswer: introExcerpt,
        modeSlug: 'life',
        languageSlug: languagePref,
        hasProfile: true,
      });

      const { data: convo } = await supabaseAdmin
        .from('conversations')
        .insert({
          user_id: order.user_id,
          profile_id: profile.id,
          linked_report_id: orderId,
          title: `${catalogItem.name} — ${profile.name}`.slice(0, 85),
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
          content: `Your **${catalogItem.name}** for **${profile.name}** is ready. Below is the complete dossier loaded into our consultation context so you can ask follow-up questions about any timeline, planetary combination, or decision.\n\n---\n\n${finalMarkdown}`,
          word_count: countWords(finalMarkdown),
          expert_used: 'council_synthesis',
          mode_used: 'life',
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
