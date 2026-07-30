import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getSupplier, getBatchesBySupplier } from "@/lib/store";
import SupTopBar from "@/components/SupTopBar";

export const dynamic = "force-dynamic";

export default async function SupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const supplier = await getSupplier(user.supplierId);
  if (!supplier) notFound();

  // Dropdown options grow from the farm's own past entries.
  const batches = await getBatchesBySupplier(user.supplierId);
  const varietyOptions = Array.from(
    new Set(batches.map((b) => b.variety).filter((v): v is string => !!v)),
  );
  const basketOptions = Array.from(
    new Set(batches.flatMap((b) => b.basketIds ?? [])),
  );

  return (
    <div className="min-h-screen">
      <SupTopBar
        supplier={supplier}
        varietyOptions={varietyOptions}
        basketOptions={basketOptions}
      />
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
