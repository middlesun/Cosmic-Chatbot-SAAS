import React, { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  Database,
  Download,
  Loader2,
  Upload,
  X,
} from 'lucide-react';
import { useAuth } from './AuthContext';
import {
  PREVIEW_APP_USER,
  PREVIEW_CONVERSATIONS,
  PREVIEW_CUSTOM_PROMPTS,
  PREVIEW_MESSAGES,
  PREVIEW_PROFILES,
} from './previewFixtures';

interface BackupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ParsedBackupSummary {
  rawPayload: Record<string, unknown>;
  fileName: string;
  profilesCount: number;
  promptsCount: number;
  conversationsCount: number;
  hasPreferences: boolean;
}

const BackupModal: React.FC<BackupModalProps> = ({ isOpen, onClose }) => {
  const { isPreviewMode, getAccessToken, refreshUser } = useAuth();
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [parsedBackup, setParsedBackup] = useState<ParsedBackupSummary | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setStatusMessage(null);
    setError(null);
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const triggerJsonDownload = (bundle: unknown, fileName: string) => {
    const blob = new Blob([JSON.stringify(bundle, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleExport = async () => {
    setError(null);
    setStatusMessage(null);
    setExporting(true);
    const today = new Date().toISOString().slice(0, 10);

    try {
      if (isPreviewMode) {
        triggerJsonDownload(
          {
            format: 'cosmic-council-backup-v1',
            exportedAt: new Date().toISOString(),
            preferences: {
              full_name: PREVIEW_APP_USER.full_name,
              currency_pref: PREVIEW_APP_USER.currency_pref,
              default_expert: PREVIEW_APP_USER.default_expert,
              default_output: PREVIEW_APP_USER.default_output,
              default_language: PREVIEW_APP_USER.default_language,
            },
            profiles: PREVIEW_PROFILES,
            customPrompts: PREVIEW_CUSTOM_PROMPTS,
            conversations: PREVIEW_CONVERSATIONS.map((c) => ({
              ...c,
              messages: PREVIEW_MESSAGES[c.id] || [],
            })),
          },
          `cosmic-council-preview-backup-${today}.json`
        );
        setStatusMessage('Sample backup downloaded (.json).');
        return;
      }

      const token = await getAccessToken();
      if (!token) throw new Error('Authentication required.');

      const res = await fetch('/api/app/data/export', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) {
        throw new Error(data?.error || 'Could not export backup data.');
      }

      triggerJsonDownload(data, `cosmic-council-backup-${today}.json`);
      const profileCnt = Array.isArray(data.profiles) ? data.profiles.length : 0;
      const convCnt = Array.isArray(data.conversations) ? data.conversations.length : 0;
      const promptCnt = Array.isArray(data.customPrompts) ? data.customPrompts.length : 0;
      setStatusMessage(
        `Exported ${profileCnt} profile(s), ${convCnt} conversation(s), and ${promptCnt} custom prompt(s).`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed.');
    } finally {
      setExporting(false);
    }
  };

  const handleFileChange = async (file: File) => {
    setError(null);
    setStatusMessage(null);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as Record<string, unknown>;
      if (!parsed || typeof parsed !== 'object') {
        throw new Error('Invalid JSON structure.');
      }
      setParsedBackup({
        rawPayload: parsed,
        fileName: file.name,
        profilesCount: Array.isArray(parsed.profiles) ? parsed.profiles.length : 0,
        promptsCount: Array.isArray(parsed.customPrompts) ? parsed.customPrompts.length : 0,
        conversationsCount: Array.isArray(parsed.conversations)
          ? parsed.conversations.length
          : 0,
        hasPreferences: Boolean(
          parsed.preferences && typeof parsed.preferences === 'object'
        ),
      });
    } catch {
      setParsedBackup(null);
      setError('Could not read backup file. Please upload a valid Cosmic Council .json export.');
    }
  };

  const handleImport = async () => {
    if (!parsedBackup) return;
    setError(null);
    setStatusMessage(null);

    if (isPreviewMode) {
      setError('Preview mode: Sign in to import data into your account.');
      return;
    }

    setImporting(true);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Authentication required.');

      const res = await fetch('/api/app/data/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(parsedBackup.rawPayload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Import failed.');
      }

      await refreshUser();
      setParsedBackup(null);
      setStatusMessage(
        `Imported ${data.importedProfiles || 0} new profile(s) and ${data.importedPrompts || 0} custom prompt(s)${
          data.updatedPreferences ? ', plus preferences' : ''
        }.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to import backup.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#1F2229]/45 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-cc-drawer-in w-full max-w-lg rounded-3xl border border-[#3D3830]/15 bg-[#FAF7F2] shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-6 py-4 bg-[#F1ECE3] border-b border-[#3D3830]/10">
          <div className="flex items-center gap-2.5">
            <Database className="h-5 w-5 text-[#8B7355]" />
            <div>
              <h2 className="font-serif text-2xl font-medium text-[#3D3830]">
                Backup &amp; Data
              </h2>
              <p className="text-[11px] text-[#8B8275]">
                Export or import your profiles, conversations, custom prompts, and preferences
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close backup modal"
            className="p-2 rounded-full text-[#8B8275] hover:text-[#3D3830] hover:bg-[#3D3830]/5 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[80dvh] overflow-y-auto">
          {/* Export Card */}
          <div className="rounded-2xl border border-[#3D3830]/12 bg-[#FDFBF7] p-4 space-y-3">
            <div>
              <h3 className="text-sm font-medium text-[#3D3830]">Export Full Archive</h3>
              <p className="mt-1 text-xs text-[#5C5449] leading-relaxed">
                Download a complete portable JSON archive containing all saved birth profiles, consultation threads, custom prompts, reports, and preferences.
              </p>
            </div>
            <button
              type="button"
              disabled={exporting}
              onClick={() => void handleExport()}
              className="inline-flex items-center gap-2 rounded-full bg-[#4A453D] px-5 py-2.5 text-xs font-medium text-[#FAF7F2] hover:bg-[#38342E] transition-colors disabled:opacity-50"
            >
              {exporting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              <span>{exporting ? 'Preparing Backup...' : 'Export All Data (.json)'}</span>
            </button>
          </div>

          {/* Import Card */}
          <div className="rounded-2xl border border-[#3D3830]/12 bg-[#FDFBF7] p-4 space-y-3">
            <div>
              <h3 className="text-sm font-medium text-[#3D3830]">Import from Backup</h3>
              <p className="mt-1 text-xs text-[#5C5449] leading-relaxed">
                Restore saved birth profiles, custom prompts, and consultation defaults from a previous Cosmic Council `.json` export. Existing duplicates are skipped safely.
              </p>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFileChange(file);
                e.target.value = '';
              }}
            />

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-full border border-[#3D3830]/20 bg-[#FAF7F2] px-4 py-2 text-xs font-medium text-[#3D3830] hover:bg-[#F1ECE3] transition-colors"
              >
                <Upload className="h-3.5 w-3.5" />
                <span>Choose Backup File</span>
              </button>

              {parsedBackup && (
                <button
                  type="button"
                  disabled={importing}
                  onClick={() => void handleImport()}
                  className="inline-flex items-center gap-2 rounded-full bg-[#4A453D] px-4 py-2 text-xs font-medium text-[#FAF7F2] hover:bg-[#38342E] transition-colors disabled:opacity-50"
                >
                  {importing ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  )}
                  <span>{importing ? 'Importing...' : 'Confirm Import'}</span>
                </button>
              )}
            </div>

            {parsedBackup && (
              <div className="rounded-xl border border-[#3D3830]/10 bg-[#FAF7F2] p-3 text-xs text-[#5C5449] space-y-1">
                <p className="font-medium text-[#3D3830] truncate">{parsedBackup.fileName}</p>
                <p className="font-['DM_Sans',sans-serif] text-[11px]">
                  {parsedBackup.profilesCount} profile(s) · {parsedBackup.promptsCount} prompt(s) ·{' '}
                  {parsedBackup.conversationsCount} chat(s) in archive
                </p>
              </div>
            )}
          </div>

          {error && (
            <p className="rounded-xl bg-[#7A3E36]/10 px-3.5 py-2.5 text-xs text-[#7A3E36]">
              {error}
            </p>
          )}

          {statusMessage && (
            <div className="flex items-start gap-2 rounded-xl bg-[#2D6A4F]/10 border border-[#2D6A4F]/20 px-3.5 py-2.5 text-xs text-[#2D6A4F]">
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{statusMessage}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BackupModal;
