import { AddProductForm } from "../../../../components/add-product-form";
import { Shell } from "../../../../components/shell";
import { createSupabaseServerClient } from "../../../../lib/supabase/server";

export default async function NewProductPage() {
  const supabase = await createSupabaseServerClient();
  const { data: ips, error } = await supabase.from("ips").select("id,name,display_name").eq("is_active", true).order("sort_order").order("display_name");
  if (error) throw new Error(`Unable to load IP options: ${error.message}`);
  return <Shell title="新产品"><AddProductForm ips={ips ?? []} /></Shell>;
}
