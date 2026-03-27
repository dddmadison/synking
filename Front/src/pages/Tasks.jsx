import React, { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api/client";
import "bulma/css/bulma.min.css";
import "./Tasks.css";
import { FaPlus, FaEdit, FaTrash } from "react-icons/fa";

const getId = (t) => t?.id ?? t?._id ?? t?.taskId ?? null;

function pad2(n) {
  return String(n).padStart(2, "0");
}

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

function onlyDigits(v = "") {
  return v.replace(/\D/g, "").slice(0, 8);
}

function formatDateDigits(digits = "") {
  const d = onlyDigits(digits);
  if (d.length <= 4) return d;
  if (d.length <= 6) return `${d.slice(0, 4)}-${d.slice(4)}`;
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
}

function isValidDateString(v = "") {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;

  const [yy, mm, dd] = v.split("-").map(Number);
  const dt = new Date(yy, mm - 1, dd);

  return (
    dt.getFullYear() === yy &&
    dt.getMonth() === mm - 1 &&
    dt.getDate() === dd
  );
}

function toDateInputValue(v) {
  const d = parseDateSafe(v);
  if (!d) return "";
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  return `${y}-${m}-${day}`;
}

function formatKo(v) {
  const d = parseDateSafe(v);
  return d ? d.toLocaleDateString("ko-KR") : "-";
}

function isInvalidDateRange(startDate, dueDate) {
  if (!startDate || !dueDate) return false;
  return startDate > dueDate;
}

export default function Tasks() {
  const emptyForm = useMemo(
    () => ({
      taskName: "",
      assignee: "",
      creator: "",
      startDate: "",
      dueDate: "",
      note: "",
    }),
    []
  );

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [mode, setMode] = useState("create");
  const [selectedTask, setSelectedTask] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const startDatePickerRef = useRef(null);
  const dueDatePickerRef = useRef(null);

  useEffect(() => {
    fetchTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchTasks() {
    try {
      setLoading(true);
      setErrorText("");
      const res = await api.get("/api/tasks");
      setTasks(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      console.error(e);
      setTasks([]);
      setErrorText("업무 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  const tasksSorted = useMemo(() => {
    return [...tasks].sort((a, b) => {
      const ad = a?.dueDate
        ? parseDateSafe(a.dueDate)?.getTime() ?? Infinity
        : Infinity;
      const bd = b?.dueDate
        ? parseDateSafe(b.dueDate)?.getTime() ?? Infinity
        : Infinity;
      return ad - bd;
    });
  }, [tasks]);

  const dateRangeInvalid = useMemo(() => {
    return isInvalidDateRange(form.startDate, form.dueDate);
  }, [form.startDate, form.dueDate]);

  const invalid = useMemo(() => {
    return (
      !form.taskName?.trim() ||
      !form.assignee?.trim() ||
      !form.creator?.trim() ||
      dateRangeInvalid
    );
  }, [form, dateRangeInvalid]);

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const onDateTextChange = (e) => {
    const { name, value } = e.target;
    const formatted = formatDateDigits(value);
    setForm((f) => ({ ...f, [name]: formatted }));
  };

  const openNativePicker = (ref) => {
    if (!ref?.current) return;

    if (typeof ref.current.showPicker === "function") {
      ref.current.showPicker();
    } else {
      ref.current.focus();
      ref.current.click();
    }
  };

  const fillFormFromTask = (t) => ({
    taskName: t?.taskName ?? "",
    assignee: t?.assignee ?? "",
    creator: t?.creator ?? "",
    startDate: toDateInputValue(t?.startDate),
    dueDate: toDateInputValue(t?.dueDate),
    note: t?.note ?? "",
  });

  const openCreate = () => {
    setMode("create");
    setSelectedTask(null);
    setForm(emptyForm);
    setErrorText("");
    setShowModal(true);
  };

  const openTaskModal = (nextMode, t) => {
    setMode(nextMode);
    setSelectedTask(t);
    setErrorText("");
    setForm(fillFormFromTask(t));
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedTask(null);
    setMode("create");
    setForm(emptyForm);
  };

  function buildPayload(f) {
    return {
      taskName: (f.taskName ?? "").trim(),
      assignee: (f.assignee ?? "").trim(),
      creator: (f.creator ?? "").trim(),
      startDate: f.startDate ? f.startDate : null,
      dueDate: f.dueDate ? f.dueDate : null,
      note: f.note ?? "",
    };
  }

  async function createTask() {
    if (dateRangeInvalid) {
      alert("시작일은 마감일보다 늦을 수 없습니다.");
      return;
    }

    try {
      setErrorText("");
      await api.post("/api/tasks", buildPayload(form));
      await fetchTasks();
      closeModal();
    } catch (e) {
      console.error(e);
      setErrorText(e?.response?.data?.message || "등록에 실패했습니다.");
      alert(e?.response?.data?.message || "등록에 실패했습니다.");
    }
  }

  async function updateTask() {
    if (dateRangeInvalid) {
      alert("시작일은 마감일보다 늦을 수 없습니다.");
      return;
    }

    try {
      setErrorText("");
      const id = getId(selectedTask);
      if (!id) throw new Error("id가 없습니다");

      await api.put(`/api/tasks/${id}`, buildPayload(form));
      await fetchTasks();
      closeModal();
    } catch (e) {
      console.error(e);
      setErrorText(e?.response?.data?.message || "수정에 실패했습니다.");
      alert(e?.response?.data?.message || "수정에 실패했습니다.");
    }
  }

  async function deleteTask(t) {
    if (!window.confirm("정말 삭제하시겠습니까?")) return;

    try {
      setErrorText("");
      const id = getId(t);
      if (!id) throw new Error("id가 없습니다");

      await api.delete(`/api/tasks/${id}`);
      await fetchTasks();

      if (showModal) closeModal();
    } catch (e) {
      console.error(e);
      setErrorText("삭제에 실패했습니다.");
      alert("삭제에 실패했습니다.");
    }
  }

  return (
    <div className="tasksPage">
      <div className="container">
        <div className="is-flex is-justify-content-space-between is-align-items-center mb-3">
          <h1 className="title is-4">업무 목록</h1>
          <button className="button is-link" onClick={openCreate}>
            <span className="icon">
              <FaPlus />
            </span>
            <span>업무 추가</span>
          </button>
        </div>

        {errorText && (
          <div className="notification is-danger is-light">{errorText}</div>
        )}

        {loading && <p className="has-text-grey">불러오는 중…</p>}

        {!loading && tasksSorted.length === 0 && (
          <div className="box has-text-centered has-text-grey">
            아직 등록된 업무가 없습니다.
          </div>
        )}

        {tasksSorted.length > 0 && (
          <div className="table-container">
            <table className="table is-fullwidth is-hoverable is-striped">
              <thead>
                <tr>
                  <th>업무명</th>
                  <th>할당인원</th>
                  <th>작성자</th>
                  <th>시작일</th>
                  <th>마감일</th>
                  <th style={{ width: 120 }}>수정</th>
                </tr>
              </thead>
              <tbody>
                {tasksSorted.map((t) => {
                  const id = getId(t);
                  return (
                    <tr key={id ?? `${t.taskName}-${t.creator}`}>
                      <td
                        onClick={() => openTaskModal("view", t)}
                        style={{ cursor: "pointer", fontWeight: 600 }}
                      >
                        {t.taskName || "-"}
                      </td>
                      <td>{t.assignee || "-"}</td>
                      <td>{t.creator || "-"}</td>
                      <td>{formatKo(t.startDate)}</td>
                      <td>{formatKo(t.dueDate)}</td>
                      <td>
                        <div className="buttons are-small">
                          <button
                            className="button is-info is-light"
                            onClick={() => openTaskModal("edit", t)}
                          >
                            <span className="icon">
                              <FaEdit />
                            </span>
                          </button>
                          <button
                            className="button is-danger is-light"
                            onClick={() => deleteTask(t)}
                          >
                            <span className="icon">
                              <FaTrash />
                            </span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {showModal && (
          <div className="modal is-active">
            <div className="modal-background" onClick={closeModal}></div>
            <div className="modal-card">
              <header className="modal-card-head">
                <p className="modal-card-title">
                  {mode === "create" && "업무 등록"}
                  {mode === "view" && "업무 상세"}
                  {mode === "edit" && "업무 수정"}
                </p>
                <button
                  className="delete"
                  aria-label="close"
                  onClick={closeModal}
                ></button>
              </header>

              <section className="modal-card-body">
                <div className="field">
                  <label className="label">업무명</label>
                  <div className="control">
                    <input
                      className="input"
                      name="taskName"
                      value={form.taskName}
                      onChange={onChange}
                      disabled={mode === "view"}
                    />
                  </div>
                </div>

                <div className="field">
                  <label className="label">할당인원</label>
                  <div className="control">
                    <input
                      className="input"
                      name="assignee"
                      value={form.assignee}
                      onChange={onChange}
                      disabled={mode === "view"}
                    />
                  </div>
                </div>

                <div className="field">
                  <label className="label">작성자</label>
                  <div className="control">
                    <input
                      className="input"
                      name="creator"
                      value={form.creator}
                      onChange={onChange}
                      disabled={mode === "view"}
                    />
                  </div>
                </div>

                <div className="columns">
                  <div className="column">
                    <div className="field">
                      <label className="label">시작일</label>
                      <div className="control date-input-wrap">
                        <input
                          className="input"
                          type="text"
                          inputMode="numeric"
                          placeholder="YYYY-MM-DD"
                          name="startDate"
                          value={form.startDate}
                          onChange={onDateTextChange}
                          disabled={mode === "view"}
                          maxLength={10}
                        />

                        <button
                          type="button"
                          className="date-picker-btn"
                          onClick={() => openNativePicker(startDatePickerRef)}
                          disabled={mode === "view"}
                          aria-label="시작일 달력 열기"
                        >
                          📅
                        </button>

                        <input
                          ref={startDatePickerRef}
                          className="native-date-input"
                          type="date"
                          name="startDate"
                          value={
                            isValidDateString(form.startDate)
                              ? form.startDate
                              : ""
                          }
                          onChange={onChange}
                          tabIndex={-1}
                          disabled={mode === "view"}
                          aria-hidden="true"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="column">
                    <div className="field">
                      <label className="label">마감일</label>
                      <div className="control date-input-wrap">
                        <input
                          className="input"
                          type="text"
                          inputMode="numeric"
                          placeholder="YYYY-MM-DD"
                          name="dueDate"
                          value={form.dueDate}
                          onChange={onDateTextChange}
                          disabled={mode === "view"}
                          maxLength={10}
                        />

                        <button
                          type="button"
                          className="date-picker-btn"
                          onClick={() => openNativePicker(dueDatePickerRef)}
                          disabled={mode === "view"}
                          aria-label="마감일 달력 열기"
                        >
                          📅
                        </button>

                        <input
                          ref={dueDatePickerRef}
                          className="native-date-input"
                          type="date"
                          name="dueDate"
                          value={
                            isValidDateString(form.dueDate) ? form.dueDate : ""
                          }
                          onChange={onChange}
                          tabIndex={-1}
                          disabled={mode === "view"}
                          aria-hidden="true"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {dateRangeInvalid && (
                  <div className="notification is-warning is-light">
                    시작일은 마감일보다 늦을 수 없습니다.
                  </div>
                )}

                <div className="field">
                  <label className="label">비고</label>
                  <div className="control">
                    <textarea
                      className="textarea"
                      name="note"
                      value={form.note}
                      onChange={onChange}
                      disabled={mode === "view"}
                    />
                  </div>
                </div>
              </section>

              <footer className="modal-card-foot">
                {mode === "create" && (
                  <button
                    className="button is-link"
                    onClick={createTask}
                    disabled={invalid}
                  >
                    등록
                  </button>
                )}

                {mode === "edit" && (
                  <button
                    className="button is-link"
                    onClick={updateTask}
                    disabled={invalid}
                  >
                    저장
                  </button>
                )}

                <button className="button" onClick={closeModal}>
                  닫기
                </button>
              </footer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}