import Link from "next/link";
import { redirect } from "next/navigation";
import { Shell } from "../../components/shell";
import { activityCategories, ActivityCategory, getActivityTimeline } from "../../lib/activity-log";

const formatter = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "America/Los_Angeles",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

type LogsSearchParams = { page?: string; actor?: string; category?: string };

function logsHref(page: number, actor?: string, category?: string) {
  const params = new URLSearchParams();
  if (page > 1) params.set("page", String(page));
  if (actor) params.set("actor", actor);
  if (category) params.set("category", category);
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
  const category = params.category && params.category in activityCategories ? params.category as ActivityCategory : undefined;
  const actor = params.actor?.trim() || undefined;
  const result = await getActivityTimeline({ page, actor, category });
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));
  if (result.total > 0 && result.page > totalPages) redirect(logsHref(totalPages, actor, category));
  const shownFrom = result.total === 0 ? 0 : (result.page - 1) * result.pageSize + 1;
  const shownTo = Math.min(result.page * result.pageSize, result.total);

  return <Shell title="日志">
    <section className="activity-panel">
      <form className="log-filters" method="get">
        <label>功能分类
          <select name="category" defaultValue={category ?? ""}>
            <option value="">全部分类</option>
            {Object.entries(activityCategories).map(([value, option]) => <option key={value} value={value}>{option.label}</option>)}
          </select>
        </label>
        <label>操作人员
          <select name="actor" defaultValue={actor ?? ""}>
            <option value="">全部人员</option>
            {result.actorNames.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </label>
        <button className="primary" type="submit">筛选</button>
        {(actor || category) && <Link className="filter-reset" href="/logs">清除筛选</Link>}
      </form>

      <div className="log-summary">
        <b>共 {result.total} 条记录</b>
        <span>{result.total ? `当前显示第 ${shownFrom}–${shownTo} 条` : "没有符合条件的记录"} · 洛杉矶时间</span>
      </div>

      {result.entries.length === 0 ? <div className="empty-log"><p>暂无符合筛选条件的日志。</p><Link href="/logs">查看全部日志</Link></div> : <div className="activity-list">{result.entries.map((entry) => <article className="activity-entry" key={entry.id}>
        <span className={`activity-dot ${entry.tone}`} />
        <div>
          <div className="activity-title"><b>{entry.actorName}</b><span className="activity-category">{entry.categoryLabel}</span><span>{entry.actionLabel}</span></div>
          <p>{entry.description}</p>
          {entry.detail && <small>{entry.detail}</small>}
        </div>
        <time dateTime={entry.createdAt}>{formatter.format(new Date(entry.createdAt))}</time>
      </article>)}</div>}

      {result.total > result.pageSize && <nav className="pagination" aria-label="日志分页">
        {result.page > 1 ? <Link href={logsHref(result.page - 1, actor, category)}>上一页</Link> : <span className="disabled">上一页</span>}
        {visiblePages(result.page, totalPages).map((pageNumber) => <Link key={pageNumber} className={pageNumber === result.page ? "current" : ""} href={logsHref(pageNumber, actor, category)} aria-current={pageNumber === result.page ? "page" : undefined}>{pageNumber}</Link>)}
        {result.page < totalPages ? <Link href={logsHref(result.page + 1, actor, category)}>下一页</Link> : <span className="disabled">下一页</span>}
      </nav>}
    </section>
  </Shell>;
}
