import React, { useState } from 'react';
import { Check, Coins, MapPin, Search, ShieldAlert, ShieldCheck } from 'lucide-react';

export interface AdminUserRow {
  id: string;
  email: string;
  full_name: string | null;
  tier: 'personal' | 'pro' | 'guru';
  credits_balance: number;
  account_status: 'active' | 'suspended';
  is_admin: boolean;
  location_country: string | null;
  location_city: string | null;
  last_active_at: string | null;
  created_at: string;
  profile_count: number;
  activated_profile_count: number;
  conversation_count: number;
}

interface UserAnalyticsProps {
  users: AdminUserRow[];
  searchQuery: string;
  onSearchChange: (q: string) => void;
  getAccessToken: () => Promise<string | null>;
  onUserUpdated: (user: AdminUserRow) => void;
}

const UserAnalytics: React.FC<UserAnalyticsProps> = ({
  users,
  searchQuery,
  onSearchChange,
  getAccessToken,
  onUserUpdated,
}) => {
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [creditDelta, setCreditDelta] = useState<string>('5000');
  const [adjustmentNote, setAdjustmentNote] = useState<string>('Admin courtesy credit adjustment');
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const patchUser = async (
    userId: string,
    payload: Record<string, unknown>,
    successMsg: string
  ) => {
    setBusyUserId(userId);
    setFeedback(null);
    try {
      const token = await getAccessToken();
      if (!token) return;
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Update failed');

      const existing = users.find((u) => u.id === userId);
      if (existing && data.user) {
        onUserUpdated({
          ...existing,
          ...data.user,
        });
      }
      setFeedback(successMsg);
      setEditingUserId(null);
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Failed to update user');
    } finally {
      setBusyUserId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="h-4 w-4 text-[#8B8275] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Filter users by email or name..."
            className="w-full rounded-2xl border border-[#3D3830]/15 bg-[#FDFBF7] pl-10 pr-4 py-2.5 text-xs text-[#3D3830] placeholder:text-[#8B8275] focus:outline-none focus:border-[#3D3830]/40"
          />
        </div>

        <span className="text-xs font-['JetBrains_Mono',monospace] tabular-nums text-[#8B8275]">
          {users.length} member accounts shown
        </span>
      </div>

      {feedback && (
        <div className="flex items-center gap-2 rounded-2xl bg-[#F1ECE3] border border-[#3D3830]/12 px-4 py-2.5 text-xs text-[#3D3830]">
          <Check className="h-3.5 w-3.5 text-[#2D6A4F]" />
          <span>{feedback}</span>
        </div>
      )}

      <div className="rounded-3xl bg-[#FDFBF7] border border-[#3D3830]/12 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F1ECE3] text-[#5C5449] border-b border-[#3D3830]/10">
              <tr>
                <th className="px-5 py-3.5 font-medium">Member</th>
                <th className="px-5 py-3.5 font-medium">Location</th>
                <th className="px-5 py-3.5 font-medium">Tier</th>
                <th className="px-5 py-3.5 font-medium text-right">Credits</th>
                <th className="px-5 py-3.5 font-medium text-right">Profiles / Chats</th>
                <th className="px-5 py-3.5 font-medium">Status</th>
                <th className="px-5 py-3.5 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#3D3830]/8">
              {users.map((u) => (
                <React.Fragment key={u.id}>
                  <tr className="hover:bg-[#FAF7F2]/60">
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-[#3D3830]">
                        {u.full_name || 'Seeker'}
                        {u.is_admin && (
                          <span className="ml-2 text-[10px] font-['JetBrains_Mono',monospace] text-[#8B7355]">
                            [ADMIN]
                          </span>
                        )}
                      </p>
                      <p className="text-[11px] text-[#8B8275]">{u.email}</p>
                    </td>

                    <td className="px-5 py-3.5 text-[#5C5449] whitespace-nowrap">
                      {u.location_city || u.location_country ? (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-[#8B8275]" />
                          {[u.location_city, u.location_country].filter(Boolean).join(', ')}
                        </span>
                      ) : (
                        <span className="text-[#8B8275]">—</span>
                      )}
                    </td>

                    <td className="px-5 py-3.5">
                      <select
                        value={u.tier}
                        disabled={busyUserId === u.id}
                        onChange={(e) =>
                          void patchUser(
                            u.id,
                            { tier: e.target.value },
                            `Updated ${u.email} to ${e.target.value} tier.`
                          )
                        }
                        aria-label={`Change tier for ${u.email}`}
                        className="rounded-lg border border-[#3D3830]/15 bg-[#FAF7F2] px-2 py-1 text-xs capitalize text-[#3D3830]"
                      >
                        <option value="personal">Personal</option>
                        <option value="pro">Pro</option>
                        <option value="guru">Guru</option>
                      </select>
                    </td>

                    <td className="px-5 py-3.5 text-right font-['JetBrains_Mono',monospace] tabular-nums font-medium text-[#3D3830]">
                      {u.credits_balance.toLocaleString()}
                    </td>

                    <td className="px-5 py-3.5 text-right font-['JetBrains_Mono',monospace] tabular-nums text-[#5C5449]">
                      {u.activated_profile_count}/{u.profile_count} · {u.conversation_count} chats
                    </td>

                    <td className="px-5 py-3.5">
                      <button
                        type="button"
                        disabled={busyUserId === u.id}
                        onClick={() =>
                          void patchUser(
                            u.id,
                            {
                              account_status:
                                u.account_status === 'active' ? 'suspended' : 'active',
                            },
                            `${u.email} status set to ${
                              u.account_status === 'active' ? 'suspended' : 'active'
                            }.`
                          )
                        }
                        className={`inline-flex items-center gap-1 text-xs font-medium ${
                          u.account_status === 'active'
                            ? 'text-[#2D6A4F]'
                            : 'text-[#7A3E36]'
                        }`}
                      >
                        {u.account_status === 'active' ? (
                          <ShieldCheck className="h-3.5 w-3.5" />
                        ) : (
                          <ShieldAlert className="h-3.5 w-3.5" />
                        )}
                        <span className="capitalize">{u.account_status}</span>
                      </button>
                    </td>

                    <td className="px-5 py-3.5 text-right">
                      <button
                        type="button"
                        onClick={() =>
                          setEditingUserId((prev) => (prev === u.id ? null : u.id))
                        }
                        className="inline-flex items-center gap-1 rounded-full border border-[#3D3830]/20 px-3 py-1 text-[11px] font-medium text-[#3D3830] hover:bg-[#F1ECE3]"
                      >
                        <Coins className="h-3 w-3" />
                        <span>Adjust Credits</span>
                      </button>
                    </td>
                  </tr>

                  {editingUserId === u.id && (
                    <tr className="bg-[#F1ECE3]/65">
                      <td colSpan={7} className="px-5 py-4">
                        <div className="flex flex-wrap items-center gap-3">
                          <input
                            type="number"
                            value={creditDelta}
                            onChange={(e) => setCreditDelta(e.target.value)}
                            placeholder="+5000 or -1000"
                            className="w-36 rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3 py-1.5 text-xs font-['JetBrains_Mono',monospace] text-[#3D3830]"
                          />
                          <input
                            type="text"
                            value={adjustmentNote}
                            onChange={(e) => setAdjustmentNote(e.target.value)}
                            placeholder="Ledger description"
                            className="flex-1 min-w-[200px] rounded-xl border border-[#3D3830]/15 bg-[#FAF7F2] px-3 py-1.5 text-xs text-[#3D3830]"
                          />
                          <button
                            type="button"
                            disabled={busyUserId === u.id}
                            onClick={() =>
                              void patchUser(
                                u.id,
                                {
                                  creditAdjustment: Number(creditDelta),
                                  adjustmentNote,
                                },
                                `Adjusted ${u.email} by ${Number(creditDelta).toLocaleString()} credits.`
                              )
                            }
                            className="rounded-full bg-[#4A453D] px-4 py-1.5 text-xs font-medium text-[#FAF7F2] hover:bg-[#38342E]"
                          >
                            Apply Credit Delta
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingUserId(null)}
                            className="text-xs text-[#8B8275] hover:text-[#3D3830]"
                          >
                            Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default UserAnalytics;
