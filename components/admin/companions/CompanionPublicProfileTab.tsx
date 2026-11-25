import React, { useRef, useState } from 'react';
import { Image as ImageIcon, Lock, Plus, Tag, Trash2, Upload } from 'lucide-react';
import CustomSelect from '../../app/CustomSelect';
import {
  COMPANION_GROUP_OPTIONS,
  type CompanionCategoryTag,
  type CompanionGroup,
  type CompanionMonogramPalette,
} from '../../app/chatTypes';
import type { CompanionSpecializationTag } from '../../../lib/companionV2Schema';
import {
  CATEGORY_OPTIONS,
  SEX_OPTIONS,
  slugifyName,
  type AdminCompanionRecord,
  type PortraitGalleryItem,
} from './companionStudioTypes';

interface CompanionPublicProfileTabProps {
  draft: AdminCompanionRecord;
  setDraft: React.Dispatch<React.SetStateAction<AdminCompanionRecord | null>>;
  isCreating: boolean;
  coreIdentityLocked: boolean;
  secondaryText: string;
  setSecondaryText: React.Dispatch<React.SetStateAction<string>>;
  situationTagsText: string;
  setSituationTagsText: React.Dispatch<React.SetStateAction<string>>;
  specializations: CompanionSpecializationTag[];
  availablePortraits: PortraitGalleryItem[];
  monogramPalettes: Record<string, CompanionMonogramPalette>;
  getAccessToken: () => Promise<string | null>;
  onFeedback: (msg: string) => void;
}

