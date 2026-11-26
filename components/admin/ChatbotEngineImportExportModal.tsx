import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Download,
  FileJson,
  Upload,
  X,
} from 'lucide-react';
import CustomSelect from '../app/CustomSelect';

export type ChatbotEngineIoScope =
  | 'all'
  | 'engine'
  | 'playbooks'
  | 'rules'
  | 'birth_chart';

interface ImportPreviewResult {
  engineChanges: Array<{ key: string; subKey?: string; action: 'add' | 'update' | 'remove' }>;
  playbookChanges: Array<{ playbookId: string; action: 'add' | 'update' | 'remove' }>;
  ruleChanges: Array<{ target: string; action: 'update' | 'clear'; ruleCount: number }>;
  birthChartChanges: Array<{ field: string; action: 'update' }>;
  warnings: string[];
  totalChanges: number;
}

interface ChatbotEngineImportExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedGuide: string;
  selectedGuideName: string;
  initialScope?: ChatbotEngineIoScope;
  initialFocus?: 'export' | 'import' | null;
  getAccessToken: () => Promise<string | null>;
  onImportSuccess: (message: string) => Promise<void>;
}

function downloadJsonFile(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const SCOPE_OPTIONS: Array<{
  value: ChatbotEngineIoScope;
  label: string;
  description: string;
}> = [
  {
    value: 'all',
    label: 'Full Engine & Rules Bundle',
    description: 'Engine prompts, canonical playbooks, modular rules, and birth chart compiler config.',
  },
  {
    value: 'engine',
    label: 'Engine Prompts, Laws & Contracts',
    description: 'Vedic & Western Stages 1–4, Deep Audit, Companion, Memory & Natal Kernel prompts.',
  },
  {
    value: 'playbooks',
    label: 'Canonical Playbook Overrides',
    description: 'Per-playbook timing stack, formula cartridges & custom instructions.',
  },
  {
    value: 'rules',
    label: 'Modular Rules & Guardrails',
    description: 'Per-guide drag-and-drop modular rules + global conversational rules.',
  },
  {
    value: 'birth_chart',
    label: 'Birth Chart Conversion Settings',
    description: 'FreeAstrologyAPI options & Layer B Natal Narrative Kernel parameters.',
  },
];

const ChatbotEngineImportExportModal: React.FC<ChatbotEngineImportExportModalProps> = ({
  isOpen,
  onClose,
  selectedGuide,
  selectedGuideName,
  initialScope = 'all',
  initialFocus = null,
  getAccessToken,
  onImportSuccess,
}) => {
  const [scope, setScope] = useState<ChatbotEngineIoScope>(initialScope);
  const [rulesGuideFilter, setRulesGuideFilter] = useState<'all' | 'active'>('active');
  const [includeDefaults, setIncludeDefaults] = useState(true);
  const [replaceMode, setReplaceMode] = useState<'merge' | 'replace'>('merge');
  const [rawJson, setRawJson] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreviewResult | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const exportSectionRef = useRef<HTMLDivElement | null>(null);
  const importSectionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setScope(initialScope);
    setError(null);
    setStatusMessage(null);
    setPreview(null);
    if (initialFocus) {
      window.setTimeout(() => {
        const target =
          initialFocus === 'import'
            ? importSectionRef.current
            : exportSectionRef.current;
        target?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 60);
    }
  }, [isOpen, initialScope, initialFocus]);

  if (!isOpen) return null;

  const handleExport = async () => {
    setBusy(true);
    setError(null);
    setStatusMessage(null);
    try {
      const token = await getAccessToken();
      const params = new URLSearchParams({
        scope,
        includeDefaults: includeDefaults ? '1' : '0',
      });
      if (scope === 'rules' && rulesGuideFilter === 'active' && selectedGuide) {
        params.set('guide', selectedGuide);
      }

      const res = await fetch(`/api/admin/settings/chatbot/export?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to export JSON bundle');

      const suffix =
        scope === 'rules' && rulesGuideFilter === 'active'
          ? `rules-${selectedGuide}`
          : scope;
      const filename = `cosmic-council-chatbot-${suffix}.json`;
      downloadJsonFile(data, filename);
      setStatusMessage(`Downloaded ${filename}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setBusy(false);
    }
  };

  const parseUploadedJson = (): unknown => {
    if (!rawJson.trim()) {
      throw new Error('Paste or load a JSON file before validating or importing.');
    }
    try {
      return JSON.parse(rawJson);
    } catch {
      throw new Error('Malformed JSON syntax — check commas, quotes, or brackets.');
    }
  };

  const handleDryRun = async () => {
    setBusy(true);
    setError(null);
    setStatusMessage(null);
    setPreview(null);
    try {
      const parsed = parseUploadedJson();
      const token = await getAccessToken();
      const res = await fetch('/api/admin/settings/chatbot/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          bundle: parsed,
          scope,
          guideSlug: selectedGuide,
          replaceMode,
          dryRun: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Dry-run validation failed');
      setPreview(data.preview || null);
      setStatusMessage('Validation passed. Review the diff below before applying.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Validation failed');
    } finally {
      setBusy(false);
    }
  };

  const handleApplyImport = async () => {
    setBusy(true);
    setError(null);
    setStatusMessage(null);
    try {
      const parsed = parseUploadedJson();
      const token = await getAccessToken();
      const res = await fetch('/api/admin/settings/chatbot/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          bundle: parsed,
          scope,
          guideSlug: selectedGuide,
          replaceMode,
          dryRun: false,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Import failed');

      const total = data.preview?.totalChanges ?? 0;
      await onImportSuccess(
        `Imported ${total} change${total === 1 ? '' : 's'} into Chatbot Engine & Rules.`
      );
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setBusy(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setRawJson(typeof reader.result === 'string' ? reader.result : '');
      setPreview(null);
      setError(null);
      setStatusMessage(`Loaded ${file.name} (${Math.round(file.size / 1024)} KB). Click Validate & Preview Diff.`);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1F2229]/55 backdrop-blur-xs p-4">
      <div className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-3xl border border-[#3D3830]/18 bg-[#FAF7F2] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-[#3D3830]/12 bg-[#FDFBF7] shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <FileJson className="h-5 w-5 text-[#8B7355] shrink-0" />
            <div className="min-w-0">
              <h3 className="font-['Cormorant_Garamond',serif] text-2xl font-medium text-[#3D3830] truncate">
                Chatbot Engine &amp; Rules — Export / Import JSON
              </h3>
              <p className="text-xs text-[#8B8275] truncate">
                Versioned backup, offline editing, and dry-run validated import for Engine Prompts, Playbooks &amp; Rules.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Export/Import modal"
            className="p-2 rounded-full text-[#5C5449] hover:bg-[#EAE3D7] hover:text-[#3D3830] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="rounded-2xl border border-[#7A3E36]/25 bg-[#7A3E36]/8 px-4 py-3 text-xs text-[#7A3E36] flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          {statusMessage && (
            <div className="rounded-2xl border border-[#2D6A4F]/25 bg-[#2D6A4F]/8 px-4 py-3 text-xs text-[#2D6A4F] flex items-center gap-2">
              <Check className="h-4 w-4 shrink-0" />
              <span>{statusMessage}</span>
            </div>
          )}

          {/* Scope Selector */}
          <div className="rounded-2xl border border-[#3D3830]/12 bg-[#FDFBF7] p-4 space-y-3">
            <label className="block text-xs font-semibold text-[#3D3830]">
              Target Scope
            </label>
            <CustomSelect
              value={scope}
              onChange={(val) => {
                setScope(val as ChatbotEngineIoScope);
                setPreview(null);
              }}
              ariaLabel="Export or import scope"
              surface="canvas"
              className="w-full"
              options={SCOPE_OPTIONS}
            />

            {scope === 'rules' && (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-xs text-[#5C5449]">Rules Export Filter:</span>
                <button
                  type="button"
                  onClick={() => setRulesGuideFilter('active')}
                  className={`rounded-full px-3 py-1 text-xs font-medium cursor-pointer ${
                    rulesGuideFilter === 'active'
                      ? 'bg-[#4A453D] text-[#FAF7F2]'
                      : 'bg-[#F1ECE3] text-[#5C5449]'
                  }`}
                >
                  Active Guide Only ({selectedGuideName})
                </button>
                <button
                  type="button"
                  onClick={() => setRulesGuideFilter('all')}
                  className={`rounded-full px-3 py-1 text-xs font-medium cursor-pointer ${
                    rulesGuideFilter === 'all'
                      ? 'bg-[#4A453D] text-[#FAF7F2]'
                      : 'bg-[#F1ECE3] text-[#5C5449]'
                  }`}
                >
                  All Guides + Global Rules
                </button>
              </div>
            )}
          </div>

          {/* Export Section */}
          <div
            ref={exportSectionRef}
            className="rounded-2xl border border-[#3D3830]/12 bg-[#FDFBF7] p-4 space-y-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-semibold text-[#3D3830]">1. Export JSON Snapshot</h4>
                <p className="text-xs text-[#8B8275] mt-0.5">
                  Download live database overrides (and optionally code defaults / playbook catalog reference).
                </p>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleExport()}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#4A453D] px-4 py-2 text-xs font-medium text-[#FAF7F2] hover:bg-[#38342E] disabled:opacity-50 transition-colors cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" />
                <span>{busy ? 'Exporting...' : 'Download JSON'}</span>
              </button>
            </div>

            {(scope === 'all' || scope === 'engine' || scope === 'playbooks') && (
              <label className="inline-flex items-center gap-2 text-xs text-[#5C5449] cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeDefaults}
                  onChange={(e) => setIncludeDefaults(e.target.checked)}
                  className="rounded border-[#3D3830]/25 accent-[#4A453D]"
                />
                <span>Include read-only Code Defaults &amp; Canonical Playbook reference in export</span>
              </label>
            )}
          </div>

          {/* Import Section */}
          <div
            ref={importSectionRef}
            className="rounded-2xl border border-[#3D3830]/12 bg-[#FDFBF7] p-4 space-y-3.5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="text-sm font-semibold text-[#3D3830]">2. Import JSON Bundle</h4>
                <p className="text-xs text-[#8B8275] mt-0.5">
                  Upload a <span className="font-mono">.json</span> file or paste JSON below. Every key is validated before applying.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/json,.json"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#3D3830]/18 bg-[#FAF7F2] px-3.5 py-1.5 text-xs font-medium text-[#3D3830] hover:bg-[#F1ECE3] cursor-pointer"
                >
                  <Upload className="h-3.5 w-3.5" />
                  <span>Load .json File</span>
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-[#5C5449]">Import Strategy:</span>
              <button
                type="button"
                onClick={() => {
                  setReplaceMode('merge');
                  setPreview(null);
                }}
                className={`rounded-full px-3 py-1 text-xs font-medium cursor-pointer ${
                  replaceMode === 'merge'
                    ? 'bg-[#4A453D] text-[#FAF7F2]'
                    : 'bg-[#F1ECE3] text-[#5C5449]'
                }`}
              >
                Merge with existing overrides
              </button>
              <button
                type="button"
                onClick={() => {
                  setReplaceMode('replace');
                  setPreview(null);
                }}
                className={`rounded-full px-3 py-1 text-xs font-medium cursor-pointer ${
                  replaceMode === 'replace'
                    ? 'bg-[#7A3E36] text-[#FAF7F2]'
                    : 'bg-[#F1ECE3] text-[#5C5449]'
                }`}
              >
                Replace selected scope cleanly
              </button>
            </div>

            <textarea
              rows={8}
              value={rawJson}
              onChange={(e) => {
                setRawJson(e.target.value);
                setPreview(null);
              }}
              placeholder='Paste exported "cosmic_council.chatbot_engine_bundle.v1" JSON here...'
              className="w-full rounded-2xl border border-[#3D3830]/15 bg-[#FAF7F2] p-3.5 font-mono text-xs leading-relaxed text-[#3D3830] focus:border-[#3D3830]/40 focus:outline-none resize-y"
            />

            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                disabled={busy || !rawJson.trim()}
                onClick={() => void handleDryRun()}
                className="inline-flex items-center gap-1.5 rounded-full border border-[#3D3830]/20 bg-[#FAF7F2] px-4 py-2 text-xs font-medium text-[#3D3830] hover:bg-[#F1ECE3] disabled:opacity-45 cursor-pointer"
              >
                <span>Validate &amp; Preview Diff</span>
              </button>
              <button
                type="button"
                disabled={busy || !rawJson.trim()}
                onClick={() => void handleApplyImport()}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#4A453D] px-5 py-2 text-xs font-medium text-[#FAF7F2] hover:bg-[#38342E] disabled:opacity-45 cursor-pointer"
              >
                <Check className="h-3.5 w-3.5" />
                <span>{busy ? 'Importing...' : 'Apply Import'}</span>
              </button>
            </div>

            {/* Dry Run Diff Preview */}
            {preview && (
              <div className="rounded-2xl border border-[#3D3830]/15 bg-[#FAF7F2] p-4 space-y-3 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-[#3D3830]">
                    Dry-Run Diff Summary ({preview.totalChanges} change{preview.totalChanges === 1 ? '' : 's'})
                  </span>
                  <span className="font-mono text-[11px] text-[#8B8275]">
                    Engine: {preview.engineChanges.length} · Playbooks: {preview.playbookChanges.length} · Rules: {preview.ruleChanges.length} · Birth Chart: {preview.birthChartChanges.length}
                  </span>
                </div>

                {preview.warnings.length > 0 && (
                  <div className="rounded-xl border border-[#B8965A]/30 bg-[#B8965A]/10 p-2.5 space-y-1 text-[11px] text-[#3D3830]">
                    {preview.warnings.map((w, i) => (
                      <p key={i}>• {w}</p>
                    ))}
                  </div>
                )}

                {preview.totalChanges === 0 ? (
                  <p className="text-[#8B8275]">
                    No differences detected — imported values already match active database settings.
                  </p>
                ) : (
                  <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 font-mono text-[11px]">
                    {preview.engineChanges.map((c, idx) => (
                      <div key={`eng-${idx}`} className="flex items-center justify-between gap-2 text-[#3D3830]">
                        <span>
                          engine.{c.key}
                          {c.subKey ? `.${c.subKey}` : ''}
                        </span>
                        <span className="uppercase text-[#8B7355]">{c.action}</span>
                      </div>
                    ))}
                    {preview.playbookChanges.map((c, idx) => (
                      <div key={`pb-${idx}`} className="flex items-center justify-between gap-2 text-[#3D3830]">
                        <span>playbook.{c.playbookId}</span>
                        <span className="uppercase text-[#8B7355]">{c.action}</span>
                      </div>
                    ))}
                    {preview.ruleChanges.map((c, idx) => (
                      <div key={`rule-${idx}`} className="flex items-center justify-between gap-2 text-[#3D3830]">
                        <span>
                          rules.{c.target} ({c.ruleCount} block{c.ruleCount === 1 ? '' : 's'})
                        </span>
                        <span className="uppercase text-[#8B7355]">{c.action}</span>
                      </div>
                    ))}
                    {preview.birthChartChanges.map((c, idx) => (
                      <div key={`bc-${idx}`} className="flex items-center justify-between gap-2 text-[#3D3830]">
                        <span>birthChartConversion.{c.field}</span>
                        <span className="uppercase text-[#8B7355]">{c.action}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatbotEngineImportExportModal;
