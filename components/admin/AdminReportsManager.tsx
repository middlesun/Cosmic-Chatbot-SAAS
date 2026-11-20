import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  Layers,
  Plus,
  Save,
  ScrollText,
  Trash2,
  X,
} from 'lucide-react';
import CustomSelect from '../app/CustomSelect';
import RichMarkdownEditor from './RichMarkdownEditor';
import type {
  ModelChoiceOption,
  PromptRecipeRecord,
  SystemPromptRecord,
} from './PromptLibraryManager';

export interface ReportStepDraft {
  stepNumber: number;
  title: string;
  instruction: string;
  promptSlugs?: string[];
  recipeSlug?: string | null;
  modelId?: string | null;
}

export interface AdminReportRecord {
  id: string;
  slug: string;
  name: string;
  category: string;
  short_description: string;
  long_description: string | null;
  price_credits: number;
  sort_order: number;
  is_active: boolean;
  model_id?: string | null;
  prompt_chain_json: ReportStepDraft[];
}

interface AdminReportsManagerProps {
  reports: AdminReportRecord[];
  prompts: SystemPromptRecord[];
  modelOptions: ModelChoiceOption[];
  getAccessToken: () => Promise<string | null>;
  onReportSaved: (report: AdminReportRecord, isNew?: boolean) => void;
  onReportDeleted: (reportId: string) => void;
}

