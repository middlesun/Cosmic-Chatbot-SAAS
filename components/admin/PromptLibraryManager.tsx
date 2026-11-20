import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  Copy,
  Eye,
  FlaskConical,
  History,
  Layers,
  Play,
  Plus,
  RotateCcw,
  Save,
  Search,
  Trash2,
} from 'lucide-react';
import CustomSelect from '../app/CustomSelect';

export interface SystemPromptRecord {
  id: string;
  slug: string;
  category:
    | 'system'
    | 'expert'
    | 'analysis'
    | 'modifier'
    | 'mode'
    | 'output'
    | 'language'
    | 'tool'
    | 'report_step'
    | 'learn';
  display_name: string;
  subtitle?: string | null;
  description?: string | null;
  prompt_body: string;
  model_id?: string | null;
  tags?: string[] | null;
  sort_order?: number | null;
  version: number;
  previous_versions: Array<{
    version: number;
    prompt_body: string;
    archived_at: string;
  }>;
  is_active: boolean;
  updated_at: string;
}

export interface PromptRecipeStep {
  prompt_slug: string;
  label?: string;
  inline_override?: string;
  enabled: boolean;
}

export interface PromptRecipeRecord {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  target_type: 'mode' | 'report_pass' | 'custom';
  target_slug: string | null;
  steps_json: PromptRecipeStep[];
  model_id: string | null;
  is_active: boolean;
  updated_at?: string;
}

export interface ModelChoiceOption {
  value: string;
  label: string;
  description?: string;
}

interface PromptLibraryManagerProps {
  prompts: SystemPromptRecord[];
  modelOptions: ModelChoiceOption[];
  getAccessToken: () => Promise<string | null>;
  onPromptSaved: (prompt: SystemPromptRecord, isNew?: boolean) => void;
  onPromptDeleted: (promptId: string) => void;
}

const PROMPT_CATEGORIES: Array<{ value: SystemPromptRecord['category']; label: string }> = [
  { value: 'system', label: 'System' },
  { value: 'expert', label: 'Expert' },
  { value: 'analysis', label: 'Analysis' },
  { value: 'modifier', label: 'Modifier' },
  { value: 'mode', label: 'Mode' },
  { value: 'output', label: 'Output' },
  { value: 'language', label: 'Language' },
  { value: 'tool', label: 'Tool' },
  { value: 'report_step', label: 'Report Step' },
  { value: 'learn', label: 'Learn' },
];

