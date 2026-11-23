import {
  DEFAULT_MINI_APP_CATEGORY_RECORDS,
  type MiniAppCategoryRecord,
  type MiniAppDefinition,
  type MiniAppRuleItem,
  type MiniAppTemplate,
} from '../../components/app/miniAppsTypes';
import { getSupabaseAdmin } from '../lib/supabaseAdmin';
import {
  DEFAULT_APP_PROMPT_TEMPLATES,
  MINI_APPS_BY_SLUG,
  MINI_APPS_CATALOG,
} from './miniAppsCatalog';
import {
  getMiniAppsConfig,
  savePlatformSetting,
  type MiniAppsGovernanceConfig,
} from './platformSettings';

export interface AdminMiniAppRecord extends MiniAppDefinition {
  sortOrder: number;
  isActive: boolean;
  vedicPrompt: string;
  westernPrompt: string;
  systemOverride: string;
  rules: MiniAppRuleItem[];
  inputLabel: string;
  inputPlaceholder: string;
  modelId: string | null;
  isBuiltIn: boolean;
  hasDefaultPrompt: boolean;
  defaultVedicPrompt: string;
  defaultWesternPrompt: string;
}

interface StoredRegistryBlob {
  categories: MiniAppCategoryRecord[];
  apps: Array<{
    slug: string;
    title: string;
    shortTitle: string;
    tagline: string;
    description: string;
    category: string;
    template: MiniAppTemplate;
    iconKey: string;
    popular: boolean;
    featuredOnHome: boolean;
    requiresProfile: boolean;
    cacheScope: 'daily' | 'weekly' | 'monthly' | 'chart' | 'none';
    chatSeedPrompt: string;
    estimatedRead: string;
    vedicPrompt: string;
    westernPrompt: string;
    systemOverride: string;
    rules?: MiniAppRuleItem[];
    inputLabel: string;
    inputPlaceholder: string;
    modelId: string | null;
    isActive: boolean;
    sortOrder: number;
  }>;
}

const REGISTRY_TTL_MS = 3 * 60 * 1000;
let registryCache: {
  categories: MiniAppCategoryRecord[];
  apps: AdminMiniAppRecord[];
  source: 'tables' | 'settings' | 'defaults';
  expiresAt: number;
} | null = null;

export function invalidateMiniAppsRegistryCache(): void {
  registryCache = null;
}

function sanitizeAppSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

function sanitizeCategorySlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
}

function sanitizeMiniAppRules(raw: unknown): MiniAppRuleItem[] {
  if (!Array.isArray(raw)) return [];
  const out: MiniAppRuleItem[] = [];
  for (let i = 0; i < raw.length && out.length < 25; i++) {
    const item = raw[i];
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const title = typeof rec.title === 'string' ? rec.title.trim().slice(0, 120) : '';
    const body = typeof rec.body === 'string' ? rec.body.trim().slice(0, 4000) : '';
    if (!title && !body) continue;
    const idRaw = typeof rec.id === 'string' && rec.id.trim() ? rec.id.trim().slice(0, 64) : `rule_${i + 1}`;
    out.push({
      id: idRaw,
      title: title || `Rule #${out.length + 1}`,
      body,
      enabled: rec.enabled !== false,
    });
  }
  return out;
}

function buildDefaultSeedRegistry(cfg: MiniAppsGovernanceConfig): {
  categories: MiniAppCategoryRecord[];
  apps: AdminMiniAppRecord[];
} {
  const categories = DEFAULT_MINI_APP_CATEGORY_RECORDS.map((c) => ({ ...c }));
  const apps: AdminMiniAppRecord[] = MINI_APPS_CATALOG.map((app, index) => {
    const ov = cfg.overrides[app.slug];
    const defaults = DEFAULT_APP_PROMPT_TEMPLATES[app.slug] || {
      vedicPrompt: '',
      westernPrompt: '',
    };
    return {
      ...app,
      sortOrder: (index + 1) * 10,
      isActive: ov ? ov.enabled !== false : true,
      featuredOnHome:
        typeof ov?.featured_on_home === 'boolean' ? ov.featured_on_home : app.featuredOnHome,
      vedicPrompt: defaults.vedicPrompt,
      westernPrompt: defaults.westernPrompt,
      systemOverride: '',
      rules: [],
      inputLabel: '',
      inputPlaceholder: '',
      modelId: ov?.model_id || null,
      isBuiltIn: true,
      hasDefaultPrompt: Boolean(defaults.vedicPrompt || defaults.westernPrompt),
      defaultVedicPrompt: defaults.vedicPrompt,
      defaultWesternPrompt: defaults.westernPrompt,
    };
  });
  return { categories, apps };
}