const AdminReportsManager: React.FC<AdminReportsManagerProps> = ({
  reports,
  prompts,
  modelOptions,
  getAccessToken,
  onReportSaved,
  onReportDeleted,
}) => {
  const [selectedId, setSelectedId] = useState<string | null>(reports[0]?.id || null);
  const [isCreating, setIsCreating] = useState(false);
  const [recipes, setRecipes] = useState<PromptRecipeRecord[]>([]);

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [category, setCategory] = useState('Life & Dharma');
  const [priceCredits, setPriceCredits] = useState<number>(3000);
  const [sortOrder, setSortOrder] = useState<number>(10);
  const [isActive, setIsActive] = useState(true);
  const [modelId, setModelId] = useState('');
  const [shortDesc, setShortDesc] = useState('');
  const [longDesc, setLongDesc] = useState('');
  const [steps, setSteps] = useState<ReportStepDraft[]>([]);
  const [pendingSlugByStep, setPendingSlugByStep] = useState<Record<number, string>>({});

  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadRecipes = async () => {
      try {
        const token = await getAccessToken();
        const res = await fetch('/api/admin/recipes', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (res.ok && Array.isArray(data.recipes)) {
          setRecipes(data.recipes);
        }
      } catch {
        // ignore
      }
    };
    void loadRecipes();
  }, []);

  const selectedReport = useMemo(
    () => reports.find((r) => r.id === selectedId) || null,
    [reports, selectedId]
  );

  useEffect(() => {
    if (isCreating) return;
    if (!selectedReport && reports.length > 0) {
      setSelectedId(reports[0].id);
      return;
    }
    if (selectedReport) {
      setName(selectedReport.name);
      setSlug(selectedReport.slug);
      setCategory(selectedReport.category);
      setPriceCredits(selectedReport.price_credits);
      setSortOrder(selectedReport.sort_order ?? 10);
      setIsActive(selectedReport.is_active);
      setModelId(selectedReport.model_id || '');
      setShortDesc(selectedReport.short_description || '');
      setLongDesc(selectedReport.long_description || '');
      setSteps(
        Array.isArray(selectedReport.prompt_chain_json) && selectedReport.prompt_chain_json.length > 0
          ? selectedReport.prompt_chain_json.map((s, idx) => ({
              stepNumber: idx + 1,
              title: s.title || `Pass ${idx + 1}`,
              instruction: s.instruction || '',
              promptSlugs: Array.isArray(s.promptSlugs) ? s.promptSlugs : [],
              recipeSlug: s.recipeSlug || '',
              modelId: s.modelId || '',
            }))
          : []
      );
      setConfirmDelete(false);
    }
  }, [selectedReport?.id, isCreating, reports.length]);

  const startNewReport = () => {
    setIsCreating(true);
    setSelectedId(null);
    setName('');
    setSlug('');
    setCategory('Career & Vocation');
    setPriceCredits(2500);
    setSortOrder(reports.length + 1);
    setIsActive(true);
    setModelId('');
    setShortDesc('');
    setLongDesc('');
    setSteps([
      {
        stepNumber: 1,
        title: 'Pass 1 · Natal & Divisional Foundation',
        instruction:
          'Analyze Lagna, Moon, relevant Bhavas, divisional Vargas, and Ashtakavarga bindus from the natal chart.',
        promptSlugs: [],
        recipeSlug: '',
        modelId: '',
      },
      {
        stepNumber: 2,
        title: 'Pass 2 · Editorial Synthesis & Dasha Timing',
        instruction:
          'Synthesize all findings into a clear, publication-ready report with Dasha/Gochar timing windows and direct answers to every user question.',
        promptSlugs: [],
        recipeSlug: '',
        modelId: '',
      },
    ]);
    setFeedback(null);
    setError(null);
  };

  const updateStep = (idx: number, patch: Partial<ReportStepDraft>) => {
    setSteps((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  };

  const moveStep = (idx: number, dir: -1 | 1) => {
    setSteps((prev) => {
      const target = idx + dir;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next.map((s, i) => ({ ...s, stepNumber: i + 1 }));
    });
  };

  const addStep = () => {
    setSteps((prev) => [
      ...prev,
      {
        stepNumber: prev.length + 1,
        title: `Pass ${prev.length + 1} · Deep Synthesis`,
        instruction: '',
        promptSlugs: [],
        recipeSlug: '',
        modelId: '',
      },
    ]);
  };

  const removeStep = (idx: number) => {
    setSteps((prev) =>
      prev.filter((_, i) => i !== idx).map((s, i) => ({ ...s, stepNumber: i + 1 }))
    );
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setFeedback(null);
    try {
      const token = await getAccessToken();
      const payload = {
        slug: slug || name,
        name,
        category,
        short_description: shortDesc,
        long_description: longDesc,
        price_credits: priceCredits,
        sort_order: sortOrder,
        is_active: isActive,
        model_id: modelId || null,
        prompt_chain_json: steps.map((s, idx) => ({
          stepNumber: idx + 1,
          title: s.title,
          instruction: s.instruction,
          promptSlugs: s.promptSlugs?.filter(Boolean) || [],
          recipeSlug: s.recipeSlug || null,
          modelId: s.modelId || null,
        })),
      };

      const url = isCreating ? '/api/admin/reports' : `/api/admin/reports/${selectedReport?.id}`;
      const method = isCreating ? 'POST' : 'PATCH';
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save report');
      onReportSaved(data.report, isCreating);
      if (isCreating) {
        setIsCreating(false);
        setSelectedId(data.report.id);
        setFeedback(`Report "${data.report.name}" added to catalog.`);
      } else {
        setFeedback(`Saved "${data.report.name}".`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedReport) return;
    setSaving(true);
    setError(null);
    try {
      const token = await getAccessToken();
      const res = await fetch(`/api/admin/reports/${selectedReport.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Could not delete report');
      const id = selectedReport.id;
      onReportDeleted(id);
      setSelectedId(reports.find((r) => r.id !== id)?.id || null);
      setConfirmDelete(false);
      setFeedback('Report removed from catalog.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setSaving(false);
    }
  };

  const promptBySlug = useMemo(() => new Map(prompts.map((p) => [p.slug, p])), [prompts]);

  const promptPickerOptions = useMemo(
    () => [
      { value: '', label: 'Attach Prompt Library block...' },
      ...prompts.map((p) => ({
        value: p.slug,
        label: `[${p.category}] ${p.display_name}`,
        description: p.slug,
      })),
    ],
    [prompts]
  );

  const recipeOptions = useMemo(
    () => [
      { value: '', label: 'No Composable Recipe attached' },
      ...recipes.map((r) => ({
        value: r.slug,
        label: `${r.name} (${r.steps_json?.length || 0} blocks)`,
        description: r.slug,
      })),
    ],
    [recipes]
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-serif text-2xl font-medium text-[#3D3830]">Reports manager</h2>
          <p className="mt-1 text-xs text-[#5C5449]">
            Configure Deep Research PDF report offerings, credit prices, model overrides, and multi-pass prompt chains powered by your Prompt Library & Recipes.
          </p>
        </div>
        <button
          type="button"
          onClick={startNewReport}
          className="inline-flex items-center gap-1.5 rounded-full bg-[#4A453D] px-4 py-2 text-xs font-medium text-[#FAF7F2] hover:bg-[#38342E] cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5" />
          New Report
        </button>
      </div>

      {error && (
        <div className="rounded-2xl border border-[#7A3E36]/25 bg-[#7A3E36]/8 px-4 py-3 text-xs text-[#7A3E36]">
          {error}
        </div>
      )}
      {feedback && (
        <div className="rounded-2xl border border-[#2D6A4F]/25 bg-[#2D6A4F]/8 px-4 py-3 text-xs text-[#2D6A4F] flex items-center gap-2">
          <Check className="h-4 w-4 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-5 items-start">
        {/* Left Report Catalog List */}
        <div className="rounded-3xl bg-[#FDFBF7] border border-[#3D3830]/12 overflow-hidden divide-y divide-[#3D3830]/8">
          {reports.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#8B8275]">
              <ScrollText className="h-6 w-6 mx-auto mb-2" />
              No reports in catalog yet.
            </div>
          ) : (
            reports.map((rep) => {
              const active = !isCreating && rep.id === selectedId;
              return (
                <button
                  key={rep.id}
                  type="button"
                  onClick={() => {
                    setIsCreating(false);
                    setSelectedId(rep.id);
                    setFeedback(null);
                    setError(null);
                  }}
                  className={`w-full text-left p-4 transition-colors cursor-pointer ${
                    active ? 'bg-[#EAE3D7]/70' : 'hover:bg-[#FAF7F2]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-[#3D3830] truncate">
                      {rep.name}
                    </span>
                    <span className="font-mono text-[11px] tabular-nums text-[#8B7355] shrink-0">
                      {rep.price_credits.toLocaleString()} cr
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[11px] text-[#8B8275]">
                    <span className="truncate">{rep.category}</span>
                    <span className="font-mono text-[10px]">
                      {rep.prompt_chain_json?.length || 0} passes
                      {!rep.is_active ? ' · Hidden' : ''}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Right Report Editor */}
        <div className="rounded-3xl bg-[#FDFBF7] border border-[#3D3830]/12 p-5 sm:p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#3D3830]/10 pb-4">
            <div>
              <h3 className="font-serif text-xl font-medium text-[#3D3830]">
                {isCreating ? 'New Deep Research Report' : name || 'Edit Report'}
              </h3>
              <p className="text-[11px] font-mono text-[#8B8275] mt-0.5">
                {slug || 'auto-generated-slug'} · {steps.length} sequential passes
              </p>
            </div>
            <button
              type="button"
              disabled={saving || !name.trim() || !shortDesc.trim()}
              onClick={handleSave}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#4A453D] px-5 py-2 text-xs font-medium text-[#FAF7F2] hover:bg-[#38342E] disabled:opacity-50 cursor-pointer"
            >
              <Save className="h-3.5 w-3.5" />
              {saving ? 'Saving...' : isCreating ? 'Publish Report' : 'Save Changes'}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            <div>
              <label className="block text-[11px] font-medium text-[#5C5449] mb-1">
                Report Title
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Life Blueprint Deep Research Dossier"
                className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3 py-2 text-xs text-[#3D3830]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-[#5C5449] mb-1">
                URL Slug
              </label>
              <input
                type="text"
                value={slug}
                disabled={!isCreating}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="life-blueprint-dossier"
                className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3 py-2 font-mono text-xs text-[#5C5449] disabled:opacity-65"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-[#5C5449] mb-1">
                Category
              </label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Life & Dharma, Career, Marriage..."
                className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3 py-2 text-xs text-[#3D3830]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-[#5C5449] mb-1">
                Credit Price
              </label>
              <input
                type="number"
                min={0}
                value={priceCredits}
                onChange={(e) => setPriceCredits(Math.max(0, Number(e.target.value) || 0))}
                className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3 py-2 font-mono text-xs tabular-nums text-[#3D3830]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-[#5C5449] mb-1">
                Default Report Model Override
              </label>
              <CustomSelect
                value={modelId}
                onChange={setModelId}
                options={[{ value: '', label: 'Use Platform Default Consultation Model' }, ...modelOptions]}
              />
            </div>
            <div className="flex items-end gap-3">
              <div className="w-24">
                <label className="block text-[11px] font-medium text-[#5C5449] mb-1">
                  Sort Order
                </label>
                <input
                  type="number"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(Number(e.target.value) || 0)}
                  className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3 py-2 font-mono text-xs tabular-nums text-[#3D3830]"
                />
              </div>
              <label className="inline-flex items-center gap-2 pb-2 text-xs font-medium text-[#3D3830] cursor-pointer">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="accent-[#4A453D]"
                />
                Visible in Store
              </label>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-[#5C5449] mb-1">
              Short Storefront Summary
            </label>
            <input
              type="text"
              value={shortDesc}
              onChange={(e) => setShortDesc(e.target.value)}
              className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3 py-2 text-xs text-[#3D3830]"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-[#5C5449] mb-1.5">
              Detailed Editorial Description (Markdown)
            </label>
            <RichMarkdownEditor value={longDesc} onChange={setLongDesc} rows={5} />
          </div>

          {/* Multi-Pass Sequential Prompt Chain */}
          <div className="space-y-3 border-t border-[#3D3830]/10 pt-5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-[#8B7355]" />
                <h4 className="text-sm font-semibold text-[#3D3830]">
                  Sequential Synthesis Chain ({steps.length} Passes)
                </h4>
              </div>
              <button
                type="button"
                onClick={addStep}
                className="inline-flex items-center gap-1 rounded-full border border-[#3D3830]/15 bg-[#FAF7F2] px-3 py-1.5 text-xs font-medium text-[#3D3830] hover:bg-[#EAE3D7]/70 cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Pass
              </button>
            </div>

            <div className="space-y-4">
              {steps.map((step, idx) => (
                <div
                  key={idx}
                  className="rounded-2xl border border-[#3D3830]/12 bg-[#FAF7F2] p-4 space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                      <span className="font-mono text-xs font-semibold text-[#8B7355]">
                        Pass {idx + 1}
                      </span>
                      <input
                        type="text"
                        value={step.title}
                        onChange={(e) => updateStep(idx, { title: e.target.value })}
                        placeholder="Pass title..."
                        className="flex-1 rounded-xl border border-[#3D3830]/15 bg-[#FDFBF7] px-3 py-1.5 text-xs font-medium text-[#3D3830]"
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => moveStep(idx, -1)}
                        className="rounded-lg p-1.5 text-[#5C5449] hover:bg-[#EAE3D7] disabled:opacity-30 cursor-pointer"
                        aria-label="Move pass up"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === steps.length - 1}
                        onClick={() => moveStep(idx, 1)}
                        className="rounded-lg p-1.5 text-[#5C5449] hover:bg-[#EAE3D7] disabled:opacity-30 cursor-pointer"
                        aria-label="Move pass down"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                      {steps.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeStep(idx)}
                          className="rounded-lg p-1.5 text-[#7A3E36] hover:bg-[#7A3E36]/10 cursor-pointer"
                          aria-label="Remove pass"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Recipe + Step Model Override */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] uppercase tracking-wider text-[#8B8275] mb-1">
                        Composable Recipe (optional)
                      </label>
                      <CustomSelect
                        value={step.recipeSlug || ''}
                        onChange={(val) => updateStep(idx, { recipeSlug: val })}
                        options={recipeOptions}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase tracking-wider text-[#8B8275] mb-1">
                        Pass Model Override (optional)
                      </label>
                      <CustomSelect
                        value={step.modelId || ''}
                        onChange={(val) => updateStep(idx, { modelId: val })}
                        options={[{ value: '', label: 'Inherit Report Model' }, ...modelOptions]}
                      />
                    </div>
                  </div>

                  {/* Reusable Prompt Library Slugs attached to this pass */}
                  <div className="space-y-2">
                    <label className="block text-[10px] uppercase tracking-wider text-[#8B8275]">
                      Reusable Prompt Library Modules (stacked in order)
                    </label>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <div className="flex-1">
                        <CustomSelect
                          value={pendingSlugByStep[idx] || ''}
                          onChange={(val) =>
                            setPendingSlugByStep((prev) => ({ ...prev, [idx]: val }))
                          }
                          options={promptPickerOptions}
                        />
                      </div>
                      <button
                        type="button"
                        disabled={!pendingSlugByStep[idx]}
                        onClick={() => {
                          const slugToAdd = pendingSlugByStep[idx];
                          if (!slugToAdd) return;
                          const curr = step.promptSlugs || [];
                          if (!curr.includes(slugToAdd)) {
                            updateStep(idx, { promptSlugs: [...curr, slugToAdd] });
                          }
                          setPendingSlugByStep((prev) => ({ ...prev, [idx]: '' }));
                        }}
                        className="rounded-xl border border-[#3D3830]/15 bg-[#FDFBF7] px-3 py-1.5 text-xs font-medium text-[#3D3830] hover:bg-[#EAE3D7] disabled:opacity-40 cursor-pointer shrink-0"
                      >
                        + Attach
                      </button>
                    </div>
                    {step.promptSlugs && step.promptSlugs.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {step.promptSlugs.map((ps) => (
                          <span
                            key={ps}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-[#EAE3D7] px-2.5 py-1 text-[11px] text-[#3D3830]"
                          >
                            <span className="font-medium">
                              {promptBySlug.get(ps)?.display_name || ps}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                updateStep(idx, {
                                  promptSlugs: (step.promptSlugs || []).filter((x) => x !== ps),
                                })
                              }
                              className="text-[#7A3E36] hover:opacity-75 cursor-pointer"
                              aria-label={`Remove ${ps}`}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-[#8B8275] mb-1">
                      Pass-Specific Instructions
                    </label>
                    <textarea
                      rows={4}
                      value={step.instruction}
                      onChange={(e) => updateStep(idx, { instruction: e.target.value })}
                      placeholder="Write specific synthesis rules for this pass..."
                      className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FDFBF7] px-3 py-2 font-mono text-xs text-[#3D3830] leading-relaxed"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {!isCreating && selectedReport && (
            <div className="flex items-center justify-end pt-3 border-t border-[#3D3830]/10">
              {confirmDelete ? (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-[#7A3E36]">Delete this report template?</span>
                  <button
                    type="button"
                    onClick={() => void handleDelete()}
                    className="rounded-full bg-[#7A3E36] px-3 py-1 text-[#FAF7F2] font-medium cursor-pointer"
                  >
                    Yes, Delete
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="rounded-full border border-[#3D3830]/15 px-3 py-1 text-[#5C5449] cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="inline-flex items-center gap-1 text-xs text-[#7A3E36] hover:underline cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete Report
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminReportsManager;
