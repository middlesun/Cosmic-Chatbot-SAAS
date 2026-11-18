import React, { useMemo, useState } from 'react';
import { CheckCircle2, FileSpreadsheet, Upload, AlertCircle } from 'lucide-react';

interface ParsedClientRow {
  email: string;
  full_name?: string;
  credits_grant?: number;
  birth_name?: string;
  birth_date?: string;
  birth_time?: string;
  birth_city?: string;
  birth_country?: string;
  gender?: string;
}

interface ImportResultRow {
  email: string;
  status: 'created' | 'updated' | 'error';
  message: string;
  inviteSent?: boolean;
}

interface ClientBulkImportProps {
  getAccessToken: () => Promise<string | null>;
  onCompleted?: () => void;
}

const SAMPLE_CSV = `email,full_name,credits_grant,birth_name,birth_date,birth_time,birth_city,birth_country,gender
arjun.mehta@example.com,Arjun Mehta,5000,Arjun Mehta,1991-08-19,14:25,Mumbai,India,male
kavya.nair@example.com,Kavya Nair,5000,Kavya Nair,1994-11-04,07:10,Bengaluru,India,female`;

function parseCsvLines(rawText: string): ParsedClientRow[] {
  const lines = rawText
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) return [];

  const splitRow = (line: string) =>
    line.split(',').map((cell) => cell.trim().replace(/^"|"$/g, ''));

  const firstCells = splitRow(lines[0]).map((c) => c.toLowerCase());
  const hasHeader = firstCells.includes('email');

  const headers = hasHeader
    ? firstCells
    : [
        'email',
        'full_name',
        'credits_grant',
        'birth_name',
        'birth_date',
        'birth_time',
        'birth_city',
        'birth_country',
        'gender',
      ];

  const dataLines = hasHeader ? lines.slice(1) : lines;

  return dataLines.map((line) => {
    const vals = splitRow(line);
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      obj[h] = vals[idx] || '';
    });

    return {
      email: obj.email || '',
      full_name: obj.full_name || '',
      credits_grant: Number(obj.credits_grant || obj.credits || 0) || 0,
      birth_name: obj.birth_name || '',
      birth_date: obj.birth_date || '',
      birth_time: obj.birth_time || '',
      birth_city: obj.birth_city || '',
      birth_country: obj.birth_country || '',
      gender: obj.gender || '',
    };
  });
}

