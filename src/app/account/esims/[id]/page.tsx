import { notFound } from "next/navigation";
import { accessibleEsim } from "@/lib/order-access";
import { EsimDetail } from "@/components/account/esim-detail";
export default async function EsimPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const esim = await accessibleEsim(id).catch(() => null);
  if (!esim) notFound();
  return (
    <>
      <h1>Your eSIM, ready to go.</h1>
      <p>{esim.orderItem.name}</p>
      <EsimDetail esim={esim} />
    </>
  );
}
