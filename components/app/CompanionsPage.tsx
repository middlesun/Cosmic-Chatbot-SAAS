import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import CompanionSetupView from './CompanionSetupView';
import { PREVIEW_CONVERSATIONS, PREVIEW_PUBLIC_COMPANIONS } from './previewFixtures';
import {
  COMPANION_LABEL_SINGULAR,
  isConsultantCatalogEntryAllowed,
  type CompanionPersona,
  type PublicCompanionCard,
} from './chatTypes';

const CompanionsPage: React.FC = () => {
  const { getAccessToken, isPreviewMode } = useAuth();
  const navigate = useNavigate();

  const previewCatalog = useMemo(
    () => PREVIEW_PUBLIC_COMPANIONS.filter(isConsultantCatalogEntryAllowed),
    []
  );

  const previewPastCompanions = useMemo(
    () =>
      isPreviewMode
        ? PREVIEW_CONVERSATIONS.filter((c) => {
            if (c.pillar !== 'companion' && !c.companion_persona_json) return false;
            const slug = c.companion_slug || c.companion_persona_json?.slug;
            const matched = slug
              ? PREVIEW_PUBLIC_COMPANIONS.find((p) => p.slug === slug)
              : undefined;
            return matched ? isConsultantCatalogEntryAllowed(matched) : true;
          })
        : [],
    [isPreviewMode]
  );

  const handleSelectPastCompanion = (conversationId: string) => {
    navigate(`/app/chat/${encodeURIComponent(conversationId)}`);
  };

  const startAndNavigate = async (payload: {
    companionSlug?: string;
    persona?: CompanionPersona;
    forceNew?: boolean;
  }) => {
    const token = await getAccessToken();
    if (!token) {
      throw new Error(
        `Please sign in to start chatting with a ${COMPANION_LABEL_SINGULAR.toLowerCase()}.`
      );
    }

    const res = await fetch('/api/chat/companions/start', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        companionSlug: payload.companionSlug,
        persona: payload.persona,
        forceNew: payload.forceNew,
        clientLocalHour: new Date().getHours(),
        pinAsTab: true,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.conversation?.id) {
      throw new Error(
        data.error ||
          `Could not open ${COMPANION_LABEL_SINGULAR.toLowerCase()} conversation right now.`
      );
    }

    navigate(`/app/chat/${encodeURIComponent(data.conversation.id)}`);
  };

  const handleStartWithCompanion = async (persona: CompanionPersona) => {
    if (isPreviewMode) {
      navigate('/app/chat', {
        state: { startCompanionPersona: persona },
      });
      return;
    }

    await startAndNavigate({
      companionSlug: persona.slug || undefined,
      persona,
    });
  };

  const handleStartPresetCompanion = async (
    card: PublicCompanionCard,
    options?: { forceNew?: boolean }
  ) => {
    if (!options?.forceNew && card.last_conversation_id) {
      navigate(`/app/chat/${encodeURIComponent(card.last_conversation_id)}`);
      return;
    }

    if (isPreviewMode) {
      navigate(
        `/app/chat?pillar=companion&companion=${encodeURIComponent(card.slug)}${
          options?.forceNew ? '&new=1' : ''
        }`
      );
      return;
    }

    await startAndNavigate({
      companionSlug: card.slug,
      forceNew: options?.forceNew,
    });
  };

  const handleStartCustomBySlug = async (
    slug: string,
    persona: CompanionPersona,
    options?: { forceNew?: boolean }
  ) => {
    if (isPreviewMode) {
      navigate('/app/chat', {
        state: {
          startCompanionPersona: { ...persona, slug },
          forceNew: options?.forceNew,
        },
      });
      return;
    }

    await startAndNavigate({
      companionSlug: slug,
      persona: { ...persona, slug },
      forceNew: options?.forceNew,
    });
  };

  return (
    <CompanionSetupView
      variant="page"
      pastCompanionConversations={previewPastCompanions}
      companionCatalog={isPreviewMode ? previewCatalog : undefined}
      isPreviewMode={isPreviewMode}
      getAccessToken={getAccessToken}
      onSelectPastCompanion={handleSelectPastCompanion}
      onStartWithCompanion={handleStartWithCompanion}
      onStartPresetCompanion={handleStartPresetCompanion}
      onStartCustomBySlug={handleStartCustomBySlug}
    />
  );
};

export default CompanionsPage;