const CompanionPublicProfileTab: React.FC<CompanionPublicProfileTabProps> = ({
  draft,
  setDraft,
  isCreating,
  coreIdentityLocked,
  secondaryText,
  setSecondaryText,
  situationTagsText,
  setSituationTagsText,
  specializations,
  availablePortraits,
  monogramPalettes,
  getAccessToken,
  onFeedback,
}) => {
  const [uploadingDp, setUploadingDp] = useState(false);
  const [dpUploadError, setDpUploadError] = useState<string | null>(null);
  const dpFileInputRef = useRef<HTMLInputElement | null>(null);

  const selectedSpecs = Array.isArray(draft.specialization_slugs)
    ? draft.specialization_slugs
    : [];

  const toggleSpecialization = (slug: string) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const current = Array.isArray(prev.specialization_slugs)
        ? prev.specialization_slugs
        : [];
      const exists = current.includes(slug);
      const next = exists
        ? current.filter((s) => s !== slug)
        : current.length < 10
        ? [...current, slug]
        : current;
      return { ...prev, specialization_slugs: next };
    });
  };

  const handleUploadPortraitFile = async (file: File) => {
    setDpUploadError(null);
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setDpUploadError('Please upload a PNG, JPEG, or WebP portrait image.');
      return;
    }

    setUploadingDp(true);
    try {
      const objectUrl = URL.createObjectURL(file);
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          try {
            const size = 320;
            const canvas = document.createElement('canvas');
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              reject(new Error('Canvas context unavailable'));
              return;
            }
            const minSide = Math.min(img.width, img.height);
            const sx = Math.max(0, (img.width - minSide) / 2);
            const sy = Math.max(0, (img.height - minSide) / 2);
            ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
            let encoded = canvas.toDataURL('image/webp', 0.86);
            if (!encoded.startsWith('data:image/webp')) {
              encoded = canvas.toDataURL('image/jpeg', 0.88);
            }
            resolve(encoded);
          } catch (err) {
            reject(err);
          } finally {
            URL.revokeObjectURL(objectUrl);
          }
        };
        img.onerror = () => {
          URL.revokeObjectURL(objectUrl);
          reject(new Error('Could not decode selected image.'));
        };
        img.src = objectUrl;
      });

      const token = await getAccessToken();
      if (!token) {
        throw new Error('Admin session required.');
      }

      const res = await fetch('/api/admin/companions/upload-dp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ dataUrl }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.avatar_url) {
        throw new Error(data.error || 'Failed to upload portrait image.');
      }
      setDraft((prev) => (prev ? { ...prev, avatar_url: data.avatar_url } : prev));
      onFeedback('Portrait image cropped (320×320) and attached — save draft or publish to apply.');
    } catch (err) {
      setDpUploadError(err instanceof Error ? err.message : 'Portrait upload failed.');
    } finally {
      setUploadingDp(false);
    }
  };

  return (
    <div className="space-y-5">
      {!isCreating && coreIdentityLocked && (
        <div className="rounded-2xl border border-[#B8965A]/35 bg-[#B8965A]/8 px-3.5 py-2.5 text-xs text-[#5C5449] flex items-center gap-2">
          <Lock className="h-3.5 w-3.5 text-[#8B7355] shrink-0" />
          <span>
            Core identity protection is enabled. Name, slug, and gender are protected unless you unlock Core Identity in the Core Identity &amp; Voice tab.
          </span>
        </div>
      )}

      {/* Basic Identity */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <label className="block space-y-1.5 sm:col-span-2">
          <span className="text-xs font-medium text-[#5C5449]">Display Name</span>
          <input
            type="text"
            value={draft.name}
            onChange={(e) => {
              const nextName = e.target.value;
              setDraft((prev) =>
                prev
                  ? {
                      ...prev,
                      name: nextName,
                      slug:
                        isCreating && (!prev.slug || prev.slug === slugifyName(prev.name))
                          ? slugifyName(nextName)
                          : prev.slug,
                    }
                  : prev
              );
            }}
            placeholder="e.g. Soul Mira"
            className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3.5 py-2.5 text-sm text-[#3D3830] focus:border-[#3D3830]/40 focus:outline-none"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-[#5C5449]">Slug ID</span>
          <input
            type="text"
            value={draft.slug}
            onChange={(e) =>
              setDraft((prev) =>
                prev
                  ? {
                      ...prev,
                      slug: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''),
                    }
                  : prev
              )
            }
            placeholder="mira"
            className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3.5 py-2.5 font-mono text-xs text-[#3D3830] focus:border-[#3D3830]/40 focus:outline-none"
          />
        </label>

        <div className="grid grid-cols-2 gap-2">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-[#5C5449]">Age</span>
            <input
              type="number"
              min={18}
              max={95}
              value={draft.age}
              onChange={(e) =>
                setDraft((prev) =>
                  prev ? { ...prev, age: Number(e.target.value) || 30 } : prev
                )
              }
              className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3 py-2.5 font-mono text-xs tabular-nums text-[#3D3830] focus:border-[#3D3830]/40 focus:outline-none"
            />
          </label>
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-[#5C5449]">Sex</span>
            <CustomSelect
              value={draft.sex}
              onChange={(val) =>
                setDraft((prev) =>
                  prev
                    ? {
                        ...prev,
                        sex: val === 'M' ? 'M' : val === 'NB' ? 'NB' : 'F',
                      }
                    : prev
                )
              }
              ariaLabel="Companion sex"
              surface="canvas"
              className="w-full"
              options={SEX_OPTIONS}
            />
          </div>
        </div>
      </div>

      {/* Classification & Hub Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <div className="space-y-1.5">
          <span className="text-xs font-medium text-[#5C5449]">Companion Pillar Group</span>
          <CustomSelect
            value={draft.companion_group || 'everyday_companions'}
            onChange={(val) =>
              setDraft((prev) =>
                prev ? { ...prev, companion_group: val as CompanionGroup } : prev
              )
            }
            ariaLabel="Companion pillar group"
            surface="canvas"
            className="w-full"
            options={COMPANION_GROUP_OPTIONS.map((g) => ({
              value: g.value,
              label: g.label,
              description: g.description,
            }))}
          />
        </div>

        <div className="space-y-1.5">
          <span className="text-xs font-medium text-[#5C5449]">Database Category</span>
          <CustomSelect
            value={draft.category_tag}
            onChange={(val) =>
              setDraft((prev) =>
                prev ? { ...prev, category_tag: val as CompanionCategoryTag } : prev
              )
            }
            ariaLabel="Companion hub category"
            surface="canvas"
            className="w-full"
            options={CATEGORY_OPTIONS}
          />
        </div>

        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-[#5C5449]">Primary Expertise / Role</span>
          <input
            type="text"
            value={draft.primary_expertise}
            onChange={(e) =>
              setDraft((prev) =>
                prev ? { ...prev, primary_expertise: e.target.value } : prev
              )
            }
            placeholder="e.g. Deep Listener"
            className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3.5 py-2.5 text-sm text-[#3D3830] focus:border-[#3D3830]/40 focus:outline-none"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-[#5C5449]">
            Card Subtitle (Mini Card Role Line)
          </span>
          <input
            type="text"
            value={draft.card_subtitle || ''}
            onChange={(e) =>
              setDraft((prev) =>
                prev ? { ...prev, card_subtitle: e.target.value } : prev
              )
            }
            placeholder="e.g. Vedic Astrology · Life & Wisdom"
            className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3.5 py-2.5 text-xs text-[#3D3830] focus:border-[#3D3830]/40 focus:outline-none"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-[#5C5449]">
            Secondary Strengths (comma-separated)
          </span>
          <input
            type="text"
            value={secondaryText}
            onChange={(e) => setSecondaryText(e.target.value)}
            placeholder="e.g. Grief Holding, Late-Night Company, Quiet Reflection"
            className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3.5 py-2.5 text-xs text-[#3D3830] focus:border-[#3D3830]/40 focus:outline-none"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-[#5C5449]">
            Discoverable Situation Tags (comma-separated)
          </span>
          <input
            type="text"
            value={situationTagsText}
            onChange={(e) => setSituationTagsText(e.target.value)}
            placeholder="e.g. heartbreak, breakup, moving-on"
            className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3.5 py-2.5 text-xs text-[#3D3830] focus:border-[#3D3830]/40 focus:outline-none"
          />
        </label>

        <label className="block space-y-1.5 sm:col-span-2">
          <span className="text-xs font-medium text-[#5C5449]">
            Cultural &amp; Language Fluency
          </span>
          <input
            type="text"
            value={draft.cultural_fluency}
            onChange={(e) =>
              setDraft((prev) =>
                prev ? { ...prev, cultural_fluency: e.target.value } : prev
              )
            }
            placeholder="e.g. English & Hinglish · Warm Mumbai sensibility"
            className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3.5 py-2.5 text-xs text-[#3D3830] focus:border-[#3D3830]/40 focus:outline-none"
          />
        </label>
      </div>

      {/* Specializations Multi-Select */}
      <div className="rounded-2xl border border-[#3D3830]/12 bg-[#FAF7F2] p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Tag className="h-3.5 w-3.5 text-[#8B7355]" />
            <span className="text-xs font-semibold text-[#3D3830]">
              Specializations ({selectedSpecs.length}/10)
            </span>
          </div>
          <span className="text-[11px] text-[#8B8275]">
            Used for Companion Hub filtering &amp; Matcher routing
          </span>
        </div>
        <div className="space-y-3">
          {(
            [
              { key: 'spiritual_guides', heading: 'Spiritual Guides · Specialization' },
              { key: 'everyday_companions', heading: 'Everyday Companions · Companionship Style' },
              { key: 'life_companions', heading: 'Life Companions · Area of Life' },
              { key: 'cross_cutting', heading: 'Cross-Cutting' },
            ] as const
          ).map((section) => {
            const groupSpecs = specializations.filter((s) => s.group === section.key);
            if (groupSpecs.length === 0) return null;
            return (
              <div key={section.key} className="space-y-1.5">
                <p className="text-[11px] font-medium text-[#8B8275]">
                  {section.heading}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {groupSpecs.map((spec) => {
                    const active = selectedSpecs.includes(spec.slug);
                    return (
                      <button
                        key={spec.slug}
                        type="button"
                        onClick={() => toggleSpecialization(spec.slug)}
                        title={spec.description}
                        className={`rounded-full border px-3 py-1 text-[11px] font-medium transition-colors cursor-pointer ${
                          active
                            ? 'border-[#4A453D] bg-[#4A453D] text-[#FAF7F2]'
                            : 'border-[#3D3830]/14 bg-[#FDFBF7] text-[#5C5449] hover:border-[#3D3830]/30 hover:text-[#3D3830]'
                        } ${!spec.is_active ? 'opacity-60' : ''}`}
                      >
                        {spec.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tagline & Bios */}
      <label className="block space-y-1.5">
        <span className="text-xs font-medium text-[#5C5449]">Tagline (Card Hook)</span>
        <input
          type="text"
          value={draft.tagline}
          onChange={(e) =>
            setDraft((prev) => (prev ? { ...prev, tagline: e.target.value } : prev))
          }
          placeholder="One warm line capturing their presence..."
          className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3.5 py-2.5 text-sm text-[#3D3830] focus:border-[#3D3830]/40 focus:outline-none"
        />
      </label>

      <label className="block space-y-1.5">
        <span className="text-xs font-medium text-[#5C5449]">Short Bio (Directory Card)</span>
        <textarea
          rows={2}
          value={draft.short_bio}
          onChange={(e) =>
            setDraft((prev) => (prev ? { ...prev, short_bio: e.target.value } : prev))
          }
          className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3.5 py-2.5 text-xs leading-relaxed text-[#3D3830] focus:border-[#3D3830]/40 focus:outline-none resize-y"
        />
      </label>

      <label className="block space-y-1.5">
        <span className="text-xs font-medium text-[#5C5449]">
          Full Bio (Profile Sheet &amp; Approach)
        </span>
        <textarea
          rows={4}
          value={draft.full_bio}
          onChange={(e) =>
            setDraft((prev) => (prev ? { ...prev, full_bio: e.target.value } : prev))
          }
          className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3.5 py-2.5 text-xs leading-relaxed text-[#3D3830] focus:border-[#3D3830]/40 focus:outline-none resize-y"
        />
      </label>

      <label className="block space-y-1.5">
        <span className="text-xs font-medium text-[#5C5449]">
          How Conversations Feel (Expanded Profile Sheet)
        </span>
        <textarea
          rows={3}
          value={draft.how_conversations_feel || ''}
          onChange={(e) =>
            setDraft((prev) =>
              prev ? { ...prev, how_conversations_feel: e.target.value } : prev
            )
          }
          placeholder="Warm narrative describing what chatting with this companion feels like..."
          className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3.5 py-2.5 text-xs leading-relaxed text-[#3D3830] focus:border-[#3D3830]/40 focus:outline-none resize-y"
        />
      </label>

      {/* Welcome Messages */}
      <div className="rounded-2xl border border-[#3D3830]/12 bg-[#FAF7F2] p-4 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div>
            <span className="text-xs font-semibold text-[#3D3830]">
              Opening Welcome Lines ({draft.welcome_messages.length})
            </span>
            <p className="text-[11px] text-[#8B8275]">
              Rotated naturally when a user starts a fresh conversation with {draft.name || 'this companion'}.
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              setDraft((prev) =>
                prev
                  ? {
                      ...prev,
                      welcome_messages: [...prev.welcome_messages, ''],
                    }
                  : prev
              )
            }
            className="inline-flex items-center gap-1 rounded-full border border-[#3D3830]/15 bg-[#FDFBF7] px-3 py-1.5 text-xs font-medium text-[#3D3830] hover:bg-[#F1ECE3] cursor-pointer whitespace-nowrap"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Opener</span>
          </button>
        </div>

        <div className="space-y-2">
          {draft.welcome_messages.map((msg, idx) => (
            <div key={idx} className="flex items-start gap-2">
              <span className="font-mono text-[11px] tabular-nums text-[#8B8275] pt-2.5 w-6 shrink-0">
                #{idx + 1}
              </span>
              <input
                type="text"
                value={msg}
                onChange={(e) => {
                  const val = e.target.value;
                  setDraft((prev) =>
                    prev
                      ? {
                          ...prev,
                          welcome_messages: prev.welcome_messages.map((m, i) =>
                            i === idx ? val : m
                          ),
                        }
                      : prev
                  );
                }}
                placeholder="Warm natural opener..."
                className="flex-1 rounded-xl border border-[#3D3830]/15 bg-[#FDFBF7] px-3 py-2 text-xs text-[#3D3830] focus:border-[#3D3830]/40 focus:outline-none"
              />
              {draft.welcome_messages.length > 1 && (
                <button
                  type="button"
                  onClick={() =>
                    setDraft((prev) =>
                      prev
                        ? {
                            ...prev,
                            welcome_messages: prev.welcome_messages.filter(
                              (_, i) => i !== idx
                            ),
                          }
                        : prev
                    )
                  }
                  aria-label={`Remove opener ${idx + 1}`}
                  className="p-2 rounded-lg border border-[#3D3830]/12 bg-[#FDFBF7] text-[#8B8275] hover:text-[#7A3E36] cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Portrait & Monogram Studio */}
      <div className="rounded-2xl border border-[#3D3830]/12 bg-[#FAF7F2] p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ImageIcon className="h-4 w-4 text-[#8B7355]" />
            <span className="text-xs font-semibold text-[#3D3830]">
              Editorial Portrait &amp; Monogram Palette
            </span>
          </div>
          {draft.avatar_url && (
            <button
              type="button"
              onClick={() =>
                setDraft((prev) => (prev ? { ...prev, avatar_url: null } : prev))
              }
              className="text-xs text-[#7A3E36] hover:underline cursor-pointer"
            >
              Use Monogram Only
            </button>
          )}
        </div>

        {availablePortraits.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[11px] text-[#8B8275]">
              Curated Watercolor Portraits (click to assign):
            </p>
            <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2">
              {availablePortraits.map((p) => {
                const selected = draft.avatar_url === p.url;
                return (
                  <button
                    key={p.url}
                    type="button"
                    onClick={() =>
                      setDraft((prev) =>
                        prev ? { ...prev, avatar_url: p.url } : prev
                      )
                    }
                    title={p.label}
                    className={`group flex flex-col items-center gap-1 rounded-xl p-1 border transition-colors cursor-pointer ${
                      selected
                        ? 'border-[#B8965A] bg-[#B8965A]/15'
                        : 'border-transparent hover:border-[#3D3830]/20 hover:bg-[#F1ECE3]'
                    }`}
                  >
                    <img
                      src={p.url}
                      alt={p.label}
                      className="h-10 w-10 rounded-full object-cover object-center"
                    />
                    <span className="text-[10px] text-[#5C5449] truncate w-full text-center">
                      {p.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-[#3D3830]/20 bg-[#FDFBF7] px-3.5 py-2.5">
          <div className="min-w-0">
            <p className="text-xs font-medium text-[#3D3830]">
              Upload Custom Display Picture (DP)
            </p>
            <p className="text-[11px] text-[#8B8275]">
              PNG, JPEG, or WebP · Auto-cropped square 320×320
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <input
              ref={dpFileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              onChange={(e) => {
                const picked = e.target.files?.[0];
                e.target.value = '';
                if (picked) void handleUploadPortraitFile(picked);
              }}
            />
            <button
              type="button"
              disabled={uploadingDp}
              onClick={() => dpFileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#3D3830]/18 bg-[#FAF7F2] px-3.5 py-1.5 text-xs font-medium text-[#3D3830] hover:bg-[#F1ECE3] disabled:opacity-50 transition-colors cursor-pointer"
            >
              <Upload className="h-3.5 w-3.5 text-[#8B7355]" />
              <span>{uploadingDp ? 'Processing…' : 'Upload Portrait Image'}</span>
            </button>
          </div>
        </div>
        {dpUploadError && <p className="text-xs text-[#7A3E36]">{dpUploadError}</p>}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-[#5C5449]">
              Custom Avatar URL (https:// or /assets/...)
            </span>
            <input
              type="text"
              value={draft.avatar_url || ''}
              onChange={(e) =>
                setDraft((prev) =>
                  prev ? { ...prev, avatar_url: e.target.value || null } : prev
                )
              }
              placeholder="/assets/companions/aira.jpg or https://..."
              className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FDFBF7] px-3 py-2 font-mono text-xs text-[#3D3830] focus:border-[#3D3830]/40 focus:outline-none"
            />
          </label>

          <div className="space-y-1.5">
            <span className="text-xs font-medium text-[#5C5449]">
              Monogram Fallback Swatches
            </span>
            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              {Object.entries(monogramPalettes).map(([key, pal]) => {
                const active =
                  draft.monogram_palette.bg.toLowerCase() === pal.bg.toLowerCase();
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() =>
                      setDraft((prev) =>
                        prev ? { ...prev, monogram_palette: { ...pal } } : prev
                      )
                    }
                    title={key}
                    style={{
                      backgroundColor: pal.bg,
                      borderColor: pal.ring,
                      color: pal.ink,
                    }}
                    className={`h-8 w-8 rounded-full border-2 font-serif text-xs font-semibold flex items-center justify-center cursor-pointer transition-transform ${
                      active ? 'scale-110 ring-2 ring-[#3D3830]/40' : ''
                    }`}
                  >
                    {(draft.name || 'C').charAt(0).toUpperCase()}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CompanionPublicProfileTab;