function enrichAdminAppRecord(
  raw: StoredRegistryBlob['apps'][number],
  catMap: Map<string, MiniAppCategoryRecord>
): AdminMiniAppRecord {
  const builtIn = MINI_APPS_BY_SLUG[raw.slug];
  const defaults = DEFAULT_APP_PROMPT_TEMPLATES[raw.slug] || {
    vedicPrompt: '',
    westernPrompt: '',
  };
  const cat = catMap.get(raw.category);
  return {
    slug: raw.slug,
    title: raw.title,
    shortTitle: raw.shortTitle || raw.title,
    tagline: raw.tagline || '',
    description: raw.description || '',
    category: raw.category,
    categoryLabel: cat?.label || builtIn?.categoryLabel || raw.category,
    template: raw.template || 'auto_brief',
    iconKey: raw.iconKey || 'sparkles',
    popular: Boolean(raw.popular),
    featuredOnHome: Boolean(raw.featuredOnHome),
    requiresProfile: raw.requiresProfile !== false,
    cacheScope: raw.cacheScope || 'monthly',
    chatSeedPrompt: raw.chatSeedPrompt || '',
    estimatedRead: raw.estimatedRead || '3 min read',
    sortOrder: Number.isFinite(raw.sortOrder) ? raw.sortOrder : 999,
    isActive: raw.isActive !== false,
    vedicPrompt: typeof raw.vedicPrompt === 'string' ? raw.vedicPrompt : defaults.vedicPrompt,
    westernPrompt:
      typeof raw.westernPrompt === 'string' ? raw.westernPrompt : defaults.westernPrompt,
    systemOverride: typeof raw.systemOverride === 'string' ? raw.systemOverride : '',
    rules: sanitizeMiniAppRules(raw.rules),
    inputLabel: typeof raw.inputLabel === 'string' ? raw.inputLabel : '',
    inputPlaceholder: typeof raw.inputPlaceholder === 'string' ? raw.inputPlaceholder : '',
    modelId: raw.modelId || null,
    isBuiltIn: Boolean(builtIn),
    hasDefaultPrompt: Boolean(defaults.vedicPrompt || defaults.westernPrompt),
    defaultVedicPrompt: defaults.vedicPrompt,
    defaultWesternPrompt: defaults.westernPrompt,
  };
}

function toPublicMiniAppDefinition(app: AdminMiniAppRecord): MiniAppDefinition {
  return {
    slug: app.slug,
    title: app.title,
    shortTitle: app.shortTitle,
    tagline: app.tagline,
    description: app.description,
    category: app.category,
    categoryLabel: app.categoryLabel,
    template: app.template,
    iconKey: app.iconKey,
    popular: app.popular,
    featuredOnHome: app.featuredOnHome,
    requiresProfile: app.requiresProfile,
    cacheScope: app.cacheScope,
    chatSeedPrompt: app.chatSeedPrompt,
    estimatedRead: app.estimatedRead,
    sortOrder: app.sortOrder,
    isActive: app.isActive,
    inputLabel: app.inputLabel || undefined,
    inputPlaceholder: app.inputPlaceholder || undefined,
  };
}

async function readMiniAppRulesOverlay(): Promise<Record<string, MiniAppRuleItem[]>> {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) return {};
  try {
    const { data, error } = await supabaseAdmin
      .from('platform_settings')
      .select('value_json')
      .eq('key', 'mini_apps_rules_overlay')
      .maybeSingle();
    if (error || !data || typeof data.value_json !== 'object' || data.value_json === null) {
      return {};
    }
    const rawMap = data.value_json as Record<string, unknown>;
    const result: Record<string, MiniAppRuleItem[]> = {};
    for (const [slug, val] of Object.entries(rawMap)) {
      result[slug] = sanitizeMiniAppRules(val);
    }
    return result;
  } catch {
    return {};
  }
}

async function saveMiniAppRulesOverlayEntry(
  slug: string,
  rules: MiniAppRuleItem[],
  adminUserId?: string | null
): Promise<void> {
  try {
    const currentMap = await readMiniAppRulesOverlay();
    currentMap[slug] = rules;
    await savePlatformSetting('mini_apps_rules_overlay', currentMap, adminUserId);
  } catch {
    // Non-fatal
  }
}

async function readSettingsFallbackRegistry(): Promise<StoredRegistryBlob | null> {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) return null;
  try {
    const { data, error } = await supabaseAdmin
      .from('platform_settings')
      .select('value_json')
      .eq('key', 'mini_apps_registry')
      .maybeSingle();
    if (error || !data || typeof data.value_json !== 'object' || data.value_json === null) {
      return null;
    }
    const val = data.value_json as Partial<StoredRegistryBlob>;
    if (!Array.isArray(val.categories) || !Array.isArray(val.apps)) {
      return null;
    }
    return {
      categories: val.categories,
      apps: val.apps,
    };
  } catch {
    return null;
  }
}

async function seedDedicatedTables(
  categories: MiniAppCategoryRecord[],
  apps: AdminMiniAppRecord[]
): Promise<boolean> {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) return false;
  try {
    const catRows = categories.map((c) => ({
      slug: c.slug,
      label: c.label,
      sort_order: c.sortOrder,
      is_active: c.isActive,
      updated_at: new Date().toISOString(),
    }));
    const appRows = apps.map((a) => ({
      slug: a.slug,
      title: a.title,
      short_title: a.shortTitle,
      tagline: a.tagline,
      description: a.description,
      category_slug: a.category,
      template: a.template,
      icon_key: a.iconKey,
      popular: a.popular,
      featured_on_home: a.featuredOnHome,
      requires_profile: a.requiresProfile,
      cache_scope: a.cacheScope,
      chat_seed_prompt: a.chatSeedPrompt,
      estimated_read: a.estimatedRead,
      vedic_prompt: a.vedicPrompt,
      western_prompt: a.westernPrompt,
      system_override: a.systemOverride,
      input_label: a.inputLabel,
      input_placeholder: a.inputPlaceholder,
      model_id: a.modelId,
      is_active: a.isActive,
      sort_order: a.sortOrder,
      updated_at: new Date().toISOString(),
    }));

    const { error: cErr } = await supabaseAdmin
      .from('mini_app_categories')
      .upsert(catRows, { onConflict: 'slug' });
    if (cErr) return false;

    const { error: aErr } = await supabaseAdmin
      .from('mini_apps')
      .upsert(appRows, { onConflict: 'slug' });
    return !aErr;
  } catch {
    return false;
  }
}

