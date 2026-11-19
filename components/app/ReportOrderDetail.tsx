import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  Loader2,
  MessageSquare,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from './AuthContext';

interface StepOutputRecord {
  stepNumber: number;
  title: string;
  content: string;
  completedAt: string;
}

interface ReportOrderFull {
  id: string;
  status: 'queued' | 'processing' | 'generating_pdf' | 'completed' | 'failed';
  progress_step: string | null;
  user_questions: string | null;
  credits_charged: number;
  completed_passes?: number;
  step_outputs_json?: StepOutputRecord[];
  final_markdown?: string | null;
  pdf_url: string | null;
  audio_url: string | null;
  linked_conversation_id: string | null;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

interface ReportMeta {
  id: string;
  name: string;
  category: string;
  short_description: string;
  pass_titles: string[];
}

interface ProfileMeta {
  id: string;
  name: string;
  birth_date: string;
  birth_time: string;
  birth_city: string;
  birth_country: string;
}

const ReportOrderDetail: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const { getAccessToken, refreshUser } = useAuth();

  const [order, setOrder] = useState<ReportOrderFull | null>(null);
  const [reportMeta, setReportMeta] = useState<ReportMeta | null>(null);
  const [profile, setProfile] = useState<ProfileMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOrder = useCallback(async (pollOnly = false) => {
    if (!orderId) return;
    try {
      const token = await getAccessToken();
      if (!token) return;

      const endpoint = pollOnly
        ? `/api/reports/orders/${orderId}?mode=poll`
        : `/api/reports/orders/${orderId}`;

      const res = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Unable to load report order');
      }

      if (pollOnly && data.order?.status === 'completed') {
        await fetchOrder(false);
        return;
      }

      setOrder(data.order);
      setReportMeta(data.reportMeta);
      setProfile(data.profile);

      if (data.order?.status === 'failed') {
        void refreshUser();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to fetch report');
    } finally {
      setIsLoading(false);
    }
  }, [orderId, getAccessToken, refreshUser]);

  useEffect(() => {
    void fetchOrder(false);
  }, [fetchOrder]);

  // Live polling while report sequential passes run in background (lightweight ?mode=poll)
  useEffect(() => {
    if (
      !order ||
      order.status === 'completed' ||
      order.status === 'failed'
    ) {
      return;
    }

    const timer = setInterval(() => {
      void fetchOrder(true);
    }, 3500);

    return () => clearInterval(timer);
  }, [order, fetchOrder]);

