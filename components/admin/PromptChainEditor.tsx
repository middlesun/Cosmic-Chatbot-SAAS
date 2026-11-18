import React, { useMemo, useState } from 'react';
import {
  Check,
  History,
  Play,
  Plus,
  RotateCcw,
  Save,
  Sparkles,
} from 'lucide-react';

export interface SystemPromptRow {
  id: string;
  slug: string;
  category: 'expert' | 'mode' | 'output' | 'language' | 'tool' | 'report_step' | 'learn';
  display_name: string;
  prompt_body: string;
  version: number;
  previous_versions: Array<{
    version: number;
    prompt_body: string;
    archived_at: string;
  }>;
  is_active: boolean;
  updated_at: string;
}

export interface ReportCatalogAdminRow {
  id: string;
  slug: string;
  name: string;
  category: string;
  short_description: string;
  long_description: string | null;
  price_credits: number;
  is_active: boolean;
  prompt_chain_json: Array<{
    stepNumber: number;
    title: string;
    instruction: string;
  }>;
}

interface PromptChainEditorProps {
  mode: 'prompts' | 'reports';
  prompts: SystemPromptRow[];
  reports: ReportCatalogAdminRow[];
  getAccessToken: () => Promise<string | null>;
  onPromptSaved: (prompt: SystemPromptRow) => void;
  onReportSaved: (report: ReportCatalogAdminRow) => void;
}

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
  const [draftBody, setDraftBody] = useState<string>(prompts[0]?.prompt_body || '');
  const [draftActive, setDraftActive] = useState<boolean>(prompts[0]?.is_active ?? true);

  // New modular rule modal state
  const [showNewPromptForm, setShowNewPromptForm] = useState(false);
  const [newSlug, setNewSlug] = useState('');
  const [newCategory, setNewCategory] = useState<SystemPromptRow['category']>('expert');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newPromptBody, setNewPromptBody] = useState('');

  // Sandbox state
  const [testQuestion, setTestQuestion] = useState(
    'How should an analyst weigh D10 Dasamsa against KP 10th Cusp Sub-Lord during Saturn Antardasha?'
  );
  const [sandboxOutput, setSandboxOutput] = useState('');
  const [isTesting, setIsTesting] = useState(false);

  // Report Catalog editor state
  const [selectedReportId, setSelectedReportId] = useState<string>(reports[0]?.id || '');
  const [reportDraft, setReportDraft] = useState<ReportCatalogAdminRow | null>(
    reports[0] || null
  );

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

  const selectPrompt = (p: SystemPromptRow) => {
    setSelectedPromptId(p.id);
    setDraftName(p.display_name);
    setDraftBody(p.prompt_body);
    setDraftActive(p.is_active);
    setFeedback(null);
    setErrorMsg(null);
    setSandboxOutput('');
  };

  const selectReport = (r: ReportCatalogAdminRow) => {
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
          prompt_body: draftBody,
          is_active: draftActive,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save prompt');
      onPromptSaved(data.prompt);
      setFeedback(`Saved "${data.prompt.display_name}" (v${data.prompt.version}). Previous version archived for rollback.`);
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
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Sandbox failed');
      setSandboxOutput(data.output || '');
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
          is_active: reportDraft.is_active,
          prompt_chain_json: reportDraft.prompt_chain_json,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update report');
      onReportSaved(data.report);
      setFeedback(`Saved Report Catalog entry "${data.report.name}".`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Save error');
    } finally {
      setIsSaving(false);
    }
  };

  if (mode === 'reports') {
    const activeReport =
      reportDraft || reports.find((r) => r.id === selectedReportId) || reports[0] || null;

    return (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 space-y-2">
          {reports.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => selectReport(r)}
              className={`w-full rounded-2xl border p-4 text-left transition-colors ${
                activeReport?.id === r.id
                  ? 'bg-[#F1ECE3] border-[#3D3830]/25'
                  : 'bg-[#FDFBF7] border-[#3D3830]/10 hover:bg-[#F1ECE3]/50'
              }`}
            >
              <div className="flex items-center justify-between text-[11px] text-[#8B8275]">
                <span>{r.category}</span>
                <span className="font-['JetBrains_Mono',monospace]">
                  {r.price_credits.toLocaleString()} Cr
                </span>
              </div>
              <p className="mt-1 font-medium text-sm text-[#3D3830]">{r.name}</p>
            </button>
          ))}
        </div>

        <div className="lg:col-span-8">
          {activeReport && (
            <div className="rounded-3xl bg-[#FDFBF7] border border-[#3D3830]/12 p-6 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
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
                <div>
                  <label className="block text-xs font-medium text-[#5C5449] mb-1">
                    Price (Credits)
                  </label>
                  <input
                    type="number"
                    value={activeReport.price_credits}
                    onChange={(e) =>
                      setReportDraft({
                        ...activeReport,
                        price_credits: Number(e.target.value),
                      })
                    }
                    className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3 py-2 text-xs font-['JetBrains_Mono',monospace] text-[#3D3830]"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <p className="text-xs font-medium text-[#3D3830]">
                  Sequential Multi-Pass Prompt Chain ({activeReport.prompt_chain_json.length} Steps)
                </p>
                {activeReport.prompt_chain_json.map((step, sIdx) => (
                  <div
                    key={sIdx}
                    className="rounded-2xl bg-[#FAF7F2] border border-[#3D3830]/10 p-4 space-y-2.5"
                  >
                    <input
                      type="text"
                      value={step.title}
                      onChange={(e) => {
                        const next = [...activeReport.prompt_chain_json];
                        next[sIdx] = { ...step, title: e.target.value };
                        setReportDraft({ ...activeReport, prompt_chain_json: next });
                      }}
                      className="w-full rounded-xl border border-[#3D3830]/12 bg-[#FDFBF7] px-3 py-1.5 text-xs font-medium text-[#3D3830]"
                    />
                    <textarea
                      rows={3}
                      value={step.instruction}
                      onChange={(e) => {
                        const next = [...activeReport.prompt_chain_json];
                        next[sIdx] = { ...step, instruction: e.target.value };
                        setReportDraft({ ...activeReport, prompt_chain_json: next });
                      }}
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
                  <span>{isSaving ? 'Saving...' : 'Save Report Chain'}</span>
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
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            aria-label="Filter system prompts by category"
            className="flex-1 rounded-xl border border-[#3D3830]/15 bg-[#FDFBF7] px-3 py-2 text-xs text-[#3D3830]"
          >
            <option value="all">All Categories ({prompts.length})</option>
            <option value="expert">Experts</option>
            <option value="mode">Modes</option>
            <option value="output">Outputs</option>
            <option value="language">Languages</option>
            <option value="tool">Quick Tools</option>
            <option value="learn">Learn Astrology</option>
            <option value="report_step">Report Steps</option>
          </select>

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
              <div className="flex items-center justify-between text-[10px] text-[#8B8275] font-['JetBrains_Mono',monospace]">
                <span className="uppercase">{p.category}</span>
                <span>v{p.version}</span>
              </div>
              <p className="mt-0.5 text-xs font-medium text-[#3D3830] truncate">
                {p.display_name}
              </p>
              <p className="text-[10px] text-[#8B8275] font-['JetBrains_Mono',monospace] truncate">
                {p.slug}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Right Editor + Rollback History + Live Gemini Sandbox */}
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
                className="rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3 py-2 text-xs font-['JetBrains_Mono',monospace]"
              />
              <select
                value={newCategory}
                onChange={(e) =>
                  setNewCategory(e.target.value as SystemPromptRow['category'])
                }
                className="rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3 py-2 text-xs"
              >
                <option value="expert">Expert</option>
                <option value="mode">Mode</option>
                <option value="output">Output</option>
                <option value="language">Language</option>
                <option value="tool">Tool</option>
                <option value="learn">Learn</option>
                <option value="report_step">Report Step</option>
              </select>
              <input
                type="text"
                required
                value={newDisplayName}
                onChange={(e) => setNewDisplayName(e.target.value)}
                placeholder="Display Name"
                className="rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3 py-2 text-xs"
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
                <div>
                  <span className="text-[11px] font-['JetBrains_Mono',monospace] text-[#8B8275]">
                    {activePrompt.slug} · Version {activePrompt.version}
                  </span>
                  <input
                    type="text"
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    className="mt-1 block font-serif text-2xl font-medium text-[#3D3830] bg-transparent border-b border-transparent focus:border-[#3D3830]/25 focus:outline-none"
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

              <textarea
                rows={10}
                value={draftBody}
                onChange={(e) => setDraftBody(e.target.value)}
                className="w-full rounded-2xl border border-[#3D3830]/15 bg-[#FAF7F2] p-4 text-xs font-['JetBrains_Mono',monospace] leading-relaxed text-[#3D3830] focus:outline-none focus:border-[#3D3830]/40"
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
              <div className="flex items-center gap-2 text-xs text-[#B8965A]">
                <Sparkles className="h-4 w-4" />
                <span>Live Gemini Prompt Sandbox</span>
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
                          <span className="font-['JetBrains_Mono',monospace] font-medium text-[#3D3830] mr-2">
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
