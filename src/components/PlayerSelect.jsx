import { useState } from 'react';
import { FiPlus, FiUserPlus, FiX } from 'react-icons/fi';

function PlayerSelect({
  waitingPlayers,
  isBusy,
  onAddPlayers,
  onCreateAndAddPlayer,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState([]);
  const [selectedRoomNumbers, setSelectedRoomNumbers] = useState({});
  const [playerSearch, setPlayerSearch] = useState('');
  const [newPlayer, setNewPlayer] = useState({
    nickname: '',
    handicap: '0',
    mulligan: '0',
    roomNumber: 1,
  });
  const filteredWaitingPlayers = waitingPlayers.filter((player) =>
    player.name
      .toLocaleLowerCase()
      .includes(playerSearch.trim().toLocaleLowerCase()),
  );
  const availableRoomNumbers = [1, 2, 3, 4];

  async function handleSubmit(event) {
    event.preventDefault();
    const addedPlayerIds = await onAddPlayers(
      selectedPlayerIds,
      selectedRoomNumbers,
    );
    setSelectedPlayerIds((currentIds) =>
      currentIds.filter((playerId) => !addedPlayerIds.includes(playerId)),
    );
  }

  async function handleAddPlayerToRoom(player, roomNumber) {
    setSelectedRoomNumbers((roomNumbers) => ({
      ...roomNumbers,
      [player.id]: roomNumber,
    }));
    const addedPlayerIds = await onAddPlayers([player.id], {
      [player.id]: roomNumber,
    });
    setSelectedPlayerIds((currentIds) =>
      currentIds.filter((playerId) => !addedPlayerIds.includes(playerId)),
    );
  }

  async function handleCreatePlayer(event) {
    event.preventDefault();
    const created = await onCreateAndAddPlayer({
      ...newPlayer,
      roomNumber: Number(newPlayer.roomNumber),
    });
    if (!created) return;

    setNewPlayer({
      nickname: '',
      handicap: '0',
      mulligan: '0',
      roomNumber: 1,
    });
    setIsCreateDialogOpen(false);
  }

  return (
    <div className="scoreboard-player-add">
      <button
        className="scoreboard-player-add__toggle"
        type="button"
        onClick={() => setIsOpen((isCurrentlyOpen) => !isCurrentlyOpen)}
        aria-expanded={isOpen}
        aria-controls="scoreboard-player-picker"
      >
        <span>
          참가할 플레이어
          {selectedPlayerIds.length > 0 &&
            ` · ${selectedPlayerIds.length}명 선택`}
          {waitingPlayers.length > 0 && ` · 대기 ${waitingPlayers.length}명`}
        </span>
        <span aria-hidden="true">{isOpen ? '−' : '+'}</span>
      </button>
      {isOpen && (
        <div
          className="scoreboard-player-picker"
          id="scoreboard-player-picker"
        >
          <label htmlFor="scoreboard-player-search">참가할 플레이어 검색</label>
          <input
            id="scoreboard-player-search"
            type="search"
            value={playerSearch}
            onChange={(event) => setPlayerSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.preventDefault();
            }}
            placeholder={
              waitingPlayers.length === 0
                ? '추가할 플레이어가 없습니다'
                : '별명을 입력해 검색하세요'
            }
            disabled={waitingPlayers.length === 0 || isBusy}
            autoComplete="off"
          />
          <span className="scoreboard-player-add__results-label">
            검색 결과
            {filteredWaitingPlayers.length > 0 &&
              ` · ${filteredWaitingPlayers.length}명`}
          </span>
          <div
            className="scoreboard-player-add__results"
            role="group"
            aria-label="검색된 플레이어 선택"
          >
            {filteredWaitingPlayers.length > 0 ? (
              filteredWaitingPlayers.map((player) => (
                <div
                  className="scoreboard-player-add__result"
                  key={player.id}
                >
                  <label className="scoreboard-player-add__player">
                    <input
                      type="checkbox"
                      checked={selectedPlayerIds.includes(player.id)}
                      onChange={(event) => {
                        setSelectedPlayerIds((selectedIds) =>
                          event.target.checked
                            ? [...selectedIds, player.id]
                            : selectedIds.filter((id) => id !== player.id),
                        );
                        setSelectedRoomNumbers((roomNumbers) => ({
                          ...roomNumbers,
                          [player.id]:
                            roomNumbers[player.id] ?? player.roomNumber ?? 1,
                        }));
                      }}
                      disabled={isBusy}
                    />
                    <span>{player.name}</span>
                  </label>
                  <span className="scoreboard-player-add__room-label">
                    참가 방
                  </span>
                  <div
                    className="scoreboard-player-add__room-options"
                    role="group"
                    aria-label={`${player.name} 참가 방번호 선택`}
                  >
                    {availableRoomNumbers.map((roomNumber) => (
                      <button
                        className="scoreboard-player-add__room-option"
                        type="button"
                        aria-pressed={
                          (selectedRoomNumbers[player.id] ??
                            player.roomNumber ??
                            1) === roomNumber
                        }
                        onClick={() =>
                          handleAddPlayerToRoom(player, roomNumber)
                        }
                        key={roomNumber}
                        disabled={isBusy}
                      >
                        {roomNumber}번 방
                      </button>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <p className="scoreboard-player-add__empty" role="status">
                {playerSearch
                  ? '검색 결과가 없습니다'
                  : '선택할 플레이어가 없습니다'}
              </p>
            )}
          </div>
          <button
            className="scoreboard-player-add__create"
            type="button"
            onClick={() => setIsCreateDialogOpen(true)}
            disabled={isBusy}
          >
            <FiUserPlus aria-hidden="true" />
            새 플레이어 추가
          </button>
          <button
            className="scoreboard-player-add__submit"
            type="button"
            onClick={handleSubmit}
            disabled={selectedPlayerIds.length === 0 || isBusy}
          >
            <FiPlus aria-hidden="true" />
            {isBusy
              ? '추가 중...'
              : `선택한 ${selectedPlayerIds.length}명 게임에 추가`}
          </button>
        </div>
      )}
      {isCreateDialogOpen && (
        <div className="player-create-dialog-backdrop">
          <section
            className="player-create-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="player-create-dialog-title"
          >
            <header className="player-create-dialog__header">
              <div>
                <span className="player-create-dialog__eyebrow">
                  ADD TO THIS GAME
                </span>
                <h2 id="player-create-dialog-title">새 플레이어 추가</h2>
                <p>플레이어 정보 저장 후 선택한 방에 바로 참가시킵니다.</p>
              </div>
              <button
                className="player-create-dialog__close"
                type="button"
                onClick={() => setIsCreateDialogOpen(false)}
                aria-label="닫기"
                disabled={isBusy}
              >
                <FiX aria-hidden="true" />
              </button>
            </header>
            <form
              className="player-create-dialog__form"
              onSubmit={handleCreatePlayer}
            >
              <label>
                별명
                <input
                  type="text"
                  value={newPlayer.nickname}
                  onChange={(event) =>
                    setNewPlayer((player) => ({
                      ...player,
                      nickname: event.target.value,
                    }))
                  }
                  maxLength={40}
                  autoComplete="off"
                  autoFocus
                  required
                />
              </label>
              <div className="player-create-dialog__numbers">
                <label>
                  핸디캡
                  <input
                    type="number"
                    step="1"
                    value={newPlayer.handicap}
                    onChange={(event) =>
                      setNewPlayer((player) => ({
                        ...player,
                        handicap: event.target.value,
                      }))
                    }
                    required
                  />
                </label>
                <label>
                  멀리건
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={newPlayer.mulligan}
                    onChange={(event) =>
                      setNewPlayer((player) => ({
                        ...player,
                        mulligan: event.target.value,
                      }))
                    }
                    required
                  />
                </label>
              </div>
              <fieldset className="player-create-dialog__rooms">
                <legend>참가 방</legend>
                {availableRoomNumbers.map((roomNumber) => (
                  <button
                    className={
                      newPlayer.roomNumber === roomNumber ? 'is-selected' : ''
                    }
                    type="button"
                    key={roomNumber}
                    aria-pressed={newPlayer.roomNumber === roomNumber}
                    onClick={() =>
                      setNewPlayer((player) => ({ ...player, roomNumber }))
                    }
                  >
                    {roomNumber}번 방
                  </button>
                ))}
              </fieldset>
              <footer className="player-create-dialog__actions">
                <button
                  className="player-create-dialog__cancel"
                  type="button"
                  onClick={() => setIsCreateDialogOpen(false)}
                  disabled={isBusy}
                >
                  취소
                </button>
                <button
                  className="player-create-dialog__submit"
                  type="submit"
                  disabled={isBusy}
                >
                  <FiPlus aria-hidden="true" />
                  {isBusy ? '추가 중...' : '저장 후 게임 참가'}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}

export default PlayerSelect;
