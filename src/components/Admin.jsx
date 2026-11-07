import { useState } from 'react';
import {
  collection,
  deleteField,
  doc,
  getDocs,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from 'firebase/firestore';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  FiArrowRight,
  FiDatabase,
  FiFlag,
  FiGrid,
  FiLock,
  FiLogOut,
  FiMapPin,
  FiShield,
  FiUsers,
} from 'react-icons/fi';
import { db } from '../context/GolfContext';
import './Admin.css';

function Admin() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const courtId = state?.courtId || '';
  const [password, setPassword] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isMergingFields, setIsMergingFields] = useState(false);
  const [isMigratingScoreProfiles, setIsMigratingScoreProfiles] =
    useState(false);
  const [isDeletingScoreProfileFields, setIsDeletingScoreProfileFields] =
    useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [statusMessage, setStatusMessage] = useState('');

  async function handleSignIn(event) {
    event.preventDefault();
    if (!db) {
      setErrorMessage('Firebase 설정이 없어 관리자 암호를 확인할 수 없습니다.');
      return;
    }
    if (!password) {
      setErrorMessage('관리자 암호를 입력해 주세요.');
      return;
    }

    setIsSigningIn(true);
    setErrorMessage('');
    setStatusMessage('');
    try {
      const usersQuery = query(
        collection(db, 'users'),
        where('최고관리자', '==', password),
      );
      const usersSnapshot = await getDocs(usersQuery);
      if (usersSnapshot.empty) {
        setIsAdmin(false);
        setErrorMessage('관리자 암호가 일치하지 않습니다.');
        return;
      }
      setIsAdmin(true);
      setPassword('');
    } catch (error) {
      console.error('관리자 로그인에 실패했습니다.', error);
      setErrorMessage(
        error?.code === 'permission-denied'
          ? 'users 컬렉션을 조회할 권한이 없습니다. Firestore 보안 규칙을 확인해 주세요.'
          : `관리자 암호 확인에 실패했습니다. (${error?.code || 'unknown'})`,
      );
    } finally {
      setIsSigningIn(false);
    }
  }

  async function handleMergeHandicapFields() {
    if (!db || !isAdmin) {
      setErrorMessage('관리자 암호를 확인한 후 다시 시도해 주세요.');
      return;
    }

    setIsMergingFields(true);
    setErrorMessage('');
    setStatusMessage('');
    try {
      const playersSnapshot = await getDocs(collection(db, 'players'));
      const documents = playersSnapshot.docs.filter((snapshot) =>
        Object.hasOwn(snapshot.data(), '핸디'),
      );
      if (
        documents.length > 0 &&
        !window.confirm(
          `${documents.length}개 players 문서의 핸디 필드를 handicap으로 통합할까요? 이 작업은 되돌릴 수 없습니다.`,
        )
      ) {
        return;
      }
      let updatedCount = 0;

      for (let index = 0; index < documents.length; index += 500) {
        const batch = writeBatch(db);
        const chunk = documents.slice(index, index + 500);
        chunk.forEach((snapshot) => {
          const data = snapshot.data();
          batch.update(snapshot.ref, {
            ...(Object.hasOwn(data, 'handicap')
              ? {}
              : { handicap: data['핸디'] }),
            '핸디': deleteField(),
          });
        });
        await batch.commit();
        updatedCount += chunk.length;
      }

      setStatusMessage(
        updatedCount > 0
          ? `${updatedCount}개 players 문서에서 핸디 필드를 handicap으로 통합했습니다.`
          : '통합할 핸디 필드가 없습니다.',
      );
    } catch (error) {
      console.error('핸디 필드를 통합하지 못했습니다.', error);
      setErrorMessage(
        `Firestore 필드 통합에 실패했습니다. (${error?.code || 'unknown'})`,
      );
    } finally {
      setIsMergingFields(false);
    }
  }

  async function handleMigrateScoreProfiles() {
    if (!db || !isAdmin) {
      setErrorMessage('관리자 암호를 확인한 후 다시 시도해 주세요.');
      return;
    }

    setIsMigratingScoreProfiles(true);
    setErrorMessage('');
    setStatusMessage('');
    let migratedScoreCount = 0;
    let importedPlayerCount = 0;
    try {
      const [scoresSnapshot, playersSnapshot] = await Promise.all([
        getDocs(collection(db, 'scores')),
        getDocs(collection(db, 'players')),
      ]);
      const profileFields = [
        'nickname',
        '별명',
        'name',
        '이름',
        'handicap',
        '핸디',
        'mulligan',
        '멀리건',
      ];
      const playersById = new Map();
      const playerIdsByNickname = new Map();
      playersSnapshot.docs.forEach((playerDocument) => {
        const data = playerDocument.data();
        const nickname = String(
          data.nickname || data['별명'] || data.name || data['이름'] || '',
        ).trim();
        const courtId = String(data.courtId || data['구장ID'] || '');
        playersById.set(playerDocument.id, playerDocument);
        if (courtId && nickname) {
          playerIdsByNickname.set(
            JSON.stringify([courtId, nickname.toLowerCase()]),
            playerDocument.id,
          );
        }
      });

      const newPlayers = new Map();
      const scoreUpdates = [];
      let skippedScoreCount = 0;
      scoresSnapshot.docs.forEach((scoreDocument) => {
        const data = scoreDocument.data();
        const hasProfileFields = profileFields.some((field) =>
          Object.hasOwn(data, field),
        );
        if (!hasProfileFields) return;

        const nickname = String(
          data.nickname || data['별명'] || data.name || data['이름'] || '',
        ).trim();
        const courtId = String(data.courtId || data['구장ID'] || '');
        const referencedPlayerId = String(
          data.playerId || data.rosterPlayerId || '',
        );
        let playerId = referencedPlayerId;
        if (!playersById.has(playerId) && playerId) {
          playerId = '';
        }

        if (!playerId && courtId && nickname) {
          playerId =
            playerIdsByNickname.get(
              JSON.stringify([courtId, nickname.toLowerCase()]),
            ) || '';
        }

        if (!playerId && courtId && nickname) {
          const preferredPlayerId = referencedPlayerId || scoreDocument.id;
          playerId = playersById.has(preferredPlayerId)
            ? doc(collection(db, 'players')).id
            : preferredPlayerId;
          const key = JSON.stringify([courtId, nickname.toLowerCase()]);
          newPlayers.set(playerId, {
            courtId,
            nickname,
            handicap: Number(data.handicap ?? data['핸디'] ?? 0),
            mulligan: Number(data.mulligan ?? data['멀리건'] ?? 0),
          });
          playerIdsByNickname.set(key, playerId);
        }

        if (!playerId) {
          skippedScoreCount += 1;
          return;
        }

        scoreUpdates.push({ scoreDocument, playerId });
      });

      if (scoreUpdates.length === 0) {
        setStatusMessage(
          `이관할 scores 프로필이 없습니다.${skippedScoreCount > 0 ? ` 구장 또는 별명 정보가 부족한 ${skippedScoreCount}개 문서는 건너뛰었습니다.` : ''}`,
        );
        return;
      }

      if (
        !window.confirm(
          `scores의 프로필 정보 ${scoreUpdates.length}건을 players 컬렉션으로 이관하고, scores에서는 playerId와 게임 데이터를 유지한 채 프로필 필드를 삭제할까요?${newPlayers.size > 0 ? ` 신규 플레이어 ${newPlayers.size}명도 추가됩니다.` : ''} 이 작업은 되돌릴 수 없습니다.`,
        )
      ) {
        return;
      }

      const migrationOperations = [
        ...[...newPlayers.entries()].map(([playerId, player]) => ({
          type: 'player',
          playerId,
          player,
        })),
        ...scoreUpdates.map(({ scoreDocument, playerId }) => ({
          type: 'score',
          scoreDocument,
          playerId,
        })),
      ];
      for (let index = 0; index < migrationOperations.length; index += 500) {
        const batch = writeBatch(db);
        const chunk = migrationOperations.slice(index, index + 500);
        chunk.forEach((operation) => {
          if (operation.type === 'player') {
            const { courtId, nickname, handicap, mulligan } = operation.player;
            const safeHandicap = Number.isFinite(handicap) ? handicap : 0;
            const safeMulligan = Number.isFinite(mulligan) ? mulligan : 0;
            batch.set(doc(db, 'players', operation.playerId), {
              courtId,
              '구장ID': courtId,
              nickname,
              별명: nickname,
              name: nickname,
              '이름': nickname,
              handicap: safeHandicap,
              mulligan: safeMulligan,
              '멀리건': safeMulligan,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
            return;
          }

          batch.update(operation.scoreDocument.ref, {
            playerId: operation.playerId,
            rosterPlayerId: deleteField(),
            ...Object.fromEntries(
              profileFields.map((field) => [field, deleteField()]),
            ),
            updatedAt: serverTimestamp(),
          });
        });
        await batch.commit();
        chunk.forEach((operation) => {
          if (operation.type === 'player') importedPlayerCount += 1;
          else migratedScoreCount += 1;
        });
      }

      setStatusMessage(
        `scores ${migratedScoreCount}건의 프로필을 players로 분리했습니다. 신규 플레이어 ${importedPlayerCount}명을 추가했고, ${skippedScoreCount}건은 구장 또는 별명 정보가 부족해 건너뛰었습니다.`,
      );
    } catch (error) {
      console.error('scores 프로필 이관에 실패했습니다.', error);
      setErrorMessage(
        migratedScoreCount > 0 || importedPlayerCount > 0
          ? `scores ${migratedScoreCount}건 정리, 신규 플레이어 ${importedPlayerCount}명 추가 후 중단되었습니다. 다시 실행해 남은 문서를 처리할 수 있습니다. (${error?.code || 'unknown'})`
          : `프로필 이관에 실패했습니다. (${error?.code || 'unknown'})`,
      );
    } finally {
      setIsMigratingScoreProfiles(false);
    }
  }

  async function handleDeleteScoreProfileFields() {
    if (!db || !isAdmin) {
      setErrorMessage('관리자 암호를 확인한 후 다시 시도해 주세요.');
      return;
    }

    setIsDeletingScoreProfileFields(true);
    setErrorMessage('');
    setStatusMessage('');
    let updatedCount = 0;
    try {
      const scoresSnapshot = await getDocs(collection(db, 'scores'));
      const fieldsToDelete = ['name', 'nickname', 'handicap'];
      const documents = scoresSnapshot.docs.filter((scoreDocument) =>
        fieldsToDelete.some((field) =>
          Object.hasOwn(scoreDocument.data(), field),
        ),
      );

      if (documents.length === 0) {
        setStatusMessage('삭제할 name, nickname, handicap 필드가 없습니다.');
        return;
      }

      if (
        !window.confirm(
          `${documents.length}개 scores 문서에서 name, nickname, handicap 필드를 삭제할까요? 이 작업은 되돌릴 수 없습니다.`,
        )
      ) {
        return;
      }

      for (let index = 0; index < documents.length; index += 500) {
        const batch = writeBatch(db);
        const chunk = documents.slice(index, index + 500);
        chunk.forEach((scoreDocument) => {
          const data = scoreDocument.data();
          const updates = Object.fromEntries(
            fieldsToDelete
              .filter((field) => Object.hasOwn(data, field))
              .map((field) => [field, deleteField()]),
          );
          batch.update(scoreDocument.ref, updates);
        });
        await batch.commit();
        updatedCount += chunk.length;
      }

      setStatusMessage(
        `${updatedCount}개 scores 문서에서 name, nickname, handicap 필드를 삭제했습니다.`,
      );
    } catch (error) {
      console.error('scores 프로필 필드를 삭제하지 못했습니다.', error);
      setErrorMessage(
        updatedCount > 0
          ? `${updatedCount}개 scores 문서 처리 후 중단되었습니다. (${error?.code || 'unknown'})`
          : `scores 필드 삭제에 실패했습니다. (${error?.code || 'unknown'})`,
      );
    } finally {
      setIsDeletingScoreProfileFields(false);
    }
  }

  function handleSignOut() {
    setIsAdmin(false);
    setStatusMessage('');
    setPassword('');
  }

  function openPage(path, pageState = state) {
    navigate(path, { state: pageState });
  }

  return (
    <main className="admin-page">
      <section className="admin-shell" aria-labelledby="admin-title">
        <header className="admin-header">
          <div className="admin-brand">
            <FiFlag aria-hidden="true" />
            GREEN<span>CARD</span>
          </div>
          {isAdmin && (
            <button
              className="admin-signout"
              type="button"
              onClick={handleSignOut}
            >
              <FiLogOut aria-hidden="true" />
              로그아웃
            </button>
          )}
        </header>

        <div className="admin-content">
          <div className="admin-heading">
            <span className="admin-heading__icon" aria-hidden="true">
              <FiShield />
            </span>
            <div>
              <span className="admin-eyebrow">ADMINISTRATION</span>
              <h1 id="admin-title">관리자 페이지</h1>
              <p>관리 기능을 선택하거나 데이터 필드를 정리하세요.</p>
            </div>
          </div>

          {errorMessage && (
            <p className="admin-message admin-message--error" role="alert">
              {errorMessage}
            </p>
          )}
          {statusMessage && (
            <p className="admin-message admin-message--success" role="status">
              {statusMessage}
            </p>
          )}

          {!isAdmin ? (
            <form className="admin-login" onSubmit={handleSignIn}>
              <h2>관리자 로그인</h2>
              <label>
                <span>관리자 암호</span>
                <input
                  type="password"
                  autoComplete="off"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </label>
              <button type="submit" disabled={isSigningIn}>
                <FiLock aria-hidden="true" />
                {isSigningIn ? '확인 중...' : '관리자 로그인'}
              </button>
            </form>
          ) : (
            <>
              <div className="admin-tools" aria-label="관리 기능">
                <button
                  className="admin-tool"
                  type="button"
                  onClick={() =>
                    openPage('/games', courtId ? { courtId } : undefined)
                  }
                >
                  <FiGrid aria-hidden="true" />
                  <span>
                    <strong>게임방 관리</strong>
                    <small>게임방 생성 및 관리</small>
                  </span>
                  <FiArrowRight aria-hidden="true" />
                </button>
                <button
                  className="admin-tool"
                  type="button"
                  onClick={() => openPage('/players')}
                >
                  <FiUsers aria-hidden="true" />
                  <span>
                    <strong>플레이어 관리</strong>
                    <small>플레이어 정보 및 명단</small>
                  </span>
                  <FiArrowRight aria-hidden="true" />
                </button>
                <button
                  className="admin-tool"
                  type="button"
                  onClick={() => openPage('/scores')}
                >
                  <FiDatabase aria-hidden="true" />
                  <span>
                    <strong>점수 관리</strong>
                    <small>스코어보드 데이터 확인</small>
                  </span>
                  <FiArrowRight aria-hidden="true" />
                </button>
                <button
                  className="admin-tool"
                  type="button"
                  onClick={() => openPage('/', { admin: true })}
                >
                  <FiMapPin aria-hidden="true" />
                  <span>
                    <strong>구장 관리</strong>
                    <small>구장 선택 및 등록 화면</small>
                  </span>
                  <FiArrowRight aria-hidden="true" />
                </button>
              </div>

              <section className="admin-migration">
                <div>
                  <h2>Firestore 필드 통합</h2>
                  <p>
                    players 문서의 기존 핸디 필드를 handicap으로 옮기고 이전
                    필드를 제거합니다. handicap 값이 이미 있으면 기존 값을
                    유지합니다.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleMergeHandicapFields}
                  disabled={isMergingFields}
                >
                  <FiDatabase aria-hidden="true" />
                  {isMergingFields ? '통합 중...' : '핸디 필드 통합'}
                </button>
              </section>

              <section className="admin-migration">
                <div>
                  <h2>scores 프로필 분리</h2>
                  <p>
                    scores의 플레이어 프로필을 players로 옮기고 scores에서는
                    프로필 필드를 제거합니다. 점수와 게임별 정보는 유지합니다.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleMigrateScoreProfiles}
                  disabled={isMigratingScoreProfiles || isMergingFields}
                >
                  <FiUsers aria-hidden="true" />
                  {isMigratingScoreProfiles
                    ? '이관 중...'
                    : '프로필 이관 및 분리'}
                </button>
              </section>

              <section className="admin-migration">
                <div>
                  <h2>scores 필드 삭제</h2>
                  <p>
                    scores 컬렉션의 모든 문서에서 name, nickname, handicap
                    필드를 삭제합니다. players 컬렉션의 필드에는 영향을 주지
                    않습니다.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleDeleteScoreProfileFields}
                  disabled={
                    isDeletingScoreProfileFields ||
                    isMigratingScoreProfiles ||
                    isMergingFields
                  }
                >
                  <FiDatabase aria-hidden="true" />
                  {isDeletingScoreProfileFields
                    ? '삭제 중...'
                    : 'scores 프로필 필드 삭제'}
                </button>
              </section>
            </>
          )}

          <button
            className="admin-back"
            type="button"
            onClick={() => navigate(-1)}
          >
            이전 화면으로
          </button>
        </div>
      </section>
    </main>
  );
}

export default Admin;
