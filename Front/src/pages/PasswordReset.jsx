import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { AuthLayout } from "../components/AuthLayout";
import { AuthInput } from "../components/AuthInput";

export function PasswordReset() {
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const errors = useMemo(() => {
    const e = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = "유효한 이메일을 입력하세요.";
    if (newPassword.length < 8) e.newPassword = "비밀번호는 8자 이상입니다.";
    if (confirmPassword && newPassword !== confirmPassword) e.confirmPassword = "비밀번호가 일치하지 않습니다.";
    return e;
  }, [email, newPassword, confirmPassword]);

  const disabled = Object.keys(errors).length > 0 || loading;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    setError("");
    if (disabled) return;

    try {
      setLoading(true);
      await api.post("/password-reset", { email, newPassword });
      setMessage("비밀번호가 성공적으로 재설정되었습니다.");
      setEmail("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      console.error(err);
      setError(err?.response?.data?.message || "비밀번호 재설정에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="비밀번호 재설정"
      subtitle="가입한 이메일과 새 비밀번호를 입력하세요"
      footer={<Link to="/" className="has-text-grey">로그인으로 돌아가기</Link>}
    >
      <form onSubmit={handleSubmit}>
        <AuthInput label="이메일" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="example@example.com" error={errors.email} />
        <AuthInput label="새 비밀번호" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="8자 이상" error={errors.newPassword} />
        <AuthInput label="비밀번호 확인" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="다시 입력" error={errors.confirmPassword} />

        {message && <div className="notification is-success is-light" style={{ marginBottom: 12 }}>{message}</div>}
        {error && <div className="notification is-danger is-light" style={{ marginBottom: 12 }}>{error}</div>}

        <button className={`button is-primary is-fullwidth ${loading ? "is-loading" : ""}`} disabled={disabled} style={{ height: 50, fontWeight: 700 }}>
          비밀번호 초기화
        </button>
      </form>
    </AuthLayout>
  );
}
