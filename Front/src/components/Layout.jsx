import React, { useEffect, useMemo, useState } from "react";
import { Link, Outlet, useNavigate } from "react-router-dom";
import "bulma/css/bulma.min.css";
import TeamMembers from "./TeamMembers";
import "./Layout.css";
import AIAssistant from "./AIAssistant";

const CHECKLIST_STORAGE_KEY = "synkingChecklist";

const Layout = () => {
  const navigate = useNavigate();

  const [checklist, setChecklist] = useState([]);
  const [inputText, setInputText] = useState("");

  const initialChecklist = useMemo(() => {
    try {
      const raw = localStorage.getItem(CHECKLIST_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.error("체크리스트 로드 실패", e);
      return [];
    }
  }, []);

  useEffect(() => {
    setChecklist(initialChecklist);
  }, [initialChecklist]);

  useEffect(() => {
    try {
      localStorage.setItem(CHECKLIST_STORAGE_KEY, JSON.stringify(checklist));
    } catch (e) {
      console.error("체크리스트 저장 실패", e);
    }
  }, [checklist]);

  const makeId = () => {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  };

  const handleLogout = (e) => {
    e?.preventDefault?.();
    localStorage.removeItem("token");
    localStorage.removeItem("userName");
    localStorage.removeItem("userEmail");
    navigate("/", { replace: true });
  };

  const handleInputChange = (e) => {
    setInputText(e.target.value);
  };

  const handleAddItem = () => {
    const text = inputText.trim();
    if (!text) return;

    setChecklist((prev) => [...prev, { id: makeId(), text }]);
    setInputText("");
  };

  const handleCheckboxChange = (id) => {
    setChecklist((prev) => prev.filter((item) => item.id !== id));
  };

  const handleDeleteItem = (id) => {
    setChecklist((prev) => prev.filter((item) => item.id !== id));
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      handleAddItem();
    }
  };

  return (
    <div className="layout">
      <header className="navbar is-primary">
        <div className="navbar-menu">
          <div className="navbar-start">
            <Link to="/home" className="navbar-item">
              메인
            </Link>
            <Link to="/tasks" className="navbar-item">
              업무
            </Link>
            <Link to="/files" className="navbar-item">
              파일함
            </Link>
            <Link to="/calendar" className="navbar-item">
              캘린더
            </Link>
          </div>

          <div className="navbar-end">
            <div className="navbar-item">
              <div className="navbar-brand">
                <Link to="/" className="navbar-item" onClick={handleLogout}>
                  로그아웃
                </Link>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="columns">
        <aside className="menu sidebar column is-one-fifth">
          <div className="box checklist-box">
            <h4 className="title">체크리스트</h4>

            <div className="field has-addons">
              <div className="control is-expanded">
                <input
                  className="input"
                  type="text"
                  placeholder="항목 추가"
                  value={inputText}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                />
              </div>
              <div className="control">
                <button className="button is-primary" onClick={handleAddItem}>
                  추가
                </button>
              </div>
            </div>

            <ul className="checklist">
              {checklist.length === 0 ? (
                <li className="has-text-grey">체크리스트가 비어 있습니다.</li>
              ) : (
                checklist.map((item) => (
                  <li key={item.id} className="field">
                    <div className="is-flex is-justify-content-space-between is-align-items-center">
                      <label className="checkbox">
                        <input
                          type="checkbox"
                          onChange={() => handleCheckboxChange(item.id)}
                          style={{ marginRight: 8 }}
                        />
                        {item.text}
                      </label>

                      <button
                        className="button is-small is-white has-text-danger"
                        onClick={() => handleDeleteItem(item.id)}
                        title="삭제"
                      >
                        ×
                      </button>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </div>

          <TeamMembers />
        </aside>

        <main className="column is-four-fifth">
          <Outlet />
        </main>
      </div>

      <AIAssistant />
    </div>
  );
};

export default Layout;