  const handleDownloadPdf = async () => {
    if (!order) return;
    setIsDownloadingPdf(true);
    setError(null);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Authentication required');

      const res = await fetch(`/api/reports/orders/${order.id}/pdf`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Could not download PDF');
      }

      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `${(reportMeta?.name || 'cosmic-council-dossier')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'PDF download failed');
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  if (isLoading) {
    return (
      <div className="py-12 text-sm text-[#5C5449]">
        Loading Deep Research Dossier...
      </div>
    );
  }

  if (!order) {
    return (
      <div className="space-y-4">
        <Link
          to="/app/reports"
          className="inline-flex items-center gap-1.5 text-xs text-[#5C5449] hover:text-[#3D3830]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Reports Store</span>
        </Link>
        <p className="text-sm text-[#7A3E36]">
          {error || 'Report order not found.'}
        </p>
      </div>
    );
  }

  const completedPasses =
    typeof order.completed_passes === 'number'
      ? order.completed_passes
      : Array.isArray(order.step_outputs_json)
      ? order.step_outputs_json.length
      : 0;
  const passTitles =
    reportMeta?.pass_titles && reportMeta.pass_titles.length > 0
      ? reportMeta.pass_titles
      : [
          'Pass 1 · Natal Foundations',
          'Pass 2 · KP & Jaimini Synthesis',
          'Pass 3 · Multi-Year Timing',
          'Pass 4 · Strategic Synthesis',
        ];

  return (
    <div className="max-w-4xl space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link
          to="/app/reports"
          className="inline-flex items-center gap-1.5 text-xs text-[#5C5449] hover:text-[#3D3830]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Reports Store</span>
        </Link>

        <span className="text-xs font-['DM_Sans',sans-serif] tabular-nums text-[#8B8275]">
          Order {order.id.slice(0, 8)} · {order.credits_charged.toLocaleString()} Credits
        </span>
      </div>

      {/* Observatory Night Status / Action Banner */}
      <section className="rounded-3xl bg-gradient-to-br from-[#1F2229] to-[#292D36] p-7 md:p-9 text-[#F4EFE6] shadow-[0_24px_60px_-24px_rgba(31,34,41,0.45)] space-y-6">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div>
            <p className="text-xs text-[#B8965A] mb-1.5">
              {reportMeta?.category || 'Deep Research Dossier'}
              {profile ? ` · ${profile.name}` : ''}
            </p>
            <h1 className="font-serif text-3xl md:text-4xl font-medium text-[#F4EFE6]">
              {reportMeta?.name || 'Vedic Research Dossier'}
            </h1>
            {profile && (
              <p className="mt-2 text-xs text-[#F4EFE6]/65">
                {profile.birth_date} {profile.birth_time} · {profile.birth_city},{' '}
                {profile.birth_country}
              </p>
            )}
          </div>

          {order.status === 'completed' && (
            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <button
                type="button"
                disabled={isDownloadingPdf}
                onClick={() => void handleDownloadPdf()}
                className="inline-flex items-center gap-2 rounded-full bg-[#F4EFE6] px-5 py-2.5 text-xs font-medium text-[#1F2229] hover:bg-[#EAE3D7] transition-colors disabled:opacity-50"
              >
                <Download className="h-3.5 w-3.5" />
                <span>{isDownloadingPdf ? 'Preparing PDF...' : 'Download PDF'}</span>
              </button>

              {order.linked_conversation_id && (
                <Link
                  to={`/app/chat/${order.linked_conversation_id}`}
                  className="inline-flex items-center gap-2 rounded-full bg-[#B8965A] px-5 py-2.5 text-xs font-medium text-[#1F2229] hover:opacity-90 transition-opacity"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  <span>Continue in Chat</span>
                </Link>
              )}
            </div>
          )}
        </div>

        {/* Sequential Progress Stepper while running */}
        {order.status !== 'completed' && order.status !== 'failed' && (
          <div className="space-y-4 pt-4 border-t border-[#F4EFE6]/10">
            <div className="flex items-center gap-2.5 text-xs text-[#F4EFE6]">
              <Loader2 className="h-4 w-4 animate-spin text-[#B8965A]" />
              <span>
                {order.progress_step || 'Preparing sequential Council passes...'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {passTitles.map((title, idx) => {
                const isDone = idx < completedPasses;
                const isActive = idx === completedPasses && order.status === 'processing';
                return (
                  <div
                    key={idx}
                    className={`rounded-2xl border p-3.5 text-xs ${
                      isDone
                        ? 'border-[#B8965A]/50 bg-[#B8965A]/10 text-[#F4EFE6]'
                        : isActive
                        ? 'border-[#F4EFE6]/30 bg-[#F4EFE6]/10 text-[#F4EFE6]'
                        : 'border-[#F4EFE6]/10 bg-[#F4EFE6]/5 text-[#F4EFE6]/50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-['DM_Sans',sans-serif] text-[10px]">
                        0{idx + 1}
                      </span>
                      {isDone && <CheckCircle2 className="h-3.5 w-3.5 text-[#B8965A]" />}
                    </div>
                    <p className="leading-snug">{title}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {order.status === 'failed' && (
          <div className="flex items-start gap-3 rounded-2xl bg-[#7A3E36]/25 border border-[#7A3E36]/40 p-4 text-xs text-[#F4EFE6]">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Report Synthesis Failed — Credits Refunded</p>
              <p className="mt-1 text-[#F4EFE6]/80">
                {order.error_message ||
                  'An unexpected interruption occurred. Your charged credits have been refunded automatically.'}
              </p>
            </div>
          </div>
        )}
      </section>

      {error && (
        <div className="rounded-2xl bg-[#7A3E36]/10 border border-[#7A3E36]/20 px-5 py-3 text-xs text-[#7A3E36]">
          {error}
        </div>
      )}

      {order.user_questions && (
        <section className="rounded-3xl bg-[#F1ECE3] border border-[#3D3830]/10 p-6 space-y-1.5">
          <p className="text-[11px] font-medium text-[#8B8275]">
            Your Submitted Questions
          </p>
          <p className="text-sm text-[#3D3830] leading-relaxed whitespace-pre-wrap">
            {order.user_questions}
          </p>
        </section>
      )}

      {/* Completed Dossier Reading View */}
      {order.status === 'completed' && order.final_markdown && (
        <article className="rounded-3xl bg-[#FDFBF7] border border-[#3D3830]/12 p-7 md:p-10 space-y-4">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              h1: ({ children }) => (
                <h2 className="font-['Cormorant_Garamond',serif] text-3xl font-medium text-[#3D3830] pt-3 pb-1 border-b border-[#3D3830]/10">
                  {children}
                </h2>
              ),
              h2: ({ children }) => (
                <h3 className="font-['Cormorant_Garamond',serif] text-2xl font-medium text-[#3D3830] pt-4">
                  {children}
                </h3>
              ),
              h3: ({ children }) => (
                <h4 className="font-['Cormorant_Garamond',serif] text-xl font-medium text-[#3D3830] pt-2">
                  {children}
                </h4>
              ),
              p: ({ children }) => (
                <p className="text-sm text-[#3D3830] leading-[1.78]">{children}</p>
              ),
              ul: ({ children }) => (
                <ul className="list-disc pl-5 space-y-1.5 text-sm text-[#3D3830]">{children}</ul>
              ),
              ol: ({ children }) => (
                <ol className="list-decimal pl-5 space-y-1.5 text-sm text-[#3D3830]">{children}</ol>
              ),
              li: ({ children }) => <li className="leading-[1.7]">{children}</li>,
              strong: ({ children }) => (
                <strong className="font-semibold text-[#3D3830]">{children}</strong>
              ),
              blockquote: ({ children }) => (
                <blockquote className="border-l-2 border-[#B8965A] pl-4 py-1 text-sm text-[#5C5449] italic">
                  {children}
                </blockquote>
              ),
              table: ({ children }) => (
                <div className="overflow-x-auto my-4 rounded-2xl border border-[#3D3830]/12 bg-[#FAF7F2]">
                  <table className="w-full text-xs text-left border-collapse">
                    {children}
                  </table>
                </div>
              ),
              thead: ({ children }) => (
                <thead className="bg-[#F1ECE3] text-[#3D3830]">{children}</thead>
              ),
              th: ({ children }) => (
                <th className="px-4 py-2.5 font-medium border-b border-[#3D3830]/12">
                  {children}
                </th>
              ),
              td: ({ children }) => (
                <td className="px-4 py-2.5 border-b border-[#3D3830]/8 text-[#5C5449]">
                  {children}
                </td>
              ),
            }}
          >
            {order.final_markdown}
          </ReactMarkdown>
        </article>
      )}
    </div>
  );
};

export default ReportOrderDetail;
