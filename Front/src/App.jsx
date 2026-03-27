// src/App.jsx
import React from "react";
import { BrowserRouter as Router, Route, Routes, Navigate } from "react-router-dom";

import Layout from "./components/Layout";
import Home from "./pages/Home";
import Tasks from "./pages/Tasks";
import Calendar from "./pages/Calendar";
import Files from "./pages/Files";
import Login from "./pages/Login";
import { Join } from "./pages/Join";
import { PasswordReset } from "./pages/PasswordReset";

import RequireAuth from "./routes/RequireAuth";
import PublicOnly from "./routes/PublicOnly";

function App() {
  return (
    <Router>
      <Routes>
        {/* 로그인/회원가입/비번재설정은 "비로그인 전용" */}
        <Route element={<PublicOnly />}>
          <Route path="/" element={<Login />} />
          <Route path="/signup" element={<Join />} />
          <Route path="/password-reset" element={<PasswordReset />} />
        </Route>

        {/* 로그인 이후 페이지는 "인증 필요" */}
        <Route element={<RequireAuth />}>
          <Route element={<Layout />}>
            <Route path="/home" element={<Home />} />
            <Route path="/tasks" element={<Tasks />} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/files" element={<Files />} />
          </Route>
        </Route>

        {/* 없는 경로 처리 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
