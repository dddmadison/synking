// src/routes/PublicOnly.jsx
import React from "react";
import { Navigate, Outlet } from "react-router-dom";

export default function PublicOnly({ redirectTo = "/home" }) {
  const token = localStorage.getItem("token");
  if (token) return <Navigate to={redirectTo} replace />;
  return <Outlet />;
}
