import {
  FiCheck,
  FiEdit2,
  FiMove,
  FiUserMinus,
  FiX,
} from 'react-icons/fi';

const scoreAdjustments = Array.from({ length: 11 }, (_, index) => index - 5);

function ScoreCard({
  player,
  index,
  viewMode,
  roomNumberDraft,
  playerNumberDraft,
  roomPlayerCount,
  isSavingOrder,
  editingMode,
  editDraft,
  isSavingScore,
  isBusy,
  onRoomNumberDraftChange,
  onSaveRoomNumber,
  onPlayerNumberDraftChange,
  onSavePlayerNumber,
  onStartEditingProfile,
  onEditDraftChange,
  onSaveScore,
  onSaveProfile,
  onCancelEditing,
  onStartEditingScore,
  onRemovePlayer,
}) {
  return (
    <article
      className={`player-score-card player-score-card--room-${((player.roomNumber - 1) % 8) + 1}`}
    >
      {viewMode === 'manual' && (
        <div className="player-card-order-controls">
          <label htmlFor={`room-number-${player.id}`}>
            <FiMove aria-hidden="true" />
            방번호
          </label>
          <input
            id={`room-number-${player.id}`}
            type="number"
            min="1"
            step="1"
            value={roomNumberDraft ?? player.roomNumber}
            onChange={(event) => onRoomNumberDraftChange(event.target.value)}
            onBlur={(event) => onSaveRoomNumber(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur();
            }}
            aria-label={`${player.name} 방번호`}
            disabled={isSavingOrder}
          />
          <label
            className="player-card-order-player-number"
            htmlFor={`player-number-${player.id}`}
          >
            플레이어 번호
            <input
              id={`player-number-${player.id}`}
              type="number"
              min="1"
              max={roomPlayerCount}
              step="1"
              value={playerNumberDraft ?? player.playerNumber ?? index + 1}
              onChange={(event) =>
                onPlayerNumberDraftChange(event.target.value)
              }
              onBlur={(event) => onSavePlayerNumber(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') event.currentTarget.blur();
              }}
              aria-label={`${player.name} 플레이어 번호`}
              disabled={isSavingOrder}
            />
          </label>
        </div>
      )}
      <div className="player-score-card__heading">
        <span className="player-score-card__room">방 {player.roomNumber}</span>
        <span
          className={`player-score-card__rank${player.rank <= 3 ? ` player-score-card__rank--${player.rank}` : ''}`}
        >
          {player.rank}위
        </span>
        <span className="player-score-card__total-label">최종 점수</span>
        <strong className="player-score-card__total">{player.netScore}</strong>
      </div>
      <div className="player-score-card__name">
        <button
          className="player-score-card__name-button"
          type="button"
          onClick={onStartEditingProfile}
          aria-label={`${player.name} 별명, 핸디캡, 멀리건 수정`}
        >
          {player.name}
        </button>
        <button
          className="player-score-card__remove-button"
          type="button"
          onClick={() => onRemovePlayer(player)}
          disabled={isBusy || isSavingScore}
          aria-label={`${player.name} 게임에서 제외`}
          title="게임 나가기"
        >
          <FiUserMinus aria-hidden="true" />
        </button>
      </div>
      <dl className="player-score-card__stats">
        <div className="player-score-card__stat">
          <dt>점수</dt>
          <dd>
            <button
              className="player-score-card__score-button"
              type="button"
              onClick={onStartEditingScore}
              aria-label={`${player.name} 점수 ${player.score}, 점수 수정`}
              disabled={isSavingScore}
            >
              {player.score}
              <FiEdit2 aria-hidden="true" />
            </button>
          </dd>
        </div>
        <div className="player-score-card__stat">
          <dt>핸디캡</dt>
          <dd>{player.handicap}</dd>
        </div>
        <div className="player-score-card__stat">
          <dt>멀리건</dt>
          <dd>
            {player.mulligan}
            <small>사용 {player.mulliganUsed ?? 0}</small>
          </dd>
        </div>
      </dl>
      {editingMode === 'score' && (
        <form
          className="score-edit-form player-score-card__score-editor"
          onSubmit={(event) => onSaveScore(event, player)}
        >
          <fieldset className="player-score-card__score-options">
            <legend>현재 점수에서 조정</legend>
            <div className="player-score-card__score-options-grid">
              {scoreAdjustments.map((adjustment) => {
                const nextScore = player.score + adjustment;
                const isSelected = Number(editDraft?.score) === nextScore;
                const label =
                  adjustment > 0 ? `+${adjustment}` : String(adjustment);

                return (
                  <button
                    className={`player-score-card__score-option${isSelected ? ' player-score-card__score-option--selected' : ''}`}
                    key={adjustment}
                    type="button"
                    onClick={() =>
                      onEditDraftChange({ score: String(nextScore) })
                    }
                    aria-pressed={isSelected}
                    disabled={isSavingScore}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </fieldset>
          <label
            className="score-edit-form__field player-score-card__score-manual"
            htmlFor={`score-edit-${player.id}`}
          >
            점수 직접 입력
            <input
              id={`score-edit-${player.id}`}
              className="player-score-card__score-input"
              type="number"
              step="1"
              value={editDraft?.score ?? ''}
              onChange={(event) =>
                onEditDraftChange({ score: event.target.value })
              }
              required
            />
          </label>
          <div className="score-edit-form__actions">
            <button
              className="score-edit-button score-edit-button--save"
              type="submit"
              disabled={isSavingScore}
            >
              <FiCheck aria-hidden="true" />
              {isSavingScore ? '저장 중...' : '점수 저장'}
            </button>
            <button
              className="score-edit-button"
              type="button"
              onClick={onCancelEditing}
              disabled={isSavingScore}
            >
              <FiX aria-hidden="true" />
              취소
            </button>
          </div>
        </form>
      )}
      {editingMode === 'profile' && (
        <form
          className="score-edit-form"
          onSubmit={(event) => onSaveProfile(event, player)}
        >
          <div className="score-edit-form__fields score-edit-form__fields--single">
            <label
              className="score-edit-form__field"
              htmlFor={`nickname-edit-${player.id}`}
            >
              별명
              <input
                id={`nickname-edit-${player.id}`}
                type="text"
                value={editDraft?.name ?? ''}
                onChange={(event) =>
                  onEditDraftChange({ name: event.target.value })
                }
                autoFocus
                maxLength="30"
                required
              />
            </label>
            <label
              className="score-edit-form__field"
              htmlFor={`handicap-edit-${player.id}`}
            >
              핸디캡
              <input
                id={`handicap-edit-${player.id}`}
                type="number"
                step="1"
                value={editDraft?.handicap ?? ''}
                onChange={(event) =>
                  onEditDraftChange({ handicap: event.target.value })
                }
                required
              />
            </label>
            <label
              className="score-edit-form__field"
              htmlFor={`mulligan-edit-${player.id}`}
            >
              멀리건
              <input
                id={`mulligan-edit-${player.id}`}
                type="number"
                min="0"
                step="1"
                value={editDraft?.mulligan ?? ''}
                onChange={(event) =>
                  onEditDraftChange({ mulligan: event.target.value })
                }
                required
              />
            </label>
          </div>
          <div className="score-edit-form__actions">
            <button
              className="score-edit-button score-edit-button--save"
              type="submit"
              disabled={isSavingScore}
            >
              <FiCheck aria-hidden="true" />
              {isSavingScore ? '저장 중...' : '저장'}
            </button>
            <button
              className="score-edit-button"
              type="button"
              onClick={onCancelEditing}
              disabled={isSavingScore}
            >
              <FiX aria-hidden="true" />
              취소
            </button>
          </div>
        </form>
      )}
    </article>
  );
}

export default ScoreCard;