async function loadResolvedRegistry(): Promise<{
  categories: MiniAppCategoryRecord[];
  apps: AdminMiniAppRecord[];
  source: 'tables' | 'settings' | 'defaults';
}> {
  const now = Date.now();
  if (registryCache && registryCache.expiresAt > now) {
    return {
      categories: registryCache.categories,
      apps: registryCache.apps,
      source: registryCache.source,
    };
  }

  const supabaseAdmin = getSupabaseAdmin();
  const cfg = await getMiniAppsConfig();
  const defaultSeed = buildDefaultSeedRegistry(cfg);

  if (!supabaseAdmin) {
    registryCache = { ...defaultSeed, source: 'defaults', expiresAt: now + REGISTRY_TTL_MS };
    return { ...defaultSeed, source: 'defaults' };
  }

  // 1. Try dedicated migration 016 tables first (with optional migration 017 rules_json column)
  try {
    const [catRes, initialAppRes] = await Promise.all([
      supabaseAdmin
        .from('mini_app_categories')
        .select('slug, label, sort_order, is_active')
        .order('sort_order', { ascending: true }),
      supabaseAdmin
        .from('mini_apps')
        .select(
          'slug, title, short_title, tagline, description, category_slug, template, icon_key, popular, featured_on_home, requires_profile, cache_scope, chat_seed_prompt, estimated_read, vedic_prompt, western_prompt, system_override, rules_json, input_label, input_placeholder, model_id, is_active, sort_order'
        )
        .order('sort_order', { ascending: true }),
    ]);

    let appRes = initialAppRes as {
      data: Array<Record<string, unknown>> | null;
      error: { message?: string; code?: string } | null;
    };
    let rulesOverlay: Record<string, MiniAppRuleItem[]> = {};

    if (
      appRes.error &&
      (appRes.error.code === '42703' ||
        String(appRes.error.message || '').toLowerCase().includes('rules_json'))
    ) {
      const [fallbackAppRes, overlay] = await Promise.all([
        supabaseAdmin
          .from('mini_apps')
          .select(
            'slug, title, short_title, tagline, description, category_slug, template, icon_key, popular, featured_on_home, requires_profile, cache_scope, chat_seed_prompt, estimated_read, vedic_prompt, western_prompt, system_override, input_label, input_placeholder, model_id, is_active, sort_order'
          )
          .order('sort_order', { ascending: true }),
        readMiniAppRulesOverlay(),
      ]);
      appRes = fallbackAppRes as unknown as typeof appRes;
      rulesOverlay = overlay;
    }

    if (!catRes.error && !appRes.error && Array.isArray(catRes.data) && Array.isArray(appRes.data)) {
      if (catRes.data.length === 0 && appRes.data.length === 0) {
        // Table exists but empty — check if platform_settings already has saved registry to migrate
        const settingsBlob = await readSettingsFallbackRegistry();
        if (settingsBlob) {
          const catMap = new Map(settingsBlob.categories.map((c) => [c.slug, c]));
          const enrichedApps = settingsBlob.apps.map((a) => enrichAdminAppRecord(a, catMap));
          await seedDedicatedTables(settingsBlob.categories, enrichedApps);
          registryCache = {
            categories: settingsBlob.categories.sort((a, b) => a.sortOrder - b.sortOrder),
            apps: enrichedApps.sort((a, b) => a.sortOrder - b.sortOrder),
            source: 'tables',
            expiresAt: now + REGISTRY_TTL_MS,
          };
          return {
            categories: registryCache.categories,
            apps: registryCache.apps,
            source: 'tables',
          };
        }
        await seedDedicatedTables(defaultSeed.categories, defaultSeed.apps);
        registryCache = { ...defaultSeed, source: 'tables', expiresAt: now + REGISTRY_TTL_MS };
        return { ...defaultSeed, source: 'tables' };
      }

      const categories: MiniAppCategoryRecord[] = catRes.data.map((r) => ({
        slug: String(r.slug),
        label: String(r.label),
        sortOrder: Number(r.sort_order ?? 0),
        isActive: r.is_active !== false,
      }));
      const catMap = new Map(categories.map((c) => [c.slug, c]));

      const apps: AdminMiniAppRecord[] = appRes.data.map((r) => {
        const slugStr = String(r.slug);
        const rulesSource =
          r.rules_json !== undefined ? r.rules_json : rulesOverlay[slugStr] || [];
        return enrichAdminAppRecord(
          {
            slug: slugStr,
            title: String(r.title),
            shortTitle: String(r.short_title || r.title),
            tagline: String(r.tagline || ''),
            description: String(r.description || ''),
            category: String(r.category_slug || 'self_chart'),
            template: String(r.template || 'auto_brief') as MiniAppTemplate,
            iconKey: String(r.icon_key || 'sparkles'),
            popular: Boolean(r.popular),
            featuredOnHome: Boolean(r.featured_on_home),
            requiresProfile: r.requires_profile !== false,
            cacheScope: String(r.cache_scope || 'monthly') as MiniAppDefinition['cacheScope'],
            chatSeedPrompt: String(r.chat_seed_prompt || ''),
            estimatedRead: String(r.estimated_read || '3 min read'),
            vedicPrompt: String(r.vedic_prompt || ''),
            westernPrompt: String(r.western_prompt || ''),
            systemOverride: String(r.system_override || ''),
            rules: sanitizeMiniAppRules(rulesSource),
            inputLabel: String(r.input_label || ''),
            inputPlaceholder: String(r.input_placeholder || ''),
            modelId: r.model_id ? String(r.model_id) : null,
            isActive: r.is_active !== false,
            sortOrder: Number(r.sort_order ?? 0),
          },
          catMap
        );
      });

      categories.sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label));
      apps.sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title));

      registryCache = { categories, apps, source: 'tables', expiresAt: now + REGISTRY_TTL_MS };
      return { categories, apps, source: 'tables' };
    }
  } catch {
    // Fall through to platform_settings fallback
  }

  // 2. Fallback to platform_settings key 'mini_apps_registry'
  const settingsBlob = await readSettingsFallbackRegistry();
  if (settingsBlob) {
    const categories = [...settingsBlob.categories].sort(
      (a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label)
    );
    const catMap = new Map(categories.map((c) => [c.slug, c]));
    const apps = settingsBlob.apps
      .map((a) => enrichAdminAppRecord(a, catMap))
      .sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title));
    registryCache = { categories, apps, source: 'settings', expiresAt: now + REGISTRY_TTL_MS };
    return { categories, apps, source: 'settings' };
  }

  registryCache = { ...defaultSeed, source: 'defaults', expiresAt: now + REGISTRY_TTL_MS };
  return { ...defaultSeed, source: 'defaults' };
}