const PromptLibraryManager: React.FC<PromptLibraryManagerProps> = ({
  prompts,
  modelOptions,
  getAccessToken,
  onPromptSaved,
  onPromptDeleted,
}) => {
  const [subView, setSubView] = useState<'prompts' | 'recipes' | 'sandbox'>('prompts');

  // Prompt Library state
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [activeOnly, setActiveOnly] = useState(false);
  const [selectedPromptId, setSelectedPromptId] = useState<string | null>(prompts[0]?.id || null);
  const [isCreatingPrompt, setIsCreatingPrompt] = useState(false);

  const [draftSlug, setDraftSlug] = useState('');
  const [draftCategory, setDraftCategory] = useState<SystemPromptRecord['category']>('analysis');
  const [draftName, setDraftName] = useState('');
  const [draftSubtitle, setDraftSubtitle] = useState('');
  const [draftDescription, setDraftDescription] = useState('');
  const [draftTags, setDraftTags] = useState('');
  const [draftSortOrder, setDraftSortOrder] = useState<number>(100);
  const [draftModelId, setDraftModelId] = useState('');
  const [draftActive, setDraftActive] = useState(true);
  const [draftBody, setDraftBody] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [confirmDeletePrompt, setConfirmDeletePrompt] = useState(false);
  const [savingPrompt, setSavingPrompt] = useState(false);

  // Recipes state
  const [recipes, setRecipes] = useState<PromptRecipeRecord[]>([]);
  const [recipesTableMissing, setRecipesTableMissing] = useState(false);
  const [loadingRecipes, setLoadingRecipes] = useState(false);
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);
  const [isCreatingRecipe, setIsCreatingRecipe] = useState(false);

  const [recipeName, setRecipeName] = useState('');
  const [recipeSlug, setRecipeSlug] = useState('');
  const [recipeDescription, setRecipeDescription] = useState('');
  const [recipeTargetType, setRecipeTargetType] = useState<'mode' | 'report_pass' | 'custom'>('mode');
  const [recipeTargetSlug, setRecipeTargetSlug] = useState('');
  const [recipeModelId, setRecipeModelId] = useState('');
  const [recipeActive, setRecipeActive] = useState(true);
  const [recipeSteps, setRecipeSteps] = useState<PromptRecipeStep[]>([]);
  const [addBlockSlug, setAddBlockSlug] = useState('');
  const [showAssembledPreview, setShowAssembledPreview] = useState(false);
  const [savingRecipe, setSavingRecipe] = useState(false);
  const [confirmDeleteRecipe, setConfirmDeleteRecipe] = useState(false);

  // Sandbox state
  const [sandboxSource, setSandboxSource] = useState<'current_prompt' | 'current_recipe'>('current_prompt');
  const [sandboxQuestion, setSandboxQuestion] = useState(
    'What career shifts should I prepare for in the next 12 months based on my Dasha and transits?'
  );
  const [sandboxChartContext, setSandboxChartContext] = useState('');
  const [sandboxModel, setSandboxModel] = useState('');
  const [sandboxRunning, setSandboxRunning] = useState(false);
  const [sandboxResult, setSandboxResult] = useState<{
    output: string;
    tokensIn: number;
    tokensOut: number;
    modelUsed: string;
  } | null>(null);

  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadRecipes = async () => {
    setLoadingRecipes(true);
    try {
      const token = await getAccessToken();
      const res = await fetch('/api/admin/recipes', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setRecipesTableMissing(Boolean(data.tableMissing));
        const list = (data.recipes || []) as PromptRecipeRecord[];
        setRecipes(list);
        if (list.length > 0 && !selectedRecipeId && !isCreatingRecipe) {
          setSelectedRecipeId(list[0].id);
        }
      }
    } catch {
      // non-fatal
    } finally {
      setLoadingRecipes(false);
    }
  };

  useEffect(() => {
    void loadRecipes();
  }, []);

  const promptBySlug = useMemo(() => {
    const map = new Map<string, SystemPromptRecord>();
    for (const p of prompts) map.set(p.slug, p);
    return map;
  }, [prompts]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: prompts.length };
    for (const p of prompts) {
      counts[p.category] = (counts[p.category] || 0) + 1;
    }
    return counts;
  }, [prompts]);

  const filteredPrompts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return prompts
      .filter((p) => {
        if (categoryFilter !== 'all' && p.category !== categoryFilter) return false;
        if (activeOnly && !p.is_active) return false;
        if (!q) return true;
        const tagsStr = (p.tags || []).join(' ').toLowerCase();
        return (
          p.display_name.toLowerCase().includes(q) ||
          p.slug.toLowerCase().includes(q) ||
          (p.subtitle || '').toLowerCase().includes(q) ||
          tagsStr.includes(q) ||
          p.prompt_body.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => (a.sort_order ?? 100) - (b.sort_order ?? 100) || a.display_name.localeCompare(b.display_name));
  }, [prompts, searchQuery, categoryFilter, activeOnly]);

  const selectedPrompt = useMemo(
    () => prompts.find((p) => p.id === selectedPromptId) || null,
    [prompts, selectedPromptId]
  );

  useEffect(() => {
    if (isCreatingPrompt) return;
    if (!selectedPrompt && prompts.length > 0) {
      setSelectedPromptId(prompts[0].id);
      return;
    }
    if (selectedPrompt) {
      setDraftSlug(selectedPrompt.slug);
      setDraftCategory(selectedPrompt.category);
      setDraftName(selectedPrompt.display_name);
      setDraftSubtitle(selectedPrompt.subtitle || '');
      setDraftDescription(selectedPrompt.description || '');
      setDraftTags((selectedPrompt.tags || []).join(', '));
      setDraftSortOrder(selectedPrompt.sort_order ?? 100);
      setDraftModelId(selectedPrompt.model_id || '');
      setDraftActive(selectedPrompt.is_active);
      setDraftBody(selectedPrompt.prompt_body);
      setShowHistory(false);
      setConfirmDeletePrompt(false);
    }
  }, [selectedPrompt?.id, isCreatingPrompt, prompts.length]);

  const selectedRecipe = useMemo(
    () => recipes.find((r) => r.id === selectedRecipeId) || null,
    [recipes, selectedRecipeId]
  );

  useEffect(() => {
    if (isCreatingRecipe) return;
    if (selectedRecipe) {
      setRecipeName(selectedRecipe.name);
      setRecipeSlug(selectedRecipe.slug);
      setRecipeDescription(selectedRecipe.description || '');
      setRecipeTargetType(selectedRecipe.target_type);
      setRecipeTargetSlug(selectedRecipe.target_slug || '');
      setRecipeModelId(selectedRecipe.model_id || '');
      setRecipeActive(selectedRecipe.is_active);
      setRecipeSteps(Array.isArray(selectedRecipe.steps_json) ? selectedRecipe.steps_json : []);
      setConfirmDeleteRecipe(false);
    }
  }, [selectedRecipe?.id, isCreatingRecipe]);

  const startNewPrompt = () => {
    setIsCreatingPrompt(true);
    setSelectedPromptId(null);
    setDraftSlug('');
    setDraftCategory(categoryFilter !== 'all' ? (categoryFilter as SystemPromptRecord['category']) : 'analysis');
    setDraftName('');
    setDraftSubtitle('');
    setDraftDescription('');
    setDraftTags('');
    setDraftSortOrder(100);
    setDraftModelId('');
    setDraftActive(true);
    setDraftBody('');
    setConfirmDeletePrompt(false);
    setFeedback(null);
    setError(null);
  };

  const handleCloneCurrentPrompt = () => {
    if (!selectedPrompt) return;
    setIsCreatingPrompt(true);
    setSelectedPromptId(null);
    setDraftSlug(`${selectedPrompt.slug}_copy`);
    setDraftCategory(selectedPrompt.category);
    setDraftName(`${selectedPrompt.display_name} (Copy)`);
    setDraftSubtitle(selectedPrompt.subtitle || '');
    setDraftDescription(selectedPrompt.description || '');
    setDraftTags((selectedPrompt.tags || []).join(', '));
    setDraftSortOrder((selectedPrompt.sort_order ?? 100) + 1);
    setDraftModelId(selectedPrompt.model_id || '');
    setDraftActive(true);
    setDraftBody(selectedPrompt.prompt_body);
    setFeedback('Cloned into new draft — customize the slug and click Create Prompt.');
  };

  const handleSavePrompt = async () => {
    setSavingPrompt(true);
    setError(null);
    setFeedback(null);
    const parsedTags = draftTags
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);

    try {
      const token = await getAccessToken();
      if (isCreatingPrompt) {
        const res = await fetch('/api/admin/prompts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            slug: draftSlug || draftName,
            category: draftCategory,
            display_name: draftName,
            subtitle: draftSubtitle,
            description: draftDescription,
            tags: parsedTags,
            sort_order: draftSortOrder,
            model_id: draftModelId || null,
            prompt_body: draftBody,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Could not create prompt');
        onPromptSaved(data.prompt, true);
        setIsCreatingPrompt(false);
        setSelectedPromptId(data.prompt.id);
        setFeedback(`Prompt "${data.prompt.display_name}" created and live.`);
      } else if (selectedPrompt) {
        const res = await fetch(`/api/admin/prompts/${selectedPrompt.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            category: draftCategory,
            display_name: draftName,
            subtitle: draftSubtitle,
            description: draftDescription,
            tags: parsedTags,
            sort_order: draftSortOrder,
            model_id: draftModelId || null,
            is_active: draftActive,
            prompt_body: draftBody,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Could not update prompt');
        onPromptSaved(data.prompt, false);
        setFeedback(`Saved "${data.prompt.display_name}" (v${data.prompt.version}).`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSavingPrompt(false);
    }
  };

  const handleRollback = async (version: number) => {
    if (!selectedPrompt) return;
    setSavingPrompt(true);
    setError(null);
    try {
      const token = await getAccessToken();
      const res = await fetch(`/api/admin/prompts/${selectedPrompt.id}/rollback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ version }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Rollback failed');
      onPromptSaved(data.prompt, false);
      setDraftBody(data.prompt.prompt_body);
      setFeedback(`Rolled back to archived v${version} (now v${data.prompt.version}).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rollback failed');
    } finally {
      setSavingPrompt(false);
    }
  };

  const handleDeletePrompt = async () => {
    if (!selectedPrompt) return;
    setSavingPrompt(true);
    setError(null);
    try {
      const token = await getAccessToken();
      const res = await fetch(`/api/admin/prompts/${selectedPrompt.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Delete failed');
      const deletedId = selectedPrompt.id;
      onPromptDeleted(deletedId);
      setConfirmDeletePrompt(false);
      setSelectedPromptId(prompts.find((p) => p.id !== deletedId)?.id || null);
      setFeedback('Prompt deleted from library.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setSavingPrompt(false);
    }
  };

  // Recipe Handlers
  const startNewRecipe = () => {
    setIsCreatingRecipe(true);
    setSelectedRecipeId(null);
    setRecipeName('');
    setRecipeSlug('');
    setRecipeDescription('');
    setRecipeTargetType('mode');
    setRecipeTargetSlug('career');
    setRecipeModelId('');
    setRecipeActive(true);
    setRecipeSteps([]);
    setConfirmDeleteRecipe(false);
    setFeedback(null);
    setError(null);
  };

  const handleAddRecipeBlock = () => {
    if (!addBlockSlug) return;
    const match = promptBySlug.get(addBlockSlug);
    setRecipeSteps((prev) => [
      ...prev,
      {
        prompt_slug: addBlockSlug,
        label: match?.display_name || addBlockSlug,
        enabled: true,
      },
    ]);
    setAddBlockSlug('');
  };

  const moveRecipeStep = (idx: number, dir: -1 | 1) => {
    setRecipeSteps((prev) => {
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };

  const handleSaveRecipe = async () => {
    setSavingRecipe(true);
    setError(null);
    setFeedback(null);
    try {
      const token = await getAccessToken();
      const payload = {
        name: recipeName,
        slug: recipeSlug || recipeName,
        description: recipeDescription,
        target_type: recipeTargetType,
        target_slug: recipeTargetSlug || null,
        model_id: recipeModelId || null,
        is_active: recipeActive,
        steps_json: recipeSteps,
      };
      const url = isCreatingRecipe ? '/api/admin/recipes' : `/api/admin/recipes/${selectedRecipe?.id}`;
      const method = isCreatingRecipe ? 'POST' : 'PATCH';
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save recipe');
      if (isCreatingRecipe) {
        setRecipes((prev) => [data.recipe, ...prev]);
        setIsCreatingRecipe(false);
        setSelectedRecipeId(data.recipe.id);
        setFeedback(`Recipe "${data.recipe.name}" created.`);
      } else {
        setRecipes((prev) => prev.map((r) => (r.id === data.recipe.id ? data.recipe : r)));
        setFeedback(`Recipe "${data.recipe.name}" updated.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Recipe save failed');
    } finally {
      setSavingRecipe(false);
    }
  };

  const handleDeleteRecipe = async () => {
    if (!selectedRecipe) return;
    setSavingRecipe(true);
    setError(null);
    try {
      const token = await getAccessToken();
      const res = await fetch(`/api/admin/recipes/${selectedRecipe.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Delete recipe failed');
      const remaining = recipes.filter((r) => r.id !== selectedRecipe.id);
      setRecipes(remaining);
      setSelectedRecipeId(remaining[0]?.id || null);
      setConfirmDeleteRecipe(false);
      setFeedback('Recipe removed.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setSavingRecipe(false);
    }
  };

  const assembledRecipePreview = useMemo(() => {
    return recipeSteps
      .filter((s) => s.enabled !== false)
      .map((s, idx) => {
        const p = promptBySlug.get(s.prompt_slug);
        const body = s.inline_override?.trim() || p?.prompt_body || `[Missing prompt: ${s.prompt_slug}]`;
        return `### Step ${idx + 1}: ${s.label || p?.display_name || s.prompt_slug} (${s.prompt_slug})\n${body}`;
      })
      .join('\n\n---\n\n');
  }, [recipeSteps, promptBySlug]);

  const handleRunSandbox = async () => {
    const promptBody =
      sandboxSource === 'current_recipe' ? assembledRecipePreview : draftBody;
    if (!promptBody.trim() || !sandboxQuestion.trim()) {
      setError('Select a prompt or recipe with content and enter a test question.');
      return;
    }
    setSandboxRunning(true);
    setError(null);
    setSandboxResult(null);
    try {
      const token = await getAccessToken();
      const res = await fetch('/api/admin/prompts/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          promptBody,
          testQuestion: sandboxQuestion,
          chartContext: sandboxChartContext,
          modelId: sandboxModel || draftModelId || recipeModelId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Sandbox execution failed');
      setSandboxResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sandbox failed');
    } finally {
      setSandboxRunning(false);
    }
  };

  const modeChoices = useMemo(() => {
    const modes = prompts.filter((p) => p.category === 'mode' || p.category === 'learn');
    return [
      { value: '', label: 'Select target mode...' },
      ...modes.map((m) => ({ value: m.slug, label: `${m.display_name} (${m.slug})` })),
    ];
  }, [prompts]);

  const blockPickerOptions = useMemo(() => {
    return [
      { value: '', label: 'Choose a prompt block to append...' },
      ...prompts.map((p) => ({
        value: p.slug,
        label: `[${p.category}] ${p.display_name}`,
        description: p.slug,
      })),
    ];
  }, [prompts]);

  const approxTokens = Math.ceil((draftBody || '').length / 4);

  return (
    <div className="space-y-5">
      {/* Header + Sub-tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-serif text-2xl font-medium text-[#3D3830]">Prompt Library</h2>
          <p className="mt-1 text-xs text-[#5C5449]">
            Manage hundreds of modular system, expert, analysis, modifier, and output prompts — and stack them into Composable Recipes.
          </p>
        </div>

        <div className="inline-flex rounded-full bg-[#EAE3D7]/80 border border-[#3D3830]/12 p-1">
          {[
            { id: 'prompts' as const, label: `Prompts (${prompts.length})` },
            { id: 'recipes' as const, label: `Composable Recipes (${recipes.length})` },
            { id: 'sandbox' as const, label: 'Sandbox' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setSubView(tab.id);
                setError(null);
                setFeedback(null);
              }}
              className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                subView === tab.id
                  ? 'bg-[#4A453D] text-[#FAF7F2]'
                  : 'text-[#5C5449] hover:text-[#3D3830]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
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

      {/* VIEW 1: PROMPTS LIBRARY (100s-scale searchable master-detail) */}
      {subView === 'prompts' && (
        <div className="space-y-4">
          {/* Category Filter Bar */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setCategoryFilter('all')}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                categoryFilter === 'all'
                  ? 'bg-[#3D3830] text-[#FAF7F2]'
                  : 'bg-[#FDFBF7] border border-[#3D3830]/12 text-[#5C5449] hover:bg-[#EAE3D7]/60'
              }`}
            >
              All ({categoryCounts.all || 0})
            </button>
            {PROMPT_CATEGORIES.map((cat) => (
              <button
                key={cat.value}
                type="button"
                onClick={() => setCategoryFilter(cat.value)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                  categoryFilter === cat.value
                    ? 'bg-[#3D3830] text-[#FAF7F2]'
                    : 'bg-[#FDFBF7] border border-[#3D3830]/12 text-[#5C5449] hover:bg-[#EAE3D7]/60'
                }`}
              >
                {cat.label} ({categoryCounts[cat.value] || 0})
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[330px_1fr] gap-5 items-start">
            {/* Left Compact Master List */}
            <div className="rounded-3xl bg-[#FDFBF7] border border-[#3D3830]/12 overflow-hidden flex flex-col max-h-[720px]">
              <div className="p-3 border-b border-[#3D3830]/10 space-y-2.5">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="h-3.5 w-3.5 text-[#8B8275] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search name, slug, tags..."
                      className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] pl-8 pr-3 py-2 text-xs text-[#3D3830] focus:outline-none focus:border-[#3D3830]/35"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={startNewPrompt}
                    className="inline-flex items-center gap-1 rounded-xl bg-[#4A453D] px-3 py-2 text-xs font-medium text-[#FAF7F2] hover:bg-[#38342E] transition-colors cursor-pointer shrink-0"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    New
                  </button>
                </div>
                <div className="flex items-center justify-between text-[11px] text-[#8B8275]">
                  <span className="font-mono tabular-nums">{filteredPrompts.length} prompts</span>
                  <label className="inline-flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={activeOnly}
                      onChange={(e) => setActiveOnly(e.target.checked)}
                      className="accent-[#4A453D]"
                    />
                    Active only
                  </label>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto divide-y divide-[#3D3830]/8">
                {filteredPrompts.length === 0 ? (
                  <p className="p-6 text-center text-xs text-[#8B8275]">
                    No prompts match this filter. Click <strong>New</strong> to create one.
                  </p>
                ) : (
                  filteredPrompts.map((p) => {
                    const active = !isCreatingPrompt && p.id === selectedPromptId;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setIsCreatingPrompt(false);
                          setSelectedPromptId(p.id);
                          setFeedback(null);
                          setError(null);
                        }}
                        className={`w-full text-left px-3.5 py-3 transition-colors cursor-pointer ${
                          active ? 'bg-[#EAE3D7]/70' : 'hover:bg-[#FAF7F2]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-[#3D3830] truncate">
                            {p.display_name}
                          </span>
                          <span className="font-mono text-[10px] text-[#8B8275] shrink-0">
                            v{p.version}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center justify-between gap-2 text-[10px]">
                          <span className="font-mono text-[#8B7355] truncate">
                            {p.category} · {p.slug}
                          </span>
                          {!p.is_active && (
                            <span className="text-[#7A3E36] font-medium shrink-0">Hidden</span>
                          )}
                        </div>
                        {p.tags && p.tags.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {p.tags.slice(0, 4).map((t) => (
                              <span
                                key={t}
                                className="rounded bg-[#EAE3D7]/80 px-1.5 py-0.5 font-mono text-[9px] text-[#5C5449]"
                              >
                                #{t}
                              </span>
                            ))}
                          </div>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Right Prompt Editor */}
            <div className="rounded-3xl bg-[#FDFBF7] border border-[#3D3830]/12 p-5 sm:p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#3D3830]/10 pb-4">
                <div>
                  <h3 className="font-serif text-xl font-medium text-[#3D3830]">
                    {isCreatingPrompt ? 'Create New Prompt Module' : draftName || 'Edit Prompt'}
                  </h3>
                  {!isCreatingPrompt && selectedPrompt && (
                    <p className="text-[11px] font-mono text-[#8B8275] mt-0.5">
                      slug: {selectedPrompt.slug} · version v{selectedPrompt.version} · ~{approxTokens} tokens
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {!isCreatingPrompt && selectedPrompt && (
                    <>
                      <button
                        type="button"
                        onClick={handleCloneCurrentPrompt}
                        className="inline-flex items-center gap-1 rounded-full border border-[#3D3830]/15 bg-[#FAF7F2] px-3 py-1.5 text-xs font-medium text-[#3D3830] hover:bg-[#EAE3D7]/70 cursor-pointer"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        Clone
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowHistory((v) => !v)}
                        className="inline-flex items-center gap-1 rounded-full border border-[#3D3830]/15 bg-[#FAF7F2] px-3 py-1.5 text-xs font-medium text-[#3D3830] hover:bg-[#EAE3D7]/70 cursor-pointer"
                      >
                        <History className="h-3.5 w-3.5" />
                        History ({selectedPrompt.previous_versions?.length || 0})
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSandboxSource('current_prompt');
                          setSubView('sandbox');
                        }}
                        className="inline-flex items-center gap-1 rounded-full border border-[#3D3830]/15 bg-[#FAF7F2] px-3 py-1.5 text-xs font-medium text-[#3D3830] hover:bg-[#EAE3D7]/70 cursor-pointer"
                      >
                        <FlaskConical className="h-3.5 w-3.5 text-[#8B7355]" />
                        Test
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    disabled={savingPrompt || !draftName.trim() || !draftBody.trim()}
                    onClick={handleSavePrompt}
                    className="inline-flex items-center gap-1.5 rounded-full bg-[#4A453D] px-4 py-1.5 text-xs font-medium text-[#FAF7F2] hover:bg-[#38342E] disabled:opacity-50 cursor-pointer"
                  >
                    <Save className="h-3.5 w-3.5" />
                    {savingPrompt
                      ? 'Saving...'
                      : isCreatingPrompt
                      ? 'Create Prompt'
                      : 'Save New Version'}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                <div>
                  <label className="block text-[11px] font-medium text-[#5C5449] mb-1">
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    placeholder="e.g. D10 Career Deep Analysis"
                    className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3 py-2 text-xs text-[#3D3830]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[#5C5449] mb-1">
                    Unique Slug
                  </label>
                  <input
                    type="text"
                    value={draftSlug}
                    disabled={!isCreatingPrompt}
                    onChange={(e) => setDraftSlug(e.target.value)}
                    placeholder="d10_career_analysis"
                    className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3 py-2 font-mono text-xs text-[#5C5449] disabled:opacity-65"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[#5C5449] mb-1">
                    Category
                  </label>
                  <CustomSelect
                    value={draftCategory}
                    onChange={(val) => setDraftCategory(val as SystemPromptRecord['category'])}
                    options={PROMPT_CATEGORIES}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[#5C5449] mb-1">
                    OpenRouter Model Override
                  </label>
                  <CustomSelect
                    value={draftModelId}
                    onChange={setDraftModelId}
                    options={[
                      { value: '', label: 'Use Platform Default Model' },
                      ...modelOptions,
                    ]}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[#5C5449] mb-1">
                    Tags (comma separated)
                  </label>
                  <input
                    type="text"
                    value={draftTags}
                    onChange={(e) => setDraftTags(e.target.value)}
                    placeholder="career, d10, kp, timing"
                    className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3 py-2 text-xs text-[#3D3830]"
                  />
                </div>
                <div className="flex items-end gap-3">
                  <div className="w-24">
                    <label className="block text-[11px] font-medium text-[#5C5449] mb-1">
                      Sort Order
                    </label>
                    <input
                      type="number"
                      value={draftSortOrder}
                      onChange={(e) => setDraftSortOrder(Number(e.target.value) || 0)}
                      className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3 py-2 font-mono text-xs tabular-nums text-[#3D3830]"
                    />
                  </div>
                  <label className="inline-flex items-center gap-2 pb-2 text-xs font-medium text-[#3D3830] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={draftActive}
                      onChange={(e) => setDraftActive(e.target.checked)}
                      className="accent-[#4A453D]"
                    />
                    Active
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[11px] font-medium text-[#5C5449] mb-1">
                    User-Facing Subtitle (shown in Chat dropdowns)
                  </label>
                  <input
                    type="text"
                    value={draftSubtitle}
                    onChange={(e) => setDraftSubtitle(e.target.value)}
                    placeholder="Short plain-English description..."
                    className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3 py-2 text-xs text-[#3D3830]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[#5C5449] mb-1">
                    Internal Notes (Admin only)
                  </label>
                  <input
                    type="text"
                    value={draftDescription}
                    onChange={(e) => setDraftDescription(e.target.value)}
                    placeholder="Where this prompt is stacked or used..."
                    className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3 py-2 text-xs text-[#3D3830]"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-medium text-[#5C5449]">
                    Prompt Instruction Body
                  </label>
                  <span className="font-mono text-[10px] text-[#8B8275] tabular-nums">
                    {draftBody.length.toLocaleString()} chars · ~{approxTokens.toLocaleString()} tokens
                  </span>
                </div>
                <textarea
                  rows={12}
                  value={draftBody}
                  onChange={(e) => setDraftBody(e.target.value)}
                  placeholder="Write the system, analysis, or modifier directive..."
                  className="w-full rounded-2xl border border-[#3D3830]/15 bg-[#FAF7F2] px-4 py-3 font-mono text-xs text-[#3D3830] leading-relaxed focus:outline-none focus:border-[#3D3830]/40"
                />
              </div>

              {/* Rollback History */}
              {showHistory && selectedPrompt && (
                <div className="rounded-2xl border border-[#3D3830]/12 bg-[#FAF7F2] p-4 space-y-2.5">
                  <h4 className="text-xs font-semibold text-[#3D3830]">Archived Versions</h4>
                  {(!selectedPrompt.previous_versions || selectedPrompt.previous_versions.length === 0) ? (
                    <p className="text-xs text-[#8B8275]">No earlier versions archived yet.</p>
                  ) : (
                    <div className="space-y-2 max-h-52 overflow-y-auto">
                      {selectedPrompt.previous_versions.map((ver) => (
                        <div
                          key={ver.version}
                          className="rounded-xl border border-[#3D3830]/10 bg-[#FDFBF7] p-3 flex items-start justify-between gap-3"
                        >
                          <div className="min-w-0">
                            <p className="font-mono text-[11px] font-medium text-[#3D3830]">
                              v{ver.version} · {new Date(ver.archived_at).toLocaleString()}
                            </p>
                            <p className="mt-1 text-[11px] text-[#5C5449] line-clamp-2 font-mono">
                              {ver.prompt_body}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => void handleRollback(ver.version)}
                            className="inline-flex items-center gap-1 rounded-full border border-[#3D3830]/15 px-3 py-1 text-[11px] font-medium text-[#3D3830] hover:bg-[#EAE3D7] shrink-0 cursor-pointer"
                          >
                            <RotateCcw className="h-3 w-3" />
                            Restore
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Delete Row */}
              {!isCreatingPrompt && selectedPrompt && (
                <div className="flex items-center justify-end pt-2 border-t border-[#3D3830]/8">
                  {confirmDeletePrompt ? (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-[#7A3E36]">Delete this prompt permanently?</span>
                      <button
                        type="button"
                        onClick={() => void handleDeletePrompt()}
                        className="rounded-full bg-[#7A3E36] px-3 py-1 text-[#FAF7F2] font-medium cursor-pointer"
                      >
                        Yes, Delete
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeletePrompt(false)}
                        className="rounded-full border border-[#3D3830]/15 px-3 py-1 text-[#5C5449] cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDeletePrompt(true)}
                      className="inline-flex items-center gap-1 text-xs text-[#7A3E36] hover:underline cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete Prompt
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: COMPOSABLE RECIPES BUILDER */}
      {subView === 'recipes' && (
        <div className="space-y-4">
          {recipesTableMissing && (
            <div className="rounded-2xl border border-[#B8965A]/40 bg-[#B8965A]/12 px-4 py-3 text-xs text-[#3D3830]">
              Run{' '}
              <code className="font-mono text-[11px] bg-[#FAF7F2] px-1.5 py-0.5 rounded">
                supabase/migrations/004_admin_console_and_recipes.sql
              </code>{' '}
              in Supabase SQL Editor to persist Composable Recipes.
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-[310px_1fr] gap-5 items-start">
            {/* Recipe List */}
            <div className="rounded-3xl bg-[#FDFBF7] border border-[#3D3830]/12 overflow-hidden">
              <div className="p-3.5 border-b border-[#3D3830]/10 flex items-center justify-between">
                <span className="text-xs font-semibold text-[#3D3830]">Saved Recipes</span>
                <button
                  type="button"
                  onClick={startNewRecipe}
                  className="inline-flex items-center gap-1 rounded-full bg-[#4A453D] px-3 py-1.5 text-xs font-medium text-[#FAF7F2] hover:bg-[#38342E] cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  New Recipe
                </button>
              </div>

              <div className="divide-y divide-[#3D3830]/8 max-h-[600px] overflow-y-auto">
                {loadingRecipes ? (
                  <p className="p-6 text-center text-xs text-[#8B8275]">Loading recipes...</p>
                ) : recipes.length === 0 ? (
                  <div className="p-6 text-center space-y-2">
                    <Layers className="h-6 w-6 mx-auto text-[#8B8275]" />
                    <p className="text-xs text-[#5C5449]">
                      No recipes yet. Stack system, analysis, and modifier prompts into a reusable Mode or Report Pass recipe.
                    </p>
                  </div>
                ) : (
                  recipes.map((r) => {
                    const active = !isCreatingRecipe && r.id === selectedRecipeId;
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => {
                          setIsCreatingRecipe(false);
                          setSelectedRecipeId(r.id);
                          setFeedback(null);
                          setError(null);
                        }}
                        className={`w-full text-left px-4 py-3.5 transition-colors cursor-pointer ${
                          active ? 'bg-[#EAE3D7]/70' : 'hover:bg-[#FAF7F2]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-[#3D3830] truncate">
                            {r.name}
                          </span>
                          <span className="font-mono text-[10px] text-[#8B8275] shrink-0">
                            {r.steps_json?.length || 0} blocks
                          </span>
                        </div>
                        <p className="mt-1 font-mono text-[10px] text-[#8B7355] truncate">
                          {r.target_type}
                          {r.target_slug ? ` → ${r.target_slug}` : ''}
                        </p>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Recipe Editor */}
            {isCreatingRecipe || selectedRecipe ? (
              <div className="rounded-3xl bg-[#FDFBF7] border border-[#3D3830]/12 p-5 sm:p-6 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#3D3830]/10 pb-4">
                  <div>
                    <h3 className="font-serif text-xl font-medium text-[#3D3830]">
                      {isCreatingRecipe ? 'Create Composable Recipe' : recipeName}
                    </h3>
                    <p className="text-xs text-[#8B8275] mt-0.5">
                      Stack ordered prompt blocks from your Prompt Library. Mode recipes run automatically when users pick that Mode.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowAssembledPreview((v) => !v)}
                      className="inline-flex items-center gap-1 rounded-full border border-[#3D3830]/15 bg-[#FAF7F2] px-3 py-1.5 text-xs font-medium text-[#3D3830] hover:bg-[#EAE3D7]/70 cursor-pointer"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      {showAssembledPreview ? 'Hide Preview' : 'Preview Stack'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSandboxSource('current_recipe');
                        setSubView('sandbox');
                      }}
                      className="inline-flex items-center gap-1 rounded-full border border-[#3D3830]/15 bg-[#FAF7F2] px-3 py-1.5 text-xs font-medium text-[#3D3830] hover:bg-[#EAE3D7]/70 cursor-pointer"
                    >
                      <FlaskConical className="h-3.5 w-3.5 text-[#8B7355]" />
                      Test Stack
                    </button>
                    <button
                      type="button"
                      disabled={savingRecipe || !recipeName.trim()}
                      onClick={handleSaveRecipe}
                      className="inline-flex items-center gap-1.5 rounded-full bg-[#4A453D] px-4 py-1.5 text-xs font-medium text-[#FAF7F2] hover:bg-[#38342E] disabled:opacity-50 cursor-pointer"
                    >
                      <Save className="h-3.5 w-3.5" />
                      {savingRecipe ? 'Saving...' : 'Save Recipe'}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  <div>
                    <label className="block text-[11px] font-medium text-[#5C5449] mb-1">
                      Recipe Name
                    </label>
                    <input
                      type="text"
                      value={recipeName}
                      onChange={(e) => setRecipeName(e.target.value)}
                      placeholder="e.g. Career Deep D10 + KP Stack"
                      className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3 py-2 text-xs text-[#3D3830]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-[#5C5449] mb-1">
                      Slug
                    </label>
                    <input
                      type="text"
                      value={recipeSlug}
                      disabled={!isCreatingRecipe}
                      onChange={(e) => setRecipeSlug(e.target.value)}
                      placeholder="career_d10_kp_recipe"
                      className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3 py-2 font-mono text-xs text-[#5C5449] disabled:opacity-65"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-[#5C5449] mb-1">
                      Target Type
                    </label>
                    <CustomSelect
                      value={recipeTargetType}
                      onChange={(v) => setRecipeTargetType(v as 'mode' | 'report_pass' | 'custom')}
                      options={[
                        { value: 'mode', label: 'Chatbot Mode (runs live in Chat)' },
                        { value: 'report_pass', label: 'Report Pass (attach in Reports Manager)' },
                        { value: 'custom', label: 'Custom Reusable Stack' },
                      ]}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-[#5C5449] mb-1">
                      {recipeTargetType === 'mode' ? 'Bind to Chatbot Mode' : 'Target Slug (optional)'}
                    </label>
                    {recipeTargetType === 'mode' ? (
                      <CustomSelect
                        value={recipeTargetSlug}
                        onChange={setRecipeTargetSlug}
                        options={modeChoices}
                      />
                    ) : (
                      <input
                        type="text"
                        value={recipeTargetSlug}
                        onChange={(e) => setRecipeTargetSlug(e.target.value)}
                        placeholder="optional identifier"
                        className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3 py-2 font-mono text-xs text-[#3D3830]"
                      />
                    )}
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-[#5C5449] mb-1">
                      Model Override (optional)
                    </label>
                    <CustomSelect
                      value={recipeModelId}
                      onChange={setRecipeModelId}
                      options={[{ value: '', label: 'Use Platform Default' }, ...modelOptions]}
                    />
                  </div>
                  <div className="flex items-end pb-2">
                    <label className="inline-flex items-center gap-2 text-xs font-medium text-[#3D3830] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={recipeActive}
                        onChange={(e) => setRecipeActive(e.target.checked)}
                        className="accent-[#4A453D]"
                      />
                      Recipe Active
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-[#5C5449] mb-1">
                    Description
                  </label>
                  <input
                    type="text"
                    value={recipeDescription}
                    onChange={(e) => setRecipeDescription(e.target.value)}
                    placeholder="Explain what this stacked prompt sequence achieves..."
                    className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3 py-2 text-xs text-[#3D3830]"
                  />
                </div>

                {/* Ordered Prompt Blocks */}
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-xs font-semibold text-[#3D3830]">
                      Stacked Prompt Blocks ({recipeSteps.length})
                    </h4>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="flex-1">
                      <CustomSelect
                        value={addBlockSlug}
                        onChange={setAddBlockSlug}
                        options={blockPickerOptions}
                      />
                    </div>
                    <button
                      type="button"
                      disabled={!addBlockSlug}
                      onClick={handleAddRecipeBlock}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#4A453D] px-4 py-2 text-xs font-medium text-[#FAF7F2] hover:bg-[#38342E] disabled:opacity-40 cursor-pointer shrink-0"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Append Block
                    </button>
                  </div>

                  {recipeSteps.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-[#3D3830]/15 bg-[#FAF7F2]/70 p-6 text-center text-xs text-[#8B8275]">
                      No prompt blocks stacked yet. Choose prompts from the picker above to compose this recipe.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {recipeSteps.map((step, idx) => {
                        const matched = promptBySlug.get(step.prompt_slug);
                        return (
                          <div
                            key={`${step.prompt_slug}-${idx}`}
                            className="rounded-2xl border border-[#3D3830]/12 bg-[#FAF7F2] p-3.5 space-y-2"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span className="font-mono text-[11px] text-[#8B7355] font-semibold">
                                  #{idx + 1}
                                </span>
                                <input
                                  type="checkbox"
                                  checked={step.enabled !== false}
                                  onChange={(e) =>
                                    setRecipeSteps((prev) =>
                                      prev.map((item, i) =>
                                        i === idx ? { ...item, enabled: e.target.checked } : item
                                      )
                                    )
                                  }
                                  className="accent-[#4A453D]"
                                />
                                <div className="min-w-0">
                                  <p className="text-xs font-medium text-[#3D3830] truncate">
                                    {matched?.display_name || step.label || step.prompt_slug}
                                  </p>
                                  <p className="font-mono text-[10px] text-[#8B8275] truncate">
                                    {matched?.category || 'prompt'} · {step.prompt_slug}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  disabled={idx === 0}
                                  onClick={() => moveRecipeStep(idx, -1)}
                                  className="rounded-lg p-1.5 text-[#5C5449] hover:bg-[#EAE3D7] disabled:opacity-30 cursor-pointer"
                                  aria-label="Move block up"
                                >
                                  <ArrowUp className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  disabled={idx === recipeSteps.length - 1}
                                  onClick={() => moveRecipeStep(idx, 1)}
                                  className="rounded-lg p-1.5 text-[#5C5449] hover:bg-[#EAE3D7] disabled:opacity-30 cursor-pointer"
                                  aria-label="Move block down"
                                >
                                  <ArrowDown className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setRecipeSteps((prev) => prev.filter((_, i) => i !== idx))
                                  }
                                  className="rounded-lg p-1.5 text-[#7A3E36] hover:bg-[#7A3E36]/10 cursor-pointer"
                                  aria-label="Remove block"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {showAssembledPreview && (
                  <div className="rounded-2xl border border-[#3D3830]/12 bg-[#1F2229] text-[#F4EFE6] p-4 space-y-2">
                    <p className="text-[11px] font-mono uppercase tracking-wider text-[#B8965A]">
                      Assembled Composite Prompt Preview
                    </p>
                    <pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed max-h-72 overflow-y-auto text-[#F4EFE6]/90">
                      {assembledRecipePreview || 'No enabled blocks to preview.'}
                    </pre>
                  </div>
                )}

                {!isCreatingRecipe && selectedRecipe && (
                  <div className="flex items-center justify-end pt-2 border-t border-[#3D3830]/8">
                    {confirmDeleteRecipe ? (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-[#7A3E36]">Delete this recipe?</span>
                        <button
                          type="button"
                          onClick={() => void handleDeleteRecipe()}
                          className="rounded-full bg-[#7A3E36] px-3 py-1 text-[#FAF7F2] font-medium cursor-pointer"
                        >
                          Yes, Delete
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteRecipe(false)}
                          className="rounded-full border border-[#3D3830]/15 px-3 py-1 text-[#5C5449] cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteRecipe(true)}
                        className="inline-flex items-center gap-1 text-xs text-[#7A3E36] hover:underline cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete Recipe
                      </button>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-3xl bg-[#FDFBF7] border border-[#3D3830]/12 p-10 text-center space-y-3">
                <Layers className="h-8 w-8 mx-auto text-[#8B7355]" />
                <h3 className="font-serif text-xl text-[#3D3830]">Compose Your First Prompt Recipe</h3>
                <p className="text-xs text-[#5C5449] max-w-md mx-auto leading-relaxed">
                  Stack multiple prompts (system rules + analysis modules + tone modifiers) into reusable recipes that automatically power Chat Modes or Deep Research Report Passes.
                </p>
                <button
                  type="button"
                  onClick={startNewRecipe}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#4A453D] px-5 py-2 text-xs font-medium text-[#FAF7F2] hover:bg-[#38342E] cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Create Composable Recipe
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW 3: LIVE PROMPT & RECIPE SANDBOX */}
      {subView === 'sandbox' && (
        <div className="rounded-3xl bg-[#FDFBF7] border border-[#3D3830]/12 p-5 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-serif text-xl font-medium text-[#3D3830]">Prompt & Recipe Sandbox</h3>
              <p className="text-xs text-[#8B8275]">
                Dry-run your current draft prompt or assembled recipe against OpenRouter before rolling it out.
              </p>
            </div>
            <div className="inline-flex rounded-full bg-[#EAE3D7]/80 p-1 text-xs">
              <button
                type="button"
                onClick={() => setSandboxSource('current_prompt')}
                className={`rounded-full px-3.5 py-1 font-medium cursor-pointer ${
                  sandboxSource === 'current_prompt'
                    ? 'bg-[#4A453D] text-[#FAF7F2]'
                    : 'text-[#5C5449]'
                }`}
              >
                Current Prompt ({draftName || 'Draft'})
              </button>
              <button
                type="button"
                onClick={() => setSandboxSource('current_recipe')}
                className={`rounded-full px-3.5 py-1 font-medium cursor-pointer ${
                  sandboxSource === 'current_recipe'
                    ? 'bg-[#4A453D] text-[#FAF7F2]'
                    : 'text-[#5C5449]'
                }`}
              >
                Current Recipe ({recipeName || 'Stack'})
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-medium text-[#5C5449] mb-1">
                  Test Model
                </label>
                <CustomSelect
                  value={sandboxModel}
                  onChange={setSandboxModel}
                  options={[{ value: '', label: 'Use Platform Default Consultation Model' }, ...modelOptions]}
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-[#5C5449] mb-1">
                  Sample User Question
                </label>
                <textarea
                  rows={3}
                  value={sandboxQuestion}
                  onChange={(e) => setSandboxQuestion(e.target.value)}
                  className="w-full rounded-2xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3.5 py-2.5 text-xs text-[#3D3830]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-[#5C5449] mb-1">
                  Optional Sample Chart Context
                </label>
                <textarea
                  rows={4}
                  value={sandboxChartContext}
                  onChange={(e) => setSandboxChartContext(e.target.value)}
                  placeholder="Optional: paste a Lagna / Moon / Dasha snippet to test chart grounding..."
                  className="w-full rounded-2xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3.5 py-2.5 font-mono text-xs text-[#3D3830]"
                />
              </div>
              <button
                type="button"
                disabled={sandboxRunning}
                onClick={handleRunSandbox}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#4A453D] px-5 py-2 text-xs font-medium text-[#FAF7F2] hover:bg-[#38342E] disabled:opacity-50 cursor-pointer"
              >
                <Play className="h-3.5 w-3.5" />
                {sandboxRunning ? 'Running OpenRouter Sandbox...' : 'Run Sandbox Test'}
              </button>
            </div>

            <div className="rounded-2xl border border-[#3D3830]/12 bg-[#FAF7F2] p-4 flex flex-col min-h-[280px]">
              <div className="flex items-center justify-between border-b border-[#3D3830]/10 pb-2 mb-3">
                <span className="text-xs font-semibold text-[#3D3830]">Live Response Output</span>
                {sandboxResult && (
                  <span className="font-mono text-[10px] text-[#8B8275] tabular-nums">
                    {sandboxResult.modelUsed} · in:{sandboxResult.tokensIn} / out:{sandboxResult.tokensOut}
                  </span>
                )}
              </div>
              <div className="flex-1 overflow-y-auto text-xs text-[#3D3830] whitespace-pre-wrap leading-relaxed">
                {sandboxRunning
                  ? 'Streaming evaluation from OpenRouter...'
                  : sandboxResult
                  ? sandboxResult.output
                  : 'Run a test to inspect tone, structure, and prompt adherence here.'}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PromptLibraryManager;
