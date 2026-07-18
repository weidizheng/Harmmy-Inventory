import { Shell } from "../../components/shell";
import { getActivityTimeline } from "../../lib/activity-log";

const formatter = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "America/Los_Angeles",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

export default async function LogsPage() {
  const entries = await getActivityTimeline();
  return <Shell title="日志"><section className="activity-panel"><p className="notice">显示最近 150 条重要操作，时间按洛杉矶时间展示。</p>{entries.length === 0 ? <p>暂无日志。</p> : <div className="activity-list">{entries.map((entry) => <article className="activity-entry" key={entry.id}><span className={`activity-dot ${entry.tone}`} /><div><div className="activity-title"><b>{entry.actorName}</b><span>{entry.actionLabel}</span></div><p>{entry.description}</p>{entry.detail && <small>{entry.detail}</small>}</div><time dateTime={entry.createdAt}>{formatter.format(new Date(entry.createdAt))}</time></article>)}</div>}</section></Shell>;
}
