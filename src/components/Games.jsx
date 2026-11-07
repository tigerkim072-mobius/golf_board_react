import { useContext, useEffect, useState } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  FiArrowLeft,
  FiArrowRight,
  FiCheck,
  FiEdit2,
  FiFlag,
  FiPlus,
  FiTrash2,
  FiUsers,
  FiX,
} from 'react-icons/fi';
import { db, GolfContext } from '../context/GolfContext';
import './Games.css';

function getFirestoreErrorMessage(error) {
  if (error.code === 'permission-denied') {
    return 'Firestore 접근 권한이 없습니다. 보안 규칙을 확인해 주세요.';
  }
  if (error.code === 'unavailable') {
    return 'Firestore에 연결할 수 없습니다. 네트워크를 확인해 주세요.';
  }
  return `게임방을 불러오지 못했습니다. (${error.code || 'unknown'})`;
}

function Games() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const courtId = state?.courtId;
  const { courts = [] } = useContext(GolfContext) ?? {};
  const courtName = courts.find((court) => court.id === courtId)?.name;
  const [gameRooms, setGameRooms] = useState([]);
  const [newGameRoomName, setNewGameRoomName] = useState('');
  const [newGameRoomPassword, setNewGameRoomPassword] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [editingGameRoomId, setEditingGameRoomId] = useState('');
  const [gameRoomNameDraft, setGameRoomNameDraft] = useState('');
  const [isSavingGameRoom, setIsSavingGameRoom] = useState(false);
  const [deletingGameRoomId, setDeletingGameRoomId] = useState('');
  const [deletePasswordDraft, setDeletePasswordDraft] = useState('');
  const [isDeletingGameRoom, setIsDeletingGameRoom] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadGameRooms() {
      if (!courtId) {
        navigate('/', { replace: true });
        return;
      }
      if (!db) {
        setErrorMessage('Firebase 설정이 없어 게임방을 불러올 수 없습니다.');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage('');
      try {
        const roomsQuery = query(
          collection(db, 'gameRooms'),
          where('courtId', '==', courtId),
        );
        const snapshot = await getDocs(roomsQuery);
        const rooms = snapshot.docs
          .map((gameRoomDocument) => {
            const data = gameRoomDocument.data();
            return {
              id: gameRoomDocument.id,
              name: String(data.name || data['이름'] || gameRoomDocument.id),
              createdAt: data.createdAt ?? null,
            };
          })
          .sort((first, second) => first.name.localeCompare(second.name, 'ko'));

        if (isMounted) setGameRooms(rooms);
      } catch (error) {
        console.error('게임방 목록을 불러오지 못했습니다.', error);
        if (isMounted) setErrorMessage(getFirestoreErrorMessage(error));
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadGameRooms();
    return () => {
      isMounted = false;
    };
  }, [courtId, navigate]);

  function openScoreboard(gameRoom) {
    navigate('/scores', {
      state: {
        courtId,
        gameRoomId: gameRoom?.id || '',
        gameRoomName: gameRoom?.name || '',
      },
    });
  }

  function startEditingGameRoom(gameRoom) {
    setErrorMessage('');
    cancelDeletingGameRoom();
    setEditingGameRoomId(gameRoom.id);
    setGameRoomNameDraft(gameRoom.name);
  }

  function cancelEditingGameRoom() {
    setEditingGameRoomId('');
    setGameRoomNameDraft('');
  }

  async function handleSaveGameRoomName(event, gameRoom) {
    event.preventDefault();
    const trimmedName = gameRoomNameDraft.trim();
    if (!trimmedName) {
      setErrorMessage('게임방 이름을 입력해 주세요.');
      return;
    }
    if (
      gameRooms.some(
        (room) =>
          room.id !== gameRoom.id &&
          room.name.toLocaleLowerCase() === trimmedName.toLocaleLowerCase(),
      )
    ) {
      setErrorMessage('같은 이름의 게임방이 이미 있습니다.');
      return;
    }
    if (!db) {
      setErrorMessage('Firebase 설정이 없어 게임방 이름을 저장할 수 없습니다.');
      return;
    }

    setIsSavingGameRoom(true);
    setErrorMessage('');
    try {
      await updateDoc(doc(db, 'gameRooms', gameRoom.id), {
        name: trimmedName,
        이름: trimmedName,
        updatedAt: serverTimestamp(),
      });
      setGameRooms((rooms) =>
        rooms
          .map((room) =>
            room.id === gameRoom.id ? { ...room, name: trimmedName } : room,
          )
          .sort((first, second) => first.name.localeCompare(second.name, 'ko')),
      );
      cancelEditingGameRoom();
    } catch (error) {
      console.error('게임방 이름을 저장하지 못했습니다.', error);
      setErrorMessage(
        error?.code === 'permission-denied'
          ? '게임방을 수정할 권한이 없습니다. Firestore 보안 규칙을 확인해 주세요.'
          : `게임방 이름 저장 중 오류가 발생했습니다. (${error?.code || 'unknown'})`,
      );
    } finally {
      setIsSavingGameRoom(false);
    }
  }

  async function handleCreateGameRoom(event) {
    event.preventDefault();
    const trimmedName = newGameRoomName.trim();
    if (!trimmedName) {
      setErrorMessage('게임방 이름을 입력해 주세요.');
      return;
    }
    if (!/^\d{4}$/.test(newGameRoomPassword)) {
      setErrorMessage('게임방 암호는 숫자 4자리로 입력해 주세요.');
      return;
    }
    if (
      gameRooms.some(
        (gameRoom) =>
          gameRoom.name.toLocaleLowerCase() === trimmedName.toLocaleLowerCase(),
      )
    ) {
      setErrorMessage('같은 이름의 게임방이 이미 있습니다.');
      return;
    }
    if (!db) {
      setErrorMessage('Firebase 설정이 없어 게임방을 만들 수 없습니다.');
      return;
    }

    setIsCreating(true);
    setErrorMessage('');
    try {
      const gameRoomReference = await addDoc(collection(db, 'gameRooms'), {
        courtId,
        구장ID: courtId,
        name: trimmedName,
        이름: trimmedName,
        암호: newGameRoomPassword,
        createdAt: serverTimestamp(),
      });
      openScoreboard({ id: gameRoomReference.id, name: trimmedName });
    } catch (error) {
      console.error('게임방을 만들지 못했습니다.', error);
      setErrorMessage(
        error?.code === 'permission-denied'
          ? '게임방을 만들 권한이 없습니다. Firestore 보안 규칙을 확인해 주세요.'
          : `게임방 생성 중 오류가 발생했습니다. (${error?.code || 'unknown'})`,
      );
    } finally {
      setIsCreating(false);
    }
  }

  function startDeletingGameRoom(gameRoom) {
    setErrorMessage('');
    cancelEditingGameRoom();
    setDeletingGameRoomId(gameRoom.id);
    setDeletePasswordDraft('');
  }

  function cancelDeletingGameRoom() {
    setDeletingGameRoomId('');
    setDeletePasswordDraft('');
  }

  async function handleDeleteGameRoom(event, gameRoom) {
    event.preventDefault();
    if (!/^\d{4}$/.test(deletePasswordDraft)) {
      setErrorMessage('삭제 확인을 위해 숫자 4자리 암호를 입력해 주세요.');
      return;
    }
    if (!db) {
      setErrorMessage('Firebase 설정이 없어 게임방을 삭제할 수 없습니다.');
      return;
    }

    setIsDeletingGameRoom(true);
    setErrorMessage('');
    try {
      const gameRoomSnapshot = await getDoc(doc(db, 'gameRooms', gameRoom.id));
      if (!gameRoomSnapshot.exists()) {
        setErrorMessage('삭제할 게임방을 찾을 수 없습니다.');
        setGameRooms((rooms) =>
          rooms.filter((room) => room.id !== gameRoom.id),
        );
        cancelDeletingGameRoom();
        return;
      }

      const storedPassword =
        gameRoomSnapshot.data().암호 ?? gameRoomSnapshot.data().password;
      if (
        typeof storedPassword !== 'string' &&
        typeof storedPassword !== 'number'
      ) {
        setErrorMessage('이 게임방에는 삭제 암호가 등록되어 있지 않습니다.');
        return;
      }
      if (String(storedPassword) !== deletePasswordDraft) {
        setErrorMessage('게임방 암호가 일치하지 않습니다.');
        return;
      }

      await deleteDoc(doc(db, 'gameRooms', gameRoom.id));
      setGameRooms((rooms) => rooms.filter((room) => room.id !== gameRoom.id));
      cancelDeletingGameRoom();
    } catch (error) {
      console.error('게임방을 삭제하지 못했습니다.', error);
      setErrorMessage(
        error?.code === 'permission-denied'
          ? '게임방을 삭제할 권한이 없습니다. Firestore 보안 규칙을 확인해 주세요.'
          : `게임방 삭제 중 오류가 발생했습니다. (${error?.code || 'unknown'})`,
      );
    } finally {
      setIsDeletingGameRoom(false);
    }
  }

  return (
    <main className="games-page">
      <section className="games-shell" aria-labelledby="games-title">
        <header className="games-header">
          <div className="games-header__brand">
            <span className="games-header__brand-icon">
              <FiFlag aria-hidden="true" />
            </span>
            <span>
              GREEN<span>CARD</span>
            </span>
          </div>
          <button
            className="games-header__back"
            type="button"
            onClick={() => navigate('/', { replace: true, state: null })}
          >
            <FiArrowLeft aria-hidden="true" />
            구장 선택
          </button>
        </header>

        <div className="games-content">
          <div className="games-title-row">
            <span className="games-title-row__icon">
              <FiUsers aria-hidden="true" />
            </span>
            <div>
              <span className="games-eyebrow">CHOOSE A GAME ROOM</span>
              <h1 id="games-title">게임방 선택</h1>
              <p>
                {courtName || '선택한 구장'}에서 진행할 게임방을 선택하세요.
              </p>
            </div>
          </div>

          {errorMessage && (
            <p className="games-error" role="alert">
              {errorMessage}
            </p>
          )}

          <section className="games-list-section" aria-label="게임방 목록">
            <div className="games-list-heading">
              <h2>등록된 게임방</h2>
              {!isLoading && <span>{gameRooms.length}개</span>}
            </div>
            {isLoading ? (
              <div className="games-status" role="status">
                게임방 목록을 불러오는 중입니다...
              </div>
            ) : gameRooms.length > 0 ? (
              <div className="games-list">
                {gameRooms.map((gameRoom) =>
                  deletingGameRoomId === gameRoom.id ? (
                    <form
                      className="games-room games-room--editing"
                      key={gameRoom.id}
                      onSubmit={(event) =>
                        handleDeleteGameRoom(event, gameRoom)
                      }
                    >
                      <span className="games-room__icon">
                        <FiTrash2 aria-hidden="true" />
                      </span>
                      <input
                        className="games-room__edit-input"
                        type="password"
                        inputMode="numeric"
                        pattern="[0-9]{4}"
                        maxLength="4"
                        value={deletePasswordDraft}
                        onChange={(event) =>
                          setDeletePasswordDraft(
                            event.target.value.replace(/\D/g, '').slice(0, 4),
                          )
                        }
                        aria-label={`${gameRoom.name} 삭제 암호`}
                        placeholder="숫자 4자리 암호"
                        autoFocus
                        required
                      />
                      <button
                        className="games-room__action games-room__action--delete"
                        type="submit"
                        aria-label="암호 확인 후 게임방 삭제"
                        title="암호 확인 후 삭제"
                        disabled={isDeletingGameRoom}
                      >
                        <FiCheck aria-hidden="true" />
                      </button>
                      <button
                        className="games-room__action"
                        type="button"
                        onClick={cancelDeletingGameRoom}
                        aria-label="삭제 취소"
                        title="취소"
                        disabled={isDeletingGameRoom}
                      >
                        <FiX aria-hidden="true" />
                      </button>
                    </form>
                  ) : editingGameRoomId === gameRoom.id ? (
                    <form
                      className="games-room games-room--editing"
                      key={gameRoom.id}
                      onSubmit={(event) =>
                        handleSaveGameRoomName(event, gameRoom)
                      }
                    >
                      <span className="games-room__icon">
                        <FiFlag aria-hidden="true" />
                      </span>
                      <input
                        className="games-room__edit-input"
                        type="text"
                        value={gameRoomNameDraft}
                        onChange={(event) =>
                          setGameRoomNameDraft(event.target.value)
                        }
                        maxLength="50"
                        aria-label="게임방 이름"
                        autoFocus
                        required
                      />
                      <button
                        className="games-room__action games-room__action--save"
                        type="submit"
                        aria-label="게임방 이름 저장"
                        title="저장"
                        disabled={isSavingGameRoom}
                      >
                        <FiCheck aria-hidden="true" />
                      </button>
                      <button
                        className="games-room__action"
                        type="button"
                        onClick={cancelEditingGameRoom}
                        aria-label="이름 수정 취소"
                        title="취소"
                        disabled={isSavingGameRoom}
                      >
                        <FiX aria-hidden="true" />
                      </button>
                    </form>
                  ) : (
                    <div className="games-room" key={gameRoom.id}>
                      <span className="games-room__icon">
                        <FiFlag aria-hidden="true" />
                      </span>
                      <span className="games-room__name">{gameRoom.name}</span>
                      <button
                        className="games-room__action"
                        type="button"
                        onClick={() => startEditingGameRoom(gameRoom)}
                        aria-label={`${gameRoom.name} 이름 수정`}
                        title="이름 수정"
                      >
                        <FiEdit2 aria-hidden="true" />
                      </button>
                      <button
                        className="games-room__action games-room__action--delete"
                        type="button"
                        onClick={() => startDeletingGameRoom(gameRoom)}
                        aria-label={`${gameRoom.name} 삭제`}
                        title="게임방 삭제"
                      >
                        <FiTrash2 aria-hidden="true" />
                      </button>
                      <button
                        className="games-room__enter-button"
                        type="button"
                        onClick={() => openScoreboard(gameRoom)}
                      >
                        입장
                        <FiArrowRight aria-hidden="true" />
                      </button>
                    </div>
                  ),
                )}
              </div>
            ) : (
              <div className="games-empty">
                아직 등록된 게임방이 없습니다. 아래에서 새 게임방을 만들어
                시작하세요.
              </div>
            )}
          </section>

          <form className="games-create" onSubmit={handleCreateGameRoom}>
            <label htmlFor="new-game-room-name">새 게임방 만들기</label>
            <p>
              새로운 라운드를 위한 스코어보드를 준비합니다. 암호는 숫자
              4자리입니다.
            </p>
            <div className="games-create__row">
              <input
                id="new-game-room-name"
                type="text"
                value={newGameRoomName}
                onChange={(event) => setNewGameRoomName(event.target.value)}
                placeholder="예: 오늘 저녁 라운드"
                maxLength="50"
                required
              />
              <input
                id="new-game-room-password"
                type="password"
                inputMode="numeric"
                pattern="[0-9]{4}"
                maxLength="4"
                value={newGameRoomPassword}
                onChange={(event) =>
                  setNewGameRoomPassword(
                    event.target.value.replace(/\D/g, '').slice(0, 4),
                  )
                }
                placeholder="암호 4자리"
                aria-label="게임방 암호 4자리"
                autoComplete="new-password"
                required
              />
              <button
                type="submit"
                disabled={isCreating || !newGameRoomName.trim() || isLoading}
              >
                <FiPlus aria-hidden="true" />
                {isCreating ? '생성 중...' : '게임방 만들기'}
              </button>
            </div>
          </form>
        </div>
      </section>
    </main>
  );
}

export default Games;
