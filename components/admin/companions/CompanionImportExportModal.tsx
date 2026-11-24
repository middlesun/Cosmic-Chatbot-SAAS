import React, { useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Download,
  FileJson,
  Lock,
  Upload,
  X,
} from 'lucide-react';
import CustomSelect from '../../app/CustomSelect';
import type { CompanionFieldDiff, CoreIdentityProtectedDiff } from '../../../lib/companionV2Schema';

type IoScope = 'single' | 'bulk' | 'global';

interface SinglePreviewResult {
  action: 'create' | 'update' | 'unchanged';
  slug: string;
  name: string;
  diffCount: number;
  diffs: CompanionFieldDiff[];
  coreIdentityLocked: boolean;
  protectedChanges: CoreIdentityProtectedDiff[];
}

interface BulkPreviewItem {
  slug: string;
  name: string;
  action: 'create' | 'update' | 'unchanged' | 'error';
  diffCount: number;
  diffs: CompanionFieldDiff[];
  coreIdentityLocked: boolean;
  protectedChanges: CoreIdentityProtectedDiff[];
  error?: string;
}

interface BulkPreviewResult {
  wouldCreate: number;
  wouldUpdate: number;
  unchanged: number;
  protectedCount: number;
  errorCount: number;
  specializationsIncluded: number;
  items: BulkPreviewItem[];
}

interface GlobalPreviewResult {
  changedKeys: string[];
  diffs: CompanionFieldDiff[];
}

interface CompanionImportExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedSlug: string | null;
  selectedName: string | null;
  getAccessToken: () => Promise<string | null>;
  onImportSuccess: (message: string, targetSlug?: string) => Promise<void>;
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

