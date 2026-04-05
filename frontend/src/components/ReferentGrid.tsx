import type { MouseEvent } from "react";

import { formatModifierLabel, playAudio, referentById } from "../lib/helpers";
import type { Condition, StimuliManifest } from "../types/contracts";

type ReferentGridProps = {
  manifest: StimuliManifest;
  referentIds: string[];
  condition: Condition;
  selectedId?: string | null;
  targetId?: string | null;
  onSelect?: (referentId: string) => void;
  showAudioButtons?: boolean;
  disabled?: boolean;
};

export function ReferentGrid({
  manifest,
  referentIds,
  condition,
  selectedId,
  targetId,
  onSelect,
  showAudioButtons = false,
  disabled = false,
}: ReferentGridProps) {
  return (
    <div className="referent-grid">
      {referentIds.map((referentId) => {
        const referent = referentById(manifest, referentId);
        if (!referent) {
          return null;
        }
        const classes = ["referent-card"];
        if (selectedId === referentId) {
          classes.push("selected");
        }
        if (targetId === referentId) {
          classes.push("target");
        }

        return (
          <button
            key={referentId}
            type="button"
            className={classes.join(" ")}
            disabled={disabled}
            onClick={() => onSelect?.(referentId)}
          >
            <img src={referent.imageUrl} alt={referentId} className="referent-image" />
            <span className="referent-name">{referent.stemId}</span>
            <span className="referent-meta">{formatModifierLabel(referent)}</span>
            {showAudioButtons ? (
              <span
                role="button"
                tabIndex={0}
                className="audio-chip"
                onClick={(event: MouseEvent<HTMLSpanElement>) => {
                  event.preventDefault();
                  event.stopPropagation();
                  playAudio(referent.audio[condition]);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    playAudio(referent.audio[condition]);
                  }
                }}
              >
                Play
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
