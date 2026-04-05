type TopBarProps = {
  score?: number;
  trialLabel?: string;
  roleLabel?: string;
};

export function TopBar({ score, trialLabel, roleLabel }: TopBarProps) {
  return (
    <div className="top-bar">
      <div>
        <span className="eyebrow">Points</span>
        <strong>{score ?? 0}</strong>
      </div>
      <div>
        <span className="eyebrow">Trial</span>
        <strong>{trialLabel ?? "Setup"}</strong>
      </div>
      <div>
        <span className="eyebrow">Role</span>
        <strong>{roleLabel ?? "Participant"}</strong>
      </div>
    </div>
  );
}
