import { requireRole } from "@/lib/auth";
import { getNotifications } from "@/lib/store";
import { thaiDateFull } from "@/lib/format";
import { CheckCircle2, Info, AlertTriangle, Lock, Upload, BarChart3, FileQuestion } from "lucide-react";
import type { Notification } from "@/lib/types";

export const dynamic = "force-dynamic";

// Figma "การแจ้งเตือน": pick an icon from the message meaning (password / version / carbon /
// incomplete), falling back to the notification kind. Circle tint stays with the semantic colour.
function iconFor(n: Notification) {
  const t = `${n.title} ${n.body}`;
  if (t.includes("รหัสผ่าน")) return { Icon: Lock, cls: "bg-brand-blue-light text-brand-blue" };
  if (t.includes("เวอร์ชัน")) return { Icon: Upload, cls: "bg-brand-blue-light text-brand-blue" };
  if (t.includes("ไม่ครบ") || t.includes("กรอกข้อมูล")) return { Icon: FileQuestion, cls: "bg-brand-yellow-light text-brand-orange" };
  if (/carbon|คาร์บอน/i.test(t) && (t.includes("สูง") || t.includes("เฉลี่ย"))) return { Icon: BarChart3, cls: "bg-brand-yellow-light text-brand-orange" };
  if (n.kind === "success") return { Icon: CheckCircle2, cls: "bg-brand-green-light text-brand-green" };
  if (n.kind === "warning") return { Icon: AlertTriangle, cls: "bg-brand-yellow-light text-brand-orange" };
  return { Icon: Info, cls: "bg-brand-blue-light text-brand-blue" };
}

export default async function NotificationsPage() {
  const user = await requireRole("supplier");
  const notifs = await getNotifications(user.supplierId);

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold text-slate-900">การแจ้งเตือน</h1>

      {notifs.length === 0 ? (
        <p className="py-16 text-center text-sm text-slate-400">ยังไม่มีการแจ้งเตือน</p>
      ) : (
        <div className="divide-y divide-slate-100">
          {notifs.map((n) => {
            const { Icon, cls } = iconFor(n);
            return (
              <div key={n.id} className={`flex items-start gap-5 py-6 ${n.read ? "opacity-55" : ""}`}>
                <span className={`grid size-14 shrink-0 place-items-center rounded-full ${cls}`}>
                  <Icon size={26} strokeWidth={2.2} />
                </span>
                <div className="min-w-0 flex-1 pt-1">
                  <h2 className="text-xl font-bold text-slate-900">{n.title}</h2>
                  <p className="mt-1.5 text-[15px] text-slate-500">{n.body}</p>
                </div>
                <time className="shrink-0 pt-1.5 text-[15px] text-slate-400">{thaiDateFull(n.createdAt)}</time>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
