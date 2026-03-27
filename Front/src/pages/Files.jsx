import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "bulma/css/bulma.min.css";
import "./Files.css";
import { FaDownload, FaTrash, FaFileUpload } from "react-icons/fa";
import { api } from "../api/client";

function normalizeBaseUrl(u) {
  if (!u) return "";
  return u.endsWith("/") ? u.slice(0, -1) : u;
}

function safeEncodeFilename(name) {
  return encodeURIComponent(name ?? "");
}

export default function Files() {
  const [files, setFiles] = useState([]);
  const [fileInput, setFileInput] = useState(null);
  const [creator, setCreator] = useState(localStorage.getItem("userName") || "");
  const [loading, setLoading] = useState(false);
  const [downloadingFile, setDownloadingFile] = useState("");
  const [errorText, setErrorText] = useState("");

  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const redirectedRef = useRef(false);

  const fileBaseUrl = useMemo(() => {
    if (api.defaults.baseURL) {
      return normalizeBaseUrl(api.defaults.baseURL);
    }
    return "http://localhost:5000";
  }, []);

  const moveToLoginOnce = () => {
    if (redirectedRef.current) return;
    redirectedRef.current = true;
    alert("로그인 세션이 만료되었습니다.");
    navigate("/", { replace: true });
  };

  const fetchFiles = async () => {
    try {
      setErrorText("");
      const res = await api.get("/api/files", { baseURL: fileBaseUrl });
      setFiles(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      console.error("Failed to fetch files", e);

      if (e.response?.status === 401) {
        moveToLoginOnce();
        return;
      }

      setFiles([]);
      setErrorText("파일 목록을 불러올 수 없습니다.");
    }
  };

  useEffect(() => {
    fetchFiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFileChange = (e) => {
    setFileInput(e.target.files?.[0] ?? null);
  };

  const handleAddFile = async () => {
    if (!fileInput || !creator.trim()) {
      alert("파일과 작성자를 모두 입력해주세요.");
      return;
    }

    const formData = new FormData();
    formData.append("file", fileInput);
    formData.append("creator", creator.trim());

    try {
      setLoading(true);
      setErrorText("");

      await api.post("/api/files/upload", formData, {
        baseURL: fileBaseUrl,
        timeout: 30000,
      });

      await fetchFiles();
      setFileInput(null);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (e) {
      console.error("Failed to upload file", e);

      if (e.response?.status === 401) {
        moveToLoginOnce();
        return;
      }

      if (e.response?.status === 413) {
        setErrorText("파일 크기가 너무 큽니다. 최대 10MB까지 업로드할 수 있습니다.");
        return;
      }

      setErrorText(e.response?.data?.message || "파일 업로드에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteFile = async (filename) => {
    if (!window.confirm("정말 삭제하시겠습니까?")) return;

    try {
      setErrorText("");
      await api.delete(`/api/files/${safeEncodeFilename(filename)}`, {
        baseURL: fileBaseUrl,
      });
      await fetchFiles();
    } catch (e) {
      console.error("Failed to delete file", e);

      if (e.response?.status === 401) {
        moveToLoginOnce();
        return;
      }

      setErrorText(e.response?.data?.message || "파일 삭제에 실패했습니다.");
    }
  };

  const handleDownloadFile = async (savedName, displayName) => {
    try {
      setErrorText("");
      setDownloadingFile(savedName);

      const response = await api.get(`/filebox/${safeEncodeFilename(savedName)}`, {
        baseURL: fileBaseUrl,
        responseType: "blob",
      });

      const blob = new Blob([response.data]);
      const url = window.URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = displayName || savedName;
      document.body.appendChild(a);
      a.click();
      a.remove();

      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Failed to download file", e);

      if (e.response?.status === 401) {
        moveToLoginOnce();
        return;
      }

      setErrorText(e.response?.data?.message || "파일 다운로드에 실패했습니다.");
    } finally {
      setDownloadingFile("");
    }
  };

  return (
    <div className="filesPage">
      <div className="container" style={{ maxWidth: 900 }}>
        <div className="is-flex is-justify-content-space-between is-align-items-center mb-5 mt-4">
          <h1 className="title is-4">파일 보관함</h1>
        </div>

        {errorText && (
          <div className="notification is-danger is-light">{errorText}</div>
        )}

        <div className="box mb-5">
          <h2 className="subtitle is-6 has-text-weight-bold">새 파일 업로드</h2>

          <div className="columns is-vcentered">
            <div className="column is-5">
              <div className="file has-name is-fullwidth">
                <label className="file-label">
                  <input
                    ref={fileInputRef}
                    className="file-input"
                    type="file"
                    onChange={handleFileChange}
                    disabled={loading}
                  />
                  <span className="file-cta">
                    <span className="file-icon">
                      <FaFileUpload />
                    </span>
                    <span className="file-label">파일 선택</span>
                  </span>
                  <span className="file-name">
                    {fileInput ? fileInput.name : "선택된 파일 없음"}
                  </span>
                </label>
              </div>
            </div>

            <div className="column is-4">
              <input
                className="input"
                type="text"
                placeholder="작성자 이름"
                value={creator}
                onChange={(e) => setCreator(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="column is-3">
              <button
                className={`button is-primary is-fullwidth ${loading ? "is-loading" : ""}`}
                onClick={handleAddFile}
                disabled={loading}
              >
                업로드
              </button>
            </div>
          </div>
        </div>

        <div className="table-container box" style={{ padding: 0 }}>
          <table className="table is-fullwidth is-hoverable is-striped">
            <thead>
              <tr className="has-background-white-ter">
                <th>파일명</th>
                <th>작성자</th>
                <th className="has-text-centered" style={{ width: 100 }}>
                  다운로드
                </th>
                <th className="has-text-centered" style={{ width: 100 }}>
                  삭제
                </th>
              </tr>
            </thead>
            <tbody>
              {files.length === 0 ? (
                <tr>
                  <td colSpan="4" className="has-text-centered py-5">
                    저장된 파일이 없습니다.
                  </td>
                </tr>
              ) : (
                files.map((file) => {
                  const displayName = file?.originalName || file?.fileName || "";
                  const savedName = file?.fileName || "";
                  const key = savedName || `${file?.creator}-${file?.uploadedAt}`;
                  const isDownloading = downloadingFile === savedName;

                  return (
                    <tr key={key}>
                      <td style={{ verticalAlign: "middle" }}>{displayName}</td>
                      <td style={{ verticalAlign: "middle" }}>
                        <span className="tag is-light">{file?.creator || "-"}</span>
                      </td>
                      <td className="has-text-centered">
                        <button
                          className={`button is-small is-info is-light ${isDownloading ? "is-loading" : ""}`}
                          onClick={() => handleDownloadFile(savedName, displayName)}
                          title="다운로드"
                          disabled={isDownloading}
                        >
                          <span className="icon">
                            <FaDownload />
                          </span>
                        </button>
                      </td>
                      <td className="has-text-centered">
                        <button
                          className="button is-small is-danger is-inverted"
                          onClick={() => handleDeleteFile(savedName)}
                          title="삭제"
                        >
                          <span className="icon">
                            <FaTrash />
                          </span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}