async function persistSettingsRegistrySnapshot(
  categories: MiniAppCategoryRecord[],
  apps: AdminMiniAppRecord[],
  adminUserId?: string | null
): Promise<{ ok: boolean; error?: string }> {
  const blob: StoredRegistryBlob = {
    categories: categories.map((c) => ({ ...c })),
    apps: apps.map((a) => ({
      slug: a.slug,
      title: a.title,
      shortTitle: a.shortTitle,
      tagline: a.tagline,
      description: a.description,
      category: a.category,
      template: a.template,
      iconKey: a.iconKey,
      popular: a.popular,
      featuredOnHome: a.featuredOnHome,
      requiresProfile: a.requiresProfile,
      cacheScope: a.cacheScope,
      chatSeedPrompt: a.chatSeedPrompt,
      estimatedRead: a.estimatedRead,
      vedicPrompt: a.vedicPrompt,
      westernPrompt: a.westernPrompt,
      systemOverride: a.systemOverride,
      rules: a.rules,
      inputLabel: a.inputLabel,
      inputPlaceholder: a.inputPlaceholder,
      modelId: a.modelId,
      isActive: a.isActive,
      sortOrder: a.sortOrder,
    })),
  };
  return savePlatformSetting('mini_apps_registry', blob, adminUserId);
}

async function syncOverrideFieldsToMiniAppsConfig(
  slug: string,
  patch: { isActive?: boolean; featuredOnHome?: boolean; modelId?: string | null },
  adminUserId?: string | null
): Promise<void> {
  try {
    const cfg = await getMiniAppsConfig();
    const prevOv = cfg.overrides[slug] || {};
    const nextConfig: MiniAppsGovernanceConfig = {
      ...cfg,
      overrides: {
        ...cfg.overrides,
        [slug]: {
          ...prevOv,
          ...(typeof patch.isActive === 'boolean' ? { enabled: patch.isActive } : {}),
          ...(typeof patch.featuredOnHome === 'boolean'
            ? { featured_on_home: patch.featuredOnHome }
            : {}),
          ...(patch.modelId !== undefined ? { model_id: patch.modelId } : {}),
        },
      },
    };
    await savePlatformSetting('mini_apps_config', nextConfig, adminUserId);
  } catch {
    // Non-fatal
  }
}

async function cleanupOverrideFromMiniAppsConfig(
  slug: string,
  adminUserId?: string | null
): Promise<void> {
  try {
    const cfg = await getMiniAppsConfig();
    if (!cfg.overrides || !Object.prototype.hasOwnProperty.call(cfg.overrides, slug)) {
      return;
    }
    const nextOverrides = { ...cfg.overrides };
    delete nextOverrides[slug];
    await savePlatformSetting(
      'mini_apps_config',
      {
        ...cfg,
        overrides: nextOverrides,
      },
      adminUserId
    );
  } catch {
    // Non-fatal
  }
}

export async function syncMiniAppsConfigOverridesToRegistry(
  overrides: MiniAppsGovernanceConfig['overrides'],
  adminUserId?: string | null
): Promise<void> {
  try {
    const current = await loadResolvedRegistry();
    const supabaseAdmin = getSupabaseAdmin();
    if (current.source === 'tables' && supabaseAdmin) {
      const nowIso = new Date().toISOString();
      const updates = current.apps
        .filter((a) => Boolean(overrides[a.slug]))
        .map((a) => {
          const ov = overrides[a.slug];
          return supabaseAdmin
            .from('mini_apps')
            .update({
              is_active: typeof ov.enabled === 'boolean' ? ov.enabled : a.isActive,
              featured_on_home:
                typeof ov.featured_on_home === 'boolean' ? ov.featured_on_home : a.featuredOnHome,
              model_id: ov.model_id !== undefined ? ov.model_id : a.modelId,
              updated_at: nowIso,
            })
            .eq('slug', a.slug);
        });
      if (updates.length > 0) {
        await Promise.all(updates);
      }
    } else if (current.source === 'settings') {
      const nextApps = current.apps.map((a) => {
        const ov = overrides[a.slug];
        if (!ov) return a;
        return {
          ...a,
          isActive: typeof ov.enabled === 'boolean' ? ov.enabled : a.isActive,
          featuredOnHome:
            typeof ov.featured_on_home === 'boolean' ? ov.featured_on_home : a.featuredOnHome,
          modelId: ov.model_id !== undefined ? ov.model_id : a.modelId,
        };
      });
      await persistSettingsRegistrySnapshot(current.categories, nextApps, adminUserId);
    }
    invalidateMiniAppsRegistryCache();
  } catch {
    // Non-fatal
  }
}

