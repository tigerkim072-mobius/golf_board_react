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
  FiAward,
  FiRefreshCw,
  FiUsers,
} from 'react-icons/fi';
import './ScoreBoard.css';
import Menus from './Menues';
import PlayerSelect from './PlayerSelect';
import ScoreCard from './ScoreCard';
import { db, GolfContext } from '../context/GolfContext';

function getFirestoreErrorMessage(error) {
  if (error.code === 'permission-denied') {
    return 'Firestore 접근 권한이 없습니다. 보안 규칙을 확인해 주세요.';
  }
  if (error.code === 'unavailable') {
    return 'Firestore에 연결할 수 없습니다. 네트워크를 확인해 주세요.';
  }
  return `점수 목록을 불러오지 못했습니다. (${error.code || 'unknown'})`;
}

function normalizeScore(scoreDocument, playerDocument) {
  const data = scoreDocument?.data() ?? {};
  const playerData = playerDocument?.data() ?? data;
  const toNumber = (value) => {
    const number = Number(value ?? 0);
    return Number.isFinite(number) ? number : 0;
  };
  const scoreDocumentId = scoreDocument?.id ?? '';
  const playerId = String(
    data.playerId || data.rosterPlayerId || scoreDocumentId || playerDocument.id,
  );

  return {
    id: scoreDocumentId || playerDocument.id,
    scoreDocumentId,
    playerId,
    name: String(
      playerData.nickname ||
        playerData['별명'] ||
        playerData.name ||
        playerData['이름'] ||
        '이름 없음',
    ),
    score: toNumber(data.score ?? data['점수']),
    handicap: toNumber(playerData.handicap ?? playerData['핸디']),
    mulligan: toNumber(playerData.mulligan ?? playerData['멀리건']),
    mulliganUsed: toNumber(data.mulliganUsed),
    gameActive: data['게임중'] === true || data.gameActive === true,
    cardOrder: Number.isInteger(data.cardOrder) ? data.cardOrder : null,
    roomNumber: Math.max(
      1,
      Math.trunc(toNumber(data.roomNumber ?? data['방번호'] ?? 1)),
    ),
    playerNumber:
      Number.isInteger(data.playerNumber ?? data['플레이어번호']) &&
      Number(data.playerNumber ?? data['플레이어번호']) > 0
        ? Number(data.playerNumber ?? data['플레이어번호'])
        : null,
    gameRoomId: String(data['게임방ID'] || data.gameRoomId || ''),
    rosterPlayerId: String(data.rosterPlayerId || ''),
  };
}

function assignPlayerNumbers(players) {
  const sortedPlayers = [...players].sort(
    (first, second) =>
      first.roomNumber - second.roomNumber ||
      (first.playerNumber ?? first.cardOrder ?? Number.MAX_SAFE_INTEGER) -
        (second.playerNumber ?? second.cardOrder ?? Number.MAX_SAFE_INTEGER) ||
      first.score - first.handicap - (second.score - second.handicap) ||
      first.name.localeCompare(second.name, 'ko'),
  );
  const roomPlayerNumbers = new Map();

  return sortedPlayers.map((player) => {
    const playerNumber = (roomPlayerNumbers.get(player.roomNumber) || 0) + 1;
    roomPlayerNumbers.set(player.roomNumber, playerNumber);
    return { ...player, playerNumber };
  });
}

