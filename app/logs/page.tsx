import Link from "next/link";
import { redirect } from "next/navigation";
import { OperationLogList } from "../../components/operation-log-list";
import { Shell } from "../../components/shell";
import { getOperationLogs } from "../../lib/operation-logs";

type LogsSearchParams = { page?: string; actor?: string };

function logsHref(page: number, actor?: string) {
  const params = new URLSearchParams();
  if (page > 1) params.set("page", String(page));
  if (actor) params.set("actor", actor);
  const query = params.toString();
  return `/logs${query ? `?${query}` : ""}`;
}

function visiblePages(current: number, total: number) {
  const start = Math.max(1, Math.min(current - 2, total - 4));
  const end = Math.min(total, start + 4);
  return Array.from({ length: Math.max(0, end - start + 1) }, (_, index) => start + index);
}

export default async function LogsPage({ searchParams }: Readonly<{ searchParams: Promise<LogsSearchParams> }>) {
  const params = await searchParams;
  const requestedPage = Number.parseInt(params.page ?? "1", 10);
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const actor = params.actor?.trim() || undefined;
  const result = await getOperationLogs({ page, actor });
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));
  if (result.total > 0 && result.page > totalPages) redirect(logsHref(totalPages, actor));
  const shownFrom = result.total === 0 ? 0 : (result.page - 1) * result.pageSize + 1;
  const shownTo = Math.min(result.page * result.pageSize, result.total);

  return <Shell title="库存操作日志">
    <section className="activity-panel operation-log-panel">
      <p className="notice">每次提交只显示为一张操作单；商品明细默认收起，点击后可核对每项操作前、变化和操作后的库存。</p>
      <form className="log-filters operation-log-filters" method="get">
        <label>操作人员
          <select name="actor" defaultValue={actor ?? ""}>
            <option value="">全部人员</option>
            {result.actorNames.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </label>
        <button className="primary" type="submit">筛选</button>
        {actor && <Link className="filter-reset" href="/logs">清除筛选</Link>}
      </form>

      <div className="log-summary">
        <b>共 {result.total} 张操作单</b>
        <span>{result.total ? `当前显示第 ${shownFrom}–${shownTo} 张` : "没有符合条件的操作单"} · 洛杉矶时间</span>
      </div>

      {result.entries.length === 0
        ? <div className="empty-log"><p>暂无符合筛选条件的库存操作。</p><Link href="/logs">查看全部日志</Link></div>
        : <OperationLogList entries={result.entries} />}

      {result.total > result.pageSize && <nav className="pagination" aria-label="操作单分页">
        {result.page > 1 ? <Link href={logsHref(result.page - 1, actor)}>上一页</Link> : <span className="disabled">上一页</span>}
        {visiblePages(result.page, totalPages).map((pageNumber) => <Link key={pageNumber} className={pageNumber === result.page ? "current" : ""} href={logsHref(pageNumber, actor)} aria-current={pageNumber === result.page ? "page" : undefined}>{pageNumber}</Link>)}
        {result.page < totalPages ? <Link href={logsHref(result.page + 1, actor)}>下一页</Link> : <span className="disabled">下一页</span>}
      </nav>}
    </section>
  </Shell>;
}
