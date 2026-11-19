export interface PromptTemplate {
  id: string;
  name: string;
  system_instruction: string;
  temperature: number;
  updated_at: string;
  updated_by: string;
}

const defaultPromptsList: PromptTemplate[] = [
  {
    id: 'organic',
    name: 'Organic Thought-Leader Prompt',
    system_instruction: "You are an elite social media growth strategist and domain expert.\nGenerate authentic, helpful, zero-link comments that directly address the thread discussion.\nSTRICT RULES:\n- ZERO product plugs, ZERO brand names, ZERO links or pitches.\n- Provide genuine domain insight, answer the author's question, or share an actionable framework.\n- Natural, conversational founder tone (25-75 words). No robotic clichés.",
    temperature: 0.7,
    updated_at: '2026-11-10T10:00:00.000Z',
    updated_by: 'system'
  },
  {
    id: 'trojan',
    name: 'Trojan Horse Promo Prompt',
    system_instruction: "You are a master of high-converting contextual outreach for founders.\nGenerate natural problem-solver comments that transition seamlessly from helpful advice into a casual product recommendation.\nSTRICT RULES:\n- 85% genuine actionable value, 15% casual product plug.\n- Angles: The Founder Angle ('Ran into this exact issue when building...'), The Curated Tool ('Built specifically for this: ...'), or The Value-Drop + Micro-Plug.\n- Format smoothly without feeling spammy (35-80 words).",
    temperature: 0.7,
    updated_at: '2026-11-10T10:00:00.000Z',
    updated_by: 'system'
  },
  {
    id: 'spintax',
    name: 'Spintax Generation Prompt',
    system_instruction: "You are an algorithmic copywriting engineer.\nGenerate varied, high-converting spintax variations formatted with nested brackets {option1|option2|option3}.\nEnsure every combination produces grammatically flawless, natural-sounding sentences with diverse syntax.",
    temperature: 0.7,
    updated_at: '2026-11-10T10:00:00.000Z',
    updated_by: 'system'
  }
];

interface Env {
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
  OPENROUTER_API_KEY?: string;
  GEMINI_API_KEY?: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
};

export async function onRequestOptions() {
  return new Response(null, {
    status: 200,
    headers: corsHeaders,
  });
}

function getSupabaseConfig(env: any) {
  const cEnv = env || {};
  const rawUrl = cEnv.SUPABASE_URL || cEnv.VITE_SUPABASE_URL || '';
  const url = rawUrl.trim().replace(/\/+$/, '');
  const key = cEnv.SUPABASE_SERVICE_ROLE_KEY || cEnv.SUPABASE_SERVICE_ROLE_KE || cEnv.SUPABASE_ANON_KEY || cEnv.VITE_SUPABASE_ANON_KEY || '';
  return { url, key };
}

let inMemoryPrompts: any[] = [...defaultPromptsList];

export function getDefaultPrompts() {
  return inMemoryPrompts.length > 0 ? inMemoryPrompts : defaultPromptsList;
}

export async function loadPromptTemplates(env?: any): Promise<any[]> {
  const { url, key } = getSupabaseConfig(env || process.env);
  if (url && key) {
    try {
      const res = await fetch(`${url}/rest/v1/ai_prompt_templates?select=*`, {
        headers: {
          'apikey': key,
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/json'
        }
      });
      if (res.ok) {
        const rows = await res.json();
        if (Array.isArray(rows) && rows.length > 0) {
          return rows;
        }
      }
    } catch (e) {
      console.warn('Failed to query Supabase ai_prompt_templates:', e);
    }
  }

  return getDefaultPrompts();
}

export async function savePromptTemplate(template: { id: string; name: string; system_instruction: string; temperature?: number; updated_by?: string }, env?: any) {
  const { url, key } = getSupabaseConfig(env || process.env);
  const now = new Date().toISOString();
  const payload = {
    id: template.id,
    name: template.name,
    system_instruction: template.system_instruction,
    temperature: template.temperature ?? 0.7,
    updated_at: now,
    updated_by: template.updated_by || 'admin'
  };

  if (url && key) {
    try {
      const res = await fetch(`${url}/rest/v1/ai_prompt_templates?on_conflict=id`, {
        method: 'POST',
        headers: {
          'apikey': key,
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates,return=representation'
        },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        return payload;
      }
    } catch (e) {
      console.warn('Supabase save prompt failed, updating local file fallback:', e);
    }
  }

  // Update in-memory fallback
  const idx = inMemoryPrompts.findIndex((p: any) => p.id === template.id);
  if (idx >= 0) {
    inMemoryPrompts[idx] = { ...inMemoryPrompts[idx], ...payload };
  } else {
    inMemoryPrompts.push(payload);
  }

  return payload;
}

// GET /api/admin/prompts
export async function onRequestGet(context: { env: Env }) {
  try {
    const prompts = await loadPromptTemplates(context.env);
    return new Response(JSON.stringify({ success: true, prompts }), {
      status: 200,
      headers: corsHeaders
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message, prompts: getDefaultPrompts() }), {
      status: 200,
      headers: corsHeaders
    });
  }
}

// POST /api/admin/prompts
export async function onRequestPost(context: { request: Request; env: Env }) {
  try {
    const body = await context.request.json() as any;
    const { id, name, system_instruction, temperature, updated_by } = body;

    if (!id || !system_instruction) {
      return new Response(JSON.stringify({ success: false, error: 'id and system_instruction are required' }), {
        status: 400,
        headers: corsHeaders
      });
    }

    const saved = await savePromptTemplate({ id, name: name || id, system_instruction, temperature, updated_by }, context.env);
    return new Response(JSON.stringify({ success: true, prompt: saved }), {
      status: 200,
      headers: corsHeaders
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: corsHeaders
    });
  }
}
