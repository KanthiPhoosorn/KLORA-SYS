import { requireRole } from "@/lib/auth";
import { getNotifications } from "@/lib/store";
import { Card } from "@/components/ui";
import { thaiDateTime } from "@/lib/format";
import { CheckCircle2, Info, AlertTriangle } from "lucide-react";

export const dynamic = "force-dynamic";

const ICON = {
  success: { Icon: CheckCircle2, cls: "bg-brand-green-light text-brand-green" },
  info: { Icon: Info, cls: "bg-brand-blue-light text-brand-blue" },
  warning: { Icon: AlertTriangle, cls: "bg-brand-yellow-light text-brand-orange" },
} as const;

export default async function NotificationsPage() {
  const user = await requireRole("supplier");
  const notifs = await getNotifications(user.supplierId);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">การแจ้งเตือน</h1>
      <Card className="divide-y divide-slate-100">
        {notifs.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-400">ยังไม่มีการแจ้งเตือน</p>
        ) : notifs.map((n) => {
          const { Icon, cls } = ICON[n.kind];
          return (
            <div key={n.id} className={`flex gap-3 px-5 py-4 ${n.read ? "opacity-60" : ""}`}>
              <span className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl ${cls}`}><Icon size={18} /></span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-800">{n.title}</span>
                  {!n.read ? <span className="h-2 w-2 rounded-full bg-brand-pink" /> : null}
                </div>
                <p className="mt-0.5 text-sm text-slate-500">{n.body}</p>
                <p className="mt-1 text-xs text-slate-400">{thaiDateTime(n.createdAt)}</p>
              </div>
            </div>
          );
        })}
      </Card>
    </div>
  );
}
