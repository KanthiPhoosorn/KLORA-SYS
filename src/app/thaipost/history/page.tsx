import { getPrints } from "@/lib/store";
import { Card } from "@/components/ui";
import { thaiDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function PrintHistoryPage() {
  const prints = [...(await getPrints())].sort((a, b) =>
    b.printedAt.localeCompare(a.printedAt),
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">ประวัติการพิมพ์ QR</h1>
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[440px] text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
              <th className="px-5 py-2.5 font-medium">SUP ID</th>
              <th className="px-5 py-2.5 font-medium">ปลายทาง</th>
              <th className="px-5 py-2.5 font-medium">เวลาพิมพ์</th>
            </tr>
          </thead>
          <tbody>
            {prints.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-5 py-8 text-center text-slate-400">
                  ยังไม่มีประวัติการพิมพ์
                </td>
              </tr>
            ) : (
              prints.map((p) => (
                <tr key={p.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-5 py-2.5 font-mono text-xs text-slate-600">{p.supplierId}</td>
                  <td className="px-5 py-2.5 text-slate-700">{p.destination ?? "—"}</td>
                  <td className="px-5 py-2.5 text-slate-600">{thaiDateTime(p.printedAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
