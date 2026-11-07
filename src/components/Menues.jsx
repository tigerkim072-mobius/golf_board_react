import { useContext } from 'react';
import { FiGrid, FiLogOut, FiMapPin, FiShield } from 'react-icons/fi';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { GolfContext } from '../context/GolfContext';
import './Menues.css';

const Menues = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { courts = [] } = useContext(GolfContext) ?? {};
  const courtId = location.state?.courtId;
  const gameRoomName = location.state?.gameRoomName;
  const currentCourt = courts.find((court) => court.id === courtId);

  function handleLogout() {
    navigate('/', { replace: true, state: null });
  }

  return (
    <nav className="score-navigation" aria-label="주요 메뉴">
      <div className="score-navigation__links">
        <NavLink
          className="score-navigation__link"
          to="/scores"
          state={location.state}
        >
          스코어 보드
        </NavLink>
        <NavLink
          className="score-navigation__link"
          to="/players"
          state={location.state}
        >
          플레이어
        </NavLink>
        <NavLink
          className="score-navigation__link"
          to="/games"
          state={{ courtId }}
        >
          <FiGrid aria-hidden="true" />
          게임방
        </NavLink>
        <NavLink
          className="score-navigation__link"
          to="/admin"
          state={location.state}
        >
          <FiShield aria-hidden="true" />
          관리자
        </NavLink>
      </div>
      <div className="score-navigation__session">
        <span className="score-navigation__court">
          <FiMapPin aria-hidden="true" />
          {currentCourt?.name || '구장 정보 없음'}
          {gameRoomName ? ` · ${gameRoomName}` : ''}
        </span>
        <button
          className="score-navigation__logout"
          type="button"
          onClick={handleLogout}
        >
          <FiLogOut aria-hidden="true" />
          로그아웃
        </button>
      </div>
    </nav>
  );
};

export default Menues;
