// src/pages/Calendar.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import "./Calendar.css";

const daysOfWeek = ["일", "월", "화", "수", "목", "금", "토"];

const at0 = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const isSameDay = (a, b) => +at0(a) === +at0(b);

// ✅ "YYYY-MM-DD"는 로컬 날짜로 파싱(UTC 해석으로 하루 밀림 방지)
function parseDateSafe(v) {
  if (!v) return null;
  if (typeof v === "string") {
    const m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) {
      const yy = Number(m[1]);
      const mm = Number(m[2]) - 1;
      const dd = Number(m[3]);
      const d = new Date(yy, mm, dd);
      return Number.isNaN(d.getTime()) ? null : d;
    }
  }
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export default function Calendar() {
  const [date, setDate] = useState(new Date());
  const [tasks, setTasks] = useState([]);

  const fetchTasks = useCallback(async () => {
    try {
      const res = await api.get("/api/tasks");
      setTasks(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      console.error("Failed to fetch tasks:", e);
      setTasks([]);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const prevMonth = () =>
    setDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const nextMonth = () =>
    setDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));

  // ✅ start/due 둘 중 하나라도 있으면 표시, 역전되면 swap
  const parsedTasks = useMemo(() => {
    return (tasks || [])
      .map((t) => {
        const s0 = parseDateSafe(t.startDate) || parseDateSafe(t.dueDate);
        const e0 = parseDateSafe(t.dueDate) || parseDateSafe(t.startDate);
        if (!s0 || !e0) return null;
        const s = s0 <= e0 ? s0 : e0;
        const e = s0 <= e0 ? e0 : s0;
        return { ...t, s, e };
      })
      .filter(Boolean);
  }, [tasks]);

  const cells = useMemo(() => {
    const y = date.getFullYear();
    const m = date.getMonth();
    const first = new Date(y, m, 1);
    const firstDow = first.getDay();
    const daysInMonth = new Date(y, m + 1, 0).getDate();

    const arr = [];
    for (let i = 0; i < firstDow; i++) arr.push(null);
    for (let d = 1; d <= daysInMonth; d++) arr.push(new Date(y, m, d));
    const tail = (7 - (arr.length % 7)) % 7;
    for (let i = 0; i < tail; i++) arr.push(null);
    return arr;
  }, [date]);

  const TaskBadges = ({ cellDate }) => {
    if (!cellDate) return null;

    // ✅ “기간”도 보여주고 싶으면 아래 조건(범위 포함)을 사용
    const dayTasks = parsedTasks.filter(
      (t) => at0(cellDate) >= at0(t.s) && at0(cellDate) <= at0(t.e)
    );

    if (dayTasks.length === 0) return null;

    // 너무 많으면 UI가 깨져서 3개까지만, 나머지는 +n
    const limited = dayTasks.slice(0, 3);
    const extra = dayTasks.length - limited.length;

    return (
      <>
        {limited.map((t) => {
          const start = isSameDay(cellDate, t.s);
          const end = isSameDay(cellDate, t.e);

          let cls = "span";
          let label = `${t.taskName}`;
          if (start && !end) {
            cls = "start";
            label = `${t.taskName} 시작`;
          } else if (end && !start) {
            cls = "due";
            label = `${t.taskName} 마감`;
          }

          const key =
            t?.id ?? t?._id ?? t?.taskId ?? `${t.taskName}-${+t.s}-${+t.e}`;

          return (
            <div key={key} className={`task-label ${cls}`} title={t.taskName}>
              {label}
            </div>
          );
        })}

        {extra > 0 && (
          <div className="task-more" title="업무 더보기">
            +{extra}
          </div>
        )}
      </>
    );
  };

  const y = date.getFullYear();
  const m = date.getMonth();
  const today = new Date();

  return (
    <div className="calendarPage">
      <div className="calendar-container">
        <div className="calendar-header">
          <button onClick={prevMonth}>&lt;</button>
          <div className="month-year">
            <span className="month">{m + 1}</span>
            <span className="year">{y}</span>
          </div>
          <button onClick={nextMonth}>&gt;</button>
        </div>

        <div className="grid" style={{ marginBottom: 4 }}>
          {daysOfWeek.map((d, i) => (
            <div
              key={d}
              className={`cell weekday ${i === 0 ? "sun" : i === 6 ? "sat" : ""}`}
            >
              {d}
            </div>
          ))}
        </div>

        <div className="grid">
          {cells.map((cellDate, idx) => {
            if (!cellDate) return <div key={`empty-${idx}`} className="cell" />;

            const dow = cellDate.getDay();
            const weekendClass =
              dow === 0 ? "cell-sun" : dow === 6 ? "cell-sat" : "";
            const isToday = isSameDay(cellDate, today);

            return (
              <div
                key={+cellDate}
                className={`cell ${weekendClass} ${isToday ? "today" : ""}`}
              >
                <div className={`date ${dow === 0 ? "sun" : dow === 6 ? "sat" : ""}`}>
                  {cellDate.getDate()}
                </div>
                <TaskBadges cellDate={cellDate} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
