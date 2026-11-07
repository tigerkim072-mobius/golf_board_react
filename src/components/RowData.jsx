import { useContext } from "react";
import { FireStoreProvider } from "../context/GolfContext";

export const RowData = () => {
  const ctx = useContext(FireStoreContext);
  rankedPlayers.map((player, index) => {
                const score = player.score;
  <tr key={player.id}>
    <th scope="row">{index + 1}</th>
    <td>{score - player.handicap}</td>
    <td>{player.nickname || player.name}</td>
    <td className="score-control">
      <button
        className="btn btn-success btn-sm"
        type="button"
        aria-label={`${player.name} 점수 올리기`}
        onClick={() => changePlayerValue(player, 'score', 1)}
      >
        +
      </button>
    </td>
    <td>{score}</td>
    <td className="score-control">
      <button
        className="btn btn-danger btn-sm"
        type="button"
        aria-label={`${player.name} 점수 내리기`}
        onClick={() => changePlayerValue(player, 'score', -1)}
      >
        −
      </button>
    </td>
    <td className="score-control">
      <button
        className="btn btn-success btn-sm"
        type="button"
        aria-label={`${player.name} 핸디캡 올리기`}
        onClick={() => changePlayerValue(player, 'handicap', 1)}
      >
        +
      </button>
    </td>
    <td>{player.handicap}</td>
    <td className="score-control">
      <button
        className="btn btn-danger btn-sm"
        type="button"
        aria-label={`${player.name} 핸디캡 내리기`}
        onClick={() => changePlayerValue(player, 'handicap', -1)}
      >
        −
      </button>
    </td>
    <td className="score-control">
      <button
        className="btn btn-success btn-sm"
        type="button"
        aria-label={`${player.name} 멀리건 추가`}
        onClick={() => changePlayerValue(player, 'mulligan', 1)}
      >
        +
      </button>
    </td>
    <td>{player.mulligan}</td>
    <td className="score-control">
      <button
        className="btn btn-danger btn-sm"
        type="button"
        aria-label={`${player.name} 멀리건 차감`}
        onClick={() => changePlayerValue(player, 'mulligan', -1)}
        disabled={player.mulligan <= 0}
      >
        −
      </button>
    </td>
    <td>
      <button
        className="btn btn-outline-secondary btn-sm"
        type="button"
        onClick={() => removePlayer(player)}
      >
        제외
      </button>
    </td>
  </tr>;
};
