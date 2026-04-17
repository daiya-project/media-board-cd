import { getExternalValues } from "@/lib/api/externalService";
import { listManagedWidgets } from "@/lib/api/externalFcService";
import AdminClient from "./_components/AdminClient";

export const dynamic = "force-dynamic";

export default async function FcAdminPage() {
  const [widgets, values] = await Promise.all([
    listManagedWidgets(),
    getExternalValues(),
  ]);
  return (
    <div className="flex flex-col gap-4 p-6 h-full max-w-[1440px] mx-auto">
      <AdminClient widgets={widgets} values={values} />
    </div>
  );
}
