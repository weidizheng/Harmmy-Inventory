import { OperationForm } from "../../../components/operation-form";
import { Shell } from "../../../components/shell";
import { getCatalogProducts } from "../../../lib/catalog";

export default async function NewOperation({ searchParams }: Readonly<{ searchParams: Promise<{ product?: string }> }>) {
  const [{ product }, products] = await Promise.all([searchParams, getCatalogProducts()]);
  return <Shell title="新建库存操作"><OperationForm products={products} initialProductId={product} /></Shell>;
}
