// src/routes/RequireAuth.jsx
import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";

export default function RequireAuth({ redirectTo = "/" }) {
  const token = localStorage.getItem("token");
  const location = useLocation();

  if (!token) {
    // 로그인 후 원래 가려던 페이지로 복귀할 수 있게 state에 저장
    return <Navigate to={redirectTo} replace state={{ from: location }} />;
  }

  return <Outlet />;
}