export const ScoreBoard = () => {
  const { state } = useLocation();
  const courtId = state?.courtId;
  const gameRoomId = state?.gameRoomId || '';
  const gameRoomName = state?.gameRoomName || '';
  const scoreboardScopeId = `${courtId || ''}:${gameRoomId}`;
  const { courts = [] } = useContext(GolfContext) ?? {};
  const courtName = courts.find((court) => court.id === courtId)?.name;
  const [rankedPlayers, setRankedPlayers] = useState([]);
  const [waitingPlayers, setWaitingPlayers] = useState([]);
  const [rosterPlayers, setRosterPlayers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [loadedCourtId, setLoadedCourtId] = useState('');
  const [editingPlayerId, setEditingPlayerId] = useState('');
  const [editingMode, setEditingMode] = useState('');
  const [editDraft, setEditDraft] = useState(null);
  const [isSavingScore, setIsSavingScore] = useState(false);
  const [viewMode, setViewMode] = useState('rank');
  const [roomNumberDrafts, setRoomNumberDrafts] = useState({});
  const [playerNumberDrafts, setPlayerNumberDrafts] = useState({});
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const [busyPlayerId, setBusyPlayerId] = useState('');
  const [resetAction, setResetAction] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function loadScores() {
      if (!courtId) {
        setErrorMessage(
          '구장 정보를 확인할 수 없습니다. 다시 로그인해 주세요.',
        );
        setLoadedCourtId('');
        setIsLoading(false);
        return;
      }

      if (!db) {
        setErrorMessage('Firebase 설정이 없어 점수 목록을 불러올 수 없습니다.');
        setLoadedCourtId(scoreboardScopeId);
        setIsLoading(false);
        return;
      }

      setErrorMessage('');
      setIsLoading(true);
      try {
        const [playerSnapshot, courtSnapshot, gameRoomSnapshot] =
          await Promise.all([
            getDocs(
              query(
                collection(db, 'players'),
                where('courtId', '==', courtId),
              ),
            ),
            getDocs(
              query(collection(db, 'scores'), where('구장ID', '==', courtId)),
            ),
            gameRoomId
              ? getDocs(
                  query(
                    collection(db, 'scores'),
                    where('게임방ID', '==', gameRoomId),
                  ),
                )
              : Promise.resolve(null),
          ]);
        const playerDocuments = new Map(
          playerSnapshot.docs.map((playerDocument) => [
            playerDocument.id,
            playerDocument,
          ]),
        );
        courtSnapshot.docs.forEach((scoreDocument) => {
          const data = scoreDocument.data();
          if (
            !data['게임방ID'] &&
            !data.gameRoomId &&
            !data.playerId &&
            !data.rosterPlayerId &&
            !playerDocuments.has(scoreDocument.id)
          ) {
            playerDocuments.set(scoreDocument.id, scoreDocument);
          }
        });
        const courtScoreDocuments = courtSnapshot.docs.filter(
          (scoreDocument) => {
            const data = scoreDocument.data();
            return !data['게임방ID'] && !data.gameRoomId;
          },
        );
        const profilePlayers = [...playerDocuments.values()].map(
          (playerDocument) => normalizeScore(null, playerDocument),
        );
        const scoreDocuments = gameRoomId
          ? gameRoomSnapshot?.docs ?? []
          : courtScoreDocuments;
        const allPlayers = scoreDocuments.map((scoreDocument) => {
          const data = scoreDocument.data();
          const playerId = String(
            data.playerId || data.rosterPlayerId || scoreDocument.id,
          );
          return normalizeScore(
            scoreDocument,
            playerDocuments.get(playerId),
          );
        });
        const waitingList = (() => {
          if (gameRoomId) {
            const roomPlayersByRosterId = new Map(
              allPlayers.map((player) => [player.playerId, player]),
            );
            const rosterWaitingPlayers = profilePlayers.flatMap(
              (rosterPlayer) => {
                const roomPlayer = roomPlayersByRosterId.get(rosterPlayer.id);
                if (roomPlayer?.gameActive) return [];
                return [
                  roomPlayer ?? {
                    ...rosterPlayer,
                    isRosterCandidate: true,
                    playerId: rosterPlayer.id,
                  },
                ];
              },
            );
            const roomOnlyWaitingPlayers = allPlayers.filter(
              (player) =>
                !player.gameActive &&
                !playerDocuments.has(player.playerId),
            );
            return [...rosterWaitingPlayers, ...roomOnlyWaitingPlayers].sort(
                (first, second) => first.name.localeCompare(second.name, 'ko'),
              );
          }

          const roomlessPlayersById = new Map(
            allPlayers.map((player) => [player.playerId, player]),
          );
          const rosterWaitingPlayers = profilePlayers.flatMap(
            (rosterPlayer) => {
              const scorePlayer = roomlessPlayersById.get(rosterPlayer.id);
              if (scorePlayer?.gameActive) return [];
              return [
                scorePlayer ?? {
                  ...rosterPlayer,
                  isRosterCandidate: true,
                },
              ];
            },
          );
          const scoreOnlyWaitingPlayers = allPlayers.filter(
            (player) =>
              !player.gameActive && !playerDocuments.has(player.playerId),
          );
          return [...rosterWaitingPlayers, ...scoreOnlyWaitingPlayers].sort(
            (first, second) => first.name.localeCompare(second.name, 'ko'),
          );
        })();
        const players = allPlayers
          .filter(
            (player) =>
              player.gameActive,
          )
          .sort(
            (first, second) =>
              first.score - first.handicap - (second.score - second.handicap) ||
              first.name.localeCompare(second.name, 'ko'),
          );

        if (isMounted) {
          setRosterPlayers(profilePlayers);
          setWaitingPlayers(waitingList);
          setRankedPlayers(
            assignPlayerNumbers(players).sort(
              (first, second) =>
                first.score -
                  first.handicap -
                  (second.score - second.handicap) ||
                first.name.localeCompare(second.name, 'ko'),
            ),
          );
        }
      } catch (error) {
        console.error('구장 점수 목록을 불러오지 못했습니다.', error);
        if (isMounted) setErrorMessage(getFirestoreErrorMessage(error));
      } finally {
        if (isMounted) {
          setLoadedCourtId(scoreboardScopeId);
          setIsLoading(false);
        }
      }
    }

    loadScores();
    return () => {
      isMounted = false;
    };
  }, [courtId, gameRoomId, scoreboardScopeId]);

  function startEditingScore(player) {
    setErrorMessage('');
    setEditingPlayerId(player.id);
    setEditingMode('score');
    setEditDraft({
      score: String(player.score),
    });
  }

  function startEditingProfile(player) {
    setErrorMessage('');
    setEditingPlayerId(player.id);
    setEditingMode('profile');
    setEditDraft({
      name: player.name,
      handicap: String(player.handicap),
      mulligan: String(player.mulligan),
    });
  }

  function cancelEditingScore() {
    setEditingPlayerId('');
    setEditingMode('');
    setEditDraft(null);
  }

  async function handleSaveScore(event, player) {
    event.preventDefault();
    const updatedScore = Number(editDraft?.score);

    if (!Number.isInteger(updatedScore)) {
      setErrorMessage('점수는 정수로 입력해 주세요.');
      return;
    }

    if (!db) {
      setErrorMessage('Firebase 설정이 없어 스코어 정보를 저장할 수 없습니다.');
      return;
    }

    setIsSavingScore(true);
    setErrorMessage('');
    try {
      await updateDoc(doc(db, 'scores', player.scoreDocumentId || player.id), {
        score: updatedScore,
        점수: updatedScore,
        updatedAt: serverTimestamp(),
      });

      setRankedPlayers((currentPlayers) =>
        currentPlayers
          .map((currentPlayer) =>
            currentPlayer.id === player.id
              ? {
                  ...currentPlayer,
                  score: updatedScore,
                }
              : currentPlayer,
          )
          .sort(
            (first, second) =>
              first.score - first.handicap - (second.score - second.handicap) ||
              first.name.localeCompare(second.name, 'ko'),
          ),
      );
      cancelEditingScore();
    } catch (error) {
      console.error('플레이어 스코어 정보를 저장하지 못했습니다.', error);
      setErrorMessage(getFirestoreErrorMessage(error));
    } finally {
      setIsSavingScore(false);
    }
  }

  async function handleSaveProfile(event, player) {
    event.preventDefault();
    const updatedName = editDraft?.name?.trim() ?? '';
    const updatedHandicap = Number(editDraft?.handicap);
    const updatedMulligan = Number(editDraft?.mulligan);

    if (!updatedName) {
      setErrorMessage('별명을 입력해 주세요.');
      return;
    }
    if (!Number.isInteger(updatedHandicap)) {
      setErrorMessage('핸디캡은 정수로 입력해 주세요.');
      return;
    }
    if (!Number.isInteger(updatedMulligan) || updatedMulligan < 0) {
      setErrorMessage('멀리건은 0 이상의 정수로 입력해 주세요.');
      return;
    }

    if (!db) {
      setErrorMessage('Firebase 설정이 없어 플레이어 정보를 저장할 수 없습니다.');
      return;
    }

    setIsSavingScore(true);
    setErrorMessage('');
    try {
      await setDoc(
        doc(db, 'players', player.playerId),
        {
          courtId,
          '구장ID': courtId,
          nickname: updatedName,
          별명: updatedName,
          handicap: updatedHandicap,
          핸디: deleteField(),
          mulligan: updatedMulligan,
          멀리건: updatedMulligan,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      setRankedPlayers((currentPlayers) =>
        currentPlayers
          .map((currentPlayer) =>
            currentPlayer.id === player.id
              ? {
                  ...currentPlayer,
                  name: updatedName,
                  handicap: updatedHandicap,
                  mulligan: updatedMulligan,
                }
              : currentPlayer,
          )
          .sort(
            (first, second) =>
              first.score - first.handicap - (second.score - second.handicap) ||
              first.name.localeCompare(second.name, 'ko'),
          ),
      );
      cancelEditingScore();
    } catch (error) {
      console.error('플레이어 정보를 저장하지 못했습니다.', error);
      setErrorMessage(getFirestoreErrorMessage(error));
    } finally {
      setIsSavingScore(false);
    }
  }

  async function handleAddPlayer(selectedPlayerIds, selectedRoomNumbers) {
    const playersToAdd = waitingPlayers.filter((player) =>
      selectedPlayerIds.includes(player.id),
    );
    if (playersToAdd.length === 0) {
      setErrorMessage('검색 결과에서 게임에 추가할 플레이어를 선택해 주세요.');
      return [];
    }

    setErrorMessage('');
    setBusyPlayerId('adding');
    let remainingPlayers = [...waitingPlayers];
    let activePlayers = [...rankedPlayers];
    const addedPlayerIds = [];
    try {
      for (const player of playersToAdd) {
      const roomNumber =
        selectedRoomNumbers[player.id] ?? player.roomNumber ?? 1;
      const lastPlayerNumber = activePlayers
        .filter(
          (currentPlayer) => currentPlayer.roomNumber === roomNumber,
        )
          .reduce(
            (highest, currentPlayer) =>
              Math.max(highest, currentPlayer.playerNumber || 0),
            0,
          );
        const activePlayer = {
          ...player,
          roomNumber,
          score: player.isRosterCandidate ? 0 : player.score,
          gameActive: true,
          playerNumber: lastPlayerNumber + 1,
        };
        if (player.isRosterCandidate) {
          const scoreDocument = await addDoc(collection(db, 'scores'), {
            courtId,
            '구장ID': courtId,
            ...(gameRoomId ? { gameRoomId, '게임방ID': gameRoomId } : {}),
            playerId: player.playerId || player.id,
            '게임중': true,
            gameActive: true,
            '점수': 0,
            score: 0,
            mulliganUsed: 0,
            roomNumber,
            방번호: roomNumber,
            playerNumber: activePlayer.playerNumber,
            플레이어번호: activePlayer.playerNumber,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          activePlayer.id = scoreDocument.id;
          activePlayer.scoreDocumentId = scoreDocument.id;
          activePlayer.playerId = player.playerId || player.id;
          activePlayer.gameRoomId = gameRoomId;
          delete activePlayer.isRosterCandidate;
        } else {
          await updateDoc(
            doc(db, 'scores', player.scoreDocumentId || player.id),
            {
              게임중: true,
              gameActive: true,
              roomNumber: activePlayer.roomNumber,
              방번호: activePlayer.roomNumber,
              playerNumber: activePlayer.playerNumber,
              플레이어번호: activePlayer.playerNumber,
              updatedAt: serverTimestamp(),
            },
          );
        }

        remainingPlayers = remainingPlayers.filter(
          (waitingPlayer) => waitingPlayer.id !== player.id,
        );
        activePlayers = [...activePlayers, activePlayer].sort(
          (first, second) =>
            first.score - first.handicap - (second.score - second.handicap) ||
            first.name.localeCompare(second.name, 'ko'),
        );
        addedPlayerIds.push(player.id);
        setWaitingPlayers(remainingPlayers);
        setRankedPlayers(activePlayers);
      }

    } catch (error) {
      console.error('플레이어를 게임에 추가하지 못했습니다.', error);
      setErrorMessage(getFirestoreErrorMessage(error));
    } finally {
      setBusyPlayerId('');
    }
    return addedPlayerIds;
  }

  async function handleCreateAndAddPlayer({
    nickname,
    handicap,
    mulligan,
    roomNumber,
  }) {
    const trimmedNickname = nickname.trim();
    const handicapValue = Number(handicap);
    const mulliganValue = Number(mulligan);
    if (!trimmedNickname) {
      setErrorMessage('플레이어 별명을 입력해 주세요.');
      return false;
    }
    if (!Number.isInteger(handicapValue)) {
      setErrorMessage('핸디캡은 정수로 입력해 주세요.');
      return false;
    }
    if (!Number.isInteger(mulliganValue) || mulliganValue < 0) {
      setErrorMessage('멀리건은 0 이상의 정수로 입력해 주세요.');
      return false;
    }
    if (!Number.isInteger(roomNumber) || roomNumber < 1 || roomNumber > 4) {
      setErrorMessage('참가 방은 1번부터 4번 중에서 선택해 주세요.');
      return false;
    }
    if (
      [...rosterPlayers, ...rankedPlayers].some(
        (player) =>
          player.name.toLocaleLowerCase() ===
          trimmedNickname.toLocaleLowerCase(),
      )
    ) {
      setErrorMessage('이미 등록된 플레이어 별명입니다.');
      return false;
    }
    if (!courtId || !db) {
      setErrorMessage('Firebase 설정 또는 구장 정보가 없어 플레이어를 추가할 수 없습니다.');
      return false;
    }

    setErrorMessage('');
    setBusyPlayerId('adding');
    let newPlayer = null;
    try {
      const playerDocument = await addDoc(collection(db, 'players'), {
        courtId,
        '구장ID': courtId,
        nickname: trimmedNickname,
        별명: trimmedNickname,
        name: trimmedNickname,
        '이름': trimmedNickname,
        handicap: handicapValue,
        mulligan: mulliganValue,
        '멀리건': mulliganValue,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      newPlayer = {
        id: playerDocument.id,
        playerId: playerDocument.id,
        name: trimmedNickname,
        handicap: handicapValue,
        mulligan: mulliganValue,
        score: 0,
        mulliganUsed: 0,
        gameActive: false,
        roomNumber,
        isRosterCandidate: true,
      };

      const playerNumber =
        rankedPlayers
          .filter((player) => player.roomNumber === roomNumber)
          .reduce(
            (highest, player) =>
              Math.max(highest, player.playerNumber || 0),
            0,
          ) + 1;
      const scoreDocument = await addDoc(collection(db, 'scores'), {
        courtId,
        '구장ID': courtId,
        ...(gameRoomId ? { gameRoomId, '게임방ID': gameRoomId } : {}),
        playerId: playerDocument.id,
        '게임중': true,
        gameActive: true,
        score: 0,
        '점수': 0,
        mulliganUsed: 0,
        roomNumber,
        방번호: roomNumber,
        playerNumber,
        플레이어번호: playerNumber,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      const activePlayer = {
        ...newPlayer,
        id: scoreDocument.id,
        scoreDocumentId: scoreDocument.id,
        gameRoomId,
        gameActive: true,
        playerNumber,
      };
      delete activePlayer.isRosterCandidate;
      setRosterPlayers((players) => [...players, newPlayer]);
      setRankedPlayers((players) =>
        assignPlayerNumbers([...players, activePlayer]),
      );
      setWaitingPlayers((players) =>
        players.filter((player) => player.id !== playerDocument.id),
      );
      return true;
    } catch (error) {
      if (newPlayer) {
        setRosterPlayers((players) => [...players, newPlayer]);
        setWaitingPlayers((players) => [...players, newPlayer]);
      }
      console.error('새 플레이어를 생성해 게임에 추가하지 못했습니다.', error);
      setErrorMessage(getFirestoreErrorMessage(error));
      return false;
    } finally {
      setBusyPlayerId('');
    }
  }

  async function handleRemovePlayer(player) {
    if (!db) {
      setErrorMessage(
        'Firebase 설정이 없어 플레이어를 게임에서 제외할 수 없습니다.',
      );
      return;
    }

    setErrorMessage('');
    setBusyPlayerId(player.id);
    try {
      await updateDoc(doc(db, 'scores', player.scoreDocumentId || player.id), {
        게임중: false,
        gameActive: false,
        updatedAt: serverTimestamp(),
      });

      setRankedPlayers((players) =>
        players.filter((currentPlayer) => currentPlayer.id !== player.id),
      );
      setWaitingPlayers((players) =>
        [...players, { ...player, gameActive: false }].sort((first, second) =>
          first.name.localeCompare(second.name, 'ko'),
        ),
      );
      if (editingPlayerId === player.id) cancelEditingScore();
    } catch (error) {
      console.error('플레이어를 게임에서 제외하지 못했습니다.', error);
      setErrorMessage(getFirestoreErrorMessage(error));
    } finally {
      setBusyPlayerId('');
    }
  }

  async function handleResetGameData(action) {
    if (rankedPlayers.length === 0) {
      setErrorMessage('초기화할 참가 플레이어가 없습니다.');
      return;
    }
    if (!db) {
      setErrorMessage('Firebase 설정이 없어 게임 데이터를 초기화할 수 없습니다.');
      return;
    }

    const isScoreReset = action === 'score';
    const actionName = isScoreReset ? '점수' : '멀리건 사용량';
    const confirmed = window.confirm(
      `${gameRoomName || '현재 게임'}의 참가 플레이어 ${rankedPlayers.length}명의 ${actionName}을 초기화할까요?`,
    );
    if (!confirmed) return;
    if (rankedPlayers.length > 500) {
      setErrorMessage('한 번에 초기화할 수 있는 플레이어는 최대 500명입니다.');
      return;
    }

    setResetAction(action);
    setErrorMessage('');
    try {
      const batch = writeBatch(db);
      rankedPlayers.forEach((player) => {
        batch.update(
          doc(db, 'scores', player.scoreDocumentId || player.id),
          isScoreReset
            ? {
                score: 0,
                점수: 0,
                updatedAt: serverTimestamp(),
              }
            : {
                mulliganUsed: 0,
                updatedAt: serverTimestamp(),
              },
        );
      });
      await batch.commit();

      if (isScoreReset) {
        setRankedPlayers((players) =>
          players
            .map((player) => ({ ...player, score: 0 }))
            .sort(
              (first, second) =>
                first.score -
                  first.handicap -
                  (second.score - second.handicap) ||
                first.name.localeCompare(second.name, 'ko'),
            ),
        );
      } else {
        setRankedPlayers((players) =>
          players.map((player) => ({ ...player, mulliganUsed: 0 })),
        );
      }
    } catch (error) {
      console.error(`${actionName} 초기화에 실패했습니다.`, error);
      setErrorMessage(getFirestoreErrorMessage(error));
    } finally {
      setResetAction('');
    }
  }

  async function saveRoomAssignments(assignedPlayers) {
    if (!db) {
      setErrorMessage(
        'Firebase 설정이 없어 방·플레이어 번호를 저장할 수 없습니다.',
      );
      return;
    }

    if (assignedPlayers.length > 500) {
      setErrorMessage('한 번에 저장할 수 있는 플레이어는 최대 500명입니다.');
      return;
    }

    setIsSavingOrder(true);
    setErrorMessage('');
    try {
      const batch = writeBatch(db);
      assignedPlayers.forEach((player) => {
        batch.update(
          doc(db, 'scores', player.scoreDocumentId || player.id),
          {
          roomNumber: player.roomNumber,
          방번호: player.roomNumber,
          playerNumber: player.playerNumber,
          플레이어번호: player.playerNumber,
          updatedAt: serverTimestamp(),
          },
        );
      });
      await batch.commit();
      setRankedPlayers((currentPlayers) =>
        currentPlayers.map(
          (player) =>
            assignedPlayers.find(
              (assignedPlayer) => assignedPlayer.id === player.id,
            ) ?? player,
        ),
      );
    } catch (error) {
      console.error('방·플레이어 번호를 저장하지 못했습니다.', error);
      setErrorMessage(getFirestoreErrorMessage(error));
    } finally {
      setIsSavingOrder(false);
    }
  }

  function orderRoomPlayers(roomPlayers, movedPlayerId, targetNumber) {
    const reorderedPlayers = [...roomPlayers];
    const currentIndex = reorderedPlayers.findIndex(
      (player) => player.id === movedPlayerId,
    );
    if (currentIndex === -1) return [];

    const [movedPlayer] = reorderedPlayers.splice(currentIndex, 1);
    reorderedPlayers.splice(targetNumber - 1, 0, movedPlayer);
    return reorderedPlayers.map((player, index) => ({
      ...player,
      playerNumber: index + 1,
    }));
  }

  async function saveRoomNumber(playerId, value) {
    setRoomNumberDrafts((drafts) => {
      const nextDrafts = { ...drafts };
      delete nextDrafts[playerId];
      return nextDrafts;
    });

    const roomNumber = Number(value);
    if (!Number.isInteger(roomNumber) || roomNumber < 1) {
      setErrorMessage('방번호는 1 이상의 정수로 입력해 주세요.');
      return;
    }

    const changedPlayer = rankedPlayers.find(
      (player) => player.id === playerId,
    );
    if (!changedPlayer || changedPlayer.roomNumber === roomNumber) return;

    const affectedRooms = new Set([changedPlayer.roomNumber, roomNumber]);
    const affectedPlayers = rankedPlayers.filter(
      (player) =>
        affectedRooms.has(player.roomNumber) || player.id === playerId,
    );
    const playersByRoom = new Map();
    affectedPlayers.forEach((player) => {
      const nextRoomNumber =
        player.id === playerId ? roomNumber : player.roomNumber;
      const roomPlayers = playersByRoom.get(nextRoomNumber) ?? [];
      roomPlayers.push({ ...player, roomNumber: nextRoomNumber });
      playersByRoom.set(nextRoomNumber, roomPlayers);
    });

    const assignedPlayers = [...playersByRoom.entries()].flatMap(
      ([nextRoomNumber, roomPlayers]) =>
        [...roomPlayers]
          .sort(
            (first, second) =>
              (first.playerNumber ?? Number.MAX_SAFE_INTEGER) -
                (second.playerNumber ?? Number.MAX_SAFE_INTEGER) ||
              first.name.localeCompare(second.name, 'ko'),
          )
          .map((player, index) => ({
            ...player,
            roomNumber: nextRoomNumber,
            playerNumber: index + 1,
          })),
    );
    await saveRoomAssignments(assignedPlayers);
  }

  async function savePlayerNumber(playerId, value) {
    setPlayerNumberDrafts((drafts) => {
      const nextDrafts = { ...drafts };
      delete nextDrafts[playerId];
      return nextDrafts;
    });

    const player = rankedPlayers.find(
      (currentPlayer) => currentPlayer.id === playerId,
    );
    if (!player) return;

    const roomPlayers = rankedPlayers
      .filter((currentPlayer) => currentPlayer.roomNumber === player.roomNumber)
      .sort(
        (first, second) =>
          (first.playerNumber ?? Number.MAX_SAFE_INTEGER) -
            (second.playerNumber ?? Number.MAX_SAFE_INTEGER) ||
          first.name.localeCompare(second.name, 'ko'),
      );
    const playerNumber = Number(value);
    if (
      !Number.isInteger(playerNumber) ||
      playerNumber < 1 ||
      playerNumber > roomPlayers.length
    ) {
      setErrorMessage(
        `플레이어 번호는 같은 방에서 1부터 ${roomPlayers.length} 사이로 입력해 주세요.`,
      );
      return;
    }

    if (playerNumber === player.playerNumber) return;
    setErrorMessage('');
    await saveRoomAssignments(
      orderRoomPlayers(roomPlayers, playerId, playerNumber),
    );
  }

  const playersWithRanks = rankedPlayers.reduce((players, player, index) => {
    const netScore = player.score - player.handicap;
    const previousPlayer = players[index - 1];
    const rank =
      previousPlayer?.netScore === netScore ? previousPlayer.rank : index + 1;

    players.push({ ...player, netScore, rank });
    return players;
  }, []);
  const displayedPlayers =
    viewMode === 'rank'
      ? playersWithRanks
      : [...playersWithRanks].sort(
          (first, second) =>
            first.roomNumber - second.roomNumber ||
            (first.playerNumber ?? first.cardOrder ?? Number.MAX_SAFE_INTEGER) -
              (second.playerNumber ??
                second.cardOrder ??
                Number.MAX_SAFE_INTEGER) ||
            first.rank - second.rank,
        );
  const playersByRoom = displayedPlayers.reduce((rooms, player) => {
    const roomPlayers = rooms.get(player.roomNumber) ?? [];
    roomPlayers.push(player);
    rooms.set(player.roomNumber, roomPlayers);
    return rooms;
  }, new Map());

  function renderPlayerCard(player, index) {
    return (
      <ScoreCard
        key={player.id}
        player={player}
        index={index}
        viewMode={viewMode}
        roomNumberDraft={roomNumberDrafts[player.id]}
        playerNumberDraft={playerNumberDrafts[player.id]}
        roomPlayerCount={
          rankedPlayers.filter(
            (roomPlayer) => roomPlayer.roomNumber === player.roomNumber,
          ).length
        }
        isSavingOrder={isSavingOrder}
        editingMode={editingPlayerId === player.id ? editingMode : ''}
        editDraft={editingPlayerId === player.id ? editDraft : null}
        isSavingScore={isSavingScore}
        isBusy={busyPlayerId === player.id}
        onRoomNumberDraftChange={(value) =>
          setRoomNumberDrafts((drafts) => ({
            ...drafts,
            [player.id]: value,
          }))
        }
        onSaveRoomNumber={(value) => saveRoomNumber(player.id, value)}
        onPlayerNumberDraftChange={(value) =>
          setPlayerNumberDrafts((drafts) => ({
            ...drafts,
            [player.id]: value,
          }))
        }
        onSavePlayerNumber={(value) => savePlayerNumber(player.id, value)}
        onStartEditingProfile={() => startEditingProfile(player)}
        onEditDraftChange={(changes) =>
          setEditDraft((draft) => ({ ...draft, ...changes }))
        }
        onSaveScore={handleSaveScore}
        onSaveProfile={handleSaveProfile}
        onCancelEditing={cancelEditingScore}
        onStartEditingScore={() => startEditingScore(player)}
        onRemovePlayer={handleRemovePlayer}
      />
    );
  }

  return (
    <>
      <Menus />
      <main className="scoreboard-page">
        <header className="scoreboard-header">
          <div>
            <h1>스코어 보드</h1>
            <p>
              {gameRoomName
                ? `${gameRoomName} · ${courtName || '현재 구장'}`
                : `${courtName || '현재 구장'} 참가 플레이어 순위`}
            </p>
          </div>
          {!isLoading && loadedCourtId === scoreboardScopeId && (
            <span className="scoreboard-player-count">
              <FiUsers aria-hidden="true" />
              {rankedPlayers.length}명 참가
            </span>
          )}
        </header>

        {!errorMessage &&
          !isLoading &&
          loadedCourtId === scoreboardScopeId && (
          <div className="scoreboard-view-switch" aria-label="카드 정렬 방식">
            <button
              className={`scoreboard-view-switch__button${viewMode === 'rank' ? ' is-active' : ''}`}
              type="button"
              onClick={() => setViewMode('rank')}
              aria-pressed={viewMode === 'rank'}
            >
              정렬 : 순위
            </button>
            <button
              className={`scoreboard-view-switch__button${viewMode === 'manual' ? ' is-active' : ''}`}
              type="button"
              onClick={() => setViewMode('manual')}
              aria-pressed={viewMode === 'manual'}
            >
              정렬 : 방/플레이어
            </button>
          </div>
        )}

        {!errorMessage &&
          !isLoading &&
          loadedCourtId === scoreboardScopeId && (
          <PlayerSelect
            waitingPlayers={waitingPlayers}
            isBusy={busyPlayerId !== ''}
            onAddPlayers={handleAddPlayer}
            onCreateAndAddPlayer={handleCreateAndAddPlayer}
          />
        )}

        {errorMessage && (
          <div className="scoreboard-error" role="alert">
            {errorMessage}
          </div>
        )}

        {errorMessage ? null : isLoading ||
          loadedCourtId !== scoreboardScopeId ? (
          <div className="scoreboard-empty-state" role="status">
            <span className="scoreboard-empty-state__icon" aria-hidden="true">
              <FiAward />
            </span>
            <p>점수 순위를 불러오는 중입니다.</p>
          </div>
        ) : rankedPlayers.length > 0 ? (
          viewMode === 'rank' ? (
            <div className="scoreboard-grid">
              {displayedPlayers.map(renderPlayerCard)}
            </div>
          ) : (
            <div className="scoreboard-room-groups">
              {[...playersByRoom.entries()].map(([roomNumber, roomPlayers]) => (
                <section
                  className="scoreboard-room-group"
                  key={roomNumber}
                  aria-labelledby={`scoreboard-room-${roomNumber}`}
                >
                  <h2
                    className="scoreboard-room-group__title"
                    id={`scoreboard-room-${roomNumber}`}
                  >
                    {roomNumber}번 방
                    <span>{roomPlayers.length}명</span>
                  </h2>
                  <div className="scoreboard-grid">
                    {roomPlayers.map(renderPlayerCard)}
                  </div>
                </section>
              ))}
            </div>
          )
        ) : (
          <div className="scoreboard-empty-state">
            <span className="scoreboard-empty-state__icon" aria-hidden="true">
              <FiAward />
            </span>
            <p>현재 게임에 참가한 플레이어가 없습니다.</p>
            <span>플레이어 관리에서 게임 참가 상태로 등록해 주세요.</span>
          </div>
        )}
        {!isLoading &&
          loadedCourtId === scoreboardScopeId && (
            <section
              className="scoreboard-reset-actions"
              aria-label="게임 데이터 초기화"
            >
              <p>
                {gameRoomName || '현재 게임'} 참가자 데이터 초기화
              </p>
              <div>
                <button
                  type="button"
                  className="scoreboard-reset-actions__button"
                  onClick={() => handleResetGameData('score')}
                  disabled={
                    rankedPlayers.length === 0 ||
                    resetAction !== '' ||
                    busyPlayerId !== ''
                  }
                >
                  <FiRefreshCw aria-hidden="true" />
                  {resetAction === 'score' ? '초기화 중...' : '점수 초기화'}
                </button>
                <button
                  type="button"
                  className="scoreboard-reset-actions__button scoreboard-reset-actions__button--mulligan"
                  onClick={() => handleResetGameData('mulligan')}
                  disabled={
                    rankedPlayers.length === 0 ||
                    resetAction !== '' ||
                    busyPlayerId !== ''
                  }
                >
                  <FiRefreshCw aria-hidden="true" />
                  {resetAction === 'mulligan'
                    ? '초기화 중...'
                    : '멀리건 초기화'}
                </button>
              </div>
            </section>
          )}
      </main>
    </>
  );
};

export default ScoreBoard;
