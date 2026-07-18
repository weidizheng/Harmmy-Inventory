import { Shell } from "../../../components/shell";
import { getRecentOperations, operationLabel } from "../../../lib/operations";

export default async function OperationsHistory() {
  const operations = await getRecentOperations();
  return <Shell title="操作记录"><section className="panel"><p className="notice">已确认的操作不可直接修改；如有错误，请使用新的盘点或更正操作，所有变动都会保留日志。</p>{operations.length === 0 ? <p>暂无操作记录。</p> : <table><thead><tr><th>单号</th><th>类型／商品</th><th>仓库</th><th>操作人</th><th>时间</th></tr></thead><tbody>{operations.map((operation) => <tr key={operation.id}><td><b>{operation.operation_number}</b><br /><small>{operation.status}</small></td><td>{operationLabel(operation.operation_type)}<br />{operation.stock_operation_items.map((item) => <small className="operation-item" key={`${operation.id}-${item.product?.sku}`}>{item.product?.sku} {item.product?.product_name_zh}：箱 {item.requested_carton_qty} · 端 {item.requested_inner_qty} · 盒 {item.requested_unit_qty}</small>)}</td><td>{operation.warehouse?.name}</td><td>{operation.operator?.display_name ?? "系统"}</td><td>{new Intl.DateTimeFormat("zh-CN", { dateStyle: "short", timeStyle: "short" }).format(new Date(operation.created_at))}</td></tr>)}</tbody></table>}</section></Shell>;
}
