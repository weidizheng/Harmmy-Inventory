import fs from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const root = process.cwd();
const outputDir = path.join(root, "private-import", "output");
const extractedImagesDir = path.join(root, "private-import", "extracted-images");
const sourceCsvPath = path.join(outputDir, "best-sellers-import-ready.csv");
const expectedProductCount = 38;

function parseEnv(text) {
  return Object.fromEntries(text.split(/\r?\n/).flatMap((line) => {
    if (!line || line.trimStart().startsWith("#")) return [];
    const separator = line.indexOf("=");
    return separator < 1 ? [] : [[line.slice(0, separator).trim(), line.slice(separator + 1).trim()]];
  }));
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        value += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        value += character;
      }
      continue;
    }
    if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      row.push(value);
      value = "";
    } else if (character === "\n") {
      row.push(value.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      value = "";
    } else {
      value += character;
    }
  }
  if (value || row.length) {
    row.push(value.replace(/\r$/, ""));
    rows.push(row);
  }
  const [headers, ...data] = rows;
  return data.filter((cells) => cells.some(Boolean)).map((cells) => Object.fromEntries(headers.map((header, index) => [header.replace(/^\uFEFF/, ""), cells[index] ?? ""])));
}

function asNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(`Expected a number, received: ${value}`);
  return number;
}

function slugify(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "other";
}

async function requireValue(env, name) {
  const value = env[name] || process.env[name];
  if (!value) throw new Error(`${name} is missing. Add it to .env.local; never commit or share it.`);
  return value;
}

