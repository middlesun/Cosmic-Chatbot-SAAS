import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  Cpu,
  History,
  Play,
  Plus,
  RotateCcw,
  Save,
  Sparkles,
  Trash2,
} from 'lucide-react';
import CustomSelect from '../app/CustomSelect';
import RichMarkdownEditor from './RichMarkdownEditor';

export interface SystemPromptRow {
  id: string;
  slug: string;
  category: 'expert' | 'mode' | 'output' | 'language' | 'tool' | 'report_step' | 'learn';
  display_name: string;
  subtitle?: string | null;
  prompt_body: string;
  model_id?: string | null;
  version: number;
  previous_versions: Array<{
    version: number;
    prompt_body: string;
    archived_at: string;
  }>;
  is_active: boolean;
  updated_at: string;
}

export interface ReportPromptStepDraft {
  stepNumber: number;
  title: string;
  instruction: string;
}

export interface ReportCatalogAdminRow {
  id: string;
  slug: string;
  name: string;
  category: string;
  short_description: string;
  long_description: string | null;
  price_credits: number;
  sort_order?: number;
  model_id?: string | null;
  is_active: boolean;
  prompt_chain_json: ReportPromptStepDraft[];
}

interface PromptChainEditorProps {
  mode: 'prompts' | 'reports';
  prompts: SystemPromptRow[];
  reports: ReportCatalogAdminRow[];
  getAccessToken: () => Promise<string | null>;
  onPromptSaved: (prompt: SystemPromptRow) => void;
  onReportSaved: (report: ReportCatalogAdminRow) => void;
}

const CURATED_OPENROUTER_MODELS = [
  { value: '', label: 'Platform Default (.env)' },
  { value: 'google/gemini-2.5-flash', label: 'google/gemini-2.5-flash' },
  { value: 'google/gemini-2.5-pro', label: 'google/gemini-2.5-pro' },
  { value: 'anthropic/claude-sonnet-4', label: 'anthropic/claude-sonnet-4' },
  { value: 'anthropic/claude-3.5-sonnet', label: 'anthropic/claude-3.5-sonnet' },
  { value: 'openai/gpt-4o', label: 'openai/gpt-4o' },
  { value: 'deepseek/deepseek-r1', label: 'deepseek/deepseek-r1' },
  { value: '__custom__', label: 'Custom OpenRouter Model ID...' },
];

const KNOWN_MODEL_VALUES = new Set(
  CURATED_OPENROUTER_MODELS.map((m) => m.value).filter((v) => v !== '__custom__')
);

const REPORT_CATEGORY_OPTIONS = [
  { value: 'Life & Dharma', label: 'Life & Dharma' },
  { value: 'Career & Vocation', label: 'Career & Vocation' },
  { value: 'Marriage & Partnership', label: 'Marriage & Partnership' },
  { value: 'Wealth & Assets', label: 'Wealth & Assets' },
  { value: 'Love & Romance', label: 'Love & Romance' },
  { value: 'Health & Vitality', label: 'Health & Vitality' },
  { value: 'Timing & Transit', label: 'Timing & Transit' },
];

interface OpenRouterModelFieldProps {
  value: string;
  onChange: (nextModelId: string) => void;
  surface?: 'canvas' | 'elevated';
}

