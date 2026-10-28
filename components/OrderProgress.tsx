import { STATUSES, STATUS_LABEL, type Status } from '@/lib/shared';

/** Four-segment progress bar; the segments fill as the order moves along. */
export default function OrderProgress({ status }: { status: Status }) {
  const step = STATUSES.indexOf(status);
  return (
    <div className="oprog" role="img" aria-label={`Order status: ${STATUS_LABEL[status].en}`}>
      <div className="segs">
        {STATUSES.map((s, i) => <i key={s} className={i < step ? 'done' : i === step ? (status === 'served' ? 'done' : 'now') : ''} />)}
      </div>
      <div className="labels">{STATUSES.map((s, i) => <span key={s} className={i === step ? 'cur' : ''}>{STATUS_LABEL[s].en}</span>)}</div>
    </div>
  );
}
