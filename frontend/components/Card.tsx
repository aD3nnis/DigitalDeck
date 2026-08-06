import styles from "./Card.module.css";
import { cardSrc, visualState, type CardVisualState } from "./CardAssets";

type Props = {
  cardId: string;
  selected?: boolean;
  pending?: boolean;
  state?: CardVisualState; // optional override
  onClick?: () => void;
  onDoubleClick?: (e: React.MouseEvent) => void;
  order?: number; // selection order badge, optional
};

export default function Card({
  cardId,
  selected = false,
  pending = false,
  state,
  onClick,
  onDoubleClick,
  order,
}: Props) {
  const src = cardSrc(
    cardId,
    state ?? visualState({ selected, pending })
  );

  return (
    <button
      type="button"
      className={styles.cardButton}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    >
      <img className={styles.card} src={src} alt={cardId} />
      {order != null && <span>({order})</span>}
    </button>
  );
}