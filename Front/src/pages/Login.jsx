import React, { useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { AuthLayout } from "../components/AuthLayout";
import { AuthInput } from "../components/AuthInput";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [touched, setTouched] = useState({ email: false, password: false });
  const [submitted, setSubmitted] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || "/home";

  const fieldErrors = useMemo(() => {
    const e = {};
    const em = (email || "").trim();

    if (!em) e.email = "이메일을 입력하세요.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
      e.email = "유효한 이메일을 입력하세요.";
    }

    if (!password) e.password = "비밀번호를 입력하세요.";
    else if (password.length < 8) e.password = "비밀번호는 8자 이상이어야 합니다.";

    return e;
  }, [email, password]);

  const disabled = Object.keys(fieldErrors).length > 0 || loading;

  const visibleError = (key) => {
    return submitted || touched[key] ? fieldErrors[key] : undefined;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitted(true);
    setError("");

    if (disabled) return;

    try {
      setLoading(true);

      const { data } = await api.post("/login", {
        email: email.trim(),
        password,
      });

      localStorage.setItem("token", data.token);

      if (data.name) {
        localStorage.setItem("userName", data.name);
      }

      if (data.email) {
        localStorage.setItem("userEmail", data.email);
      }

      navigate(from, { replace: true });
    } catch (err) {
      console.error(err);
      setError(err?.response?.data?.message || "로그인에 실패했습니다. 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="로그인"
      subtitle="계정으로 계속하기"
      footer={
        <div className="is-flex is-justify-content-space-between is-align-items-center">
          <span className="has-text-grey" style={{ fontSize: 14 }}>
            처음이신가요?
          </span>
          <Link
            to="/signup"
            className="button is-text"
            style={{ color: "#2563eb", textDecoration: "underline", fontSize: 15 }}
          >
            회원가입
          </Link>
        </div>
      }
    >
      <form onSubmit={handleSubmit}>
        <AuthInput
          label="이메일"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, email: true }))}
          placeholder="example@example.com"
          error={visibleError("email")}
        />

        <AuthInput
          label="비밀번호"
          type={showPw ? "text" : "password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, password: true }))}
          placeholder="8자 이상"
          error={visibleError("password")}
        />

        <label className="checkbox" style={{ display: "block", margin: "6px 0 10px" }}>
          <input
            type="checkbox"
            checked={showPw}
            onChange={(e) => setShowPw(e.target.checked)}
            style={{ marginRight: 8 }}
          />
          비밀번호 표시
        </label>

        <div className="is-flex is-justify-content-flex-end" style={{ marginBottom: 14 }}>
          <Link to="/password-reset" className="has-text-grey" style={{ fontSize: 14 }}>
            비밀번호를 잊으셨나요?
          </Link>
        </div>

        {error && (
          <div className="notification is-danger is-light" style={{ marginBottom: 16 }}>
            {error}
          </div>
        )}

        <button
          className={`button is-primary is-fullwidth ${loading ? "is-loading" : ""}`}
          disabled={disabled}
          style={{ height: 56, fontWeight: 800, fontSize: 16 }}
        >
          로그인
        </button>
      </form>
    </AuthLayout>
  );
}