export async function getDynamicMiniAppsPublicCatalog(): Promise<{
  categories: MiniAppCategoryRecord[];
  apps: MiniAppDefinition[];
}> {
  const { categories, apps } = await loadResolvedRegistry();
  const cfg = await getMiniAppsConfig();

  const activeCategories = categories.filter((c) => c.isActive);
  const activeCatSet = new Set(activeCategories.map((c) => c.slug));
  const catLabelMap = new Map(categories.map((c) => [c.slug, c.label]));

  const visibleApps: MiniAppDefinition[] = [];
  for (const app of apps) {
    const ov = cfg.overrides[app.slug];
    const effectiveActive = ov && ov.enabled === false ? false : app.isActive;
    if (!effectiveActive) continue;
    // If category exists and was explicitly hidden by Admin, hide apps in that category too
    if (catLabelMap.has(app.category) && !activeCatSet.has(app.category)) continue;

    const effectiveFeatured =
      typeof ov?.featured_on_home === 'boolean' ? ov.featured_on_home : app.featuredOnHome;

    visibleApps.push(
      toPublicMiniAppDefinition({
        ...app,
        featuredOnHome: effectiveFeatured,
        categoryLabel: catLabelMap.get(app.category) || app.categoryLabel,
      })
    );
  }

  return {
    categories: activeCategories,
    apps: visibleApps,
  };
}

export async function getDynamicMiniAppsAdminCatalog(): Promise<{
  categories: MiniAppCategoryRecord[];
  apps: AdminMiniAppRecord[];
  storageSource: 'tables' | 'settings' | 'defaults';
}> {
  const { categories, apps, source } = await loadResolvedRegistry();
  const cfg = await getMiniAppsConfig();
  const catLabelMap = new Map(categories.map((c) => [c.slug, c.label]));

  const resolvedApps = apps.map((app) => {
    const ov = cfg.overrides[app.slug];
    return {
      ...app,
      categoryLabel: catLabelMap.get(app.category) || app.categoryLabel,
      isActive: ov?.enabled !== undefined ? ov.enabled !== false : app.isActive,
      featuredOnHome:
        ov?.featured_on_home !== undefined ? ov.featured_on_home : app.featuredOnHome,
      modelId: ov?.model_id !== undefined ? ov.model_id : app.modelId,
    };
  });

  return {
    categories,
    apps: resolvedApps,
    storageSource: source,
  };
}

export async function getDynamicAppBySlug(slug: string): Promise<AdminMiniAppRecord | null> {
  const clean = slug.trim();
  if (!clean) return null;
  const { apps } = await getDynamicMiniAppsAdminCatalog();
  return apps.find((a) => a.slug === clean) || null;
}

// =============================================================================
// ADMIN CRUD MUTATIONS — MINI-APPS
// =============================================================================

export interface MiniAppMutationPayload {
  slug?: string;
  title: string;
  shortTitle?: string;
  tagline?: string;
  description?: string;
  category: string;
  template?: MiniAppTemplate;
  iconKey?: string;
  popular?: boolean;
  featuredOnHome?: boolean;
  requiresProfile?: boolean;
  cacheScope?: MiniAppDefinition['cacheScope'];
  chatSeedPrompt?: string;
  estimatedRead?: string;
  vedicPrompt?: string;
  westernPrompt?: string;
  systemOverride?: string;
  rules?: MiniAppRuleItem[];
  inputLabel?: string;
  inputPlaceholder?: string;
  modelId?: string | null;
  isActive?: boolean;
  sortOrder?: number;
}

export async function createDynamicMiniApp(
  input: MiniAppMutationPayload,
  adminUserId?: string | null
): Promise<{ ok: true; app: AdminMiniAppRecord } | { ok: false; error: string }> {
  const title = String(input.title || '').trim();
  if (!title) return { ok: false, error: 'App name is required.' };

  const rawSlug = String(input.slug || title);
  const slug = sanitizeAppSlug(rawSlug);
  if (!slug || slug.length < 2) {
    return { ok: false, error: 'Valid slug (letters, numbers, hyphens) is required.' };
  }

  const current = await loadResolvedRegistry();
  if (current.apps.some((a) => a.slug === slug)) {
    return { ok: false, error: `An app with slug "${slug}" already exists.` };
  }

  const maxOrder = current.apps.reduce((m, a) => Math.max(m, a.sortOrder), 0);
  const catMap = new Map(current.categories.map((c) => [c.slug, c]));
  const categorySlug = catMap.has(input.category)
    ? input.category
    : current.categories[0]?.slug || 'self_chart';

  const newRaw: StoredRegistryBlob['apps'][number] = {
    slug,
    title,
    shortTitle: String(input.shortTitle || title).trim(),
    tagline: String(input.tagline || '').trim(),
    description: String(input.description || '').trim(),
    category: categorySlug,
    template:
      input.template === 'form_reading' ||
      input.template === 'domain_explorer' ||
      input.template === 'guided_quiz'
        ? input.template
        : 'auto_brief',
    iconKey: String(input.iconKey || 'sparkles').trim() || 'sparkles',
    popular: Boolean(input.popular),
    featuredOnHome: Boolean(input.featuredOnHome),
    requiresProfile: input.requiresProfile !== false,
    cacheScope:
      input.cacheScope === 'daily' ||
      input.cacheScope === 'weekly' ||
      input.cacheScope === 'monthly' ||
      input.cacheScope === 'chart' ||
      input.cacheScope === 'none'
        ? input.cacheScope
        : 'monthly',
    chatSeedPrompt:
      String(input.chatSeedPrompt || '').trim() ||
      `Let’s explore insights from ${title} in deeper detail.`,
    estimatedRead: String(input.estimatedRead || '').trim() || '3 min read',
    vedicPrompt: String(input.vedicPrompt || '').trim(),
    westernPrompt: String(input.westernPrompt || '').trim(),
    systemOverride: String(input.systemOverride || '').trim(),
    rules: sanitizeMiniAppRules(input.rules),
    inputLabel: String(input.inputLabel || '').trim(),
    inputPlaceholder: String(input.inputPlaceholder || '').trim(),
    modelId: input.modelId ? String(input.modelId).trim() : null,
    isActive: input.isActive !== false,
    sortOrder: typeof input.sortOrder === 'number' ? input.sortOrder : maxOrder + 10,
  };

  const enriched = enrichAdminAppRecord(newRaw, catMap);
  const supabaseAdmin = getSupabaseAdmin();

  if (current.source === 'tables' && supabaseAdmin) {
    const baseRow = {
      slug: enriched.slug,
      title: enriched.title,
      short_title: enriched.shortTitle,
      tagline: enriched.tagline,
      description: enriched.description,
      category_slug: enriched.category,
      template: enriched.template,
      icon_key: enriched.iconKey,
      popular: enriched.popular,
      featured_on_home: enriched.featuredOnHome,
      requires_profile: enriched.requiresProfile,
      cache_scope: enriched.cacheScope,
      chat_seed_prompt: enriched.chatSeedPrompt,
      estimated_read: enriched.estimatedRead,
      vedic_prompt: enriched.vedicPrompt,
      western_prompt: enriched.westernPrompt,
      system_override: enriched.systemOverride,
      input_label: enriched.inputLabel,
      input_placeholder: enriched.inputPlaceholder,
      model_id: enriched.modelId,
      is_active: enriched.isActive,
      sort_order: enriched.sortOrder,
    };

    let { error } = await supabaseAdmin
      .from('mini_apps')
      .insert({ ...baseRow, rules_json: enriched.rules });
    if (
      error &&
      (error.code === '42703' || String(error.message || '').toLowerCase().includes('rules_json'))
    ) {
      const retry = await supabaseAdmin.from('mini_apps').insert(baseRow);
      error = retry.error;
      if (!error) {
        await saveMiniAppRulesOverlayEntry(enriched.slug, enriched.rules, adminUserId);
      }
    }
    if (error) {
      return { ok: false, error: error.message || 'Failed to create app in database.' };
    }
  } else {
    const nextApps = [...current.apps, enriched];
    const saved = await persistSettingsRegistrySnapshot(current.categories, nextApps, adminUserId);
    if (!saved.ok) {
      return { ok: false, error: saved.error || 'Failed to save new app.' };
    }
  }

  await syncOverrideFieldsToMiniAppsConfig(
    enriched.slug,
    {
      isActive: enriched.isActive,
      featuredOnHome: enriched.featuredOnHome,
      modelId: enriched.modelId,
    },
    adminUserId
  );

  invalidateMiniAppsRegistryCache();
  return { ok: true, app: enriched };
}

