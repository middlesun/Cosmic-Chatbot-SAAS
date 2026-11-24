import React, { useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronRight,
  GitBranch,
  History,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import {
  computeCompanionFieldDiffs,
  type CompanionVersionRecord,
} from '../../../lib/companionV2Schema';
import type { CompanionV2EditorState } from './companionStudioTypes';

interface CompanionVersionsTabProps {
  editorState: CompanionV2EditorState | null;
  hasUnsavedLocalChanges: boolean;
  changeNote: string;
  setChangeNote: React.Dispatch<React.SetStateAction<string>>;
  publishing: boolean;
  discarding: boolean;
  rollingBackVersion: number | null;
  onPublish: () => void;
  onDiscardDraft: () => void;
  onRollbackToDraft: (version: CompanionVersionRecord) => void;
}

const CompanionVersionsTab: React.FC<CompanionVersionsTabProps> = ({
  editorState,
  hasUnsavedLocalChanges,
  changeNote,
  setChangeNote,
  publishing,
  discarding,
  rollingBackVersion,
  onPublish,
  onDiscardDraft,
  onRollbackToDraft,
}) => {
  const [expandedVersionId, setExpandedVersionId] = useState<string | null>(null);

  if (!editorState) {
    return (
      <div className="rounded-2xl border border-[#3D3830]/12 bg-[#FAF7F2] p-6 text-center text-xs text-[#8B8275]">
        Save this new companion first to track drafts, publish versions, and inspect snapshot history.
      </div>
    );
  }

  const diffs = editorState.draft_diffs || [];
  const versions = editorState.versions || [];

  return (
    <div className="space-y-5">
      {/* Draft vs Published Staging Card */}
      <div className="rounded-2xl border border-[#3D3830]/12 bg-[#FAF7F2] p-4 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <GitBranch className="h-3.5 w-3.5 text-[#8B7355]" />
              <span className="text-xs font-semibold text-[#3D3830]">
                Draft &amp; Publishing Status
              </span>
              <span className="font-mono text-[11px] tabular-nums text-[#8B8275]">
                Live v{editorState.v2_version}
              </span>
              {editorState.has_unpublished_draft && (
                <span className="text-[11px] font-medium text-[#8B7355]">
                  · Server Draft Pending ({diffs.length} {diffs.length === 1 ? 'change' : 'changes'})
                </span>
              )}
            </div>
            <p className="text-[11px] text-[#5C5449]">
              {editorState.last_published_at
                ? `Last published ${new Date(editorState.last_published_at).toLocaleString()}`
                : 'Published baseline active'}
              {editorState.usingFallbackStorage
                ? ' · Pre-022 overlay storage active'
                : ''}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {editorState.has_unpublished_draft && (
              <button
                type="button"
                disabled={discarding || publishing}
                onClick={onDiscardDraft}
                className="inline-flex items-center gap-1.5 rounded-full border border-[#7A3E36]/25 bg-[#FDFBF7] px-3 py-1.5 text-xs font-medium text-[#7A3E36] hover:bg-[#7A3E36]/8 disabled:opacity-50 cursor-pointer whitespace-nowrap"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>{discarding ? 'Discarding...' : 'Discard Draft'}</span>
              </button>
            )}
            <button
              type="button"
              disabled={publishing || discarding}
              onClick={onPublish}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#4A453D] px-4 py-1.5 text-xs font-medium text-[#FAF7F2] hover:bg-[#38342E] disabled:opacity-50 cursor-pointer whitespace-nowrap"
            >
              <Check className="h-3.5 w-3.5" />
              <span>
                {publishing
                  ? 'Publishing...'
                  : hasUnsavedLocalChanges || editorState.has_unpublished_draft
                  ? `Publish Draft as v${editorState.v2_version + 1}`
                  : `Snapshot & Publish v${editorState.v2_version + 1}`}
              </span>
            </button>
          </div>
        </div>

        <label className="block space-y-1">
          <span className="text-[11px] font-medium text-[#5C5449]">
            Version Change Note (Saved in Snapshot History)
          </span>
          <input
            type="text"
            value={changeNote}
            onChange={(e) => setChangeNote(e.target.value)}
            placeholder="e.g. Refined Hinglish cadence and breakup contextual nuance"
            className="w-full rounded-xl border border-[#3D3830]/15 bg-[#FDFBF7] px-3 py-2 text-xs text-[#3D3830] focus:border-[#3D3830]/40 focus:outline-none"
          />
        </label>

        {hasUnsavedLocalChanges && (
          <div className="rounded-xl border border-[#B8965A]/40 bg-[#B8965A]/10 px-3 py-2 text-[11px] text-[#5C5449]">
            You have unsaved edits in the editor. Click <strong>Save Draft</strong> to stage them in the diff below, or click <strong>Publish</strong> to promote them directly live.
          </div>
        )}

        {/* Draft vs Live Diff Table */}
        {diffs.length > 0 ? (
          <div className="space-y-2">
            <p className="text-[11px] font-semibold text-[#3D3830]">
              Server Draft vs. Published v{editorState.v2_version} ({diffs.length} field{diffs.length === 1 ? '' : 's'} changed)
            </p>
            <div className="overflow-x-auto rounded-xl border border-[#3D3830]/12 bg-[#FDFBF7]">
              <table className="w-full text-left text-[11px]">
                <thead className="bg-[#F1ECE3]/70 text-[#8B8275] border-b border-[#3D3830]/10">
                  <tr>
                    <th className="py-2 px-3 font-medium">Field</th>
                    <th className="py-2 px-3 font-medium">Live Published</th>
                    <th className="py-2 px-3 font-medium">Staged Draft</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#3D3830]/8">
                  {diffs.map((d) => (
                    <tr key={d.field}>
                      <td className="py-2 px-3 font-medium text-[#3D3830] whitespace-nowrap align-top">
                        {d.label}
                      </td>
                      <td className="py-2 px-3 text-[#8B8275] align-top break-words max-w-[220px]">
                        {d.before}
                      </td>
                      <td className="py-2 px-3 text-[#2D6A4F] align-top break-words max-w-[220px]">
                        {d.after}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <p className="text-xs text-[#8B8275]">
            Server draft is in sync with live published v{editorState.v2_version}.
          </p>
        )}
      </div>

      {/* Snapshot History & 1-Click Rollback */}
      <div className="rounded-2xl border border-[#3D3830]/12 bg-[#FAF7F2] p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <History className="h-3.5 w-3.5 text-[#8B7355]" />
            <span className="text-xs font-semibold text-[#3D3830]">
              Version History ({versions.length})
            </span>
          </div>
          <span className="text-[11px] text-[#8B8275]">
            Rollback stages snapshot cleanly into Draft for inspection before Publish
          </span>
        </div>

        <div className="space-y-2">
          {versions.map((ver) => {
            const isExpanded = expandedVersionId === ver.id;
            const snapDiffs = computeCompanionFieldDiffs(
              ver.snapshot_json || {},
              editorState.v2_published_json || {}
            );
            const isRolling = rollingBackVersion === ver.version_number;
            return (
              <div
                key={ver.id}
                className="rounded-xl border border-[#3D3830]/12 bg-[#FDFBF7] overflow-hidden"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5">
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedVersionId((cur) => (cur === ver.id ? null : ver.id))
                    }
                    className="flex items-center gap-2 text-left min-w-0 flex-1 cursor-pointer"
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-3.5 w-3.5 text-[#8B8275] shrink-0" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 text-[#8B8275] shrink-0" />
                    )}
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-semibold tabular-nums text-[#3D3830]">
                          v{ver.version_number}
                        </span>
                        <span
                          className={`text-[10px] font-medium ${
                            ver.version_number === editorState.v2_version
                              ? 'text-[#2D6A4F]'
                              : 'text-[#8B8275]'
                          }`}
                        >
                          {ver.version_number === editorState.v2_version
                            ? 'Live Now'
                            : ver.status}
                        </span>
                        <span className="text-xs text-[#5C5449] truncate">
                          {ver.change_note || 'Snapshot'}
                        </span>
                      </div>
                      <p className="text-[10px] text-[#8B8275] mt-0.5">
                        {new Date(ver.created_at).toLocaleString()} ·{' '}
                        {snapDiffs.length === 0
                          ? 'Matches current live version'
                          : `${snapDiffs.length} diff${snapDiffs.length === 1 ? '' : 's'} vs live`}
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    disabled={isRolling || publishing || discarding}
                    onClick={() => onRollbackToDraft(ver)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[#3D3830]/15 bg-[#FAF7F2] px-3 py-1 text-[11px] font-medium text-[#3D3830] hover:bg-[#F1ECE3] disabled:opacity-50 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <RotateCcw className="h-3 w-3 text-[#8B7355]" />
                    <span>{isRolling ? 'Staging...' : 'Restore to Draft'}</span>
                  </button>
                </div>

                {isExpanded && (
                  <div className="border-t border-[#3D3830]/10 bg-[#FAF7F2]/60 p-3 space-y-2">
                    {snapDiffs.length > 0 ? (
                      <div className="space-y-1.5">
                        <p className="text-[11px] font-medium text-[#5C5449]">
                          Differences between v{ver.version_number} snapshot and current live v{editorState.v2_version}:
                        </p>
                        <div className="space-y-1 max-h-48 overflow-y-auto">
                          {snapDiffs.map((sd) => (
                            <div
                              key={sd.field}
                              className="rounded-lg border border-[#3D3830]/10 bg-[#FDFBF7] px-2.5 py-1.5 text-[11px]"
                            >
                              <span className="font-semibold text-[#3D3830]">
                                {sd.label}:{' '}
                              </span>
                              <span className="text-[#5C5449]">v{ver.version_number}: {sd.before}</span>
                              <span className="text-[#8B8275]"> → Live: {sd.after}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-[11px] text-[#8B8275]">
                        This snapshot is identical to the current published configuration.
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default CompanionVersionsTab;
