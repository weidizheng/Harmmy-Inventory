import { Shell } from "../../../../components/shell";

export default function NewProductPage() {
  return <Shell title="Add product"><section className="panel"><h2>Catalog details</h2><div className="form-grid"><label>SKU<input /></label><label>中文商品名（主名）<input /></label><label>English product name（副名）<input /></label><label>Primary IP<select><option>Choose IP</option></select></label><label>Product type<select><option>Other</option></select></label><label>Units per inner<input type="number" /></label><label>Inners per carton<input type="number" /></label></div><p>库存数量不能在此直接编辑；初始库存只能通过正式入库单建立。</p><button className="primary">Save draft</button></section></Shell>;
}