export async function updateDynamicMiniApp(
  slug: string,
  patch: Partial<MiniAppMutationPayload>,
  adminUserId?: string | null
): Promise<{ ok: true; app: AdminMiniAppRecord } | { ok: false; error: string }> {
  const cleanSlug = slug.trim();
  const current = await loadResolvedRegistry();
  const idx = current.apps.findIndex((a) => a.slug === cleanSlug);
  if (idx === -1) return { ok: false, error: `Mini-App "${cleanSlug}" not found.` };

  const existing = current.apps[idx];
  const catMap = new Map(current.categories.map((c) => [c.slug, c]));

  const mergedRaw: StoredRegistryBlob['apps'][number] = {
    slug: existing.slug,
    title: typeof patch.title === 'string' && patch.title.trim() ? patch.title.trim() : existing.title,
    shortTitle:
      typeof patch.shortTitle === 'string' && patch.shortTitle.trim()
        ? patch.shortTitle.trim()
        : existing.shortTitle,
    tagline: typeof patch.tagline === 'string' ? patch.tagline.trim() : existing.tagline,
    description:
      typeof patch.description === 'string' ? patch.description.trim() : existing.description,
    category:
      typeof patch.category === 'string' && catMap.has(patch.category)
        ? patch.category
        : existing.category,
    template: patch.template || existing.template,
    iconKey: typeof patch.iconKey === 'string' && patch.iconKey.trim() ? patch.iconKey.trim() : existing.iconKey,
    popular: typeof patch.popular === 'boolean' ? patch.popular : existing.popular,
    featuredOnHome:
      typeof patch.featuredOnHome === 'boolean' ? patch.featuredOnHome : existing.featuredOnHome,
    requiresProfile:
      typeof patch.requiresProfile === 'boolean' ? patch.requiresProfile : existing.requiresProfile,
    cacheScope: patch.cacheScope || existing.cacheScope,
    chatSeedPrompt:
      typeof patch.chatSeedPrompt === 'string' ? patch.chatSeedPrompt.trim() : existing.chatSeedPrompt,
    estimatedRead:
      typeof patch.estimatedRead === 'string' ? patch.estimatedRead.trim() : existing.estimatedRead,
    vedicPrompt:
      typeof patch.vedicPrompt === 'string' ? patch.vedicPrompt : existing.vedicPrompt,
    westernPrompt:
      typeof patch.westernPrompt === 'string' ? patch.westernPrompt : existing.westernPrompt,
    systemOverride:
      typeof patch.systemOverride === 'string' ? patch.systemOverride : existing.systemOverride,
    rules: patch.rules !== undefined ? sanitizeMiniAppRules(patch.rules) : existing.rules,
    inputLabel:
      typeof patch.inputLabel === 'string' ? patch.inputLabel.trim() : existing.inputLabel,
    inputPlaceholder:
      typeof patch.inputPlaceholder === 'string'
        ? patch.inputPlaceholder.trim()
        : existing.inputPlaceholder,
    modelId:
      patch.modelId !== undefined
        ? patch.modelId && String(patch.modelId).trim()
          ? String(patch.modelId).trim()
          : null
        : existing.modelId,
    isActive: typeof patch.isActive === 'boolean' ? patch.isActive : existing.isActive,
    sortOrder: typeof patch.sortOrder === 'number' ? patch.sortOrder : existing.sortOrder,
  };

  const enriched = enrichAdminAppRecord(mergedRaw, catMap);
  const supabaseAdmin = getSupabaseAdmin();

  if (current.source === 'tables' && supabaseAdmin) {
    const baseUpdate = {
      title: enriched.title,
      short_title: enriched.shortTitle,
      tagline: enriched.tagline,
      description: enriched.description,
      category_slug: enriched.category,
      template: enriched.template,
      icon_key: enriched.iconKey,
      popular: enriched.popular,
      featured_on_home: enriched.featuredOnHome,
      requires_profile: enriched.requiresProfile,
      cache_scope: enriched.cacheScope,
      chat_seed_prompt: enriched.chatSeedPrompt,
      estimated_read: enriched.estimatedRead,
      vedic_prompt: enriched.vedicPrompt,
      western_prompt: enriched.westernPrompt,
      system_override: enriched.systemOverride,
      input_label: enriched.inputLabel,
      input_placeholder: enriched.inputPlaceholder,
      model_id: enriched.modelId,
      is_active: enriched.isActive,
      sort_order: enriched.sortOrder,
      updated_at: new Date().toISOString(),
    };
    let { error } = await supabaseAdmin
      .from('mini_apps')
      .update({ ...baseUpdate, rules_json: enriched.rules })
      .eq('slug', cleanSlug);
    if (
      error &&
      (error.code === '42703' || String(error.message || '').toLowerCase().includes('rules_json'))
    ) {
      const retry = await supabaseAdmin
        .from('mini_apps')
        .update(baseUpdate)
        .eq('slug', cleanSlug);
      error = retry.error;
      if (!error) {
        await saveMiniAppRulesOverlayEntry(enriched.slug, enriched.rules, adminUserId);
      }
    }
    if (error) {
      return { ok: false, error: error.message || 'Failed to update app in database.' };
    }
  } else {
    const nextApps = [...current.apps];
    nextApps[idx] = enriched;
    const saved = await persistSettingsRegistrySnapshot(current.categories, nextApps, adminUserId);
    if (!saved.ok) {
      return { ok: false, error: saved.error || 'Failed to update app.' };
    }
  }

  await syncOverrideFieldsToMiniAppsConfig(
    enriched.slug,
    {
      isActive: enriched.isActive,
      featuredOnHome: enriched.featuredOnHome,
      modelId: enriched.modelId,
    },
    adminUserId
  );

  invalidateMiniAppsRegistryCache();
  return { ok: true, app: enriched };
}

