import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Check,
  LifeBuoy,
  Mail,
  RefreshCw,
  Save,
  Search,
  Send,
} from 'lucide-react';
import CustomSelect from '../app/CustomSelect';

interface SupportTicketRow {
  id: string;
  user_id: string | null;
  from_name: string;
  from_email: string;
  category: string;
  subject: string;
  message: string;
  status: 'open' | 'in_progress' | 'resolved';
  priority: 'low' | 'normal' | 'high';
  admin_notes: string | null;
  admin_reply_text: string | null;
  replied_at: string | null;
  created_at: string;
  user_tier?: string | null;
  user_credits_balance?: number | null;
}

interface AdminSupportDeskProps {
  getAccessToken: () => Promise<string | null>;
}

const AdminSupportDesk: React.FC<AdminSupportDeskProps> = ({ getAccessToken }) => {
  const [tickets, setTickets] = useState<SupportTicketRow[]>([]);
  const [tableMissing, setTableMissing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [draftStatus, setDraftStatus] = useState<'open' | 'in_progress' | 'resolved'>('open');
  const [draftPriority, setDraftPriority] = useState<'low' | 'normal' | 'high'>('normal');
  const [draftNotes, setDraftNotes] = useState('');
  const [replyText, setReplyText] = useState('');
  const [markResolvedOnReply, setMarkResolvedOnReply] = useState(true);

  const [savingMeta, setSavingMeta] = useState(false);
  const [sendingReply, setSendingReply] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadTickets = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getAccessToken();
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (searchQuery.trim()) params.set('q', searchQuery.trim());
      const res = await fetch(`/api/admin/support?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load support tickets');

      setTableMissing(Boolean(data.tableMissing));
      const rows = (data.tickets || []) as SupportTicketRow[];
      setTickets(rows);
      if (rows.length > 0 && (!selectedId || !rows.some((r) => r.id === selectedId))) {
        setSelectedId(rows[0].id);
      } else if (rows.length === 0) {
        setSelectedId(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to fetch support tickets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadTickets();
  }, [statusFilter]);

  const selectedTicket = useMemo(
    () => tickets.find((t) => t.id === selectedId) || null,
    [tickets, selectedId]
  );

  useEffect(() => {
    if (!selectedTicket) return;
    setDraftStatus(selectedTicket.status);
    setDraftPriority(selectedTicket.priority);
    setDraftNotes(selectedTicket.admin_notes || '');
    setReplyText('');
    setFeedback(null);
    setError(null);
  }, [selectedTicket?.id]);

  const handleSaveMeta = async () => {
    if (!selectedTicket) return;
    setSavingMeta(true);
    setError(null);
    setFeedback(null);
    try {
      const token = await getAccessToken();
      const res = await fetch(`/api/admin/support/${selectedTicket.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          status: draftStatus,
          priority: draftPriority,
          admin_notes: draftNotes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update ticket');
      setTickets((prev) =>
        prev.map((t) => (t.id === selectedTicket.id ? { ...t, ...data.ticket } : t))
      );
      setFeedback('Ticket status and notes saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setSavingMeta(false);
    }
  };

  const handleSendReply = async () => {
    if (!selectedTicket || !replyText.trim()) return;
    setSendingReply(true);
    setError(null);
    setFeedback(null);
    try {
      const token = await getAccessToken();
      const res = await fetch(`/api/admin/support/${selectedTicket.id}/reply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          replyText: replyText.trim(),
          markResolved: markResolvedOnReply,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send reply');

      setTickets((prev) =>
        prev.map((t) => (t.id === selectedTicket.id ? { ...t, ...data.ticket } : t))
      );
      setDraftStatus(data.ticket.status);
      setReplyText('');
      setFeedback(
        data.emailSent
          ? `Reply emailed to ${selectedTicket.from_email} and saved to ticket.`
          : `Reply saved to ticket (email not delivered: ${data.emailReason || 'Resend not configured'}).`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reply failed');
    } finally {
      setSendingReply(false);
    }
  };

  const statusTone = (status: SupportTicketRow['status']) => {
    if (status === 'resolved') return 'text-[#2D6A4F] bg-[#2D6A4F]/10 border-[#2D6A4F]/20';
    if (status === 'in_progress') return 'text-[#8B7355] bg-[#B8965A]/15 border-[#B8965A]/30';
    return 'text-[#7A3E36] bg-[#7A3E36]/10 border-[#7A3E36]/20';
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-serif text-2xl font-medium text-[#3D3830]">Support</h2>
          <p className="mt-1 text-xs text-[#5C5449]">
            Review member support tickets, add internal notes, and send direct email replies via Resend.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadTickets()}
          className="inline-flex items-center gap-1.5 rounded-full border border-[#3D3830]/15 bg-[#FDFBF7] px-3.5 py-2 text-xs font-medium text-[#3D3830] hover:bg-[#F1ECE3] transition-colors cursor-pointer"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>

      {tableMissing && (
        <div className="rounded-2xl border border-[#B8965A]/40 bg-[#B8965A]/12 px-4 py-3 text-xs text-[#3D3830] flex items-start gap-2.5">
          <AlertCircle className="h-4 w-4 text-[#8B7355] shrink-0 mt-0.5" />
          <div>
            <strong>Database migration pending:</strong> Run{' '}
            <code className="font-mono text-[11px] bg-[#FAF7F2] px-1.5 py-0.5 rounded">
              supabase/migrations/004_admin_console_and_recipes.sql
            </code>{' '}
            in your Supabase SQL Editor so incoming Support inquiries are stored in this inbox.
          </div>
        </div>
      )}

      {/* Filter & Search Row */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#FDFBF7] border border-[#3D3830]/10 p-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { id: 'all', label: 'All Tickets' },
            { id: 'open', label: 'Open' },
            { id: 'in_progress', label: 'In Progress' },
            { id: 'resolved', label: 'Resolved' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                statusFilter === tab.id
                  ? 'bg-[#4A453D] text-[#FAF7F2]'
                  : 'text-[#5C5449] hover:bg-[#EAE3D7]/70'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void loadTickets();
          }}
          className="relative flex items-center gap-2 w-full sm:w-72"
        >
          <Search className="h-3.5 w-3.5 text-[#8B8275] absolute left-3 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search email, subject, message..."
            className="w-full rounded-full border border-[#3D3830]/15 bg-[#FAF7F2] pl-9 pr-3 py-1.5 text-xs text-[#3D3830] placeholder:text-[#8B8275] focus:outline-none focus:border-[#3D3830]/35"
          />
        </form>
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

      {loading ? (
        <div className="rounded-3xl bg-[#FDFBF7] border border-[#3D3830]/10 p-10 text-center text-sm text-[#8B8275]">
          Loading support tickets...
        </div>
      ) : tickets.length === 0 ? (
        <div className="rounded-3xl bg-[#FDFBF7] border border-[#3D3830]/10 p-12 text-center space-y-2">
          <LifeBuoy className="h-7 w-7 mx-auto text-[#8B8275]" />
          <p className="text-sm font-medium text-[#3D3830]">No support tickets found</p>
          <p className="text-xs text-[#8B8275]">
            Messages submitted via the user Support modal will automatically appear here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-5 items-start">
          {/* Ticket List */}
          <div className="rounded-3xl bg-[#FDFBF7] border border-[#3D3830]/12 overflow-hidden divide-y divide-[#3D3830]/8 max-h-[680px] overflow-y-auto">
            {tickets.map((ticket) => {
              const active = ticket.id === selectedId;
              return (
                <button
                  key={ticket.id}
                  type="button"
                  onClick={() => setSelectedId(ticket.id)}
                  className={`w-full text-left p-4 transition-colors cursor-pointer ${
                    active ? 'bg-[#EAE3D7]/65' : 'hover:bg-[#FAF7F2]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize ${statusTone(
                        ticket.status
                      )}`}
                    >
                      {ticket.status.replace('_', ' ')}
                    </span>
                    <span className="font-mono text-[10px] text-[#8B8275]">
                      {new Date(ticket.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="mt-2 text-xs font-semibold text-[#3D3830] line-clamp-1">
                    {ticket.subject}
                  </p>
                  <p className="mt-0.5 text-[11px] text-[#5C5449] truncate">
                    {ticket.from_name} · {ticket.from_email}
                  </p>
                  <p className="mt-1 text-[11px] text-[#8B8275] line-clamp-2">{ticket.message}</p>
                </button>
              );
            })}
          </div>

          {/* Ticket Detail & Reply Pane */}
          {selectedTicket && (
            <div className="rounded-3xl bg-[#FDFBF7] border border-[#3D3830]/12 p-5 sm:p-6 space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#3D3830]/10 pb-4">
                <div>
                  <span className="text-[11px] font-medium uppercase tracking-wider text-[#8B7355]">
                    {selectedTicket.category}
                  </span>
                  <h3 className="mt-1 font-serif text-xl font-medium text-[#3D3830]">
                    {selectedTicket.subject}
                  </h3>
                  <p className="mt-1 text-xs text-[#5C5449]">
                    From <strong>{selectedTicket.from_name}</strong> ({selectedTicket.from_email})
                    {selectedTicket.user_tier && (
                      <>
                        {' · '}
                        <span className="capitalize">{selectedTicket.user_tier} plan</span>
                        {typeof selectedTicket.user_credits_balance === 'number' && (
                          <span className="font-mono tabular-nums">
                            {' '}
                            · {selectedTicket.user_credits_balance.toLocaleString()} cr
                          </span>
                        )}
                      </>
                    )}
                  </p>
                </div>
                <div className="font-mono text-[11px] text-[#8B8275]">
                  {new Date(selectedTicket.created_at).toLocaleString()}
                </div>
              </div>

              {/* Member Message */}
              <div className="rounded-2xl bg-[#FAF7F2] border border-[#3D3830]/10 p-4 text-sm text-[#3D3830] whitespace-pre-wrap leading-relaxed">
                {selectedTicket.message}
              </div>

              {/* Status / Priority / Internal Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-[#5C5449] mb-1">
                    Ticket Status
                  </label>
                  <CustomSelect
                    value={draftStatus}
                    onChange={(val) => setDraftStatus(val as 'open' | 'in_progress' | 'resolved')}
                    options={[
                      { value: 'open', label: 'Open' },
                      { value: 'in_progress', label: 'In Progress' },
                      { value: 'resolved', label: 'Resolved' },
                    ]}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[#5C5449] mb-1">
                    Priority
                  </label>
                  <CustomSelect
                    value={draftPriority}
                    onChange={(val) => setDraftPriority(val as 'low' | 'normal' | 'high')}
                    options={[
                      { value: 'low', label: 'Low' },
                      { value: 'normal', label: 'Normal' },
                      { value: 'high', label: 'High' },
                    ]}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-medium text-[#5C5449]">
                    Internal Admin Notes (private)
                  </label>
                  <button
                    type="button"
                    disabled={savingMeta}
                    onClick={handleSaveMeta}
                    className="inline-flex items-center gap-1 rounded-full border border-[#3D3830]/15 bg-[#FAF7F2] px-3 py-1 text-[11px] font-medium text-[#3D3830] hover:bg-[#EAE3D7]/70 cursor-pointer"
                  >
                    <Save className="h-3 w-3" />
                    {savingMeta ? 'Saving...' : 'Save Status & Notes'}
                  </button>
                </div>
                <textarea
                  rows={2}
                  value={draftNotes}
                  onChange={(e) => setDraftNotes(e.target.value)}
                  placeholder="Add private triage notes for your team..."
                  className="w-full rounded-2xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3.5 py-2.5 text-xs text-[#3D3830]"
                />
              </div>

              {selectedTicket.admin_reply_text && (
                <div className="rounded-2xl border border-[#2D6A4F]/20 bg-[#2D6A4F]/6 p-4 space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-[#2D6A4F]">
                    <span className="font-medium inline-flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5" />
                      Last Admin Reply Sent
                    </span>
                    {selectedTicket.replied_at && (
                      <span className="font-mono text-[10px]">
                        {new Date(selectedTicket.replied_at).toLocaleString()}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#3D3830] whitespace-pre-wrap leading-relaxed">
                    {selectedTicket.admin_reply_text}
                  </p>
                </div>
              )}

              {/* Direct Email Reply */}
              <div className="border-t border-[#3D3830]/10 pt-4 space-y-3">
                <label className="block text-xs font-semibold text-[#3D3830]">
                  Reply to {selectedTicket.from_email}
                </label>
                <textarea
                  rows={4}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Write a calm, helpful response to the member..."
                  className="w-full rounded-2xl border border-[#3D3830]/15 bg-[#FAF7F2] px-4 py-3 text-xs text-[#3D3830] leading-relaxed"
                />
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <label className="inline-flex items-center gap-2 text-xs text-[#5C5449] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={markResolvedOnReply}
                      onChange={(e) => setMarkResolvedOnReply(e.target.checked)}
                      className="accent-[#4A453D]"
                    />
                    Mark ticket as Resolved after sending
                  </label>
                  <button
                    type="button"
                    disabled={sendingReply || !replyText.trim()}
                    onClick={handleSendReply}
                    className="inline-flex items-center gap-1.5 rounded-full bg-[#4A453D] px-5 py-2 text-xs font-medium text-[#FAF7F2] hover:bg-[#38342E] disabled:opacity-50 transition-colors cursor-pointer"
                  >
                    <Send className="h-3.5 w-3.5" />
                    {sendingReply ? 'Sending...' : 'Send Email Reply'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminSupportDesk;