const ClientBulkImport: React.FC<ClientBulkImportProps> = ({
  getAccessToken,
  onCompleted,
}) => {
  const [csvText, setCsvText] = useState('');
  const [sendInviteEmails, setSendInviteEmails] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [results, setResults] = useState<ImportResultRow[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const parsedRows = useMemo(() => parseCsvLines(csvText), [csvText]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setCsvText(text);
    setResults([]);
    setErrorMsg(null);
  };

  const handleExecuteImport = async () => {
    if (parsedRows.length === 0) return;
    setIsImporting(true);
    setErrorMsg(null);
    setResults([]);

    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Authentication required');

      const res = await fetch('/api/admin/import-clients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          clients: parsedRows,
          sendInviteEmails,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Import failed');

      setResults(data.results || []);
      onCompleted?.();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Bulk import failed');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-[#FDFBF7] border border-[#3D3830]/12 p-6 space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="font-serif text-2xl font-medium text-[#3D3830]">
              Bulk Legacy Client Onboarding (CSV)
            </h3>
            <p className="mt-1 text-xs text-[#5C5449]">
              Pre-create accounts for 30–50+ existing consultation clients with forced first-login password setup (`must_change_password = true`), starting welcome credits, and optional birth profile pre-population.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                setCsvText(SAMPLE_CSV);
                setResults([]);
              }}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#3D3830]/20 px-4 py-2 text-xs font-medium text-[#3D3830] hover:bg-[#F1ECE3]"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              <span>Load Sample CSV</span>
            </button>

            <label className="inline-flex items-center gap-1.5 rounded-full bg-[#4A453D] px-4 py-2 text-xs font-medium text-[#FAF7F2] hover:bg-[#38342E] cursor-pointer">
              <Upload className="h-3.5 w-3.5" />
              <span>Upload .csv</span>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => void handleFileUpload(e)}
                className="hidden"
              />
            </label>
          </div>
        </div>

        <textarea
          rows={6}
          value={csvText}
          onChange={(e) => {
            setCsvText(e.target.value);
            setResults([]);
          }}
          placeholder="Paste CSV rows: email,full_name,credits_grant,birth_name,birth_date,birth_time,birth_city,birth_country,gender"
          className="w-full rounded-2xl border border-[#3D3830]/15 bg-[#FAF7F2] p-4 text-xs font-['JetBrains_Mono',monospace] text-[#3D3830] focus:outline-none focus:border-[#3D3830]/40"
        />

        <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
          <label className="inline-flex items-center gap-2 text-xs text-[#5C5449]">
            <input
              type="checkbox"
              checked={sendInviteEmails}
              onChange={(e) => setSendInviteEmails(e.target.checked)}
            />
            <span>
              Send onboarding invite emails via Resend with temporary password
            </span>
          </label>

          <button
            type="button"
            disabled={isImporting || parsedRows.length === 0}
            onClick={() => void handleExecuteImport()}
            className="inline-flex items-center gap-2 rounded-full bg-[#4A453D] px-6 py-2.5 text-xs font-medium text-[#FAF7F2] hover:bg-[#38342E] disabled:opacity-45"
          >
            <span>
              {isImporting
                ? 'Importing Clients...'
                : `Import ${parsedRows.length} Client${parsedRows.length === 1 ? '' : 's'}`}
            </span>
          </button>
        </div>

        {errorMsg && (
          <p className="rounded-2xl bg-[#7A3E36]/10 px-4 py-3 text-xs text-[#7A3E36]">
            {errorMsg}
          </p>
        )}
      </div>

      {/* Preview Table */}
      {parsedRows.length > 0 && results.length === 0 && (
        <div className="rounded-3xl bg-[#FDFBF7] border border-[#3D3830]/10 overflow-hidden">
          <div className="px-5 py-3 bg-[#F1ECE3] text-xs font-medium text-[#3D3830]">
            Preview ({parsedRows.length} rows parsed)
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#3D3830]/10 text-[#8B8275]">
                <tr>
                  <th className="px-5 py-2.5 font-medium">Email</th>
                  <th className="px-5 py-2.5 font-medium">Name</th>
                  <th className="px-5 py-2.5 font-medium">Credits</th>
                  <th className="px-5 py-2.5 font-medium">Birth Profile</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#3D3830]/8">
                {parsedRows.slice(0, 20).map((r, i) => (
                  <tr key={i}>
                    <td className="px-5 py-2.5 text-[#3D3830]">{r.email}</td>
                    <td className="px-5 py-2.5 text-[#5C5449]">{r.full_name || '—'}</td>
                    <td className="px-5 py-2.5 font-['JetBrains_Mono',monospace] tabular-nums">
                      {(r.credits_grant || 0).toLocaleString()}
                    </td>
                    <td className="px-5 py-2.5 text-[#5C5449]">
                      {r.birth_date && r.birth_city
                        ? `${r.birth_date} ${r.birth_time} · ${r.birth_city}`
                        : 'Account only'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Results Audit */}
      {results.length > 0 && (
        <div className="rounded-3xl bg-[#FDFBF7] border border-[#3D3830]/12 p-5 space-y-2.5">
          <p className="text-xs font-medium text-[#3D3830]">
            Import Completed ({results.length} processed)
          </p>
          {results.map((r, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between gap-3 rounded-2xl bg-[#FAF7F2] px-4 py-2.5 text-xs"
            >
              <div className="flex items-center gap-2">
                {r.status === 'error' ? (
                  <AlertCircle className="h-3.5 w-3.5 text-[#7A3E36]" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5 text-[#2D6A4F]" />
                )}
                <span className="font-medium text-[#3D3830]">{r.email}</span>
                <span className="text-[#5C5449]">— {r.message}</span>
              </div>
              {r.inviteSent && (
                <span className="text-[11px] font-['JetBrains_Mono',monospace] text-[#8B7355]">
                  Invite Emailed
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ClientBulkImport;