export async function deleteDynamicMiniApp(
  slug: string,
  adminUserId?: string | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  const cleanSlug = slug.trim();
  const current = await loadResolvedRegistry();
  if (!current.apps.some((a) => a.slug === cleanSlug)) {
    return { ok: false, error: `Mini-App "${cleanSlug}" not found.` };
  }

  const supabaseAdmin = getSupabaseAdmin();
  if (current.source === 'tables' && supabaseAdmin) {
    const { error } = await supabaseAdmin.from('mini_apps').delete().eq('slug', cleanSlug);
    if (error) {
      return { ok: false, error: error.message || 'Failed to delete app.' };
    }
  } else {
    const nextApps = current.apps.filter((a) => a.slug !== cleanSlug);
    const saved = await persistSettingsRegistrySnapshot(current.categories, nextApps, adminUserId);
    if (!saved.ok) {
      return { ok: false, error: saved.error || 'Failed to delete app.' };
    }
  }

  await cleanupOverrideFromMiniAppsConfig(cleanSlug, adminUserId);
  invalidateMiniAppsRegistryCache();
  return { ok: true };
}

export async function reorderDynamicMiniApps(
  orderedSlugs: string[],
  adminUserId?: string | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  const current = await loadResolvedRegistry();
  const bySlug = new Map(current.apps.map((a) => [a.slug, a]));
  const seen = new Set<string>();
  const reordered: AdminMiniAppRecord[] = [];

  for (const s of orderedSlugs) {
    const app = bySlug.get(s);
    if (app && !seen.has(s)) {
      seen.add(s);
      reordered.push(app);
    }
  }
  for (const app of current.apps) {
    if (!seen.has(app.slug)) {
      reordered.push(app);
    }
  }

  const updatedApps = reordered.map((app, i) => ({
    ...app,
    sortOrder: (i + 1) * 10,
  }));

  const supabaseAdmin = getSupabaseAdmin();
  if (current.source === 'tables' && supabaseAdmin) {
    const nowIso = new Date().toISOString();
    await Promise.all(
      updatedApps.map((a) =>
        supabaseAdmin
          .from('mini_apps')
          .update({ sort_order: a.sortOrder, updated_at: nowIso })
          .eq('slug', a.slug)
      )
    );
  } else {
    const saved = await persistSettingsRegistrySnapshot(current.categories, updatedApps, adminUserId);
    if (!saved.ok) {
      return { ok: false, error: saved.error || 'Failed to save app order.' };
    }
  }

  invalidateMiniAppsRegistryCache();
  return { ok: true };
}

// =============================================================================
// ADMIN CRUD MUTATIONS — CATEGORIES
// =============================================================================

