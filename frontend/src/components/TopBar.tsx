type TopBarProps = {
  score?: number;
  trialLabel?: string;
  roleLabel?: string;
};

export function TopBar({ score, trialLabel, roleLabel }: TopBarProps) {
  return (
    <div className="top-bar">
      <span className="top-bar-item">Points: <strong>{score ?? 0}</strong></span>
      <span className="top-bar-item">Trial: <strong>{trialLabel ?? "—"}</strong></span>
      <span className="top-bar-item">Role: <strong>{roleLabel ?? "—"}</strong></span>
    </div>
  );
}
