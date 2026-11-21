import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  Copy,
  Download,
  Eye,
  FlaskConical,
  History,
  Layers,
  Play,
  Plus,
  RotateCcw,
  Save,
  Search,
  Tag,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import CustomSelect from '../app/CustomSelect';

export interface SystemPromptRecord {
  id: string;
  slug: string;
  category:
    | 'system'
    | 'master_prompts'
    | 'expert'
    | 'analysis'
    | 'modifier'
    | 'tone'
    | 'mode'
    | 'output'
    | 'language'
    | 'tool'
    | 'report_step'
    | 'learn'
    | 'formula_cartridge'
    | 'priority_rule';
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
  created_at?: string;
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
  { value: 'master_prompts', label: 'Master Prompts' },
  { value: 'expert', label: 'Expert' },
  { value: 'analysis', label: 'Analysis' },
  { value: 'modifier', label: 'Modifier' },
  { value: 'tone', label: 'Tone' },
  { value: 'mode', label: 'Mode' },
  { value: 'output', label: 'Output' },
  { value: 'language', label: 'Language' },
  { value: 'tool', label: 'Tool' },
  { value: 'report_step', label: 'Report Step' },
  { value: 'learn', label: 'Learn' },
  { value: 'formula_cartridge', label: 'Formula Cartridge' },
  { value: 'priority_rule', label: 'Priority Rule' },
];

const CATEGORY_LABEL_MAP: Record<string, string> = Object.fromEntries(
  PROMPT_CATEGORIES.map((c) => [c.value, c.label])
);

function getCategoryLabel(category: string): string {
  return CATEGORY_LABEL_MAP[category] || category;
}

function formatCharsCompact(len: number): string {
  if (len >= 10000) return `${Math.round(len / 1000)}K`;
  if (len >= 1000) return `${Number((len / 1000).toFixed(1))}K`;
  return String(len);
}

