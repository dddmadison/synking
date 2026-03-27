// src/components/AIAssistant.jsx
import React, { useState, useRef, useEffect } from "react";
import { api } from "../api/client";
import { FaRobot, FaTimes, FaPaperPlane, FaFileUpload } from "react-icons/fa";
import "./AIAssistant.css";

export default function AIAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 1,
      role: "ai",
      text: "안녕하세요! 무엇을 도와드릴까요? 파일을 드래그해서 바로 업로드할 수도 있어요!"
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const [selectedFile, setSelectedFile] = useState(null);

  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  const uploadFile = async (file) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("creator", localStorage.getItem("userName") || "AI 챗봇");

    setMessages((prev) => [
      ...prev,
      { id: Date.now(), role: "user", text: `📎 파일 업로드: ${file.name}` }
    ]);
    setLoading(true);

    try {
      const res = await api.post("/api/files/upload", formData);

      const uploaded = {
        fileId: res.data.fileId,
        fileName: res.data.fileName || file.name,
      };

      setSelectedFile(uploaded);

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          role: "ai",
          text:
            `'${uploaded.fileName}' 파일이 보관함에 성공적으로 저장되었습니다! 🎉\n` +
            `이제 이 파일 내용에 대해 자유롭게 질문해주세요.`
        }
      ]);
    } catch (error) {
      console.error("Chat File Upload Error:", error);
      setMessages((prev) => [
        ...prev,
        { id: Date.now() + 1, role: "ai", text: "❌ 파일 업로드에 실패했습니다." }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;

    const file = e.dataTransfer.files?.[0];
    if (file) {
      await uploadFile(file);
    }
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      await uploadFile(file);
      e.target.value = null;
    }
  };

  const handleSend = async (e) => {
    e?.preventDefault();

    if (!input.trim() || loading) return;

    if (!selectedFile?.fileId) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          role: "ai",
          text: "먼저 질문할 파일을 업로드해주세요."
        }
      ]);
      return;
    }

    const userText = input;
    setInput("");

    setMessages((prev) => [
      ...prev,
      { id: Date.now(), role: "user", text: userText }
    ]);
    setLoading(true);

    try {
      const res = await api.post("/api/ai/ask", {
        question: userText,
        fileId: selectedFile.fileId,
      });

      const aiResponse = res.data.answer;
      const answeredFileName = res.data.fileName || selectedFile.fileName;

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          role: "ai",
          text: aiResponse,
          fileName: answeredFileName,
        }
      ]);
    } catch (error) {
      console.error("AI Ask Error:", error);

      const errorMessage =
        error?.response?.data?.answer ||
        "오류가 발생했습니다. 잠시 후 다시 시도해주세요.";

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          role: "ai",
          text: errorMessage
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleClearSelectedFile = () => {
    setSelectedFile(null);
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now(),
        role: "ai",
        text: "현재 질문 대상 파일이 해제되었습니다. 새 파일을 업로드해주세요."
      }
    ]);
  };

  return (
    <div className="ai-widget-container">
      {isOpen && (
        <div
          className="ai-window"
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          {isDragging && (
            <div className="ai-drag-overlay">
              <FaFileUpload size={48} style={{ marginBottom: 16 }} />
              <span>여기에 파일을 놓아 바로 업로드하세요!</span>
            </div>
          )}

          <div className="ai-header">
            <span className="ai-title">🤖 Synking AI</span>
            <button
              onClick={() => setIsOpen(false)}
              style={{ border: "none", background: "none", cursor: "pointer" }}
            >
              <FaTimes color="#999" />
            </button>
          </div>

          {selectedFile && (
            <div className="ai-current-file">
              <div className="ai-current-file-name">
                현재 파일: <strong>{selectedFile.fileName}</strong>
              </div>
              <button
                type="button"
                className="ai-current-file-clear"
                onClick={handleClearSelectedFile}
              >
                해제
              </button>
            </div>
          )}

          <div className="ai-body" ref={scrollRef}>
            {messages.map((msg) => (
              <div key={msg.id} className={`msg ${msg.role}`} style={{ whiteSpace: "pre-wrap" }}>
                <div>{msg.text}</div>
                {msg.role === "ai" && msg.fileName && (
                  <div className="msg-file-meta">기준 파일: {msg.fileName}</div>
                )}
              </div>
            ))}
            {loading && <div className="msg ai">생각하는 중... 💭</div>}
          </div>

          <form className="ai-input-area" onSubmit={handleSend}>
            <label className="ai-file-btn" title="파일 첨부">
              <input
                type="file"
                style={{ display: "none" }}
                onChange={handleFileSelect}
                disabled={loading}
              />
              <FaFileUpload size={18} color="#666" />
            </label>

            <input
              className="ai-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                selectedFile
                  ? "질문을 입력하세요..."
                  : "먼저 파일을 업로드해주세요..."
              }
              disabled={loading}
            />

            <button type="submit" className="ai-send-btn" disabled={loading}>
              <FaPaperPlane size={14} />
            </button>
          </form>
        </div>
      )}

      <button className="ai-fab" onClick={() => setIsOpen(!isOpen)}>
        {isOpen ? <FaTimes size={24} /> : <FaRobot size={28} />}
      </button>
    </div>
  );
}