const CompanionImportExportModal: React.FC<CompanionImportExportModalProps> = ({
  isOpen,
  onClose,
  selectedSlug,
  selectedName,
  getAccessToken,
  onImportSuccess,
}) => {
  const [scope, setScope] = useState<IoScope>(selectedSlug ? 'single' : 'bulk');
  const [exportStage, setExportStage] = useState<'published' | 'draft'>('published');
  const [importMode, setImportMode] = useState<'draft' | 'publish'>('draft');
  const [unlockCore, setUnlockCore] = useState(false);
  const [rawJson, setRawJson] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [singlePreview, setSinglePreview] = useState<SinglePreviewResult | null>(null);
  const [bulkPreview, setBulkPreview] = useState<BulkPreviewResult | null>(null);
  const [globalPreview, setGlobalPreview] = useState<GlobalPreviewResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const clearPreviews = () => {
    setSinglePreview(null);
    setBulkPreview(null);
    setGlobalPreview(null);
  };

  const handleExport = async () => {
    setBusy(true);
    setError(null);
    setStatusMessage(null);
    try {
      const token = await getAccessToken();
      let url = '/api/admin/companions/export/bulk';
      let filename = `cosmic-council-companions-${exportStage}.json`;
      if (scope === 'single') {
        if (!selectedSlug) throw new Error('Select a companion first to export individually.');
        url = `/api/admin/companions/${encodeURIComponent(selectedSlug)}/export?stage=${exportStage}`;
        filename = `companion-${selectedSlug}-${exportStage}.json`;
      } else if (scope === 'bulk') {
        url = `/api/admin/companions/export/bulk?stage=${exportStage}`;
      } else {
        url = '/api/admin/companions/export/global';
        filename = 'cosmic-council-companion-global-config.json';
      }

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to export JSON bundle');
      downloadJsonFile(data, filename);
      setStatusMessage(`Downloaded ${filename}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setBusy(false);
    }
  };

  const handleDownloadTemplate = async (which: 'companion' | 'global') => {
    setBusy(true);
    setError(null);
    try {
      const token = await getAccessToken();
      const res = await fetch('/api/admin/companions/templates', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch blank template');
      if (which === 'companion') {
        downloadJsonFile(data.companionTemplate, 'blank-companion-v2-template.json');
        setStatusMessage('Downloaded blank Companion V2 authoring template.');
      } else {
        downloadJsonFile(data.globalConfigTemplate, 'blank-global-companion-config-v2.json');
        setStatusMessage('Downloaded blank Global Companion Config V2 template.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Template download failed');
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
    clearPreviews();
    try {
      const parsed = parseUploadedJson();
      const token = await getAccessToken();

      if (scope === 'single') {
        const slugOrNew = selectedSlug || '__new__';
        const res = await fetch(
          `/api/admin/companions/${encodeURIComponent(slugOrNew)}/import`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              bundle: parsed,
              mode: importMode,
              dryRun: true,
              unlockCoreIdentity: unlockCore,
            }),
          }
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Dry-run validation failed');
        setSinglePreview(data.preview || null);
      } else if (scope === 'bulk') {
        const res = await fetch('/api/admin/companions/import/bulk', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            bundle: parsed,
            mode: importMode,
            dryRun: true,
            unlockCoreIdentity: unlockCore,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Bulk dry-run validation failed');
        setBulkPreview(data.preview || null);
      } else {
        const res = await fetch('/api/admin/companions/import/global', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ bundle: parsed, dryRun: true }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Global dry-run validation failed');
        setGlobalPreview({
          changedKeys: data.changedKeys || [],
          diffs: data.diffs || [],
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Dry-run check failed');
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

      if (scope === 'single') {
        const slugOrNew = selectedSlug || '__new__';
        const res = await fetch(
          `/api/admin/companions/${encodeURIComponent(slugOrNew)}/import`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              bundle: parsed,
              mode: importMode,
              dryRun: false,
              unlockCoreIdentity: unlockCore,
              confirmCoreIdentityChange: unlockCore,
            }),
          }
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Companion import failed');
        const slugOut = data.companion?.slug || selectedSlug || undefined;
        await onImportSuccess(
          `Imported ${data.companion?.name || 'companion'} as ${
            importMode === 'publish' ? 'published' : 'draft'
          }.`,
          slugOut
        );
        onClose();
      } else if (scope === 'bulk') {
        const res = await fetch('/api/admin/companions/import/bulk', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            bundle: parsed,
            mode: importMode,
            dryRun: false,
            unlockCoreIdentity: unlockCore,
            confirmCoreIdentityChange: unlockCore,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Bulk import failed');
        const skippedCount = Array.isArray(data.skippedProtected)
          ? data.skippedProtected.length
          : 0;
        const msg = `Bulk import complete: ${data.created || 0} created, ${
          data.updated || 0
        } published, ${data.drafted || 0} drafted${
          skippedCount > 0 ? `, ${skippedCount} skipped (Core Locked)` : ''
        }.`;
        await onImportSuccess(msg);
        onClose();
      } else {
        const res = await fetch('/api/admin/companions/import/global', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ bundle: parsed, dryRun: false }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Global config import failed');
        await onImportSuccess('Imported global companion intelligence configuration.');
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1F2229]/50 backdrop-blur-xs p-4">
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl border border-[#3D3830]/18 bg-[#FDFBF7] shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-[#3D3830]/10 bg-[#FAF7F2]">
          <div className="flex items-center gap-2.5">
            <FileJson className="h-4 w-4 text-[#8B7355]" />
            <div>
              <h3 className="font-['Cormorant_Garamond',serif] text-xl font-medium text-[#3D3830]">
                Companion JSON Import &amp; Export Studio
              </h3>
              <p className="text-[11px] text-[#8B8275]">
                Schema-validated bundles with dry-run diff preview &amp; Core Identity Lock protection
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Import/Export Modal"
            className="p-2 rounded-full text-[#5C5449] hover:bg-[#EAE3D7] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Scope Selector */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center gap-1 rounded-2xl bg-[#F1ECE3] p-1">
              {(
                [
                  {
                    key: 'single',
                    label: selectedName ? `Single (${selectedName})` : 'Single Companion',
                  },
                  { key: 'bulk', label: 'Bulk Roster' },
                  { key: 'global', label: 'Global Config' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => {
                    setScope(tab.key);
                    clearPreviews();
                    setError(null);
                    setStatusMessage(null);
                  }}
                  className={`rounded-xl px-3.5 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                    scope === tab.key
                      ? 'bg-[#FDFBF7] text-[#3D3830] shadow-xs'
                      : 'text-[#5C5449] hover:text-[#3D3830]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleDownloadTemplate('companion')}
                className="inline-flex items-center gap-1 rounded-full border border-[#3D3830]/15 bg-[#FAF7F2] px-3 py-1.5 text-[11px] font-medium text-[#5C5449] hover:text-[#3D3830] cursor-pointer"
              >
                <Download className="h-3 w-3" />
                <span>Blank Companion Template</span>
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleDownloadTemplate('global')}
                className="inline-flex items-center gap-1 rounded-full border border-[#3D3830]/15 bg-[#FAF7F2] px-3 py-1.5 text-[11px] font-medium text-[#5C5449] hover:text-[#3D3830] cursor-pointer"
              >
                <Download className="h-3 w-3" />
                <span>Blank Global Template</span>
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded-2xl border border-[#7A3E36]/25 bg-[#7A3E36]/8 px-4 py-3 text-xs text-[#7A3E36]">
              {error}
            </div>
          )}

          {statusMessage && (
            <div className="flex items-center gap-2 rounded-2xl border border-[#2D6A4F]/25 bg-[#2D6A4F]/8 px-4 py-3 text-xs text-[#2D6A4F]">
              <Check className="h-3.5 w-3.5 shrink-0" />
              <span>{statusMessage}</span>
            </div>
          )}

          {/* Export Section */}
          <div className="rounded-2xl border border-[#3D3830]/12 bg-[#FAF7F2] p-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-[#3D3830]">
                Export{' '}
                {scope === 'single'
                  ? selectedName || 'Companion'
                  : scope === 'bulk'
                  ? 'Full Companion Roster'
                  : 'Global Companion Intelligence'}
              </p>
              <p className="text-[11px] text-[#8B8275] mt-0.5">
                Downloads clean JSON v2 bundle including all authored fields &amp; specializations.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {scope !== 'global' && (
                <div className="w-36">
                  <CustomSelect
                    value={exportStage}
                    onChange={(v) => setExportStage(v === 'draft' ? 'draft' : 'published')}
                    ariaLabel="Export stage"
                    surface="elevated"
                    size="sm"
                    options={[
                      { value: 'published', label: 'Published Live' },
                      { value: 'draft', label: 'Staged Draft' },
                    ]}
                  />
                </div>
              )}
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleExport()}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#4A453D] px-4 py-2 text-xs font-medium text-[#FAF7F2] hover:bg-[#38342E] disabled:opacity-50 cursor-pointer whitespace-nowrap"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Download JSON</span>
              </button>
            </div>
          </div>

          {/* Import Section */}
          <div className="rounded-2xl border border-[#3D3830]/12 bg-[#FAF7F2] p-4 space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-semibold text-[#3D3830]">
                  Import JSON Bundle (With Dry-Run Preview)
                </p>
                <p className="text-[11px] text-[#8B8275]">
                  Load a .json file or paste JSON below, inspect diff &amp; lock status, then apply cleanly.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = () => {
                      setRawJson(String(reader.result || ''));
                      clearPreviews();
                      setError(null);
                    };
                    reader.readAsText(file);
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#3D3830]/18 bg-[#FDFBF7] px-3 py-1.5 text-xs font-medium text-[#3D3830] hover:bg-[#F1ECE3] cursor-pointer"
                >
                  <Upload className="h-3.5 w-3.5 text-[#8B7355]" />
                  <span>Load .json File</span>
                </button>
              </div>
            </div>

            <textarea
              rows={8}
              value={rawJson}
              onChange={(e) => {
                setRawJson(e.target.value);
                clearPreviews();
              }}
              placeholder="Paste JSON bundle here..."
              className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FDFBF7] p-3 font-mono text-xs text-[#3D3830] placeholder:text-[#8B8275] focus:border-[#3D3830]/40 focus:outline-none resize-y"
            />

            {scope !== 'global' && (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-[#5C5449]">Target Stage:</span>
                  <div className="w-40">
                    <CustomSelect
                      value={importMode}
                      onChange={(v) => setImportMode(v === 'publish' ? 'publish' : 'draft')}
                      ariaLabel="Import target stage"
                      surface="elevated"
                      size="sm"
                      options={[
                        { value: 'draft', label: 'Save to Draft' },
                        { value: 'publish', label: 'Publish Immediately' },
                      ]}
                    />
                  </div>
                </div>

                <label className="inline-flex items-center gap-2 text-xs text-[#5C5449] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={unlockCore}
                    onChange={(e) => setUnlockCore(e.target.checked)}
                    className="accent-[#4A453D]"
                  />
                  <Lock className="h-3 w-3 text-[#8B7355]" />
                  <span>Allow overwriting Core Identity Protected fields</span>
                </label>
              </div>
            )}

            {/* Dry-Run Preview Display */}
            {singlePreview && (
              <div className="rounded-xl border border-[#3D3830]/15 bg-[#FDFBF7] p-3.5 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-[#3D3830]">
                    Dry-Run Preview: {singlePreview.name} ({singlePreview.slug}) ·{' '}
                    <span className="font-mono uppercase">{singlePreview.action}</span>
                  </span>
                  <span className="font-mono text-[11px] tabular-nums text-[#8B8275]">
                    {singlePreview.diffCount} field changes
                  </span>
                </div>
                {singlePreview.protectedChanges.length > 0 && !unlockCore && (
                  <div className="rounded-lg border border-[#7A3E36]/25 bg-[#7A3E36]/8 px-3 py-2 text-[11px] text-[#7A3E36] flex items-center gap-2">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    <span>
                      Core Lock Warning: modifies{' '}
                      {singlePreview.protectedChanges.map((p) => p.label).join(', ')}. Check &ldquo;Allow overwriting Core Identity Protected fields&rdquo; above to proceed.
                    </span>
                  </div>
                )}
                {singlePreview.diffs.length > 0 && (
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {singlePreview.diffs.map((d) => (
                      <div key={d.field} className="text-[11px] text-[#5C5449]">
                        <strong className="text-[#3D3830]">{d.label}:</strong> {d.before} →{' '}
                        <span className="text-[#2D6A4F]">{d.after}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {bulkPreview && (
              <div className="rounded-xl border border-[#3D3830]/15 bg-[#FDFBF7] p-3.5 space-y-2">
                <div className="flex flex-wrap items-center gap-3 text-xs text-[#3D3830] font-medium">
                  <span>Creates: {bulkPreview.wouldCreate}</span>
                  <span>·</span>
                  <span>Updates: {bulkPreview.wouldUpdate}</span>
                  <span>·</span>
                  <span>Unchanged: {bulkPreview.unchanged}</span>
                  {bulkPreview.protectedCount > 0 && (
                    <>
                      <span>·</span>
                      <span className="text-[#8B7355]">
                        Core-Protected: {bulkPreview.protectedCount}
                      </span>
                    </>
                  )}
                  {bulkPreview.errorCount > 0 && (
                    <>
                      <span>·</span>
                      <span className="text-[#7A3E36]">Errors: {bulkPreview.errorCount}</span>
                    </>
                  )}
                </div>
                <div className="max-h-48 overflow-y-auto divide-y divide-[#3D3830]/8">
                  {bulkPreview.items.map((item, i) => (
                    <div key={`${item.slug}-${i}`} className="py-1.5 text-[11px] flex items-center justify-between gap-2">
                      <span className="font-medium text-[#3D3830] truncate">
                        {item.name} <span className="font-mono text-[#8B8275]">({item.slug})</span>
                      </span>
                      <span className="font-mono text-[10px] shrink-0 text-[#5C5449]">
                        {item.error
                          ? `Error: ${item.error}`
                          : item.action === 'create'
                          ? 'CREATE'
                          : `${item.diffCount} diffs${
                              item.protectedChanges.length > 0 ? ' · CORE LOCKED' : ''
                            }`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {globalPreview && (
              <div className="rounded-xl border border-[#3D3830]/15 bg-[#FDFBF7] p-3.5 space-y-2">
                <p className="text-xs font-semibold text-[#3D3830]">
                  Global Config Dry-Run ({globalPreview.changedKeys.length} keys changed)
                </p>
                {globalPreview.diffs.length === 0 ? (
                  <p className="text-[11px] text-[#8B8275]">No differences from active global configuration.</p>
                ) : (
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {globalPreview.diffs.map((d) => (
                      <div key={d.field} className="text-[11px] text-[#5C5449]">
                        <strong className="text-[#3D3830]">{d.label}:</strong> {d.before} →{' '}
                        <span className="text-[#2D6A4F]">{d.after}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleDryRun()}
                className="rounded-full border border-[#3D3830]/18 bg-[#FDFBF7] px-4 py-2 text-xs font-medium text-[#3D3830] hover:bg-[#F1ECE3] disabled:opacity-50 cursor-pointer"
              >
                {busy ? 'Inspecting...' : 'Validate & Dry-Run Diff'}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleApplyImport()}
                className="rounded-full bg-[#4A453D] px-5 py-2 text-xs font-medium text-[#FAF7F2] hover:bg-[#38342E] disabled:opacity-50 cursor-pointer"
              >
                {busy
                  ? 'Importing...'
                  : scope === 'global'
                  ? 'Apply Global Config'
                  : importMode === 'publish'
                  ? 'Import & Publish'
                  : 'Import to Draft'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CompanionImportExportModal;