const OpenRouterModelField: React.FC<OpenRouterModelFieldProps> = ({
  value,
  onChange,
  surface = 'canvas',
}) => {
  const trimmed = value.trim();
  const isCustom = Boolean(trimmed) && !KNOWN_MODEL_VALUES.has(trimmed);
  const [customMode, setCustomMode] = useState(isCustom);

  useEffect(() => {
    setCustomMode(Boolean(value.trim()) && !KNOWN_MODEL_VALUES.has(value.trim()));
  }, [value]);

  return (
    <div className="space-y-2">
      <CustomSelect
        value={customMode ? '__custom__' : trimmed}
        onChange={(selected) => {
          if (selected === '__custom__') {
            setCustomMode(true);
            if (!trimmed || KNOWN_MODEL_VALUES.has(trimmed)) {
              onChange('');
            }
          } else {
            setCustomMode(false);
            onChange(selected);
          }
        }}
        ariaLabel="OpenRouter Model Override"
        size="sm"
        surface={surface}
        className="w-full"
        options={CURATED_OPENROUTER_MODELS}
      />

      {customMode && (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="provider/model-slug (e.g., qwen/qwen-2.5-72b-instruct)"
          className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3 py-2 text-xs font-['DM_Sans',sans-serif] text-[#3D3830] placeholder:text-[#8B8275] focus:outline-none focus:border-[#3D3830]/40"
        />
      )}
    </div>
  );
};

const EMPTY_NEW_REPORT_CHAIN: ReportPromptStepDraft[] = [
  {
    stepNumber: 1,
    title: 'Pass 1 · Chart Foundations & Planetary Evidence',
    instruction:
      'Analyze relevant houses, lordships, divisional charts, and Sarvashtakavarga scores from the natal chart context.',
  },
  {
    stepNumber: 2,
    title: 'Pass 2 · Strategic Dossier Synthesis',
    instruction:
      'Combine earlier planetary findings with Dasha and Gochar timing into one cohesive, editorial Markdown dossier answering all user questions.',
  },
];

const PromptChainEditor: React.FC<PromptChainEditorProps> = ({
  mode,
  prompts,
  reports,
  getAccessToken,
  onPromptSaved,
  onReportSaved,
}) => {
  // System Prompts editor state
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [selectedPromptId, setSelectedPromptId] = useState<string>(prompts[0]?.id || '');
  const [draftName, setDraftName] = useState<string>(prompts[0]?.display_name || '');
  const [draftSubtitle, setDraftSubtitle] = useState<string>(prompts[0]?.subtitle || '');
  const [draftBody, setDraftBody] = useState<string>(prompts[0]?.prompt_body || '');
  const [draftModelId, setDraftModelId] = useState<string>(prompts[0]?.model_id || '');
  const [draftActive, setDraftActive] = useState<boolean>(prompts[0]?.is_active ?? true);

  // New modular rule modal state
  const [showNewPromptForm, setShowNewPromptForm] = useState(false);
  const [newSlug, setNewSlug] = useState('');
  const [newCategory, setNewCategory] = useState<SystemPromptRow['category']>('expert');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newSubtitle, setNewSubtitle] = useState('');
  const [newModelId, setNewModelId] = useState('');
  const [newPromptBody, setNewPromptBody] = useState('');

  // Sandbox state
  const [testQuestion, setTestQuestion] = useState(
    'How should an analyst weigh D10 Dasamsa against KP 10th Cusp Sub-Lord during Saturn Antardasha?'
  );
  const [sandboxOutput, setSandboxOutput] = useState('');
  const [sandboxModelUsed, setSandboxModelUsed] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  // Report Catalog editor state
  const [selectedReportId, setSelectedReportId] = useState<string>(reports[0]?.id || '');
  const [reportDraft, setReportDraft] = useState<ReportCatalogAdminRow | null>(
    reports[0] ? (JSON.parse(JSON.stringify(reports[0])) as ReportCatalogAdminRow) : null
  );
  const [showNewReportForm, setShowNewReportForm] = useState(false);
  const [newReportName, setNewReportName] = useState('');
  const [newReportSlug, setNewReportSlug] = useState('');
  const [newReportCategory, setNewReportCategory] = useState('Career & Vocation');
  const [newReportPrice, setNewReportPrice] = useState(2500);
  const [newReportSortOrder, setNewReportSortOrder] = useState(10);
  const [newReportModelId, setNewReportModelId] = useState('');
  const [newReportShortDesc, setNewReportShortDesc] = useState('');
  const [newReportLongDesc, setNewReportLongDesc] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const filteredPrompts = useMemo(() => {
    if (categoryFilter === 'all') return prompts;
    return prompts.filter((p) => p.category === categoryFilter);
  }, [prompts, categoryFilter]);

  const activePrompt = useMemo(
    () => prompts.find((p) => p.id === selectedPromptId) || filteredPrompts[0] || null,
    [prompts, selectedPromptId, filteredPrompts]
  );

  // Ensure initial async load populates drafts properly
  useEffect(() => {
    if (!selectedPromptId && prompts.length > 0) {
      const first = prompts[0];
      setSelectedPromptId(first.id);
      setDraftName(first.display_name);
      setDraftSubtitle(first.subtitle || '');
      setDraftBody(first.prompt_body);
      setDraftModelId(first.model_id || '');
      setDraftActive(first.is_active);
    }
  }, [prompts, selectedPromptId]);

  useEffect(() => {
    if (!selectedReportId && reports.length > 0) {
      const first = reports[0];
      setSelectedReportId(first.id);
      setReportDraft(JSON.parse(JSON.stringify(first)) as ReportCatalogAdminRow);
    }
  }, [reports, selectedReportId]);

  const selectPrompt = (p: SystemPromptRow) => {
    setShowNewPromptForm(false);
    setSelectedPromptId(p.id);
    setDraftName(p.display_name);
    setDraftSubtitle(p.subtitle || '');
    setDraftBody(p.prompt_body);
    setDraftModelId(p.model_id || '');
    setDraftActive(p.is_active);
    setFeedback(null);
    setErrorMsg(null);
    setSandboxOutput('');
    setSandboxModelUsed(null);
  };

  const selectReport = (r: ReportCatalogAdminRow) => {
    setShowNewReportForm(false);
    setSelectedReportId(r.id);
    setReportDraft(JSON.parse(JSON.stringify(r)) as ReportCatalogAdminRow);
    setFeedback(null);
    setErrorMsg(null);
  };

  const handleSavePrompt = async () => {
    if (!activePrompt) return;
    setIsSaving(true);
    setFeedback(null);
    setErrorMsg(null);
    try {
      const token = await getAccessToken();
      if (!token) return;
      const res = await fetch(`/api/admin/prompts/${activePrompt.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          display_name: draftName,
          subtitle: draftSubtitle.trim() || null,
          prompt_body: draftBody,
          model_id: draftModelId.trim() || null,
          is_active: draftActive,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save prompt');
      onPromptSaved(data.prompt);
      setFeedback(
        `Saved "${data.prompt.display_name}" (v${data.prompt.version}). Live user catalog updated.`
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Save error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreatePrompt = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setErrorMsg(null);
    setFeedback(null);
    try {
      const token = await getAccessToken();
      if (!token) return;
      const res = await fetch('/api/admin/prompts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          slug: newSlug,
          category: newCategory,
          display_name: newDisplayName,
          subtitle: newSubtitle.trim() || null,
          model_id: newModelId.trim() || null,
          prompt_body: newPromptBody,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Create prompt failed');
      onPromptSaved(data.prompt);
      selectPrompt(data.prompt);
      setShowNewPromptForm(false);
      setNewSlug('');
      setNewDisplayName('');
      setNewSubtitle('');
      setNewModelId('');
      setNewPromptBody('');
      setFeedback(`Created modular prompt "${data.prompt.display_name}".`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRollback = async (versionNum: number) => {
    if (!activePrompt) return;
    setIsSaving(true);
    setErrorMsg(null);
    try {
      const token = await getAccessToken();
      if (!token) return;
      const res = await fetch(`/api/admin/prompts/${activePrompt.id}/rollback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ version: versionNum }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Rollback failed');
      onPromptSaved(data.prompt);
      setDraftBody(data.prompt.prompt_body);
      setFeedback(`Rolled back cleanly to archived v${versionNum} (now live as v${data.prompt.version}).`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Rollback failed');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRunSandbox = async () => {
    setIsTesting(true);
    setErrorMsg(null);
    setSandboxOutput('');
    setSandboxModelUsed(null);
    try {
      const token = await getAccessToken();
      if (!token) return;
      const res = await fetch('/api/admin/prompts/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          promptBody: draftBody,
          testQuestion,
          modelId: draftModelId.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Sandbox failed');
      setSandboxOutput(data.output || '');
      setSandboxModelUsed(data.modelUsed || null);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Sandbox failed');
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveReportCatalog = async () => {
    if (!reportDraft) return;
    setIsSaving(true);
    setFeedback(null);
    setErrorMsg(null);
    try {
      const token = await getAccessToken();
      if (!token) return;
      const normalizedChain = reportDraft.prompt_chain_json.map((step, idx) => ({
        stepNumber: idx + 1,
        title: step.title,
        instruction: step.instruction,
      }));

      const res = await fetch(`/api/admin/reports/${reportDraft.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: reportDraft.name,
          category: reportDraft.category,
          short_description: reportDraft.short_description,
          long_description: reportDraft.long_description,
          price_credits: Number(reportDraft.price_credits),
          sort_order: Number(reportDraft.sort_order ?? 1),
          model_id: reportDraft.model_id?.trim() || null,
          is_active: reportDraft.is_active,
          prompt_chain_json: normalizedChain,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update report');
      onReportSaved(data.report);
      setReportDraft(JSON.parse(JSON.stringify(data.report)) as ReportCatalogAdminRow);
      setFeedback(`Saved Report Catalog entry "${data.report.name}".`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Save error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateReport = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setErrorMsg(null);
    setFeedback(null);
    try {
      const token = await getAccessToken();
      if (!token) return;
      const res = await fetch('/api/admin/reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newReportName,
          slug: newReportSlug || undefined,
          category: newReportCategory,
          short_description: newReportShortDesc,
          long_description: newReportLongDesc || null,
          price_credits: Number(newReportPrice),
          sort_order: Number(newReportSortOrder),
          model_id: newReportModelId.trim() || null,
          is_active: true,
          prompt_chain_json: EMPTY_NEW_REPORT_CHAIN,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Create report failed');
      onReportSaved(data.report);
      selectReport(data.report);
      setShowNewReportForm(false);
      setNewReportName('');
      setNewReportSlug('');
      setNewReportShortDesc('');
      setNewReportLongDesc('');
      setNewReportModelId('');
      setFeedback(`Created report "${data.report.name}".`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Create report failed');
    } finally {
      setIsSaving(false);
    }
  };

  const updateReportStep = (
    index: number,
    patch: Partial<ReportPromptStepDraft>,
    draft: ReportCatalogAdminRow
  ) => {
    const next = [...draft.prompt_chain_json];
    next[index] = { ...next[index], ...patch };
    setReportDraft({ ...draft, prompt_chain_json: next });
  };

  const moveReportStep = (index: number, direction: -1 | 1, draft: ReportCatalogAdminRow) => {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= draft.prompt_chain_json.length) return;
    const next = [...draft.prompt_chain_json];
    const [moved] = next.splice(index, 1);
    next.splice(targetIdx, 0, moved);
    setReportDraft({
      ...draft,
      prompt_chain_json: next.map((s, i) => ({ ...s, stepNumber: i + 1 })),
    });
  };

  const addReportStep = (draft: ReportCatalogAdminRow) => {
    const nextNum = draft.prompt_chain_json.length + 1;
    setReportDraft({
      ...draft,
      prompt_chain_json: [
        ...draft.prompt_chain_json,
        {
          stepNumber: nextNum,
          title: `Pass ${nextNum} · Analytical Synthesis`,
          instruction: '',
        },
      ],
    });
  };

  const removeReportStep = (index: number, draft: ReportCatalogAdminRow) => {
    if (draft.prompt_chain_json.length <= 1) return;
    const next = draft.prompt_chain_json
      .filter((_, i) => i !== index)
      .map((s, i) => ({ ...s, stepNumber: i + 1 }));
    setReportDraft({ ...draft, prompt_chain_json: next });
  };

  if (mode === 'reports') {
    const activeReport =
      reportDraft || reports.find((r) => r.id === selectedReportId) || reports[0] || null;

    return (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#5C5449]">
              Report Catalog ({reports.length})
            </span>
            <button
              type="button"
              onClick={() => {
                setShowNewReportForm((v) => !v);
                setErrorMsg(null);
                setFeedback(null);
              }}
              className="inline-flex items-center gap-1 rounded-full bg-[#4A453D] px-3.5 py-1.5 text-xs font-medium text-[#FAF7F2] hover:bg-[#38342E]"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>New Report</span>
            </button>
          </div>

          <div className="space-y-2 max-h-[680px] overflow-y-auto pr-1">
            {reports.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => selectReport(r)}
                className={`w-full rounded-2xl border p-4 text-left transition-colors ${
                  activeReport?.id === r.id && !showNewReportForm
                    ? 'bg-[#F1ECE3] border-[#3D3830]/25'
                    : 'bg-[#FDFBF7] border-[#3D3830]/10 hover:bg-[#F1ECE3]/50'
                }`}
              >
                <div className="flex items-center justify-between text-[11px] text-[#8B8275]">
                  <span>
                    {r.category}
                    {!r.is_active ? ' · Hidden' : ''}
                  </span>
                  <span className="font-['DM_Sans',sans-serif]">
                    {r.price_credits.toLocaleString()} Cr
                  </span>
                </div>
                <p className="mt-1 font-medium text-sm text-[#3D3830]">{r.name}</p>
                {r.model_id && (
                  <p className="mt-1 text-[10px] font-['DM_Sans',sans-serif] text-[#8B7355] truncate">
                    Model: {r.model_id}
                  </p>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="lg:col-span-8 space-y-5">
          {showNewReportForm && (
            <form
              onSubmit={handleCreateReport}
              className="rounded-3xl bg-[#F1ECE3] border border-[#3D3830]/15 p-6 space-y-4"
            >
              <h3 className="font-serif text-2xl font-medium text-[#3D3830]">
                Create New Research Dossier
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#5C5449] mb-1">
                    Report Title
                  </label>
                  <input
                    type="text"
                    required
                    value={newReportName}
                    onChange={(e) => setNewReportName(e.target.value)}
                    placeholder="e.g., Saturn Sade Sati Navigation Report"
                    className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3 py-2 text-xs text-[#3D3830]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#5C5449] mb-1">
                    URL Slug (auto-generated if blank)
                  </label>
                  <input
                    type="text"
                    value={newReportSlug}
                    onChange={(e) => setNewReportSlug(e.target.value)}
                    placeholder="sade-sati-navigation"
                    className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3 py-2 text-xs font-['DM_Sans',sans-serif] text-[#3D3830]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#5C5449] mb-1">
                    Category
                  </label>
                  <CustomSelect
                    value={newReportCategory}
                    onChange={setNewReportCategory}
                    ariaLabel="New report category"
                    size="sm"
                    surface="canvas"
                    className="w-full"
                    options={REPORT_CATEGORY_OPTIONS}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#5C5449] mb-1">
                    Price (Credits)
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={newReportPrice}
                    onChange={(e) => setNewReportPrice(Number(e.target.value))}
                    className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3 py-2 text-xs font-['DM_Sans',sans-serif] text-[#3D3830]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#5C5449] mb-1">
                    Sort Order
                  </label>
                  <input
                    type="number"
                    value={newReportSortOrder}
                    onChange={(e) => setNewReportSortOrder(Number(e.target.value))}
                    className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3 py-2 text-xs font-['DM_Sans',sans-serif] text-[#3D3830]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#5C5449] mb-1">
                  OpenRouter Model Override (optional)
                </label>
                <OpenRouterModelField
                  value={newReportModelId}
                  onChange={setNewReportModelId}
                  surface="canvas"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#5C5449] mb-1">
                  Card Short Description
                </label>
                <input
                  type="text"
                  required
                  value={newReportShortDesc}
                  onChange={(e) => setNewReportShortDesc(e.target.value)}
                  placeholder="Crisp 1-2 sentence summary shown on the Reports Store card..."
                  className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3 py-2 text-xs text-[#3D3830]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#5C5449] mb-1">
                  Detailed Overview (Rich Text / Markdown)
                </label>
                <RichMarkdownEditor
                  value={newReportLongDesc}
                  onChange={setNewReportLongDesc}
                  rows={4}
                />
              </div>

              {errorMsg && <p className="text-xs text-[#7A3E36]">{errorMsg}</p>}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewReportForm(false)}
                  className="px-4 py-2 text-xs text-[#8B8275] hover:text-[#3D3830]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#4A453D] px-5 py-2 text-xs font-medium text-[#FAF7F2] hover:bg-[#38342E]"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>{isSaving ? 'Creating...' : 'Create Report'}</span>
                </button>
              </div>
            </form>
          )}

          {!showNewReportForm && activeReport && (
            <div className="rounded-3xl bg-[#FDFBF7] border border-[#3D3830]/12 p-6 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#3D3830]/10 pb-4">
                <div>
                  <span className="text-[11px] font-['DM_Sans',sans-serif] text-[#8B8275]">
                    {activeReport.slug}
                  </span>
                </div>
                <label className="inline-flex items-center gap-2 text-xs text-[#5C5449]">
                  <input
                    type="checkbox"
                    checked={activeReport.is_active}
                    onChange={(e) =>
                      setReportDraft({ ...activeReport, is_active: e.target.checked })
                    }
                    className="rounded border-[#3D3830]/30"
                  />
                  <span>Visible in Store</span>
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                <div className="md:col-span-6">
                  <label className="block text-xs font-medium text-[#5C5449] mb-1">
                    Report Title
                  </label>
                  <input
                    type="text"
                    value={activeReport.name}
                    onChange={(e) =>
                      setReportDraft({ ...activeReport, name: e.target.value })
                    }
                    className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3 py-2 text-xs text-[#3D3830]"
                  />
                </div>
                <div className="md:col-span-3">
                  <label className="block text-xs font-medium text-[#5C5449] mb-1">
                    Category
                  </label>
                  <CustomSelect
                    value={activeReport.category}
                    onChange={(val) => setReportDraft({ ...activeReport, category: val })}
                    ariaLabel="Report category"
                    size="sm"
                    surface="canvas"
                    className="w-full"
                    options={
                      REPORT_CATEGORY_OPTIONS.some((c) => c.value === activeReport.category)
                        ? REPORT_CATEGORY_OPTIONS
                        : [
                            { value: activeReport.category, label: activeReport.category },
                            ...REPORT_CATEGORY_OPTIONS,
                          ]
                    }
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-[#5C5449] mb-1">
                    Price (Cr)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={activeReport.price_credits}
                    onChange={(e) =>
                      setReportDraft({
                        ...activeReport,
                        price_credits: Number(e.target.value),
                      })
                    }
                    className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3 py-2 text-xs font-['DM_Sans',sans-serif] text-[#3D3830]"
                  />
                </div>
                <div className="md:col-span-1">
                  <label className="block text-xs font-medium text-[#5C5449] mb-1">
                    Order
                  </label>
                  <input
                    type="number"
                    value={activeReport.sort_order ?? 1}
                    onChange={(e) =>
                      setReportDraft({
                        ...activeReport,
                        sort_order: Number(e.target.value),
                      })
                    }
                    className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-2.5 py-2 text-xs font-['DM_Sans',sans-serif] text-[#3D3830]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#5C5449] mb-1">
                    Card Short Description
                  </label>
                  <input
                    type="text"
                    value={activeReport.short_description}
                    onChange={(e) =>
                      setReportDraft({ ...activeReport, short_description: e.target.value })
                    }
                    className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3 py-2 text-xs text-[#3D3830]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#5C5449] mb-1">
                    OpenRouter Model Override
                  </label>
                  <OpenRouterModelField
                    value={activeReport.model_id || ''}
                    onChange={(nextModel) =>
                      setReportDraft({ ...activeReport, model_id: nextModel || null })
                    }
                    surface="canvas"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#5C5449] mb-1.5">
                  Long Description & Sales Detail (Rich Text / Markdown)
                </label>
                <RichMarkdownEditor
                  value={activeReport.long_description || ''}
                  onChange={(nextMarkdown) =>
                    setReportDraft({ ...activeReport, long_description: nextMarkdown })
                  }
                  rows={5}
                />
              </div>

              <div className="space-y-3 pt-2 border-t border-[#3D3830]/10">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium text-[#3D3830]">
                    Sequential Multi-Pass Prompt Chain ({activeReport.prompt_chain_json.length} Steps)
                  </p>
                  <button
                    type="button"
                    onClick={() => addReportStep(activeReport)}
                    className="inline-flex items-center gap-1 rounded-full border border-[#3D3830]/20 bg-[#FAF7F2] px-3 py-1 text-[11px] font-medium text-[#3D3830] hover:bg-[#F1ECE3]"
                  >
                    <Plus className="h-3 w-3" />
                    <span>Add Pass</span>
                  </button>
                </div>

                {activeReport.prompt_chain_json.map((step, sIdx) => (
                  <div
                    key={sIdx}
                    className="rounded-2xl bg-[#FAF7F2] border border-[#3D3830]/10 p-4 space-y-2.5"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-['DM_Sans',sans-serif] text-[#8B8275] shrink-0">
                        #{sIdx + 1}
                      </span>
                      <input
                        type="text"
                        value={step.title}
                        onChange={(e) =>
                          updateReportStep(sIdx, { title: e.target.value }, activeReport)
                        }
                        className="flex-1 rounded-xl border border-[#3D3830]/12 bg-[#FDFBF7] px-3 py-1.5 text-xs font-medium text-[#3D3830]"
                      />
                      <button
                        type="button"
                        disabled={sIdx === 0}
                        onClick={() => moveReportStep(sIdx, -1, activeReport)}
                        aria-label="Move pass up"
                        className="p-1.5 rounded-lg text-[#8B8275] hover:text-[#3D3830] disabled:opacity-30"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={sIdx === activeReport.prompt_chain_json.length - 1}
                        onClick={() => moveReportStep(sIdx, 1, activeReport)}
                        aria-label="Move pass down"
                        className="p-1.5 rounded-lg text-[#8B8275] hover:text-[#3D3830] disabled:opacity-30"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={activeReport.prompt_chain_json.length <= 1}
                        onClick={() => removeReportStep(sIdx, activeReport)}
                        aria-label="Delete pass"
                        className="p-1.5 rounded-lg text-[#8B8275] hover:text-[#7A3E36] disabled:opacity-30"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <textarea
                      rows={3}
                      value={step.instruction}
                      onChange={(e) =>
                        updateReportStep(sIdx, { instruction: e.target.value }, activeReport)
                      }
                      className="w-full rounded-xl border border-[#3D3830]/12 bg-[#FDFBF7] p-3 text-xs text-[#5C5449]"
                    />
                  </div>
                ))}
              </div>

              {feedback && (
                <p className="text-xs text-[#2D6A4F] flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5" /> {feedback}
                </p>
              )}
              {errorMsg && <p className="text-xs text-[#7A3E36]">{errorMsg}</p>}

              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => void handleSaveReportCatalog()}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#4A453D] px-5 py-2.5 text-xs font-medium text-[#FAF7F2] hover:bg-[#38342E]"
                >
                  <Save className="h-3.5 w-3.5" />
                  <span>{isSaving ? 'Saving...' : 'Save Report Catalog'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left Prompt Library List */}
      <div className="lg:col-span-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <CustomSelect
            value={categoryFilter}
            onChange={setCategoryFilter}
            ariaLabel="Filter system prompts by category"
            size="sm"
            surface="elevated"
            className="flex-1"
            options={[
              { value: 'all', label: `All Categories (${prompts.length})` },
              { value: 'expert', label: 'Experts' },
              { value: 'mode', label: 'Modes' },
              { value: 'output', label: 'Outputs' },
              { value: 'language', label: 'Languages' },
              { value: 'tool', label: 'Quick Tools' },
              { value: 'learn', label: 'Learn Astrology' },
              { value: 'report_step', label: 'Report Steps' },
            ]}
          />

          <button
            type="button"
            onClick={() => setShowNewPromptForm((v) => !v)}
            className="inline-flex items-center gap-1 rounded-full bg-[#4A453D] px-3.5 py-2 text-xs font-medium text-[#FAF7F2] hover:bg-[#38342E]"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add</span>
          </button>
        </div>

        <div className="space-y-1.5 max-h-[620px] overflow-y-auto pr-1">
          {filteredPrompts.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => selectPrompt(p)}
              className={`w-full rounded-2xl border px-3.5 py-2.5 text-left transition-colors ${
                activePrompt?.id === p.id
                  ? 'bg-[#F1ECE3] border-[#3D3830]/25'
                  : 'bg-[#FDFBF7] border-[#3D3830]/10 hover:bg-[#F1ECE3]/50'
              }`}
            >
              <div className="flex items-center justify-between text-[10px] text-[#8B8275] font-['DM_Sans',sans-serif]">
                <span className="uppercase">
                  {p.category}
                  {!p.is_active ? ' · INACTIVE' : ''}
                </span>
                <span>v{p.version}</span>
              </div>
              <p className="mt-0.5 text-xs font-medium text-[#3D3830] truncate">
                {p.display_name}
              </p>
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] text-[#8B8275] font-['DM_Sans',sans-serif] truncate">
                  {p.slug}
                </p>
                {p.model_id && (
                  <span className="text-[10px] font-['DM_Sans',sans-serif] text-[#8B7355] truncate max-w-[130px]">
                    {p.model_id.split('/')[1] || p.model_id}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Right Editor + Rollback History + Live OpenRouter Sandbox */}
      <div className="lg:col-span-8 space-y-5">
        {showNewPromptForm && (
          <form
            onSubmit={handleCreatePrompt}
            className="rounded-3xl bg-[#F1ECE3] border border-[#3D3830]/15 p-5 space-y-3"
          >
            <h3 className="font-serif text-xl font-medium text-[#3D3830]">
              Create New Modular System Prompt
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="text"
                required
                value={newSlug}
                onChange={(e) => setNewSlug(e.target.value)}
                placeholder="slug_identifier"
                className="rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3 py-2 text-xs font-['DM_Sans',sans-serif]"
              />
              <CustomSelect
                value={newCategory}
                onChange={(val) => setNewCategory(val as SystemPromptRow['category'])}
                ariaLabel="Prompt module category"
                size="sm"
                surface="canvas"
                className="w-full"
                options={[
                  { value: 'expert', label: 'Expert' },
                  { value: 'mode', label: 'Mode' },
                  { value: 'output', label: 'Output' },
                  { value: 'language', label: 'Language' },
                  { value: 'tool', label: 'Tool' },
                  { value: 'learn', label: 'Learn' },
                  { value: 'report_step', label: 'Report Step' },
                ]}
              />
              <input
                type="text"
                required
                value={newDisplayName}
                onChange={(e) => setNewDisplayName(e.target.value)}
                placeholder="Display Name"
                className="rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3 py-2 text-xs"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                value={newSubtitle}
                onChange={(e) => setNewSubtitle(e.target.value)}
                placeholder="User-facing subtitle / hint (optional)"
                className="rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3 py-2 text-xs"
              />
              <OpenRouterModelField
                value={newModelId}
                onChange={setNewModelId}
                surface="canvas"
              />
            </div>

            <textarea
              rows={4}
              required
              value={newPromptBody}
              onChange={(e) => setNewPromptBody(e.target.value)}
              placeholder="System prompt body instructions..."
              className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] p-3 text-xs"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowNewPromptForm(false)}
                className="text-xs text-[#8B8275] px-3 py-1.5"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="rounded-full bg-[#4A453D] px-4 py-1.5 text-xs font-medium text-[#FAF7F2]"
              >
                Save New Module
              </button>
            </div>
          </form>
        )}

        {activePrompt && (
          <>
            <div className="rounded-3xl bg-[#FDFBF7] border border-[#3D3830]/12 p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex-1 min-w-[220px]">
                  <span className="text-[11px] font-['DM_Sans',sans-serif] text-[#8B8275]">
                    {activePrompt.slug} · Version {activePrompt.version}
                  </span>
                  <input
                    type="text"
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    className="mt-1 block w-full font-serif text-2xl font-medium text-[#3D3830] bg-transparent border-b border-transparent focus:border-[#3D3830]/25 focus:outline-none"
                  />
                </div>

                <label className="inline-flex items-center gap-2 text-xs text-[#5C5449]">
                  <input
                    type="checkbox"
                    checked={draftActive}
                    onChange={(e) => setDraftActive(e.target.checked)}
                    className="rounded border-[#3D3830]/30"
                  />
                  <span>Active in Studio</span>
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-medium text-[#5C5449] mb-1">
                    User-Facing Subtitle / Picker Hint
                  </label>
                  <input
                    type="text"
                    value={draftSubtitle}
                    onChange={(e) => setDraftSubtitle(e.target.value)}
                    placeholder="Concise guidance shown to users in menus..."
                    className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3 py-2 text-xs text-[#3D3830] focus:outline-none focus:border-[#3D3830]/40"
                  />
                </div>

                <div>
                  <label className="flex items-center gap-1.5 text-[11px] font-medium text-[#5C5449] mb-1">
                    <Cpu className="h-3 w-3 text-[#8B7355]" />
                    <span>OpenRouter Model Override</span>
                  </label>
                  <OpenRouterModelField
                    value={draftModelId}
                    onChange={setDraftModelId}
                    surface="canvas"
                  />
                </div>
              </div>

              <textarea
                rows={10}
                value={draftBody}
                onChange={(e) => setDraftBody(e.target.value)}
                className="w-full rounded-2xl border border-[#3D3830]/15 bg-[#FAF7F2] p-4 text-xs font-['DM_Sans',sans-serif] leading-relaxed text-[#3D3830] focus:outline-none focus:border-[#3D3830]/40"
              />

              {feedback && (
                <p className="text-xs text-[#2D6A4F] flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5" /> {feedback}
                </p>
              )}
              {errorMsg && <p className="text-xs text-[#7A3E36]">{errorMsg}</p>}

              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => void handleSavePrompt()}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#4A453D] px-5 py-2.5 text-xs font-medium text-[#FAF7F2] hover:bg-[#38342E]"
                >
                  <Save className="h-3.5 w-3.5" />
                  <span>{isSaving ? 'Saving...' : 'Save & Archive Version'}</span>
                </button>
              </div>
            </div>

            {/* Live Prompt Test Sandbox */}
            <div className="rounded-3xl bg-[#1F2229] text-[#F4EFE6] p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#B8965A]">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  <span>Live OpenRouter Prompt Sandbox</span>
                </div>
                <span className="font-['DM_Sans',sans-serif] text-[11px] text-[#F4EFE6]/65">
                  Model: {sandboxModelUsed || draftModelId.trim() || 'Platform Default'}
                </span>
              </div>
              <textarea
                rows={2}
                value={testQuestion}
                onChange={(e) => setTestQuestion(e.target.value)}
                className="w-full rounded-2xl border border-[#F4EFE6]/15 bg-[#292D36] p-3 text-xs text-[#F4EFE6] focus:outline-none"
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={isTesting}
                  onClick={() => void handleRunSandbox()}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#F4EFE6] px-4 py-2 text-xs font-medium text-[#1F2229] hover:bg-[#EAE3D7]"
                >
                  <Play className="h-3 w-3" />
                  <span>{isTesting ? 'Running...' : 'Test Prompt Live'}</span>
                </button>
              </div>
              {sandboxOutput && (
                <div className="rounded-2xl bg-[#292D36] border border-[#F4EFE6]/10 p-4 text-xs text-[#F4EFE6]/85 whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">
                  {sandboxOutput}
                </div>
              )}
            </div>

            {/* Version Rollback History */}
            {Array.isArray(activePrompt.previous_versions) &&
              activePrompt.previous_versions.length > 0 && (
                <div className="rounded-3xl bg-[#F1ECE3] border border-[#3D3830]/10 p-5 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-medium text-[#3D3830]">
                    <History className="h-3.5 w-3.5 text-[#8B8275]" />
                    <span>Archived Versions (One-Click Rollback)</span>
                  </div>
                  <div className="space-y-2">
                    {activePrompt.previous_versions.map((v) => (
                      <div
                        key={v.version}
                        className="flex items-center justify-between gap-3 rounded-2xl bg-[#FDFBF7] px-4 py-2.5 text-xs"
                      >
                        <div className="min-w-0 flex-1">
                          <span className="font-['DM_Sans',sans-serif] font-medium text-[#3D3830] mr-2">
                            v{v.version}
                          </span>
                          <span className="text-[#8B8275] truncate">
                            {v.prompt_body.slice(0, 90)}...
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleRollback(v.version)}
                          className="inline-flex items-center gap-1 rounded-full border border-[#3D3830]/20 px-3 py-1 text-[11px] font-medium text-[#3D3830] hover:bg-[#F1ECE3] shrink-0"
                        >
                          <RotateCcw className="h-3 w-3" />
                          <span>Restore</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
          </>
        )}
      </div>
    </div>
  );
};

export default PromptChainEditor;