export async function createDynamicCategory(
  input: { slug?: string; label: string; isActive?: boolean },
  adminUserId?: string | null
): Promise<{ ok: true; category: MiniAppCategoryRecord } | { ok: false; error: string }> {
  const label = String(input.label || '').trim();
  if (!label) return { ok: false, error: 'Category name is required.' };

  const slug = sanitizeCategorySlug(input.slug || label);
  if (!slug || ['all', 'popular', 'favorites'].includes(slug)) {
    return {
      ok: false,
      error: 'Please enter a valid unique category slug (cannot be all, popular, or favorites).',
    };
  }

  const current = await loadResolvedRegistry();
  if (current.categories.some((c) => c.slug === slug)) {
    return { ok: false, error: `Category "${slug}" already exists.` };
  }

  const maxOrder = current.categories.reduce((m, c) => Math.max(m, c.sortOrder), 0);
  const newCat: MiniAppCategoryRecord = {
    slug,
    label,
    sortOrder: maxOrder + 10,
    isActive: input.isActive !== false,
  };

  const supabaseAdmin = getSupabaseAdmin();
  if (current.source === 'tables' && supabaseAdmin) {
    const { error } = await supabaseAdmin.from('mini_app_categories').insert({
      slug: newCat.slug,
      label: newCat.label,
      sort_order: newCat.sortOrder,
      is_active: newCat.isActive,
    });
    if (error) {
      return { ok: false, error: error.message || 'Failed to create category.' };
    }
  } else {
    const nextCats = [...current.categories, newCat];
    const saved = await persistSettingsRegistrySnapshot(nextCats, current.apps, adminUserId);
    if (!saved.ok) {
      return { ok: false, error: saved.error || 'Failed to save category.' };
    }
  }

  invalidateMiniAppsRegistryCache();
  return { ok: true, category: newCat };
}

export async function updateDynamicCategory(
  slug: string,
  patch: { label?: string; isActive?: boolean; sortOrder?: number },
  adminUserId?: string | null
): Promise<{ ok: true; category: MiniAppCategoryRecord } | { ok: false; error: string }> {
  const cleanSlug = slug.trim();
  const current = await loadResolvedRegistry();
  const idx = current.categories.findIndex((c) => c.slug === cleanSlug);
  if (idx === -1) return { ok: false, error: `Category "${cleanSlug}" not found.` };

  const existing = current.categories[idx];
  const updated: MiniAppCategoryRecord = {
    slug: existing.slug,
    label:
      typeof patch.label === 'string' && patch.label.trim() ? patch.label.trim() : existing.label,
    sortOrder: typeof patch.sortOrder === 'number' ? patch.sortOrder : existing.sortOrder,
    isActive: typeof patch.isActive === 'boolean' ? patch.isActive : existing.isActive,
  };

  const supabaseAdmin = getSupabaseAdmin();
  if (current.source === 'tables' && supabaseAdmin) {
    const { error } = await supabaseAdmin
      .from('mini_app_categories')
      .update({
        label: updated.label,
        sort_order: updated.sortOrder,
        is_active: updated.isActive,
        updated_at: new Date().toISOString(),
      })
      .eq('slug', cleanSlug);
    if (error) {
      return { ok: false, error: error.message || 'Failed to update category.' };
    }
  } else {
    const nextCats = [...current.categories];
    nextCats[idx] = updated;
    const saved = await persistSettingsRegistrySnapshot(nextCats, current.apps, adminUserId);
    if (!saved.ok) {
      return { ok: false, error: saved.error || 'Failed to update category.' };
    }
  }

  invalidateMiniAppsRegistryCache();
  return { ok: true, category: updated };
}

export async function deleteDynamicCategory(
  slug: string,
  adminUserId?: string | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  const cleanSlug = slug.trim();
  const current = await loadResolvedRegistry();
  if (!current.categories.some((c) => c.slug === cleanSlug)) {
    return { ok: false, error: `Category "${cleanSlug}" not found.` };
  }

  const assignedCount = current.apps.filter((a) => a.category === cleanSlug).length;
  if (assignedCount > 0) {
    return {
      ok: false,
      error: `Cannot delete this category while ${assignedCount} app(s) are assigned to it. Reassign those apps first.`,
    };
  }

  const supabaseAdmin = getSupabaseAdmin();
  if (current.source === 'tables' && supabaseAdmin) {
    const { error } = await supabaseAdmin.from('mini_app_categories').delete().eq('slug', cleanSlug);
    if (error) {
      return { ok: false, error: error.message || 'Failed to delete category.' };
    }
  } else {
    const nextCats = current.categories.filter((c) => c.slug !== cleanSlug);
    const saved = await persistSettingsRegistrySnapshot(nextCats, current.apps, adminUserId);
    if (!saved.ok) {
      return { ok: false, error: saved.error || 'Failed to delete category.' };
    }
  }

  invalidateMiniAppsRegistryCache();
  return { ok: true };
}

export async function reorderDynamicCategories(
  orderedSlugs: string[],
  adminUserId?: string | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  const current = await loadResolvedRegistry();
  const bySlug = new Map(current.categories.map((c) => [c.slug, c]));
  const seen = new Set<string>();
  const reordered: MiniAppCategoryRecord[] = [];

  for (const s of orderedSlugs) {
    const cat = bySlug.get(s);
    if (cat && !seen.has(s)) {
      seen.add(s);
      reordered.push(cat);
    }
  }
  for (const cat of current.categories) {
    if (!seen.has(cat.slug)) {
      reordered.push(cat);
    }
  }

  const updatedCats = reordered.map((c, i) => ({
    ...c,
    sortOrder: (i + 1) * 10,
  }));

  const supabaseAdmin = getSupabaseAdmin();
  if (current.source === 'tables' && supabaseAdmin) {
    const nowIso = new Date().toISOString();
    await Promise.all(
      updatedCats.map((c) =>
        supabaseAdmin
          .from('mini_app_categories')
          .update({ sort_order: c.sortOrder, updated_at: nowIso })
          .eq('slug', c.slug)
      )
    );
  } else {
    const saved = await persistSettingsRegistrySnapshot(updatedCats, current.apps, adminUserId);
    if (!saved.ok) {
      return { ok: false, error: saved.error || 'Failed to save category order.' };
    }
  }

  invalidateMiniAppsRegistryCache();
  return { ok: true };
}
