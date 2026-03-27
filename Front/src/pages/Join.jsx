// src/pages/Join.jsx
import React, { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { AuthLayout } from "../components/AuthLayout";
import { AuthInput } from "../components/AuthInput";

export function Join() {
  const [name, setName] = useState("");
  // ✅ 1. 회사, 부서 상태 추가
  const [company, setCompany] = useState("");
  const [department, setDepartment] = useState("");
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [agree, setAgree] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [touched, setTouched] = useState({
    name: false,
    company: false,
    department: false,
    email: false,
    password: false,
    password2: false,
    agree: false,
  });
  const [submitted, setSubmitted] = useState(false);

  const navigate = useNavigate();

  const fieldErrors = useMemo(() => {
    const e = {};
    if (!name.trim()) e.name = "이름을 입력하세요.";
    // ✅ 2. 유효성 검사 추가
    if (!company.trim()) e.company = "회사명을 입력하세요.";
    if (!department.trim()) e.department = "부서명을 입력하세요.";
    
    if (!email) e.email = "이메일을 입력하세요.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = "유효한 이메일을 입력하세요.";
    if (!password) e.password = "비밀번호를 입력하세요.";
    else if (password.length < 8) e.password = "비밀번호는 8자 이상입니다.";
    if (!password2) e.password2 = "비밀번호 확인을 입력하세요.";
    else if (password !== password2) e.password2 = "비밀번호가 일치하지 않습니다.";
    if (!agree) e.agree = "약관에 동의해주세요.";
    return e;
  }, [name, company, department, email, password, password2, agree]);

  const disabled = Object.keys(fieldErrors).length > 0 || loading;
  const visibleError = (key) => (submitted || touched[key]) ? fieldErrors[key] : undefined;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitted(true);
    setError("");
    if (disabled) return;

    try {
      setLoading(true);
      // 3. 서버로 데이터 전송 시 company, department 포함
      const res = await api.post("/signup", { 
        name, 
        company, 
        department, 
        email, 
        password 
      });
      
      if (res.status === 200 || res.status === 201) {
        alert("회원가입이 완료되었습니다! 로그인해주세요.");
        navigate("/", { replace: true });
      }
    } catch (err) {
      console.error(err);
      setError(err?.response?.data?.message || "회원가입에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="회원가입"
      subtitle="몇 가지 정보만 입력하면 시작할 수 있어요"
      footer={
        <div className="has-text-centered">
          <span className="has-text-grey">이미 계정이 있나요? </span>
          <Link
            to="/"
            className="button is-text is-small"
            style={{
              padding: 1,
              height: "auto",
              textDecoration: "underline",
              fontSize: 14,
            }}
          >
            로그인
          </Link>
        </div>
      }
    >
      <form onSubmit={handleSubmit}>
        <AuthInput
          label="이름"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, name: true }))}
          placeholder="홍길동"
          error={visibleError("name")}
        />
        
        {/* 회사명, 부서명 입력 폼*/}
        <div className="columns is-mobile" style={{ marginBottom: 0 }}>
          <div className="column is-half" style={{ paddingBottom: 0 }}>
            <AuthInput
              label="회사명"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, company: true }))}
              placeholder="씽킹컴퍼니"
              error={visibleError("company")}
            />
          </div>
          <div className="column is-half" style={{ paddingBottom: 0 }}>
            <AuthInput
              label="부서명"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, department: true }))}
              placeholder="영업팀"
              error={visibleError("department")}
            />
          </div>
        </div>

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
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, password: true }))}
          placeholder="8자 이상"
          error={visibleError("password")}
        />
        <AuthInput
          label="비밀번호 확인"
          type="password"
          value={password2}
          onChange={(e) => setPassword2(e.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, password2: true }))}
          placeholder="다시 입력"
          error={visibleError("password2")}
        />

        <label className="checkbox" style={{ display: "block", margin: "8px 0 16px" }}>
          <input
            type="checkbox"
            checked={agree}
            onChange={(e) => setAgree(e.target.checked)}
            onBlur={() => setTouched((t) => ({ ...t, agree: true }))}
            style={{ marginRight: 8 }}
          />
          (필수) 서비스 이용약관 및 개인정보 처리방침에 동의합니다.
        </label>
        {(submitted || touched.agree) && fieldErrors.agree && (
          <p className="help is-danger" style={{ marginTop: -8, marginBottom: 8 }}>
            {fieldErrors.agree}
          </p>
        )}

        {error && (
          <div className="notification is-danger is-light" style={{ marginBottom: 14 }}>
            {error}
          </div>
        )}

        <button
          className={`button is-primary is-fullwidth ${loading ? "is-loading" : ""}`}
          disabled={disabled}
          style={{ height: 56, fontWeight: 800, fontSize: 16 }}
        >
          가입하기
        </button>
      </form>
    </AuthLayout>
  );
}