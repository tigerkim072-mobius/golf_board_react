import { useContext, useEffect, useState } from 'react';
import {
  addDoc,
  collection,
  deleteField,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { useLocation } from 'react-router-dom';
import {
  FiCheck,
  FiEdit2,
  FiGrid,
  FiList,
  FiPause,
  FiPlay,
  FiSearch,
  FiTrash2,
  FiUserPlus,
  FiUsers,
  FiX,
} from 'react-icons/fi';
import { db, GolfContext } from '../context/GolfContext';
import Menues from './Menues';
import './Players.css';

function getFirestoreErrorMessage(error) {
  if (error.code === 'permission-denied') {
    return 'Firestore 접근 권한이 없습니다. 보안 규칙을 확인해 주세요.';
  }
  if (error.code === 'unavailable') {
    return 'Firestore에 연결할 수 없습니다. 네트워크를 확인해 주세요.';
  }
  return `플레이어 처리 중 오류가 발생했습니다. (${error.code || 'unknown'})`;
}

function normalizePlayer(playerDocument, scoreDocument) {
  const data = playerDocument.data();
  const scoreData = scoreDocument?.data() ?? {};
  const name = String(
    data.nickname ||
      data['별명'] ||
      data.name ||
      data['이름'] ||
      playerDocument.id,
  );
  const handicap = Number(data.handicap ?? data['핸디'] ?? 0);
  const mulligan = Number(data.mulligan ?? data['멀리건'] ?? 0);

  return {
    id: playerDocument.id,
    name,
    handicap: Number.isFinite(handicap) ? handicap : 0,
    mulligan: Number.isFinite(mulligan) ? mulligan : 0,
    gameActive:
      scoreData['게임중'] === true || scoreData.gameActive === true,
    scoreDocumentId: scoreDocument?.id ?? '',
    legacyScoreDocumentId:
      playerDocument.ref.parent.id === 'scores' ? playerDocument.id : '',
  };
}

function Players() {
  const { state } = useLocation();
  const courtId = state?.courtId;
  const gameRoomId = state?.gameRoomId || '';
  const gameRoomName = state?.gameRoomName || '';
  const playerScopeId = `${courtId || ''}:${gameRoomId}`;
  const { courts = [] } = useContext(GolfContext) ?? {};
  const courtName = courts.find((court) => court.id === courtId)?.name;
  const [players, setPlayers] = useState([]);
  const [nickname, setNickname] = useState('');
  const [handicap, setHandicap] = useState('0');
  const [mulligan, setMulligan] = useState('0');
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [loadedCourtId, setLoadedCourtId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingPlayerId, setEditingPlayerId] = useState('');
  const [editDraft, setEditDraft] = useState(null);
  const [busyPlayerId, setBusyPlayerId] = useState('');
  const [playerSearch, setPlayerSearch] = useState('');
  const [viewMode, setViewMode] = useState('cards');

  const normalizedSearch = playerSearch.trim().toLocaleLowerCase();
  const filteredPlayers = players.filter((player) =>
    player.name.toLocaleLowerCase().includes(normalizedSearch),
  );

  useEffect(() => {
    let isMounted = true;

    async function loadPlayers() {
      if (!courtId) {
        setErrorMessage('구장 정보를 확인할 수 없습니다. 다시 로그인해 주세요.');
        setLoadedCourtId('');
        setIsLoading(false);
        return;
      }

      if (!db) {
        setErrorMessage(
          'Firebase 설정이 없습니다. 프로젝트 루트의 .env.local 설정을 확인해 주세요.',
        );
        setLoadedCourtId(playerScopeId);
        setIsLoading(false);
        return;
      }

      try {
        const [playersSnapshot, legacyPlayersSnapshot, scoresSnapshot] =
          await Promise.all([
            getDocs(
              query(
                collection(db, 'players'),
                where('courtId', '==', courtId),
              ),
            ),
            getDocs(
              query(
                collection(db, 'scores'),
                where('구장ID', '==', courtId),
              ),
            ),
            getDocs(
              query(
                collection(db, 'scores'),
                gameRoomId
                  ? where('게임방ID', '==', gameRoomId)
                  : where('구장ID', '==', courtId),
              ),
            ),
          ]);
        const profileDocuments = new Map(
          playersSnapshot.docs.map((playerDocument) => [
            playerDocument.id,
            playerDocument,
          ]),
        );
        const legacyPlayerDocuments = legacyPlayersSnapshot.docs.filter(
          (scoreDocument) => {
            const data = scoreDocument.data();
            return (
              !data['게임방ID'] &&
              !data.gameRoomId &&
              !data.playerId &&
              !data.rosterPlayerId
            );
          },
        );
        const legacyScoreIdsByPlayerId = new Map(
          legacyPlayerDocuments.map((scoreDocument) => [
            scoreDocument.id,
            scoreDocument.id,
          ]),
        );
        legacyPlayerDocuments.forEach((scoreDocument) => {
          if (!profileDocuments.has(scoreDocument.id)) {
            profileDocuments.set(scoreDocument.id, scoreDocument);
          }
        });
        const scoresByPlayerId = new Map();
        scoresSnapshot.docs.forEach((scoreDocument) => {
          const data = scoreDocument.data();
          const playerId = String(
            data.playerId ||
              data.rosterPlayerId ||
              (!data['게임방ID'] && !data.gameRoomId
                ? scoreDocument.id
                : ''),
          );
          if (playerId) scoresByPlayerId.set(playerId, scoreDocument);
        });
        const loadedPlayers = [...profileDocuments.values()]
          .map((playerDocument) => {
            const player = normalizePlayer(
              playerDocument,
              scoresByPlayerId.get(playerDocument.id),
            );
            return {
              ...player,
              legacyScoreDocumentId:
                legacyScoreIdsByPlayerId.get(playerDocument.id) ||
                player.legacyScoreDocumentId,
            };
          })
          .sort((first, second) => first.name.localeCompare(second.name, 'ko'));

        if (isMounted) setPlayers(loadedPlayers);
      } catch (error) {
        console.error('플레이어 목록을 불러오지 못했습니다.', error);
        if (isMounted) setErrorMessage(getFirestoreErrorMessage(error));
      } finally {
        if (isMounted) {
          setLoadedCourtId(playerScopeId);
          setIsLoading(false);
        }
      }
    }

    loadPlayers();
    return () => {
      isMounted = false;
    };
  }, [courtId, gameRoomId, playerScopeId]);

  async function handleSubmit(event) {
    event.preventDefault();
    setErrorMessage('');

    const trimmedNickname = nickname.trim();
    const handicapValue = Number(handicap);
    const mulliganValue = Number(mulligan);

    if (!trimmedNickname) {
      setErrorMessage('플레이어 별명을 입력해 주세요.');
      return;
    }

    if (!courtId) {
      setErrorMessage('구장 정보를 확인할 수 없습니다. 다시 로그인해 주세요.');
      return;
    }

    if (
      !Number.isInteger(handicapValue) ||
      !Number.isInteger(mulliganValue) ||
      mulliganValue < 0
    ) {
      setErrorMessage(
        '핸디와 멀리건은 정수로 입력하고, 멀리건은 0 이상이어야 합니다.',
      );
      return;
    }

    if (
      players.some(
        (player) =>
          player.name.toLocaleLowerCase() ===
          trimmedNickname.toLocaleLowerCase(),
      )
    ) {
      setErrorMessage('이미 등록된 플레이어 별명입니다.');
      return;
    }

    if (!db) {
      setErrorMessage('Firebase 설정이 없어 플레이어를 저장할 수 없습니다.');
      return;
    }

    setIsSubmitting(true);
    try {
      const playerDocument = doc(collection(db, 'players'));
      await setDoc(playerDocument, {
        courtId,
        '구장ID': courtId,
        '이름': trimmedNickname,
        '멀리건': mulliganValue,
        nickname: trimmedNickname,
        name: trimmedNickname,
        handicap: handicapValue,
        mulligan: mulliganValue,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setPlayers((currentPlayers) =>
        [
          ...currentPlayers,
          {
            id: playerDocument.id,
            name: trimmedNickname,
            handicap: handicapValue,
            mulligan: mulliganValue,
            gameActive: false,
            scoreDocumentId: '',
          },
        ].sort((first, second) => first.name.localeCompare(second.name, 'ko')),
      );
      setNickname('');
      setHandicap('0');
      setMulligan('0');
    } catch (error) {
      console.error('플레이어 등록에 실패했습니다.', error);
      setErrorMessage(getFirestoreErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  function startEditing(player) {
    setErrorMessage('');
    setEditingPlayerId(player.id);
    setEditDraft({
      name: player.name,
      handicap: String(player.handicap),
      mulligan: String(player.mulligan),
    });
  }

  function cancelEditing() {
    setEditingPlayerId('');
    setEditDraft(null);
  }

  async function handleUpdatePlayer(event, player) {
    event.preventDefault();
    setErrorMessage('');

    const updatedName = editDraft?.name.trim() || '';
    const handicapValue = Number(editDraft?.handicap);
    const mulliganValue = Number(editDraft?.mulligan);

    if (!updatedName) {
      setErrorMessage('플레이어 별명을 입력해 주세요.');
      return;
    }

    if (
      !Number.isInteger(handicapValue) ||
      !Number.isInteger(mulliganValue) ||
      mulliganValue < 0
    ) {
      setErrorMessage(
        '핸디와 멀리건은 정수로 입력하고, 멀리건은 0 이상이어야 합니다.',
      );
      return;
    }

    if (
      players.some(
        (otherPlayer) =>
          otherPlayer.id !== player.id &&
          otherPlayer.name.toLocaleLowerCase() ===
            updatedName.toLocaleLowerCase(),
      )
    ) {
      setErrorMessage('이미 등록된 플레이어 별명입니다.');
      return;
    }

    if (!db) {
      setErrorMessage('Firebase 설정이 없어 플레이어 정보를 수정할 수 없습니다.');
      return;
    }

    setBusyPlayerId(player.id);
    try {
      await setDoc(doc(db, 'players', player.id), {
        courtId,
        '구장ID': courtId,
        nickname: updatedName,
        name: updatedName,
        '이름': updatedName,
        handicap: handicapValue,
        '핸디': deleteField(),
        mulligan: mulliganValue,
        '멀리건': mulliganValue,
        updatedAt: serverTimestamp(),
      }, { merge: true });

      setPlayers((currentPlayers) =>
        currentPlayers
          .map((currentPlayer) =>
            currentPlayer.id === player.id
              ? {
                  ...currentPlayer,
                  name: updatedName,
                  handicap: handicapValue,
                  mulligan: mulliganValue,
                }
              : currentPlayer,
          )
          .sort((first, second) => first.name.localeCompare(second.name, 'ko')),
      );
      cancelEditing();
    } catch (error) {
      console.error('플레이어 정보 수정에 실패했습니다.', error);
      setErrorMessage(getFirestoreErrorMessage(error));
    } finally {
      setBusyPlayerId('');
    }
  }

  async function handleDeletePlayer(player) {
    const confirmed = window.confirm(
      `${player.name} 플레이어를${courtName ? ` ${courtName}에서` : ''} 삭제하시겠습니까?`,
    );
    if (!confirmed) return;

    if (!db) {
      setErrorMessage('Firebase 설정이 없어 플레이어를 삭제할 수 없습니다.');
      return;
    }

    setErrorMessage('');
    setBusyPlayerId(player.id);
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, 'players', player.id));
      if (player.legacyScoreDocumentId) {
        batch.delete(doc(db, 'scores', player.legacyScoreDocumentId));
      }
      await batch.commit();
      setPlayers((currentPlayers) =>
        currentPlayers.filter((currentPlayer) => currentPlayer.id !== player.id),
      );
      if (editingPlayerId === player.id) cancelEditing();
    } catch (error) {
      console.error('플레이어 삭제에 실패했습니다.', error);
      setErrorMessage(getFirestoreErrorMessage(error));
    } finally {
      setBusyPlayerId('');
    }
  }

  async function handleToggleGame(player) {
    if (!db) {
      setErrorMessage('Firebase 설정이 없어 게임 상태를 변경할 수 없습니다.');
      return;
    }

    const gameActive = !player.gameActive;
    setErrorMessage('');
    setBusyPlayerId(player.id);
    try {
      let scoreDocumentId = player.scoreDocumentId;
      if (scoreDocumentId) {
        await updateDoc(doc(db, 'scores', scoreDocumentId), {
          '게임중': gameActive,
          gameActive,
          updatedAt: serverTimestamp(),
        });
      } else {
        const scoreDocument = await addDoc(collection(db, 'scores'), {
          courtId,
          '구장ID': courtId,
          ...(gameRoomId
            ? { gameRoomId, '게임방ID': gameRoomId }
            : {}),
          playerId: player.id,
          score: 0,
          '점수': 0,
          '게임중': gameActive,
          gameActive,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        scoreDocumentId = scoreDocument.id;
      }
      setPlayers((currentPlayers) =>
        currentPlayers.map((currentPlayer) =>
          currentPlayer.id === player.id
            ? { ...currentPlayer, gameActive, scoreDocumentId }
            : currentPlayer,
        ),
      );
    } catch (error) {
      console.error('플레이어 게임 상태 변경에 실패했습니다.', error);
      setErrorMessage(getFirestoreErrorMessage(error));
    } finally {
      setBusyPlayerId('');
    }
  }

  return (
    <>
      <Menues />
      <main className="players-page">
        <header className="players-page__header">
          <h1>플레이어 관리</h1>
          <p>
            {gameRoomName
              ? `${courtName || '현재 구장'} 전체 플레이어 · ${gameRoomName}에서 사용`
              : courtName
                ? `${courtName}에 등록된 플레이어`
                : '현재 구장의 플레이어'}
          </p>
        </header>

        {errorMessage && (
          <p className="players-message" role="alert">
            {errorMessage}
          </p>
        )}

        <section className="player-add-card" aria-labelledby="add-player-title">
          <div className="player-add-card__heading">
            <span className="player-add-card__icon" aria-hidden="true">
              <FiUserPlus />
            </span>
            <div>
              <h2 id="add-player-title">새 플레이어 추가</h2>
              <p>별명과 기본 정보를 입력해 플레이어를 등록하세요.</p>
            </div>
          </div>

          <form className="player-registration-form" onSubmit={handleSubmit}>
            <label className="player-form-field" htmlFor="new-player-nickname">
              <span>별명</span>
              <input
                id="new-player-nickname"
                type="text"
                placeholder="예: 버디왕"
                value={nickname}
                onChange={(event) => setNickname(event.target.value)}
                maxLength={40}
                autoComplete="off"
                required
              />
            </label>
            <label className="player-form-field" htmlFor="new-player-handicap">
              <span>핸디</span>
              <input
                id="new-player-handicap"
                type="number"
                step="1"
                value={handicap}
                onChange={(event) => setHandicap(event.target.value)}
                required
              />
            </label>
            <label className="player-form-field" htmlFor="new-player-mulligan">
              <span>멀리건</span>
              <input
                id="new-player-mulligan"
                type="number"
                min="0"
                step="1"
                value={mulligan}
                onChange={(event) => setMulligan(event.target.value)}
                required
              />
            </label>
            <button
              className="player-add-button"
              type="submit"
              disabled={isSubmitting || !courtId}
            >
              <FiUserPlus aria-hidden="true" />
              {isSubmitting ? '등록 중...' : '플레이어 추가'}
            </button>
          </form>
        </section>

        <section
          className="player-list-section"
          aria-labelledby="player-list-title"
        >
          <div className="player-list-heading">
            <div className="player-list-heading__title">
              <span className="player-list-heading__icon" aria-hidden="true">
                <FiUsers />
              </span>
              <div>
                <h2 id="player-list-title">플레이어 목록</h2>
                <p>등록된 플레이어 정보를 확인할 수 있습니다.</p>
              </div>
            </div>
          </div>

          <div className="player-list-toolbar">
            <label className="player-search" htmlFor="player-search">
              <FiSearch aria-hidden="true" />
              <input
                id="player-search"
                type="search"
                value={playerSearch}
                onChange={(event) => setPlayerSearch(event.target.value)}
                placeholder="별명으로 검색"
                aria-label="플레이어 별명 검색"
              />
              {playerSearch && (
                <button
                  className="player-search__clear"
                  type="button"
                  onClick={() => setPlayerSearch('')}
                  aria-label="검색어 지우기"
                >
                  <FiX aria-hidden="true" />
                </button>
              )}
            </label>
            <span className="player-count" aria-live="polite">
              {isLoading
                ? '불러오는 중'
                : `${filteredPlayers.length} / ${players.length}명`}
            </span>
            <div className="player-view-toggle" role="group" aria-label="보기 방식">
              <button
                className={`player-view-toggle__button${viewMode === 'cards' ? ' is-active' : ''}`}
                type="button"
                onClick={() => setViewMode('cards')}
                aria-pressed={viewMode === 'cards'}
              >
                <FiGrid aria-hidden="true" />
                카드
              </button>
              <button
                className={`player-view-toggle__button${viewMode === 'list' ? ' is-active' : ''}`}
                type="button"
                onClick={() => setViewMode('list')}
                aria-pressed={viewMode === 'list'}
              >
                <FiList aria-hidden="true" />
                리스트
              </button>
            </div>
          </div>

          {isLoading || loadedCourtId !== playerScopeId ? (
            <div className="player-list-state" role="status">
              플레이어 목록을 불러오는 중입니다...
            </div>
          ) : players.length === 0 ? (
            <div className="player-list-state">
              <FiUsers aria-hidden="true" />
              <strong>아직 등록된 플레이어가 없습니다.</strong>
              <span>위 입력 카드에서 첫 플레이어를 추가해 보세요.</span>
            </div>
          ) : filteredPlayers.length === 0 ? (
            <div className="player-list-state">
              <FiSearch aria-hidden="true" />
              <strong>검색 결과가 없습니다.</strong>
              <span>다른 별명을 입력하거나 검색어를 지워 보세요.</span>
            </div>
          ) : (
            <div
              className={`player-list-grid${viewMode === 'list' ? ' player-list-grid--list' : ''}`}
            >
              {filteredPlayers.map((player) => (
                <article className="player-list-card" key={player.id}>
                  {editingPlayerId === player.id ? (
                    <form
                      className="player-edit-form"
                      onSubmit={(event) => handleUpdatePlayer(event, player)}
                    >
                      <label className="player-edit-field">
                        <span>별명</span>
                        <input
                          type="text"
                          value={editDraft?.name ?? ''}
                          onChange={(event) =>
                            setEditDraft((draft) => ({
                              ...draft,
                              name: event.target.value,
                            }))
                          }
                          maxLength={40}
                          required
                        />
                      </label>
                      <div className="player-edit-form__numbers">
                        <label className="player-edit-field">
                          <span>핸디</span>
                          <input
                            type="number"
                            step="1"
                            value={editDraft?.handicap ?? ''}
                            onChange={(event) =>
                              setEditDraft((draft) => ({
                                ...draft,
                                handicap: event.target.value,
                              }))
                            }
                            required
                          />
                        </label>
                        <label className="player-edit-field">
                          <span>멀리건</span>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={editDraft?.mulligan ?? ''}
                            onChange={(event) =>
                              setEditDraft((draft) => ({
                                ...draft,
                                mulligan: event.target.value,
                              }))
                            }
                            required
                          />
                        </label>
                      </div>
                      <div className="player-card-actions">
                        <button
                          className="player-card-action player-card-action--save"
                          type="submit"
                          disabled={busyPlayerId === player.id}
                        >
                          <FiCheck aria-hidden="true" />
                          {busyPlayerId === player.id ? '저장 중...' : '저장'}
                        </button>
                        <button
                          className="player-card-action"
                          type="button"
                          onClick={cancelEditing}
                          disabled={busyPlayerId === player.id}
                        >
                          <FiX aria-hidden="true" />
                          취소
                        </button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <div className="player-list-card__identity">
                        <span
                          className="player-list-card__avatar"
                          aria-hidden="true"
                        >
                          {player.name.slice(0, 1)}
                        </span>
                        <h3>{player.name}</h3>
                      </div>
                      <span
                        className={`player-game-status${player.gameActive ? ' player-game-status--active' : ''}`}
                      >
                        <span aria-hidden="true" />
                        {player.gameActive ? '게임 중' : '대기 중'}
                      </span>
                      <dl className="player-list-card__stats">
                        <div>
                          <dt>핸디</dt>
                          <dd>{player.handicap}</dd>
                        </div>
                        <div>
                          <dt>멀리건</dt>
                          <dd>{player.mulligan}</dd>
                        </div>
                      </dl>
                      <div className="player-card-actions">
                        <button
                          className={`player-card-action ${player.gameActive ? 'player-card-action--playing' : 'player-card-action--save'}`}
                          type="button"
                          onClick={() => handleToggleGame(player)}
                          disabled={busyPlayerId === player.id}
                        >
                          {player.gameActive ? (
                            <FiPause aria-hidden="true" />
                          ) : (
                            <FiPlay aria-hidden="true" />
                          )}
                          {busyPlayerId === player.id
                            ? '변경 중...'
                            : player.gameActive
                              ? '게임 제외'
                              : '게임 참가'}
                        </button>
                        <button
                          className="player-card-action"
                          type="button"
                          onClick={() => startEditing(player)}
                          disabled={busyPlayerId === player.id}
                        >
                          <FiEdit2 aria-hidden="true" />
                          수정
                        </button>
                        <button
                          className="player-card-action player-card-action--delete"
                          type="button"
                          onClick={() => handleDeletePlayer(player)}
                          disabled={busyPlayerId === player.id}
                        >
                          <FiTrash2 aria-hidden="true" />
                          삭제
                        </button>
                      </div>
                    </>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </>
  );
}

export default Players;
