import { getSupabaseAdmin } from '../lib/supabaseAdmin';
import { sendReferralBonusEmail } from './email';
import { getPricingConfig } from './platformSettings';

/**
 * Payment-gated referral reward (default +5,000 Credits to both referrer and referee).
 * Strictly triggers only once after the referred user completes their first real payment
 * or paid profile activation, protected by an atomic pending -> rewarded guard.
 */
export async function rewardReferralIfEligible(refereeUserId: string): Promise<{
  rewarded: boolean;
  creditsAwarded?: number;
}> {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) return { rewarded: false };

  try {
    const { data: pendingReferral } = await supabaseAdmin
      .from('referrals')
      .select('*')
      .eq('referee_id', refereeUserId)
      .eq('status', 'pending')
      .maybeSingle();

    if (!pendingReferral) {
      return { rewarded: false };
    }

    const pricing = await getPricingConfig();
    const rewardAmount = Number(pendingReferral.reward_credits) || pricing.referral_reward_credits;

    // Atomically flip status pending -> rewarded so concurrent webhooks cannot double-reward
    const { data: claimed, error: claimErr } = await supabaseAdmin
      .from('referrals')
      .update({
        status: 'rewarded',
        rewarded_at: new Date().toISOString(),
      })
      .eq('id', pendingReferral.id)
      .eq('status', 'pending')
      .select('*')
      .maybeSingle();

    if (claimErr || !claimed) {
      return { rewarded: false };
    }

    // Grant bonus credits to both referrer & referee
    await Promise.all([
      supabaseAdmin.rpc('grant_user_credits', {
        p_user_id: claimed.referrer_id,
        p_amount: rewardAmount,
        p_tx_type: 'referral_bonus',
        p_reference_id: claimed.id,
        p_description: 'Referral reward unlocked after friend completed first paid action',
      }),
      supabaseAdmin.rpc('grant_user_credits', {
        p_user_id: claimed.referee_id,
        p_amount: rewardAmount,
        p_tx_type: 'referral_bonus',
        p_reference_id: claimed.id,
        p_description: 'Welcome referral bonus unlocked after first paid action',
      }),
    ]);

    // Notify referrer via Resend (best-effort)
    const { data: referrerUser } = await supabaseAdmin
      .from('users')
      .select('email, full_name')
      .eq('id', claimed.referrer_id)
      .maybeSingle();

    if (referrerUser?.email) {
      void sendReferralBonusEmail({
        to: referrerUser.email,
        name: referrerUser.full_name,
        creditsAwarded: rewardAmount,
      });
    }

    return { rewarded: true, creditsAwarded: rewardAmount };
  } catch (err) {
    console.warn('[referralReward] Non-fatal error checking referral reward:', err);
    return { rewarded: false };
  }
}
