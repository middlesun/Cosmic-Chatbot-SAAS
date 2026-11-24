import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Loader2, X } from 'lucide-react';
import { useAuth } from './AuthContext';
import {
  clearPendingOnboardingDraft,
  getPendingOnboardingDraft,
  type PendingBirthChartDraft,
} from '../../lib/pendingOnboarding';
import type { ChatProfile } from './chatTypes';

const PendingOnboardingHydrator: React.FC = () => {
  const { session, appUser, isPreviewMode, getAccessToken, refreshUser } = useAuth();
  const navigate = useNavigate();

  const [status, setStatus] = useState<'idle' | 'hydrating' | 'success' | 'error'>('idle');
  const [subjectName, setSubjectName] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const runningRef = useRef(false);

  const hydratePendingDraft = useCallback(async () => {
    const draft = getPendingOnboardingDraft();
    if (!draft || runningRef.current) return;
    if (!session || !appUser || isPreviewMode) return;

    runningRef.current = true;
    setSubjectName(draft.name);
    setStatus('hydrating');
    setErrorMsg(null);

    try {
      const token = await getAccessToken();
      if (!token) {
        runningRef.current = false;
        setStatus('idle');
        return;
      }

      // 1. Check existing profiles first so refreshing doesn't duplicate a just-saved chart
      const listRes = await fetch('/api/profiles', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const listData = listRes.ok ? await listRes.json().catch(() => ({})) : {};
      const existingProfiles: ChatProfile[] = Array.isArray(listData.profiles)
        ? listData.profiles
        : [];

      const normalizedName = draft.name.trim().toLowerCase();
      const normalizedTime = draft.birth_time.slice(0, 5);
      let targetProfile: ChatProfile | undefined = existingProfiles.find(
        (p) =>
          p.name.trim().toLowerCase() === normalizedName &&
          p.birth_date === draft.birth_date &&
          (p.birth_time ? p.birth_time.slice(0, 5) === normalizedTime : true)
      );

      if (!targetProfile) {
        const createPayload: Record<string, unknown> = {
          name: draft.name,
          is_default: existingProfiles.length === 0,
          birth_date: draft.birth_date,
          birth_time: draft.birth_time,
          place_query: draft.place_query,
          relationship: 'Self',
        };
        if (draft.birth_city) createPayload.birth_city = draft.birth_city;
        if (draft.birth_state) createPayload.birth_state = draft.birth_state;
        if (draft.birth_country) createPayload.birth_country = draft.birth_country;
        if (typeof draft.latitude === 'number') createPayload.latitude = draft.latitude;
        if (typeof draft.longitude === 'number') createPayload.longitude = draft.longitude;
        if (typeof draft.timezone_offset === 'number') {
          createPayload.timezone_offset = draft.timezone_offset;
        }

        const createRes = await fetch('/api/profiles', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(createPayload),
        });
        const createData = await createRes.json().catch(() => ({}));

        if (!createRes.ok || !createData.profile?.id) {
          throw new Error(
            createData.error ||
              'Could not calculate your saved birth chart automatically. Please check your birth place.'
          );
        }

        targetProfile = createData.profile as ChatProfile;
        void refreshUser();
      }

      // Only clear stored draft AFTER the chart profile exists safely on the user's account
      clearPendingOnboardingDraft();

      window.dispatchEvent(
        new CustomEvent('cc-onboarding-profile-ready', {
          detail: { profile: targetProfile, hasCompanion: Boolean(draft.companion_slug) },
        })
      );

      // 2. If they clicked a specific companion before Gmail sign-in, start or open that chat
      if (draft.companion_slug) {
        const startRes = await fetch('/api/chat/companions/start', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            companionSlug: draft.companion_slug,
            profileId: targetProfile.id,
            clientLocalHour: new Date().getHours(),
            pinAsTab: true,
          }),
        });
        const startData = await startRes.json().catch(() => ({}));
        if (startRes.ok && startData.conversation?.id) {
          window.dispatchEvent(
            new CustomEvent('cc-onboarding-profile-ready', {
              detail: { profile: targetProfile, conversationId: startData.conversation.id },
            })
          );
          setStatus('success');
          navigate('/app/home', {
            replace: true,
            state: { selectedProfileId: targetProfile.id, conversationId: startData.conversation.id },
          });
          window.setTimeout(() => setStatus('idle'), 3500);
          return;
        }
      }

      setStatus('success');
      navigate('/app/home', {
        replace: true,
        state: { selectedProfileId: targetProfile.id },
      });
      window.setTimeout(() => setStatus('idle'), 4000);
    } catch (err) {
      setStatus('error');
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Could not finalize your saved birth chart. You can retry without re-entering details.'
      );
    } finally {
      runningRef.current = false;
    }
  }, [appUser, getAccessToken, isPreviewMode, navigate, refreshUser, session]);

  useEffect(() => {
    void hydratePendingDraft();
  }, [hydratePendingDraft]);

  if (status === 'idle') return null;

  const activeDraft: PendingBirthChartDraft | null = getPendingOnboardingDraft();

  return (
    <div className="fixed bottom-5 right-5 z-50 max-w-sm w-[calc(100vw-2.5rem)] rounded-2xl border border-[#3D3830]/15 bg-[#FDFBF7] shadow-2xl p-4 text-[#3D3830] animate-cc-message-in">
      {status === 'hydrating' && (
        <div className="flex items-start gap-3">
          <Loader2 className="h-4.5 w-4.5 animate-spin text-[#B8965A] shrink-0 mt-0.5" />
          <div className="min-w-0 space-y-0.5">
            <p className="text-xs font-semibold text-[#3D3830]">
              Saving {subjectName ? `${subjectName}'s` : 'your'} birth chart
            </p>
            <p className="text-xs text-[#5C5449]">
              Computing natal placements, Dashas, and 600+ chart points...
            </p>
          </div>
        </div>
      )}

      {status === 'success' && (
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <CheckCircle2 className="h-4.5 w-4.5 text-[#2D6A4F] shrink-0" />
            <p className="text-xs font-medium text-[#2D6A4F] truncate">
              {subjectName ? `${subjectName}'s chart` : 'Birth chart'} saved and ready
            </p>
          </div>
          <button
            type="button"
            onClick={() => setStatus('idle')}
            aria-label="Dismiss notice"
            className="p-1 text-[#8B8275] hover:text-[#3D3830]"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {status === 'error' && (
        <div className="space-y-2.5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2 text-xs text-[#7A3E36]">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold">Your birth details are still saved</p>
                <p className="text-[#5C5449] leading-relaxed">{errorMsg}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                clearPendingOnboardingDraft();
                setStatus('idle');
              }}
              aria-label="Dismiss error"
              className="p-1 text-[#8B8275] hover:text-[#3D3830]"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            {activeDraft && (
              <button
                type="button"
                onClick={() => void hydratePendingDraft()}
                className="rounded-full bg-[#4A453D] px-3.5 py-1.5 text-xs font-medium text-[#FAF7F2] hover:bg-[#38342E] cursor-pointer"
              >
                Retry saving
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setStatus('idle');
                navigate('/app/profiles');
              }}
              className="rounded-full border border-[#3D3830]/15 bg-[#FAF7F2] px-3.5 py-1.5 text-xs font-medium text-[#3D3830] hover:bg-[#EAE3D7] cursor-pointer"
            >
              Edit in Profiles
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PendingOnboardingHydrator;