async function main() {
  const preflightOnly = process.argv.includes("--preflight");
  const verifyBatchId = process.argv.find((argument) => argument.startsWith("--verify-batch="))?.slice("--verify-batch=".length);
  const env = parseEnv(await fs.readFile(path.join(root, ".env.local"), "utf8"));
  const url = await requireValue(env, "NEXT_PUBLIC_SUPABASE_URL");
  const publishableKey = await requireValue(env, "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  const importerEmail = await requireValue(env, "SUPABASE_IMPORTER_EMAIL");
  const importerPassword = await requireValue(env, "SUPABASE_IMPORTER_PASSWORD");
  const rows = parseCsv(await fs.readFile(sourceCsvPath, "utf8"));
  if (rows.length !== expectedProductCount) throw new Error(`Expected ${expectedProductCount} reviewed Best Sellers, found ${rows.length}.`);
  const invalidRows = rows.filter((row) => row.validation_status !== "PASS" || !row.product_name_zh || !row.image_path);
  if (invalidRows.length) throw new Error(`Refusing import: ${invalidRows.length} row(s) are not import-ready.`);

  const supabase = createClient(url, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: login, error: loginError } = await supabase.auth.signInWithPassword({
    email: importerEmail,
    password: importerPassword,
  });
  if (loginError) throw new Error(`Importer login failed: ${loginError.message}`);
  const { data: importer, error: importerError } = await supabase
    .from("staff")
    .select("display_name")
    .eq("auth_user_id", login.user.id)
    .eq("is_active", true)
    .single();
  if (importerError || !importer) throw new Error("Importer account is not an active staff member.");
  if (verifyBatchId) {
    const [products, images, ips, batch, activityLogs] = await Promise.all([
      supabase.from("products").select("id", { count: "exact", head: true }),
      supabase.from("product_images").select("id", { count: "exact", head: true }),
      supabase.from("ips").select("id", { count: "exact", head: true }),
      supabase.from("import_batches").select("status,summary").eq("id", verifyBatchId).single(),
      supabase.from("activity_logs").select("id", { count: "exact", head: true }),
    ]);
    for (const result of [products, images, ips, batch, activityLogs]) if (result.error) throw result.error;
    console.log(JSON.stringify({
      products: products.count,
      product_images: images.count,
      ips: ips.count,
      batch_status: batch.data.status,
      batch_summary: batch.data.summary,
      audit_log_entries: activityLogs.count,
    }));
    return;
  }
  const imageSizes = await Promise.all(rows.map(async (row) => {
    const localImagePath = path.join(extractedImagesDir, row.image_path);
    const imageInfo = await fs.stat(localImagePath);
    if (imageInfo.size > 5 * 1024 * 1024) throw new Error(`${row.sku} image exceeds the 5 MB storage limit.`);
    return imageInfo.size;
  }));
  if (preflightOnly) {
    const [{ error: imageAccessError }, { count: existingProducts, error: productCountError }] = await Promise.all([
      supabase.storage.from("product-images").list("", { limit: 1 }),
      supabase.from("products").select("id", { count: "exact", head: true }),
    ]);
    if (imageAccessError) throw imageAccessError;
    if (productCountError) throw productCountError;
    console.log(JSON.stringify({
      scope: "Best Sellers",
      reviewed_products: rows.length,
      validated_images: imageSizes.length,
      largest_image_bytes: Math.max(...imageSizes),
      private_image_bucket: true,
      existing_remote_products: existingProducts ?? 0,
      authenticated_importer: importer.display_name,
      ready_to_import: true,
    }));
    return;
  }
  const importSummary = { scope: "Best Sellers", source: "best-sellers-import-ready.csv", requested_products: rows.length };
  const { data: batch, error: batchError } = await supabase.from("import_batches")
    .insert({ source_filename: "best-sellers-import-ready.csv", status: "DRAFT", summary: importSummary })
    .select("id").single();
  if (batchError) throw batchError;

  try {
    const ipNames = [...new Set(rows.map((row) => row.ip_name).filter(Boolean))];
    const { data: ips, error: ipError } = await supabase.from("ips")
      .upsert(ipNames.map((name, index) => ({ name, slug: slugify(name), display_name: name, sort_order: index })), { onConflict: "name" })
      .select("id,name");
    if (ipError) throw ipError;
    const ipIds = new Map(ips.map((ip) => [ip.name, ip.id]));

    const products = rows.map((row) => ({
      sku: row.sku,
      product_name_zh: row.product_name_zh,
      product_name_en: row.product_name_en || null,
      primary_ip_id: ipIds.get(row.ip_name) ?? null,
      product_type: row.product_type || "Other",
      units_per_inner: asNumber(row.units_per_inner),
      inners_per_carton: asNumber(row.inners_per_carton),
      quantity_per_carton_source: asNumber(row.quantity_per_carton_source),
      wholesale_price: asNumber(row.wholesale_price),
      retail_price: asNumber(row.retail_price),
      is_pinned: row.is_pinned === "true",
      sort_weight: asNumber(row.sort_weight),
      size_text: row.size_text || null,
      details_raw: row.details_raw || null,
      image_source: row.image_source || null,
      notes: `Source carton quantity: ${row.quantity_per_carton_source}. ${row.details_raw || ""}`.trim(),
    }));
    const { data: importedProducts, error: productError } = await supabase.from("products")
      .upsert(products, { onConflict: "sku" }).select("id,sku");
    if (productError) throw productError;
    const productIds = new Map(importedProducts.map((product) => [product.sku, product.id]));

    const imageRecords = [];
    for (const row of rows) {
      const localImagePath = path.join(extractedImagesDir, row.image_path);
      const image = await fs.readFile(localImagePath);
      const { error: uploadError } = await supabase.storage.from("product-images")
        .upload(row.image_path, image, { contentType: "image/webp", upsert: true });
      if (uploadError) throw uploadError;
      imageRecords.push({ product_id: productIds.get(row.sku), storage_path: row.image_path, is_primary: true, sort_order: 0, image_type: "product", is_active: true });
    }
    const { error: imageError } = await supabase.from("product_images")
      .upsert(imageRecords, { onConflict: "storage_path" });
    if (imageError) throw imageError;

    const { error: itemError } = await supabase.from("import_batch_items").insert(rows.map((row, index) => ({
      import_batch_id: batch.id,
      source_row: index + 2,
      normalized_data: row,
      validation_status: "PASS",
      product_id: productIds.get(row.sku),
    })));
    if (itemError) throw itemError;
    const { error: completeError } = await supabase.from("import_batches")
      .update({ status: "IMPORTED", summary: { ...importSummary, imported_products: products.length, uploaded_images: imageRecords.length } })
      .eq("id", batch.id);
    if (completeError) throw completeError;
    console.log(JSON.stringify({ batch_id: batch.id, imported_products: products.length, uploaded_images: imageRecords.length }));
  } catch (error) {
    await supabase.from("import_batches").update({ status: "REJECTED", summary: { ...importSummary, error: error instanceof Error ? error.message : String(error) } }).eq("id", batch.id);
    throw error;
  }
}

await main();
