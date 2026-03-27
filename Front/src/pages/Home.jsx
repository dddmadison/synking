import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "bulma/css/bulma.min.css";
import "./Home.css";
import { GoInbox } from "react-icons/go";
import { BsFileEarmarkBarGraph } from "react-icons/bs";
import { GrSchedule } from "react-icons/gr";
import { FiClock } from "react-icons/fi";

function buildDisplayName() {
  const name = (localStorage.getItem("userName") || "").trim();
  if (name) return name;

  const email = (localStorage.getItem("userEmail") || "").trim();
  if (email && email.includes("@")) return email.split("@")[0];

  return "사용자";
}

function formatDateTime(value) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export default function Home() {
  const navigate = useNavigate();
  const userName = useMemo(() => buildDisplayName(), []);

  const [attendance, setAttendance] = useState({
    workDate: "",
    checkInTime: null,
    checkOutTime: null,
  });
  const [loadingAttendance, setLoadingAttendance] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isAttendanceOpen, setIsAttendanceOpen] = useState(false);

  const handleNavigation = (path) => navigate(path);

  const fetchTodayAttendance = async () => {
    const token = localStorage.getItem("token");

    if (!token) {
      setLoadingAttendance(false);
      return;
    }

    try {
      setLoadingAttendance(true);

      const response = await fetch("http://localhost:5000/api/attendance/today", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.message || "근태 정보를 불러오지 못했습니다.");
        return;
      }

      setAttendance({
        workDate: data.workDate || "",
        checkInTime: data.checkInTime || null,
        checkOutTime: data.checkOutTime || null,
      });
    } catch (error) {
      console.error("오늘 근태 조회 실패:", error);
      alert("서버와 통신 중 오류가 발생했습니다.");
    } finally {
      setLoadingAttendance(false);
    }
  };

  useEffect(() => {
    fetchTodayAttendance();
  }, []);

  const handleCheckIn = async () => {
    const token = localStorage.getItem("token");

    if (!token) {
      alert("로그인이 필요합니다.");
      return;
    }

    try {
      setSubmitting(true);

      const response = await fetch("http://localhost:5000/api/attendance/check-in", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.message || "출근 처리에 실패했습니다.");
        return;
      }

      alert(data.message || "출근 처리되었습니다.");
      await fetchTodayAttendance();
    } catch (error) {
      console.error("출근 처리 실패:", error);
      alert("서버와 통신 중 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckOut = async () => {
    const token = localStorage.getItem("token");

    if (!token) {
      alert("로그인이 필요합니다.");
      return;
    }

    try {
      setSubmitting(true);

      const response = await fetch("http://localhost:5000/api/attendance/check-out", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.message || "퇴근 처리에 실패했습니다.");
        return;
      }

      alert(data.message || "퇴근 처리되었습니다.");
      await fetchTodayAttendance();
    } catch (error) {
      console.error("퇴근 처리 실패:", error);
      alert("서버와 통신 중 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  const isCheckedIn = Boolean(attendance.checkInTime);
  const isCheckedOut = Boolean(attendance.checkOutTime);

  return (
    <div className="container home">
      <p className="welcome">
        {userName}님, 반갑습니다! 씽킹세상에 오신 걸 환영합니다
      </p>

      <img
        src={`${process.env.PUBLIC_URL}/logo.png`}
        alt="Logo"
        className="logo"
      />

      <h2 className="home-title">어느 작업을 하실 건가요?</h2>

      <div className="buttons">
        <div className="button-container">
          <button
            className="icon-btn"
            onClick={() => handleNavigation("/tasks")}
            title="Tasks"
            aria-label="Tasks"
          >
            <BsFileEarmarkBarGraph size={100} />
          </button>
          <p>Tasks</p>
        </div>

        <div className="button-container">
          <button
            className="icon-btn"
            onClick={() => handleNavigation("/files")}
            title="Files"
            aria-label="Files"
          >
            <GoInbox size={100} />
          </button>
          <p>Files</p>
        </div>

        <div className="button-container">
          <button
            className="icon-btn"
            onClick={() => handleNavigation("/calendar")}
            title="Calendar"
            aria-label="Calendar"
          >
            <GrSchedule size={100} />
          </button>
          <p>Calendar</p>
        </div>
      </div>

      {isAttendanceOpen && (
        <div className="attendance-panel">
          <div className="attendance-card">
            <h3 className="attendance-title">오늘의 출퇴근</h3>

            {loadingAttendance ? (
              <p className="attendance-loading">근태 정보를 불러오는 중...</p>
            ) : (
              <>
                <p className="attendance-row">
                  <strong>근무일:</strong> {attendance.workDate || "-"}
                </p>
                <p className="attendance-row">
                  <strong>출근 시간:</strong> {formatDateTime(attendance.checkInTime)}
                </p>
                <p className="attendance-row">
                  <strong>퇴근 시간:</strong> {formatDateTime(attendance.checkOutTime)}
                </p>

                <div className="attendance-actions">
                  <button
                    className="button is-primary attendance-btn"
                    onClick={handleCheckIn}
                    disabled={submitting || isCheckedIn}
                  >
                    출근 도장 찍기
                  </button>

                  <button
                    className="button is-link attendance-btn"
                    onClick={handleCheckOut}
                    disabled={submitting || !isCheckedIn || isCheckedOut}
                  >
                    퇴근 도장 찍기
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <button
        className="attendance-fab"
        onClick={() => setIsAttendanceOpen((prev) => !prev)}
        aria-label="출퇴근 패널 열기"
        title="출퇴근"
      >
        <FiClock size={28} />
      </button>
    </div>
  );
}