import {
  corsHeaders,
  extractBearerToken,
  getStorageQuotaBytesForTier,
  getUserStorageUsageBytes,
  hasProFeatures,
  isUnlimitedTier,
  PlanTier,
  verifyBearerToken,
} from '../../lib/workspace-auth';
import {
  buildDirectoryListsByCategory,
  getWorkspaceRandomnessDicts,
  getWorkspaceSelectorRecipes,
  loadDirectoriesFromEnv,
} from '../../lib/catalog';
import { getDefaultPrompts, loadPromptTemplates } from '../admin/prompts';
import { PLAN_SPECS } from '../../lib/pricing';

const WORKSPACE_BOOTSTRAP_TTL_MS = 12 * 60 * 60 * 1000;

export async function onRequestOptions() {
  return new Response(null, { status: 200, headers: corsHeaders });
}

export async function onRequestGet(context: { request: Request; env: any }) {
  try {
    const token = extractBearerToken(context.request);
    const auth = await verifyBearerToken(context.env, token);
    if (!auth.ok) {
      return new Response(
        JSON.stringify({ success: false, error: auth.error }),
        { status: auth.status, headers: corsHeaders }
      );
    }

    const authUser = auth.user;
    const isPro = hasProFeatures(authUser);
    const isUnlimited = isUnlimitedTier(authUser);
    const tier: PlanTier = isUnlimited ? 'unlimited' : (authUser.tier === 'studio' ? 'studio' : (isPro ? 'pro' : 'basic'));
    const catalogTier: 'basic' | 'pro' = isPro ? 'pro' : 'basic';
    const campaignLimit = authUser.role === 'admin' ? null : (tier === 'unlimited' ? PLAN_SPECS.agency.productLimit : (tier === 'studio' ? PLAN_SPECS.studio.productLimit : (isPro ? PLAN_SPECS.pro.productLimit : PLAN_SPECS.free.productLimit)));
    const storageUsedBytes = await getUserStorageUsageBytes(context.env, authUser.userId, token);
    const storageLimitBytes = getStorageQuotaBytesForTier(tier);

    const dirResult = await loadDirectoriesFromEnv(context.env, false);
    const allDirs = dirResult.items || [];
    const directoryLists = buildDirectoryListsByCategory(allDirs);
    const selectorRecipes = getWorkspaceSelectorRecipes(catalogTier);
    const randomnessDicts = getWorkspaceRandomnessDicts(catalogTier);

    let promptRecipes: Array<{ id: string; name: string; system_instruction: string; temperature: number }> = [];
    if (isPro) {
      try {
        const templates = await loadPromptTemplates(context.env);
        promptRecipes = (Array.isArray(templates) ? templates : []).map((t: any) => ({
          id: String(t.id || ''),
          name: String(t.name || t.id || 'Prompt Recipe'),
          system_instruction: String(t.system_instruction || ''),
          temperature: Number(t.temperature ?? 0.7),
        }));
      } catch {
        promptRecipes = getDefaultPrompts().map((t: any) => ({
          id: String(t.id || ''),
          name: String(t.name || t.id || 'Prompt Recipe'),
          system_instruction: String(t.system_instruction || ''),
          temperature: Number(t.temperature ?? 0.7),
        }));
      }
    }

    const syncedAt = new Date().toISOString();
    return new Response(
      JSON.stringify({
        success: true,
        version: '1.4.0',
        userId: authUser.userId,
        tier,
        role: authUser.role,
        isPro,
        isUnlimited,
        campaignLimit,
        billingInterval: authUser.billingInterval || 'monthly',
        subscriptionStatus: authUser.subscriptionStatus || 'inactive',
        currentPeriodEnd: authUser.currentPeriodEnd || null,
        cancelAtPeriodEnd: Boolean(authUser.cancelAtPeriodEnd),
        storageUsedBytes,
        storageLimitBytes,
        syncedAt,
        expiresAt: Date.now() + WORKSPACE_BOOTSTRAP_TTL_MS,
        ttlMs: WORKSPACE_BOOTSTRAP_TTL_MS,
        totalAvailableDirectories: allDirs.length,
        directoryCount: allDirs.length,
        isPreview: false,
        directories: allDirs,
        directoryLists,
        selectorRecipes,
        promptRecipes,
        randomnessDicts,
        source: dirResult.source,
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err?.message || 'Workspace bootstrap failed' }),
      { status: 500, headers: corsHeaders }
    );
  }
}
