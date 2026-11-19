import {
  corsHeaders,
  extractBearerToken,
  getStorageQuotaBytesForTier,
  getUserStorageUsageBytes,
  signEntitlementClaim,
  verifyBearerToken,
} from '../../lib/workspace-auth';
import { PLAN_SPECS } from '../../lib/pricing';

export async function onRequestOptions() {
  return new Response(null, { status: 200, headers: corsHeaders });
}

export async function onRequestGet(context: { request: Request; env: any }) {
  const token = extractBearerToken(context.request);
  const auth = await verifyBearerToken(context.env, token);
  if (!auth.ok) {
    return new Response(
      JSON.stringify({ success: false, error: auth.error }),
      { status: auth.status, headers: corsHeaders }
    );
  }

  const user = auth.user;
  const claim = await signEntitlementClaim(context.env, user.userId, user.tier);
  const storageUsedBytes = await getUserStorageUsageBytes(context.env, user.userId, token);
  const storageLimitBytes = getStorageQuotaBytesForTier(user.tier);
  const campaignLimit = user.role === 'admin'
    ? null
    : (user.tier === 'unlimited' ? PLAN_SPECS.agency.productLimit : (user.tier === 'studio' ? PLAN_SPECS.studio.productLimit : (user.tier === 'pro' ? PLAN_SPECS.pro.productLimit : PLAN_SPECS.free.productLimit)));
  const entitlement = {
    userId: user.userId,
    email: user.email,
    tier: user.tier,
    role: user.role,
    billingInterval: user.billingInterval || 'monthly',
    subscriptionStatus: user.subscriptionStatus || 'inactive',
    currentPeriodEnd: user.currentPeriodEnd || null,
    cancelAtPeriodEnd: Boolean(user.cancelAtPeriodEnd),
    campaignLimit,
    storageUsedBytes,
    storageLimitBytes,
    issuedAt: claim.issuedAt,
    expiresAt: claim.expiresAt,
    signature: claim.signature,
  };

  return new Response(
    JSON.stringify({
      success: true,
      ...entitlement,
      entitlement,
    }),
    { status: 200, headers: corsHeaders }
  );
}
