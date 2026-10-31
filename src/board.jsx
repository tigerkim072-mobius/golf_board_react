import { useState } from 'react';
import heroImg from './assets/hero.png';
import reactLogo from './assets/react.svg';
import viteLogo from './assets/vite.svg';
import './App.css';

function App() {
  const [count, setCount] = useState(0);

  return (
    <>
      <nav class="navbar navbar-expand-lg bg-body-tertiary">
        <div class="container-fluid">
          <a class="navbar-brand" href="/scoreboard.html">
            스크린골프
          </a>
          <button
            className="navbar-toggler"
            type="button"
            data-bs-toggle="collapse"
            data-bs-target="#navbarText"
            aria-controls="navbarText"
            aria-expanded="false"
            aria-label="메뉴 열기"
          >
            <span class="navbar-toggler-icon"></span>
          </button>
          <div class="collapse navbar-collapse" id="navbarText">
            <ul class="navbar-nav me-auto mb-2 mb-lg-0">
              <li class="nav-item">
                <div class="d-flex gap-3">
                  <a class="nav-link" href="/players.html">
                    플레이어 관리
                  </a>
                </div>
              </li>
              <li class="nav-item">
                <a class="nav-link" href="/courts.html">
                  구장 관리
                </a>
              </li>
            </ul>
            <span class="navbar-text">▶</span>
          </div>
        </div>
      </nav>

      <div id="app-content" hidden>
        <div class="container-fluid px-1">
          <div class="row">
            <div class="col-12">
              <h1>순위표</h1>
              <div
                id="score-error"
                class="alert alert-danger d-none"
                role="alert"
              ></div>
              <div class="row g-2 align-items-end mb-3">
                <div class="col-12 col-md-6">
                  <label for="registered-player-select" class="form-label">
                    ㅇ 등록된 플레이어 추가
                  </label>
                  <select id="registered-player-select" class="form-select">
                    <option value="">플레이어를 선택하세요</option>
                  </select>
                </div>
                <div class="col-12 col-md-auto">
                  <button
                    id="add-registered-player"
                    class="btn btn-primary"
                    type="button"
                    disabled
                  >
                    게임에 추가
                  </button>
                </div>
              </div>
              <div class="text-end mb-2">
                <button id="reset-scores" class="btn btn-outline-danger">
                  전체 점수 초기화
                </button>
                <button id="reset-mulligans" class="btn btn-outline-danger">
                  전체 멀리건 초기화
                </button>
              </div>
              <table class="table table-striped table-bordered">
                <thead>
                  <tr>
                    <th scope="col" class="text-center">
                      순위
                    </th>
                    <th scope="col" class="text-center final-score-cell">
                      최종점수
                    </th>
                    <th scope="col" class="text-center final-score-cell">
                      이름
                    </th>
                    <th
                      scope="col"
                      class="text-center compact-stat-group"
                      colspan="3"
                    >
                      점수
                    </th>

                    <th
                      scope="col"
                      class="text-center compact-stat-group"
                      colspan="3"
                    >
                      핸디캡
                    </th>
                    <th
                      scope="col"
                      class="text-center compact-stat-group"
                      colspan="3"
                    >
                      멀리건
                    </th>
                    <th scope="col" class="text-center final-score-cell">
                      참가
                    </th>
                  </tr>
                </thead>
                <tbody id="score-table-body"></tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default App;