function normalizeTagToken(raw: string): string {
  return raw.trim().replace(/^#+/, '').toLowerCase();
}

function parseTagTokens(raw: string): string[] {
  return Array.from(
    new Set(
      raw
        .split(',')
        .map((t) => normalizeTagToken(t))
        .filter(Boolean)
    )
  );
}

type PromptSortMode = 'default' | 'newest' | 'oldest' | 'longest' | 'shortest';

const PROMPT_SORT_OPTIONS: Array<{ value: PromptSortMode; label: string }> = [
  { value: 'default', label: 'Sort: Default' },
  { value: 'newest', label: 'Sort: Newest' },
  { value: 'oldest', label: 'Sort: Oldest' },
  { value: 'longest', label: 'Sort: Longest' },
  { value: 'shortest', label: 'Sort: Shortest' },
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
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<PromptSortMode>('default');
  const [activeOnly, setActiveOnly] = useState(false);
  const [selectedPromptId, setSelectedPromptId] = useState<string | null>(prompts[0]?.id || null);
  const [isCreatingPrompt, setIsCreatingPrompt] = useState(false);

  const [draftSlug, setDraftSlug] = useState('');
  const [draftCategory, setDraftCategory] = useState<SystemPromptRecord['category']>('analysis');
  const [draftName, setDraftName] = useState('');
  const [draftSubtitle, setDraftSubtitle] = useState('');
  const [draftDescription, setDraftDescription] = useState('');
  const [draftTagsList, setDraftTagsList] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [draftSortOrder, setDraftSortOrder] = useState<number>(100);
  const [draftModelId, setDraftModelId] = useState('');
  const [draftActive, setDraftActive] = useState(true);
  const [draftBody, setDraftBody] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [confirmDeletePrompt, setConfirmDeletePrompt] = useState(false);
  const [savingPrompt, setSavingPrompt] = useState(false);
  const [togglingPromptId, setTogglingPromptId] = useState<string | null>(null);
  const [updatingCategoryPromptId, setUpdatingCategoryPromptId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    prompt: SystemPromptRecord;
    x: number;
    y: number;
  } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement | null>(null);

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

  // Export / Import modals
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportScope, setExportScope] = useState<'all' | 'filtered' | 'manual'>('all');
  const [manualSelectedIds, setManualSelectedIds] = useState<string[]>([]);
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false);
  const [exportPromptSearch, setExportPromptSearch] = useState('');
  const [exportCategoryFilter, setExportCategoryFilter] = useState<string>('all');
  const [exportActiveOnly, setExportActiveOnly] = useState(false);
  const [exportFormat, setExportFormat] = useState<'json' | 'markdown'>('json');
  const [exportCopied, setExportCopied] = useState(false);

  const [showImportModal, setShowImportModal] = useState(false);
  const [importJsonText, setImportJsonText] = useState('');
  const [importConflictMode, setImportConflictMode] = useState<'skip' | 'upsert'>('skip');
  const [importingPrompts, setImportingPrompts] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const importFileRef = useRef<HTMLInputElement | null>(null);

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

  const allLibraryTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of prompts) {
      for (const raw of p.tags || []) {
        const tag = normalizeTagToken(raw);
        if (!tag) continue;
        counts.set(tag, (counts.get(tag) || 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
  }, [prompts]);

  const filteredPrompts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const tagQ = q.replace(/^#+/, '');
    return prompts
      .filter((p) => {
        if (categoryFilter !== 'all' && p.category !== categoryFilter) return false;
        if (activeOnly && !p.is_active) return false;
        const normalizedTags = (p.tags || []).map((t) => normalizeTagToken(t)).filter(Boolean);
        if (tagFilter && !normalizedTags.includes(tagFilter)) return false;
        if (!q) return true;
        return (
          p.display_name.toLowerCase().includes(q) ||
          (tagQ.length > 0 && normalizedTags.some((t) => t.includes(tagQ)))
        );
      })
      .sort((a, b) => {
        if (sortBy === 'newest') {
          const ta = new Date(a.updated_at || a.created_at || 0).getTime();
          const tb = new Date(b.updated_at || b.created_at || 0).getTime();
          return tb - ta || a.display_name.localeCompare(b.display_name);
        }
        if (sortBy === 'oldest') {
          const ta = new Date(a.updated_at || a.created_at || 0).getTime();
          const tb = new Date(b.updated_at || b.created_at || 0).getTime();
          return ta - tb || a.display_name.localeCompare(b.display_name);
        }
        if (sortBy === 'longest') {
          return (
            (b.prompt_body || '').length - (a.prompt_body || '').length ||
            a.display_name.localeCompare(b.display_name)
          );
        }
        if (sortBy === 'shortest') {
          return (
            (a.prompt_body || '').length - (b.prompt_body || '').length ||
            a.display_name.localeCompare(b.display_name)
          );
        }
        return (
          (a.sort_order ?? 100) - (b.sort_order ?? 100) ||
          a.display_name.localeCompare(b.display_name)
        );
      });
  }, [prompts, searchQuery, categoryFilter, activeOnly, tagFilter, sortBy]);

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
      setDraftTagsList(
        Array.from(
          new Set((selectedPrompt.tags || []).map((t) => normalizeTagToken(t)).filter(Boolean))
        )
      );
      setTagInput('');
      setDraftSortOrder(selectedPrompt.sort_order ?? 100);
      setDraftModelId(selectedPrompt.model_id || '');
      setDraftActive(selectedPrompt.is_active);
      setDraftBody(selectedPrompt.prompt_body);
      setShowHistory(false);
      setConfirmDeletePrompt(false);
    }
  }, [selectedPrompt?.id, isCreatingPrompt, prompts.length]);

  useEffect(() => {
    if (!contextMenu) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (contextMenuRef.current && contextMenuRef.current.contains(e.target as Node)) {
        return;
      }
      setContextMenu(null);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu(null);
    };
    const handleCloseOnScroll = () => setContextMenu(null);

    document.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', handleCloseOnScroll, true);
    window.addEventListener('resize', handleCloseOnScroll);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleCloseOnScroll, true);
      window.removeEventListener('resize', handleCloseOnScroll);
    };
  }, [contextMenu]);

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
    setDraftTagsList(tagFilter ? [tagFilter] : []);
    setTagInput('');
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
    setDraftTagsList(
      Array.from(
        new Set((selectedPrompt.tags || []).map((t) => normalizeTagToken(t)).filter(Boolean))
      )
    );
    setTagInput('');
    setDraftSortOrder((selectedPrompt.sort_order ?? 100) + 1);
    setDraftModelId(selectedPrompt.model_id || '');
    setDraftActive(true);
    setDraftBody(selectedPrompt.prompt_body);
    setFeedback('Cloned into new draft — customize the slug and click Save.');
  };

  const commitPendingTags = (rawInput: string) => {
    const tokens = parseTagTokens(rawInput);
    if (tokens.length === 0) return;
    setDraftTagsList((prev) => Array.from(new Set([...prev, ...tokens])).slice(0, 25));
    setTagInput('');
  };

  const handleSavePrompt = async () => {
    setSavingPrompt(true);
    setError(null);
    setFeedback(null);
    const pendingTokens = parseTagTokens(tagInput);
    const parsedTags = Array.from(new Set([...draftTagsList, ...pendingTokens])).slice(0, 25);
    if (pendingTokens.length > 0) {
      setDraftTagsList(parsedTags);
      setTagInput('');
    }

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

  const handleTogglePromptActive = async (prompt: SystemPromptRecord) => {
    setTogglingPromptId(prompt.id);
    setError(null);
    try {
      const token = await getAccessToken();
      const nextActive = !prompt.is_active;
      const res = await fetch(`/api/admin/prompts/${prompt.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ is_active: nextActive }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not toggle prompt status');
      onPromptSaved(data.prompt, false);
      if (!isCreatingPrompt && selectedPromptId === prompt.id) {
        setDraftActive(Boolean(data.prompt.is_active));
      }
      setFeedback(
        `${data.prompt.is_active ? 'Enabled' : 'Disabled'} "${data.prompt.display_name}".`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Status update failed');
    } finally {
      setTogglingPromptId(null);
    }
  };

  const handleChangePromptCategory = async (
    prompt: SystemPromptRecord,
    newCategory: SystemPromptRecord['category']
  ) => {
    setContextMenu(null);
    if (prompt.category === newCategory) return;
    setUpdatingCategoryPromptId(prompt.id);
    setError(null);
    try {
      const token = await getAccessToken();
      const res = await fetch(`/api/admin/prompts/${prompt.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ category: newCategory }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not change category');
      onPromptSaved(data.prompt, false);
      if (!isCreatingPrompt && selectedPromptId === prompt.id) {
        setDraftCategory(data.prompt.category);
      }
      setFeedback(
        `Moved "${data.prompt.display_name}" to ${getCategoryLabel(data.prompt.category)}.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Category update failed');
    } finally {
      setUpdatingCategoryPromptId(null);
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

  // Export & Import helpers
  const manualSelectedSet = useMemo(() => new Set(manualSelectedIds), [manualSelectedIds]);

  const sortedAllPrompts = useMemo(() => {
    return [...prompts].sort(
      (a, b) =>
        (a.sort_order ?? 100) - (b.sort_order ?? 100) ||
        a.display_name.localeCompare(b.display_name)
    );
  }, [prompts]);

  const exportDropdownPrompts = useMemo(() => {
    const q = exportPromptSearch.trim().toLowerCase();
    const tagQ = q.replace(/^#+/, '');
    return sortedAllPrompts.filter((p) => {
      if (exportActiveOnly && !p.is_active) return false;
      if (exportCategoryFilter !== 'all' && p.category !== exportCategoryFilter) return false;
      if (!q) return true;
      const catLabel = getCategoryLabel(p.category).toLowerCase();
      const normalizedTags = (p.tags || []).map((t) => normalizeTagToken(t)).filter(Boolean);
      return (
        p.display_name.toLowerCase().includes(q) ||
        p.slug.toLowerCase().includes(q) ||
        catLabel.includes(q) ||
        (tagQ.length > 0 && normalizedTags.some((t) => t.includes(tagQ)))
      );
    });
  }, [sortedAllPrompts, exportPromptSearch, exportCategoryFilter, exportActiveOnly]);

  const manualSelectedPrompts = useMemo(
    () => sortedAllPrompts.filter((p) => manualSelectedSet.has(p.id)),
    [sortedAllPrompts, manualSelectedSet]
  );

  const toggleManualPrompt = (promptId: string) => {
    setManualSelectedIds((prev) =>
      prev.includes(promptId) ? prev.filter((id) => id !== promptId) : [...prev, promptId]
    );
  };

  const promptsToExport = useMemo(() => {
    const base =
      exportScope === 'filtered'
        ? filteredPrompts
        : exportScope === 'manual'
        ? prompts.filter((p) => manualSelectedSet.has(p.id))
        : prompts;
    return exportActiveOnly ? base.filter((p) => p.is_active) : base;
  }, [exportScope, exportActiveOnly, filteredPrompts, prompts, manualSelectedSet]);

  const exportPayloadText = useMemo(() => {
    if (exportFormat === 'markdown') {
      const header = `# Cosmic Council Prompt Library Export\nExported: ${new Date().toISOString()}\nTotal prompts: ${promptsToExport.length}\n`;
      const sections = promptsToExport.map((p, idx) => {
        const tagsStr = (p.tags || []).length > 0 ? (p.tags || []).map((t) => `#${t}`).join(', ') : 'none';
        return [
          `---`,
          `## ${idx + 1}. ${p.display_name}`,
          `- **Slug:** \`${p.slug}\``,
          `- **Category:** ${getCategoryLabel(p.category)} (\`${p.category}\`)`,
          `- **Active:** ${p.is_active ? 'Yes' : 'No'} | **Version:** v${p.version} | **Sort Order:** ${p.sort_order ?? 100}`,
          `- **Model Override:** ${p.model_id || 'Platform Default'}`,
          `- **Tags:** ${tagsStr}`,
          p.subtitle ? `- **Subtitle:** ${p.subtitle}` : null,
          p.description ? `- **Internal Notes:** ${p.description}` : null,
          ``,
          `\`\`\`text`,
          p.prompt_body || '',
          `\`\`\``,
        ]
          .filter((line) => line !== null)
          .join('\n');
      });
      return `${header}\n${sections.join('\n\n')}\n`;
    }

    const bundle = {
      format: 'cosmic-council-prompts-v1',
      exported_at: new Date().toISOString(),
      count: promptsToExport.length,
      prompts: promptsToExport.map((p) => ({
        slug: p.slug,
        category: p.category,
        display_name: p.display_name,
        subtitle: p.subtitle || null,
        description: p.description || null,
        tags: (p.tags || []).map((t) => normalizeTagToken(t)).filter(Boolean),
        sort_order: p.sort_order ?? 100,
        model_id: p.model_id || null,
        is_active: p.is_active,
        version: p.version,
        prompt_body: p.prompt_body,
      })),
    };
    return JSON.stringify(bundle, null, 2);
  }, [promptsToExport, exportFormat]);

  const handleDownloadExport = () => {
    if (promptsToExport.length === 0) return;
    const ext = exportFormat === 'markdown' ? 'md' : 'json';
    const mime = exportFormat === 'markdown' ? 'text/markdown;charset=utf-8' : 'application/json;charset=utf-8';
    const blob = new Blob([exportPayloadText], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cosmic-council-prompts-${new Date().toISOString().slice(0, 10)}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setFeedback(`Exported ${promptsToExport.length} prompt(s) as .${ext}.`);
  };

  const handleCopyExport = async () => {
    if (promptsToExport.length === 0) return;
    try {
      await navigator.clipboard.writeText(exportPayloadText);
      setExportCopied(true);
      window.setTimeout(() => setExportCopied(false), 1800);
    } catch {
      setError('Clipboard copy failed. Use Download File instead.');
    }
  };

  const parsedImportPreview = useMemo(() => {
    const rawText = importJsonText.trim();
    if (!rawText) {
      return { items: [] as Array<Record<string, unknown>>, parseError: null as string | null };
    }
    try {
      const parsed = JSON.parse(rawText);
      const list = Array.isArray(parsed)
        ? parsed
        : parsed && typeof parsed === 'object' && Array.isArray((parsed as any).prompts)
        ? (parsed as any).prompts
        : null;
      if (!list) {
        return {
          items: [] as Array<Record<string, unknown>>,
          parseError: 'Expected a JSON array or an export object containing a "prompts" array.',
        };
      }
      const validObjects = list.filter(
        (entry: unknown): entry is Record<string, unknown> =>
          Boolean(entry && typeof entry === 'object')
      );
      return { items: validObjects, parseError: null };
    } catch (err) {
      return {
        items: [] as Array<Record<string, unknown>>,
        parseError: err instanceof Error ? err.message : 'Invalid JSON syntax',
      };
    }
  }, [importJsonText]);

  const handleImportFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);
    try {
      const text = await file.text();
      setImportJsonText(text);
    } catch {
      setImportError('Could not read the selected file.');
    } finally {
      e.target.value = '';
    }
  };

  const handleRunImport = async () => {
    if (parsedImportPreview.parseError || parsedImportPreview.items.length === 0) return;
    setImportingPrompts(true);
    setImportError(null);
    setError(null);
    try {
      const token = await getAccessToken();
      const res = await fetch('/api/admin/prompts/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          prompts: parsedImportPreview.items,
          conflictMode: importConflictMode,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Import failed');

      const createdList = Array.isArray(data.created) ? (data.created as SystemPromptRecord[]) : [];
      const updatedList = Array.isArray(data.updated) ? (data.updated as SystemPromptRecord[]) : [];
      const skippedList = Array.isArray(data.skipped) ? data.skipped : [];
      const errorList = Array.isArray(data.errors) ? data.errors : [];

      for (const item of createdList) {
        onPromptSaved(item, true);
      }
      for (const item of updatedList) {
        onPromptSaved(item, false);
      }

      const firstTouched = createdList[0] || updatedList[0];
      if (firstTouched) {
        setIsCreatingPrompt(false);
        setSelectedPromptId(firstTouched.id);
      }

      const summaryParts = [
        `${createdList.length} created`,
        `${updatedList.length} updated`,
        `${skippedList.length} skipped`,
      ];
      if (errorList.length > 0) {
        summaryParts.push(`${errorList.length} failed`);
      }
      setFeedback(`Prompt import complete: ${summaryParts.join(', ')}.`);
      if (errorList.length > 0) {
        setImportError(
          errorList
            .slice(0, 5)
            .map((er: { slug?: string; error?: string }) => `${er.slug}: ${er.error}`)
            .join(' | ')
        );
      } else {
        setShowImportModal(false);
        setImportJsonText('');
      }
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImportingPrompts(false);
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
      ...prompts.map((p) => {
        const charLen = (p.prompt_body || '').length;
        const tokenCount = Math.ceil(charLen / 4);
        return {
          value: p.slug,
          label: p.display_name,
          hint: `${getCategoryLabel(p.category)} - ${formatCharsCompact(charLen)} characters - ${tokenCount} Tokens`,
        };
      }),
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

        <div className="flex flex-wrap items-center gap-2.5">
          {subView === 'prompts' && (
            <div className="inline-flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setExportCopied(false);
                  setShowExportModal(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-full border border-[#3D3830]/15 bg-[#FDFBF7] px-3.5 py-1.5 text-xs font-medium text-[#5C5449] hover:bg-[#EAE3D7]/60 hover:text-[#3D3830] transition-colors cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" />
                Export
              </button>
              <button
                type="button"
                onClick={() => {
                  setImportError(null);
                  setShowImportModal(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-full border border-[#3D3830]/15 bg-[#FDFBF7] px-3.5 py-1.5 text-xs font-medium text-[#5C5449] hover:bg-[#EAE3D7]/60 hover:text-[#3D3830] transition-colors cursor-pointer"
              >
                <Upload className="h-3.5 w-3.5" />
                Import
              </button>
            </div>
          )}

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
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCategoryFilter('all')}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                  categoryFilter === 'all'
                    ? 'bg-[#3D3830] text-[#FAF7F2]'
                    : 'bg-[#FDFBF7] border border-[#3D3830]/15 text-[#5C5449] hover:bg-[#EAE3D7]/60'
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
                      : 'bg-[#FDFBF7] border border-[#3D3830]/15 text-[#5C5449] hover:bg-[#EAE3D7]/60'
                  }`}
                >
                  {cat.label} ({categoryCounts[cat.value] || 0})
                </button>
              ))}
            </div>

            {/* Tag Discovery Bar */}
            {allLibraryTags.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                <span className="inline-flex items-center gap-1 text-[#8B8275] font-medium mr-0.5">
                  <Tag className="h-3 w-3" />
                  Tags:
                </span>
                <button
                  type="button"
                  onClick={() => setTagFilter(null)}
                  className={`rounded-full px-2.5 py-1 font-mono text-[10px] transition-colors cursor-pointer ${
                    tagFilter === null
                      ? 'bg-[#4A453D] text-[#FAF7F2]'
                      : 'bg-[#FDFBF7] border border-[#3D3830]/15 text-[#5C5449] hover:bg-[#EAE3D7]/60'
                  }`}
                >
                  All tags
                </button>
                {allLibraryTags.map(({ tag, count }) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setTagFilter((prev) => (prev === tag ? null : tag))}
                    className={`rounded-full px-2.5 py-1 font-mono text-[10px] transition-colors cursor-pointer ${
                      tagFilter === tag
                        ? 'bg-[#4A453D] text-[#FAF7F2]'
                        : 'bg-[#FDFBF7] border border-[#3D3830]/15 text-[#5C5449] hover:bg-[#EAE3D7]/60'
                    }`}
                  >
                    #{tag} ({count})
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[350px_1fr] gap-5 items-start">
            {/* Left Compact Master List */}
            <div className="rounded-3xl bg-[#FDFBF7] border border-[#3D3830]/15 overflow-hidden flex flex-col max-h-[760px]">
              <div className="p-3 border-b border-[#3D3830]/10 space-y-2.5">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="h-3.5 w-3.5 text-[#8B8275] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search title or #tags..."
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

                <div className="flex items-center justify-between gap-2 text-[11px] text-[#8B8275]">
                  <span className="font-mono tabular-nums shrink-0">
                    {filteredPrompts.length} prompts
                  </span>
                  <div className="flex items-center gap-2.5">
                    <label className="inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={activeOnly}
                        onChange={(e) => setActiveOnly(e.target.checked)}
                        className="accent-[#4A453D]"
                      />
                      Active only
                    </label>
                    <div className="w-[138px]">
                      <CustomSelect
                        size="xs"
                        surface="canvas"
                        align="right"
                        ariaLabel="Sort prompts"
                        value={sortBy}
                        onChange={(val) => setSortBy(val as PromptSortMode)}
                        options={PROMPT_SORT_OPTIONS}
                      />
                    </div>
                  </div>
                </div>

                {tagFilter && (
                  <div className="flex items-center justify-between rounded-xl bg-[#EAE3D7]/60 px-2.5 py-1.5 text-[11px] text-[#3D3830]">
                    <span className="font-mono truncate">
                      Filtered by tag: <strong>#{tagFilter}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => setTagFilter(null)}
                      className="inline-flex items-center gap-0.5 text-[10px] font-medium text-[#5C5449] hover:text-[#3D3830] cursor-pointer shrink-0"
                    >
                      <X className="h-3 w-3" />
                      Clear
                    </button>
                  </div>
                )}
              </div>

              <div className="flex-1 overflow-y-auto divide-y divide-[#3D3830]/10">
                {filteredPrompts.length === 0 ? (
                  <p className="p-6 text-center text-xs text-[#8B8275]">
                    No prompts match this filter. Click <strong>New</strong> to create one.
                  </p>
                ) : (
                  filteredPrompts.map((p) => {
                    const active = !isCreatingPrompt && p.id === selectedPromptId;
                    const charLen = (p.prompt_body || '').length;
                    const tokenCount = Math.ceil(charLen / 4);
                    const isUpdatingRow =
                      togglingPromptId === p.id || updatingCategoryPromptId === p.id;
                    const rowTags = (p.tags || []).map((t) => normalizeTagToken(t)).filter(Boolean);

                    return (
                      <div
                        key={p.id}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          const menuWidth = 216;
                          const menuHeight = 380;
                          const safeX = Math.max(
                            8,
                            Math.min(e.clientX, window.innerWidth - menuWidth - 8)
                          );
                          const safeY = Math.max(
                            8,
                            Math.min(e.clientY, window.innerHeight - menuHeight - 8)
                          );
                          setContextMenu({ prompt: p, x: safeX, y: safeY });
                        }}
                        className={`px-3.5 py-3 transition-colors ${
                          active ? 'bg-[#EAE3D7]/70' : 'hover:bg-[#FAF7F2]'
                        } ${isUpdatingRow ? 'opacity-70' : ''}`}
                      >
                        <div className="flex items-start justify-between gap-2.5">
                          <button
                            type="button"
                            onClick={() => {
                              setIsCreatingPrompt(false);
                              setSelectedPromptId(p.id);
                              setFeedback(null);
                              setError(null);
                            }}
                            className="flex-1 min-w-0 text-left cursor-pointer"
                          >
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span
                                className={`text-xs font-semibold truncate ${
                                  p.is_active ? 'text-[#3D3830]' : 'text-[#8B8275]'
                                }`}
                              >
                                {p.display_name}
                              </span>
                              <span className="font-mono text-[10px] text-[#8B8275] shrink-0">
                                v{p.version}
                              </span>
                            </div>
                            <p className="mt-1 font-mono text-[10px] text-[#8B7355] truncate tabular-nums">
                              {getCategoryLabel(p.category)} - {formatCharsCompact(charLen)} characters - {tokenCount} Tokens
                            </p>
                          </button>

                          <button
                            type="button"
                            role="switch"
                            aria-checked={p.is_active}
                            aria-label={
                              p.is_active
                                ? `Disable ${p.display_name}`
                                : `Enable ${p.display_name}`
                            }
                            title={
                              p.is_active
                                ? 'Enabled — click to disable'
                                : 'Disabled — click to enable'
                            }
                            disabled={togglingPromptId === p.id}
                            onClick={() => void handleTogglePromptActive(p)}
                            className={`relative mt-0.5 inline-flex h-[18px] w-[32px] shrink-0 items-center rounded-full transition-colors cursor-pointer disabled:opacity-50 ${
                              p.is_active ? 'bg-[#2D6A4F]' : 'bg-[#3D3830]/20'
                            }`}
                          >
                            <span
                              className={`inline-block h-[14px] w-[14px] transform rounded-full bg-[#FAF7F2] shadow-xs transition-transform ${
                                p.is_active ? 'translate-x-[16px]' : 'translate-x-[2px]'
                              }`}
                            />
                          </button>
                        </div>

                        {rowTags.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {rowTags.slice(0, 4).map((t) => (
                              <button
                                key={t}
                                type="button"
                                onClick={() =>
                                  setTagFilter((prev) => (prev === t ? null : t))
                                }
                                title={`Filter by #${t}`}
                                className={`rounded px-1.5 py-0.5 font-mono text-[9px] transition-colors cursor-pointer ${
                                  tagFilter === t
                                    ? 'bg-[#4A453D] text-[#FAF7F2]'
                                    : 'bg-[#EAE3D7]/80 text-[#5C5449] hover:bg-[#DDD4C5]'
                                }`}
                              >
                                #{t}
                              </button>
                            ))}
                            {rowTags.length > 4 && (
                              <span className="px-1 font-mono text-[9px] text-[#8B8275]">
                                +{rowTags.length - 4}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Right Prompt Editor */}
            <div className="rounded-3xl bg-[#FDFBF7] border border-[#3D3830]/15 p-5 sm:p-6 space-y-4">
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
                    {savingPrompt ? 'Saving...' : 'Save'}
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
                <div className="sm:col-span-2 lg:col-span-1">
                  <label className="block text-[11px] font-medium text-[#5C5449] mb-1">
                    Tags
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={tagInput}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val.includes(',')) {
                          const parts = val.split(',');
                          const complete = parts.slice(0, -1).join(',');
                          const remainder = parts[parts.length - 1];
                          const tokens = parseTagTokens(complete);
                          if (tokens.length > 0) {
                            setDraftTagsList((prev) =>
                              Array.from(new Set([...prev, ...tokens])).slice(0, 25)
                            );
                          }
                          setTagInput(remainder);
                        } else {
                          setTagInput(val);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          commitPendingTags(tagInput);
                        }
                      }}
                      placeholder="Add tag (Enter or comma)..."
                      className="flex-1 min-w-0 rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3 py-2 text-xs text-[#3D3830]"
                    />
                    <button
                      type="button"
                      disabled={!normalizeTagToken(tagInput)}
                      onClick={() => commitPendingTags(tagInput)}
                      className="rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-2.5 py-2 text-xs font-medium text-[#3D3830] hover:bg-[#EAE3D7] disabled:opacity-40 cursor-pointer shrink-0"
                    >
                      Add
                    </button>
                  </div>
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

              {(draftTagsList.length > 0 || allLibraryTags.some((t) => !draftTagsList.includes(t.tag))) && (
                <div className="rounded-2xl border border-[#3D3830]/10 bg-[#FAF7F2]/80 px-3.5 py-2.5 space-y-2">
                  {draftTagsList.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] font-medium text-[#8B8275]">Applied tags:</span>
                      {draftTagsList.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-1 rounded-full bg-[#EAE3D7] px-2.5 py-0.5 font-mono text-[10px] text-[#3D3830]"
                        >
                          #{tag}
                          <button
                            type="button"
                            aria-label={`Remove tag ${tag}`}
                            onClick={() =>
                              setDraftTagsList((prev) => prev.filter((item) => item !== tag))
                            }
                            className="text-[#5C5449] hover:text-[#7A3E36] cursor-pointer"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  {allLibraryTags.some((t) => !draftTagsList.includes(t.tag)) && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] text-[#8B8275]">Quick add existing:</span>
                      {allLibraryTags
                        .filter((t) => !draftTagsList.includes(t.tag))
                        .slice(0, 10)
                        .map(({ tag }) => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() =>
                              setDraftTagsList((prev) =>
                                Array.from(new Set([...prev, tag])).slice(0, 25)
                              )
                            }
                            className="rounded-full border border-[#3D3830]/15 bg-[#FDFBF7] px-2 py-0.5 font-mono text-[10px] text-[#5C5449] hover:bg-[#EAE3D7] hover:text-[#3D3830] cursor-pointer"
                          >
                            + #{tag}
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              )}

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
                <div className="rounded-2xl border border-[#3D3830]/15 bg-[#FAF7F2] p-4 space-y-2.5">
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

              {/* Bottom Action Bar (Delete + Bottom Save) */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#3D3830]/10">
                <div>
                  {!isCreatingPrompt && selectedPrompt && (
                    confirmDeletePrompt ? (
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
                    )
                  )}
                </div>

                <button
                  type="button"
                  disabled={savingPrompt || !draftName.trim() || !draftBody.trim()}
                  onClick={handleSavePrompt}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#4A453D] px-4 py-1.5 text-xs font-medium text-[#FAF7F2] hover:bg-[#38342E] disabled:opacity-50 cursor-pointer"
                >
                  <Save className="h-3.5 w-3.5" />
                  {savingPrompt ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>

          {contextMenu &&
            typeof document !== 'undefined' &&
            createPortal(
              <div
                ref={contextMenuRef}
                role="menu"
                aria-label={`Change category for ${contextMenu.prompt.display_name}`}
                style={{
                  position: 'fixed',
                  top: `${contextMenu.y}px`,
                  left: `${contextMenu.x}px`,
                  zIndex: 250,
                }}
                className="w-[216px] rounded-2xl border border-[#3D3830]/15 bg-[#FDFBF7] p-1.5 shadow-[0_18px_42px_-12px_rgba(61,56,48,0.24)]"
              >
                <div className="px-2.5 py-1.5 border-b border-[#3D3830]/10 mb-1">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-[#8B8275]">
                    Change Category
                  </p>
                  <p className="text-xs font-semibold text-[#3D3830] truncate">
                    {contextMenu.prompt.display_name}
                  </p>
                </div>
                <div className="max-h-72 overflow-y-auto space-y-0.5">
                  {PROMPT_CATEGORIES.map((cat) => {
                    const isCurrent = contextMenu.prompt.category === cat.value;
                    return (
                      <button
                        key={cat.value}
                        type="button"
                        role="menuitem"
                        onClick={() =>
                          void handleChangePromptCategory(contextMenu.prompt, cat.value)
                        }
                        className={`w-full flex items-center justify-between gap-2 rounded-xl px-2.5 py-1.5 text-xs text-left transition-colors cursor-pointer ${
                          isCurrent
                            ? 'bg-[#F1ECE3] font-medium text-[#3D3830]'
                            : 'text-[#5C5449] hover:bg-[#F1ECE3]/70 hover:text-[#3D3830]'
                        }`}
                      >
                        <span>{cat.label}</span>
                        {isCurrent && <Check className="h-3.5 w-3.5 text-[#8B7355] shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>,
              document.body
            )}
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
      {/* Export Prompts Modal */}
      {showExportModal &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[120] flex items-center justify-center bg-[#1F2229]/45 backdrop-blur-xs p-4"
            onClick={() => {
              setExportDropdownOpen(false);
              setShowExportModal(false);
            }}
          >
            <div
              className="w-full max-w-xl max-h-[90vh] flex flex-col rounded-3xl border border-[#3D3830]/15 bg-[#FDFBF7] p-6 shadow-2xl space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3 shrink-0">
                <div>
                  <h3 className="font-serif text-xl font-medium text-[#3D3830]">
                    Export Prompt Library
                  </h3>
                  <p className="mt-0.5 text-xs text-[#5C5449]">
                    Download a re-importable JSON bundle or clean Markdown for review.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setExportDropdownOpen(false);
                    setShowExportModal(false);
                  }}
                  aria-label="Close export modal"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[#8B8275] hover:bg-[#EAE3D7] hover:text-[#3D3830] cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-3.5 pr-0.5">
                <div>
                  <label className="block text-[11px] font-medium text-[#5C5449] mb-1.5">
                    Scope
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setExportScope('all');
                        setExportDropdownOpen(false);
                      }}
                      className={`rounded-2xl border px-3.5 py-2.5 text-left text-xs transition-colors cursor-pointer ${
                        exportScope === 'all'
                          ? 'border-[#4A453D] bg-[#EAE3D7]/60 text-[#3D3830] font-medium'
                          : 'border-[#3D3830]/12 bg-[#FAF7F2] text-[#5C5449] hover:border-[#3D3830]/25'
                      }`}
                    >
                      All prompts ({prompts.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setExportScope('filtered');
                        setExportDropdownOpen(false);
                      }}
                      className={`rounded-2xl border px-3.5 py-2.5 text-left text-xs transition-colors cursor-pointer ${
                        exportScope === 'filtered'
                          ? 'border-[#4A453D] bg-[#EAE3D7]/60 text-[#3D3830] font-medium'
                          : 'border-[#3D3830]/12 bg-[#FAF7F2] text-[#5C5449] hover:border-[#3D3830]/25'
                      }`}
                    >
                      Current filter ({filteredPrompts.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setExportScope('manual');
                        if (manualSelectedIds.length === 0) {
                          setExportDropdownOpen(true);
                        }
                      }}
                      className={`rounded-2xl border px-3.5 py-2.5 text-left text-xs transition-colors cursor-pointer ${
                        exportScope === 'manual'
                          ? 'border-[#4A453D] bg-[#EAE3D7]/60 text-[#3D3830] font-medium'
                          : 'border-[#3D3830]/12 bg-[#FAF7F2] text-[#5C5449] hover:border-[#3D3830]/25'
                      }`}
                    >
                      Select manually ({manualSelectedPrompts.length})
                    </button>
                  </div>
                </div>

                {exportScope === 'manual' && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <label className="block text-[11px] font-medium text-[#5C5449]">
                        Select Prompts
                      </label>
                      {manualSelectedPrompts.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setManualSelectedIds([])}
                          className="text-[11px] text-[#8B8275] hover:text-[#7A3E36] cursor-pointer"
                        >
                          Clear ({manualSelectedPrompts.length})
                        </button>
                      )}
                    </div>

                    <button
                      type="button"
                      aria-expanded={exportDropdownOpen}
                      onClick={() => setExportDropdownOpen((prev) => !prev)}
                      className={`w-full flex items-center justify-between gap-2 rounded-2xl border px-3.5 py-2.5 text-left text-xs transition-all cursor-pointer ${
                        exportDropdownOpen
                          ? 'border-[#3D3830]/45 bg-[#FAF7F2] ring-2 ring-[#B8965A]/20'
                          : 'border-[#3D3830]/15 bg-[#FAF7F2] hover:border-[#3D3830]/35'
                      }`}
                    >
                      <span
                        className={`truncate ${
                          manualSelectedPrompts.length === 0
                            ? 'text-[#8B8275]'
                            : 'text-[#3D3830] font-medium'
                        }`}
                      >
                        {manualSelectedPrompts.length === 0
                          ? 'Choose prompts to compile into bundle...'
                          : manualSelectedPrompts.length === 1
                          ? manualSelectedPrompts[0].display_name
                          : `${manualSelectedPrompts.length} prompts selected`}
                      </span>
                      <ChevronDown
                        className={`h-3.5 w-3.5 shrink-0 text-[#8B8275] transition-transform duration-200 ${
                          exportDropdownOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </button>

                    {exportDropdownOpen && (
                      <div className="animate-cc-dropdown-down rounded-2xl border border-[#3D3830]/15 bg-[#FAF7F2] shadow-[0_14px_34px_-12px_rgba(61,56,48,0.18)] overflow-hidden">
                        <div className="p-2.5 border-b border-[#3D3830]/10 space-y-2 bg-[#FDFBF7]">
                          <div className="flex flex-col sm:flex-row gap-2">
                            <div className="relative flex-1">
                              <Search className="h-3.5 w-3.5 text-[#8B8275] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                              <input
                                type="text"
                                value={exportPromptSearch}
                                onChange={(e) => setExportPromptSearch(e.target.value)}
                                placeholder="Search prompt, category, or #tag..."
                                className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] pl-8 pr-2.5 py-1.5 text-xs text-[#3D3830] focus:outline-none focus:border-[#3D3830]/35"
                              />
                            </div>
                            <div className="sm:w-[155px]">
                              <CustomSelect
                                size="xs"
                                surface="canvas"
                                align="right"
                                ariaLabel="Filter export prompts by category"
                                value={exportCategoryFilter}
                                onChange={setExportCategoryFilter}
                                options={[
                                  { value: 'all', label: 'All categories' },
                                  ...PROMPT_CATEGORIES.map((c) => ({
                                    value: c.value,
                                    label: c.label,
                                  })),
                                ]}
                              />
                            </div>
                          </div>

                          <div className="flex items-center justify-between gap-2 text-[11px] text-[#8B8275]">
                            <span className="font-mono tabular-nums">
                              {exportDropdownPrompts.length} shown · {manualSelectedPrompts.length} selected
                            </span>
                            <div className="flex items-center gap-2.5">
                              <button
                                type="button"
                                disabled={exportDropdownPrompts.length === 0}
                                onClick={() => {
                                  const visibleIds = exportDropdownPrompts.map((p) => p.id);
                                  setManualSelectedIds((prev) =>
                                    Array.from(new Set([...prev, ...visibleIds]))
                                  );
                                }}
                                className="font-medium text-[#5C5449] hover:text-[#3D3830] disabled:opacity-40 cursor-pointer"
                              >
                                Select visible
                              </button>
                              <button
                                type="button"
                                disabled={manualSelectedPrompts.length === 0}
                                onClick={() => setManualSelectedIds([])}
                                className="font-medium text-[#5C5449] hover:text-[#7A3E36] disabled:opacity-40 cursor-pointer"
                              >
                                Clear all
                              </button>
                              <button
                                type="button"
                                onClick={() => setExportDropdownOpen(false)}
                                className="rounded-lg bg-[#EAE3D7] px-2 py-0.5 text-[10px] font-medium text-[#3D3830] hover:bg-[#DDD4C5] cursor-pointer"
                              >
                                Done
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="max-h-60 overflow-y-auto divide-y divide-[#3D3830]/10">
                          {exportDropdownPrompts.length === 0 ? (
                            <p className="p-4 text-center text-xs text-[#8B8275]">
                              No prompts match this filter.
                            </p>
                          ) : (
                            exportDropdownPrompts.map((p) => {
                              const checked = manualSelectedSet.has(p.id);
                              const charLen = (p.prompt_body || '').length;
                              const tokenCount = Math.ceil(charLen / 4);
                              return (
                                <button
                                  key={p.id}
                                  type="button"
                                  role="option"
                                  aria-selected={checked}
                                  onClick={() => toggleManualPrompt(p.id)}
                                  className={`w-full px-3.5 py-2.5 text-left flex items-start gap-2.5 transition-colors cursor-pointer ${
                                    checked
                                      ? 'bg-[#EAE3D7]/65'
                                      : 'hover:bg-[#FDFBF7]'
                                  }`}
                                >
                                  <span
                                    className={`mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                                      checked
                                        ? 'border-[#4A453D] bg-[#4A453D] text-[#FAF7F2]'
                                        : 'border-[#3D3830]/25 bg-[#FDFBF7]'
                                    }`}
                                  >
                                    {checked && <Check className="h-3 w-3" />}
                                  </span>

                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      <span
                                        className={`text-xs font-semibold truncate ${
                                          p.is_active ? 'text-[#3D3830]' : 'text-[#8B8275]'
                                        }`}
                                      >
                                        {p.display_name}
                                      </span>
                                      <span className="font-mono text-[10px] text-[#8B8275] shrink-0">
                                        v{p.version}
                                      </span>
                                      {!p.is_active && (
                                        <span className="font-mono text-[9px] text-[#8B8275] shrink-0">
                                          · inactive
                                        </span>
                                      )}
                                    </div>
                                    <p className="mt-0.5 font-mono text-[10px] text-[#8B7355] truncate tabular-nums">
                                      {getCategoryLabel(p.category)} - {formatCharsCompact(charLen)} characters - {tokenCount} Tokens
                                    </p>
                                  </div>
                                </button>
                              );
                            })
                          )}
                        </div>
                      </div>
                    )}

                    {!exportDropdownOpen && manualSelectedPrompts.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto rounded-2xl border border-[#3D3830]/10 bg-[#FAF7F2]/80 p-2">
                        {manualSelectedPrompts.map((p) => (
                          <span
                            key={p.id}
                            className="inline-flex items-center gap-1 rounded-lg border border-[#3D3830]/12 bg-[#FDFBF7] px-2 py-1 text-[11px] text-[#3D3830]"
                          >
                            <span className="truncate max-w-[180px] font-medium">
                              {p.display_name}
                            </span>
                            <span className="font-mono text-[10px] text-[#8B7355]">
                              ({getCategoryLabel(p.category)} · {formatCharsCompact((p.prompt_body || '').length)})
                            </span>
                            <button
                              type="button"
                              aria-label={`Remove ${p.display_name}`}
                              onClick={() => toggleManualPrompt(p.id)}
                              className="text-[#8B8275] hover:text-[#7A3E36] cursor-pointer ml-0.5"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-medium text-[#5C5449] mb-1.5">
                    Format
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setExportFormat('json')}
                      className={`rounded-2xl border px-3.5 py-2.5 text-left text-xs transition-colors cursor-pointer ${
                        exportFormat === 'json'
                          ? 'border-[#4A453D] bg-[#EAE3D7]/60 text-[#3D3830] font-medium'
                          : 'border-[#3D3830]/12 bg-[#FAF7F2] text-[#5C5449] hover:border-[#3D3830]/25'
                      }`}
                    >
                      <div>JSON (.json)</div>
                      <div className="text-[10px] text-[#8B8275] mt-0.5">
                        Full metadata · Re-importable
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setExportFormat('markdown')}
                      className={`rounded-2xl border px-3.5 py-2.5 text-left text-xs transition-colors cursor-pointer ${
                        exportFormat === 'markdown'
                          ? 'border-[#4A453D] bg-[#EAE3D7]/60 text-[#3D3830] font-medium'
                          : 'border-[#3D3830]/12 bg-[#FAF7F2] text-[#5C5449] hover:border-[#3D3830]/25'
                      }`}
                    >
                      <div>Markdown (.md)</div>
                      <div className="text-[10px] text-[#8B8275] mt-0.5">
                        Readable doc for review & sharing
                      </div>
                    </button>
                  </div>
                </div>

                <label className="inline-flex items-center gap-2 text-xs text-[#5C5449] cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={exportActiveOnly}
                    onChange={(e) => setExportActiveOnly(e.target.checked)}
                    className="accent-[#4A453D]"
                  />
                  Include active prompts only
                </label>

                <div className="rounded-2xl border border-[#3D3830]/10 bg-[#FAF7F2] px-3.5 py-2.5 flex items-center justify-between text-[11px] text-[#5C5449]">
                  <span>
                    {exportScope === 'manual' && promptsToExport.length === 0
                      ? 'Select at least 1 prompt above'
                      : 'Ready to export'}
                  </span>
                  <span className="font-mono tabular-nums text-[#3D3830] font-medium">
                    {promptsToExport.length} prompt(s) · ~{formatCharsCompact(exportPayloadText.length)} chars
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-[#3D3830]/10 shrink-0">
                <button
                  type="button"
                  disabled={promptsToExport.length === 0}
                  onClick={() => void handleCopyExport()}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#3D3830]/15 bg-[#FAF7F2] px-4 py-2 text-xs font-medium text-[#3D3830] hover:bg-[#EAE3D7]/60 disabled:opacity-45 cursor-pointer"
                >
                  {exportCopied ? <Check className="h-3.5 w-3.5 text-[#2D6A4F]" /> : <Copy className="h-3.5 w-3.5" />}
                  {exportCopied ? 'Copied!' : 'Copy to Clipboard'}
                </button>
                <button
                  type="button"
                  disabled={promptsToExport.length === 0}
                  onClick={handleDownloadExport}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#4A453D] px-5 py-2 text-xs font-medium text-[#FAF7F2] hover:bg-[#38342E] disabled:opacity-45 cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download .{exportFormat === 'markdown' ? 'md' : 'json'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Import Prompts Modal */}
      {showImportModal &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[120] flex items-center justify-center bg-[#1F2229]/45 backdrop-blur-xs p-4"
            onClick={() => !importingPrompts && setShowImportModal(false)}
          >
            <div
              className="w-full max-w-2xl rounded-3xl border border-[#3D3830]/15 bg-[#FDFBF7] p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-serif text-xl font-medium text-[#3D3830]">
                    Import Prompts (JSON)
                  </h3>
                  <p className="mt-0.5 text-xs text-[#5C5449]">
                    Upload an exported Cosmic Council JSON file or paste prompt JSON below.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={importingPrompts}
                  onClick={() => setShowImportModal(false)}
                  aria-label="Close import modal"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[#8B8275] hover:bg-[#EAE3D7] hover:text-[#3D3830] cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {importError && (
                <div className="rounded-2xl border border-[#7A3E36]/25 bg-[#7A3E36]/8 px-3.5 py-2.5 text-xs text-[#7A3E36]">
                  {importError}
                </div>
              )}

              <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                <div className="flex items-center justify-between gap-2">
                  <input
                    ref={importFileRef}
                    type="file"
                    accept=".json,application/json"
                    onChange={(e) => void handleImportFileChange(e)}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => importFileRef.current?.click()}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[#3D3830]/18 bg-[#FAF7F2] px-3.5 py-1.5 text-xs font-medium text-[#3D3830] hover:bg-[#EAE3D7]/60 cursor-pointer"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    Choose .json file
                  </button>
                  {importJsonText.trim() && (
                    <button
                      type="button"
                      onClick={() => {
                        setImportJsonText('');
                        setImportError(null);
                      }}
                      className="text-[11px] text-[#8B8275] hover:text-[#3D3830] cursor-pointer"
                    >
                      Clear input
                    </button>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-[#5C5449] mb-1">
                    Or paste JSON payload
                  </label>
                  <textarea
                    rows={7}
                    value={importJsonText}
                    onChange={(e) => {
                      setImportJsonText(e.target.value);
                      setImportError(null);
                    }}
                    placeholder='{"prompts":[{"slug":"my_prompt","category":"master_prompts","display_name":"My Prompt","tags":["vedic"],"prompt_body":"..."}]}'
                    className="w-full rounded-2xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3.5 py-2.5 font-mono text-[11px] leading-relaxed text-[#3D3830] focus:outline-none focus:border-[#3D3830]/35"
                  />
                </div>

                {parsedImportPreview.parseError && (
                  <p className="text-[11px] text-[#7A3E36]">
                    JSON parse error: {parsedImportPreview.parseError}
                  </p>
                )}

                {parsedImportPreview.items.length > 0 && (
                  <div className="rounded-2xl border border-[#3D3830]/12 bg-[#FAF7F2] p-3 space-y-2">
                    <div className="flex items-center justify-between text-[11px] text-[#5C5449]">
                      <span className="font-medium text-[#3D3830]">
                        Detected {parsedImportPreview.items.length} prompt(s)
                      </span>
                      <span className="font-mono text-[10px] text-[#8B8275]">
                        {
                          parsedImportPreview.items.filter((it) => {
                            const slugVal = String(
                              it.slug || it.display_name || ''
                            )
                              .trim()
                              .toLowerCase()
                              .replace(/[^a-z0-9_]+/g, '_')
                              .replace(/^_+|_+$/g, '');
                            return slugVal && promptBySlug.has(slugVal);
                          }).length
                        }{' '}
                        matching existing slug(s)
                      </span>
                    </div>
                    <div className="max-h-36 overflow-y-auto divide-y divide-[#3D3830]/8">
                      {parsedImportPreview.items.slice(0, 50).map((it, idx) => {
                        const title = String(it.display_name || it.slug || `Item ${idx + 1}`);
                        const rawSlug = String(it.slug || title)
                          .trim()
                          .toLowerCase()
                          .replace(/[^a-z0-9_]+/g, '_')
                          .replace(/^_+|_+$/g, '');
                        const exists = Boolean(rawSlug && promptBySlug.has(rawSlug));
                        const catLabel = getCategoryLabel(String(it.category || 'unknown'));
                        return (
                          <div
                            key={`${rawSlug}-${idx}`}
                            className="py-1.5 flex items-center justify-between gap-2 text-[11px]"
                          >
                            <div className="min-w-0 truncate">
                              <span className="font-medium text-[#3D3830]">{title}</span>
                              <span className="ml-2 font-mono text-[10px] text-[#8B8275]">
                                {catLabel} · {rawSlug || 'no-slug'}
                              </span>
                            </div>
                            <span
                              className={`shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px] ${
                                exists
                                  ? 'bg-[#EAE3D7] text-[#5C5449]'
                                  : 'bg-[#2D6A4F]/10 text-[#2D6A4F]'
                              }`}
                            >
                              {exists ? 'exists' : 'new'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-medium text-[#5C5449] mb-1.5">
                    If slug already exists
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setImportConflictMode('skip')}
                      className={`rounded-2xl border px-3.5 py-2 text-left text-xs transition-colors cursor-pointer ${
                        importConflictMode === 'skip'
                          ? 'border-[#4A453D] bg-[#EAE3D7]/60 text-[#3D3830] font-medium'
                          : 'border-[#3D3830]/12 bg-[#FAF7F2] text-[#5C5449]'
                      }`}
                    >
                      <div>Skip existing (Safe)</div>
                      <div className="text-[10px] text-[#8B8275] mt-0.5">
                        Only adds brand-new slugs
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setImportConflictMode('upsert')}
                      className={`rounded-2xl border px-3.5 py-2 text-left text-xs transition-colors cursor-pointer ${
                        importConflictMode === 'upsert'
                          ? 'border-[#4A453D] bg-[#EAE3D7]/60 text-[#3D3830] font-medium'
                          : 'border-[#3D3830]/12 bg-[#FAF7F2] text-[#5C5449]'
                      }`}
                    >
                      <div>Update matching slugs</div>
                      <div className="text-[10px] text-[#8B8275] mt-0.5">
                        Archives old body in version history
                      </div>
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#3D3830]/10">
                <button
                  type="button"
                  disabled={importingPrompts}
                  onClick={() => setShowImportModal(false)}
                  className="rounded-full border border-[#3D3830]/15 bg-[#FAF7F2] px-4 py-2 text-xs font-medium text-[#5C5449] hover:text-[#3D3830] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={
                    importingPrompts ||
                    Boolean(parsedImportPreview.parseError) ||
                    parsedImportPreview.items.length === 0
                  }
                  onClick={() => void handleRunImport()}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#4A453D] px-5 py-2 text-xs font-medium text-[#FAF7F2] hover:bg-[#38342E] disabled:opacity-45 cursor-pointer"
                >
                  <Upload className="h-3.5 w-3.5" />
                  {importingPrompts
                    ? 'Importing...'
                    : `Import ${parsedImportPreview.items.length || ''} Prompt${
                        parsedImportPreview.items.length === 1 ? '' : 's'
                      }`}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

export default PromptLibraryManager;
