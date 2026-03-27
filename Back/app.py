import os
import uuid
import pymysql
import jwt
import datetime
from functools import wraps

from flask import Flask, request, jsonify, send_from_directory, g
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
from dotenv import load_dotenv

import pandas as pd
from google import genai
from langchain_community.document_loaders import PyPDFLoader, UnstructuredWordDocumentLoader

load_dotenv()

app = Flask(__name__)

# ==========================================
# 1. 환경 설정 및 DB / AI 초기화
# ==========================================
ALLOWED_ORIGINS = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:5173,http://localhost:3000"
)
ALLOWED_ORIGINS = [origin.strip() for origin in ALLOWED_ORIGINS.split(",") if origin.strip()]

CORS(
    app,
    resources={r"/*": {"origins": ALLOWED_ORIGINS}},
    supports_credentials=False
)

DB_HOST = os.getenv("DB_HOST", "localhost")
DB_USER = os.getenv("DB_USER", "root")
DB_PASSWORD = os.getenv("DB_PASSWORD", "1234")
DB_NAME = os.getenv("DB_NAME", "auth_db")

SECRET_KEY = os.getenv("AUTH_SECRET")
if not SECRET_KEY:
    raise ValueError("AUTH_SECRET 환경변수가 설정되지 않았습니다.")

UPLOAD_FOLDER = os.path.join(os.path.abspath(os.path.dirname(__file__)), "filebox")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

MAX_FILE_SIZE = 10 * 1024 * 1024
app.config["MAX_CONTENT_LENGTH"] = MAX_FILE_SIZE

ALLOWED_EXTENSIONS = {
    ".pdf", ".docx", ".txt", ".csv", ".xlsx", ".xls", ".png", ".jpg", ".jpeg"
}

ALLOWED_MIME_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
    "text/csv",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "image/png",
    "image/jpeg",
}

CURRENT_GEMINI_MODEL = "gemini-2.5-flash"
gemini_client = None

try:
    gemini_client = genai.Client()
    print(f"구글 AI 연결 완료 ({CURRENT_GEMINI_MODEL})")
except Exception as e:
    print(f"❌ 구글 AI 연결 실패: {e}")


# ==========================================
# 2. 헬퍼 함수
# ==========================================
def extract_text_from_file(file_path):
    ext = os.path.splitext(file_path)[1].lower()

    try:
        text = ""

        if ext in [".xlsx", ".xls"]:
            text = pd.read_excel(file_path).to_string(index=False)

        elif ext == ".csv":
            try:
                text = pd.read_csv(file_path, encoding="utf-8").to_string(index=False)
            except Exception:
                text = pd.read_csv(file_path, encoding="cp949").to_string(index=False)

        elif ext == ".txt":
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    text = f.read()
            except Exception:
                with open(file_path, "r", encoding="cp949") as f:
                    text = f.read()

        elif ext == ".pdf":
            text = "\n".join([doc.page_content for doc in PyPDFLoader(file_path).load()])

        elif ext == ".docx":
            text = "\n".join(
                [doc.page_content for doc in UnstructuredWordDocumentLoader(file_path).load()]
            )

        return text if text and text.strip() else None

    except Exception as e:
        print(f"File Read Error: {e}")
        return None


def get_db_connection():
    return pymysql.connect(
        host=DB_HOST,
        user=DB_USER,
        password=DB_PASSWORD,
        database=DB_NAME,
        charset="utf8mb4",
        cursorclass=pymysql.cursors.DictCursor,
        autocommit=True,
    )


def serialize_attendance_row(row):
    if not row:
        return {
            "workDate": "",
            "checkInTime": None,
            "checkOutTime": None,
        }

    return {
        "workDate": str(row["work_date"]) if row.get("work_date") else "",
        "checkInTime": row["check_in_time"].isoformat() if row.get("check_in_time") else None,
        "checkOutTime": row["check_out_time"].isoformat() if row.get("check_out_time") else None,
    }


def init_db():
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS users (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    email VARCHAR(255) NOT NULL UNIQUE,
                    password VARCHAR(512) NOT NULL,
                    name VARCHAR(255) NOT NULL,
                    company VARCHAR(255) NOT NULL,
                    department VARCHAR(255) NOT NULL,
                    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
                """
            )

            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS tasks (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    taskName VARCHAR(255),
                    assignee VARCHAR(255),
                    creator VARCHAR(255),
                    company VARCHAR(255),
                    department VARCHAR(255),
                    startDate DATE,
                    dueDate DATE,
                    note TEXT,
                    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
                """
            )

            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS files (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    fileName VARCHAR(255) NOT NULL,
                    originalName VARCHAR(255),
                    creator VARCHAR(255),
                    company VARCHAR(255),
                    department VARCHAR(255),
                    uploadedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
                """
            )

            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS attendance (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id INT NOT NULL,
                    work_date DATE NOT NULL,
                    check_in_time DATETIME NULL,
                    check_out_time DATETIME NULL,
                    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    UNIQUE KEY uq_user_work_date (user_id, work_date),
                    CONSTRAINT fk_attendance_user
                        FOREIGN KEY (user_id) REFERENCES users(id)
                        ON DELETE CASCADE
                )
                """
            )
    finally:
        conn.close()


init_db()


def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get("Authorization", "").replace("Bearer ", "")

        if not token:
            return jsonify({"message": "토큰이 없습니다."}), 401

        try:
            g.user = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        except Exception:
            return jsonify({"message": "유효하지 않은 토큰입니다."}), 401

        return f(*args, **kwargs)

    return decorated


def validate_task_dates(start_date, due_date):
    if start_date and due_date and start_date > due_date:
        return False
    return True


def allowed_file(filename):
    ext = os.path.splitext(filename)[1].lower()
    return ext in ALLOWED_EXTENSIONS


def allowed_mimetype(mimetype):
    return mimetype in ALLOWED_MIME_TYPES


# ==========================================
# 3. 인증 API
# ==========================================
@app.route("/signup", methods=["POST"])
def signup():
    data = request.get_json() or {}

    email = (data.get("email") or "").strip()
    password = data.get("password") or ""
    name = (data.get("name") or "").strip()
    company = (data.get("company") or "").strip()
    department = (data.get("department") or "").strip()

    if not email or not password or not name or not company or not department:
        return jsonify({"message": "모든 항목을 입력해주세요."}), 400

    hashed_pw = generate_password_hash(password)

    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO users (email, password, name, company, department)
                VALUES (%s, %s, %s, %s, %s)
                """,
                (email, hashed_pw, name, company, department),
            )
        return jsonify({"message": "회원가입 성공"}), 201

    except pymysql.err.IntegrityError:
        return jsonify({"message": "이미 가입된 이메일입니다."}), 409

    finally:
        conn.close()


@app.route("/login", methods=["POST"])
def login():
    data = request.get_json() or {}

    email = (data.get("email") or "").strip()
    password = data.get("password") or ""

    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT * FROM users WHERE email = %s", (email,))
            user = cursor.fetchone()

        if user and check_password_hash(user["password"], password):
            token_payload = {
                "id": user["id"],
                "email": user["email"],
                "name": user["name"],
                "company": user["company"],
                "department": user["department"],
                "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=24),
            }
            token = jwt.encode(token_payload, SECRET_KEY, algorithm="HS256")

            return jsonify(
                {
                    "message": "로그인 성공",
                    "token": token,
                    "name": user["name"],
                    "email": user["email"],
                }
            ), 200

        return jsonify({"message": "이메일 또는 비밀번호 불일치"}), 401

    finally:
        conn.close()


@app.route("/password-reset", methods=["POST"])
def password_reset():
    data = request.get_json() or {}

    email = (data.get("email") or "").strip()
    new_password = data.get("newPassword") or ""

    if not email or not new_password:
        return jsonify({"message": "이메일과 새 비밀번호를 입력해주세요."}), 400

    if len(new_password) < 8:
        return jsonify({"message": "비밀번호는 8자 이상이어야 합니다."}), 400

    hashed_pw = generate_password_hash(new_password)

    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT id FROM users WHERE email = %s", (email,))
            user = cursor.fetchone()

            if not user:
                return jsonify({"message": "가입된 이메일이 없습니다."}), 404

            cursor.execute(
                "UPDATE users SET password = %s WHERE email = %s",
                (hashed_pw, email),
            )

        return jsonify({"message": "비밀번호가 재설정되었습니다."}), 200

    finally:
        conn.close()


# ==========================================
# 4. 업무 API
# ==========================================
@app.route("/api/tasks", methods=["GET", "POST"])
@token_required
def tasks():
    conn = get_db_connection()
    try:
        if request.method == "GET":
            with conn.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT * FROM tasks
                    WHERE company = %s AND department = %s
                    ORDER BY id DESC
                    """,
                    (g.user["company"], g.user["department"]),
                )
                tasks_data = cursor.fetchall()

                for task in tasks_data:
                    if task["startDate"]:
                        task["startDate"] = str(task["startDate"])
                    if task["dueDate"]:
                        task["dueDate"] = str(task["dueDate"])

            return jsonify(tasks_data), 200

        data = request.get_json() or {}

        start_date = data.get("startDate") or None
        due_date = data.get("dueDate") or None

        if not validate_task_dates(start_date, due_date):
            return jsonify({"message": "시작일은 마감일보다 늦을 수 없습니다."}), 400

        with conn.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO tasks (
                    taskName, assignee, creator, company, department, startDate, dueDate, note
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    data.get("taskName"),
                    data.get("assignee"),
                    data.get("creator"),
                    g.user["company"],
                    g.user["department"],
                    start_date,
                    due_date,
                    data.get("note"),
                ),
            )

        return jsonify({"message": "업무 등록 성공"}), 201

    finally:
        conn.close()


@app.route("/api/tasks/<int:task_id>", methods=["PUT", "DELETE"])
@token_required
def manage_task(task_id):
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            if request.method == "PUT":
                data = request.get_json() or {}

                start_date = data.get("startDate") or None
                due_date = data.get("dueDate") or None

                if not validate_task_dates(start_date, due_date):
                    return jsonify({"message": "시작일은 마감일보다 늦을 수 없습니다."}), 400

                cursor.execute(
                    """
                    UPDATE tasks
                    SET taskName = %s,
                        assignee = %s,
                        creator = %s,
                        startDate = %s,
                        dueDate = %s,
                        note = %s
                    WHERE id = %s AND company = %s AND department = %s
                    """,
                    (
                        data.get("taskName"),
                        data.get("assignee"),
                        data.get("creator"),
                        start_date,
                        due_date,
                        data.get("note"),
                        task_id,
                        g.user["company"],
                        g.user["department"],
                    ),
                )

                if cursor.rowcount == 0:
                    return jsonify({"message": "수정할 업무가 없거나 권한이 없습니다."}), 404

                return jsonify({"message": "업무 수정 성공"}), 200

            cursor.execute(
                """
                DELETE FROM tasks
                WHERE id = %s AND company = %s AND department = %s
                """,
                (task_id, g.user["company"], g.user["department"]),
            )

            if cursor.rowcount == 0:
                return jsonify({"message": "삭제할 업무가 없거나 권한이 없습니다."}), 404

            return jsonify({"message": "삭제 성공"}), 200

    finally:
        conn.close()


@app.route("/api/team-members", methods=["GET"])
@token_required
def get_team_members():
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT name FROM users
                WHERE company = %s AND department = %s
                ORDER BY name ASC
                """,
                (g.user["company"], g.user["department"]),
            )
            members = cursor.fetchall()

        return jsonify(members), 200

    finally:
        conn.close()


# ==========================================
# 5. 근태 API
# ==========================================
@app.route("/api/attendance/today", methods=["GET"])
@token_required
def get_today_attendance():
    today = datetime.date.today()

    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT work_date, check_in_time, check_out_time
                FROM attendance
                WHERE user_id = %s AND work_date = %s
                """,
                (g.user["id"], today),
            )
            attendance_row = cursor.fetchone()

        return jsonify(serialize_attendance_row(attendance_row)), 200

    finally:
        conn.close()


@app.route("/api/attendance/check-in", methods=["POST"])
@token_required
def check_in():
    now = datetime.datetime.now()
    today = now.date()

    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT id, check_in_time, check_out_time
                FROM attendance
                WHERE user_id = %s AND work_date = %s
                """,
                (g.user["id"], today),
            )
            attendance_row = cursor.fetchone()

            if attendance_row:
                if attendance_row["check_in_time"] is not None:
                    return jsonify({"message": "이미 출근 처리되었습니다."}), 400

                cursor.execute(
                    """
                    UPDATE attendance
                    SET check_in_time = %s
                    WHERE id = %s
                    """,
                    (now, attendance_row["id"]),
                )
            else:
                cursor.execute(
                    """
                    INSERT INTO attendance (user_id, work_date, check_in_time)
                    VALUES (%s, %s, %s)
                    """,
                    (g.user["id"], today, now),
                )

        return jsonify({"message": "출근 처리되었습니다."}), 200

    finally:
        conn.close()


@app.route("/api/attendance/check-out", methods=["POST"])
@token_required
def check_out():
    now = datetime.datetime.now()
    today = now.date()

    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT id, check_in_time, check_out_time
                FROM attendance
                WHERE user_id = %s AND work_date = %s
                """,
                (g.user["id"], today),
            )
            attendance_row = cursor.fetchone()

            if not attendance_row:
                return jsonify({"message": "출근 기록이 없습니다."}), 400

            if attendance_row["check_in_time"] is None:
                return jsonify({"message": "출근 기록이 없습니다."}), 400

            if attendance_row["check_out_time"] is not None:
                return jsonify({"message": "이미 퇴근 처리되었습니다."}), 400

            cursor.execute(
                """
                UPDATE attendance
                SET check_out_time = %s
                WHERE id = %s
                """,
                (now, attendance_row["id"]),
            )

        return jsonify({"message": "퇴근 처리되었습니다."}), 200

    finally:
        conn.close()


# ==========================================
# 6. 파일 API
# ==========================================
@app.route("/api/files/upload", methods=["POST"])
@token_required
def upload_file():
    try:
        print("\n--- 📤 파일 업로드 요청 ---")
        print("request.files keys:", list(request.files.keys()))
        print("content_type:", request.content_type)

        if "file" not in request.files:
            print("❌ file 키 없음")
            return jsonify({"message": "파일이 없습니다."}), 400

        file = request.files["file"]
        print("filename:", file.filename)
        print("mimetype:", file.mimetype)

        if not file or not file.filename:
            print("❌ 파일 객체 또는 파일명 없음")
            return jsonify({"message": "유효한 파일이 아닙니다."}), 400

        raw_filename = (file.filename or "").strip()
        print("raw filename:", raw_filename)

        if not raw_filename:
            print("❌ 파일명 비어 있음")
            return jsonify({"message": "유효한 파일이 아닙니다."}), 400

        ext = os.path.splitext(raw_filename)[1].lower()
        print("ext:", ext)

        if ext not in ALLOWED_EXTENSIONS:
            print("❌ 확장자 불허")
            return jsonify({
                "message": f"허용되지 않는 파일 형식입니다. ext={ext}"
            }), 400

        # 초기 단계에서는 MIME 검사 제거 또는 완화 추천
        # if not allowed_mimetype(file.mimetype):
        #     print("❌ MIME 불허:", file.mimetype)
        #     return jsonify({
        #         "message": f"허용되지 않는 MIME 타입입니다. mimetype={file.mimetype}"
        #     }), 400

        original_filename = raw_filename
        save_name = f"{uuid.uuid4().hex}{ext}"
        save_path = os.path.join(UPLOAD_FOLDER, save_name)

        file.save(save_path)
        creator = request.form.get("creator", "").strip()

        conn = get_db_connection()
        try:
            with conn.cursor() as cursor:
                cursor.execute(
                    """
                    INSERT INTO files (fileName, originalName, creator, company, department)
                    VALUES (%s, %s, %s, %s, %s)
                    """,
                    (
                        save_name,
                        original_filename,
                        creator,
                        g.user["company"],
                        g.user["department"],
                    ),
                )
                file_id = cursor.lastrowid
        finally:
            conn.close()

        print("✅ 업로드 성공:", original_filename)
        return jsonify({
            "message": "파일 업로드 성공",
            "fileId": file_id,
            "fileName": save_name,
            "originalName": original_filename
        }), 200

    except Exception as e:
        print(f"❌ 파일 업로드 오류: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"message": "파일 업로드 중 서버 오류가 발생했습니다."}), 500
    try:
        print("\n--- 📤 파일 업로드 요청 ---")
        print("request.files keys:", list(request.files.keys()))
        print("content_type:", request.content_type)

        if "file" not in request.files:
            print("❌ file 키 없음")
            return jsonify({"message": "파일이 없습니다."}), 400

        file = request.files["file"]
        print("filename:", file.filename)
        print("mimetype:", file.mimetype)

        if not file or not file.filename:
            print("❌ 파일 객체 또는 파일명 없음")
            return jsonify({"message": "유효한 파일이 아닙니다."}), 400

        original_filename = secure_filename(file.filename)
        print("secure filename:", original_filename)

        if not allowed_file(original_filename):
            print("❌ 확장자 불허")
            return jsonify({
                "message": f"허용되지 않는 파일 형식입니다. ext={os.path.splitext(original_filename)[1].lower()}"
            }), 400

        if not allowed_mimetype(file.mimetype):
            print("❌ MIME 불허:", file.mimetype)
            return jsonify({
                "message": f"허용되지 않는 MIME 타입입니다. mimetype={file.mimetype}"
            }), 400

        ext = os.path.splitext(original_filename)[1].lower()
        save_name = f"{uuid.uuid4().hex}{ext}"
        save_path = os.path.join(UPLOAD_FOLDER, save_name)

        file.save(save_path)
        creator = request.form.get("creator", "").strip()

        conn = get_db_connection()
        try:
            with conn.cursor() as cursor:
                cursor.execute(
                    """
                    INSERT INTO files (fileName, originalName, creator, company, department)
                    VALUES (%s, %s, %s, %s, %s)
                    """,
                    (
                        save_name,
                        original_filename,
                        creator,
                        g.user["company"],
                        g.user["department"],
                    ),
                )
                file_id = cursor.lastrowid
        finally:
            conn.close()

        print("✅ 업로드 성공:", original_filename)
        return jsonify({
            "message": "파일 업로드 성공",
            "fileId": file_id,
            "fileName": save_name,
            "originalName": original_filename
        }), 200

    except Exception as e:
        print(f"❌ 파일 업로드 오류: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"message": "파일 업로드 중 서버 오류가 발생했습니다."}), 500

@app.route("/api/files", methods=["GET"])
@token_required
def list_files():
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT * FROM files
                WHERE company = %s AND department = %s
                ORDER BY id DESC
                """,
                (g.user["company"], g.user["department"]),
            )
            files = cursor.fetchall()

            for file_item in files:
                if file_item["uploadedAt"]:
                    file_item["uploadedAt"] = str(file_item["uploadedAt"])

        return jsonify(files), 200

    finally:
        conn.close()


@app.route("/api/files/<filename>", methods=["DELETE"])
@token_required
def delete_file(filename):
    safe_filename = secure_filename(filename)

    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                DELETE FROM files
                WHERE fileName = %s AND company = %s AND department = %s
                """,
                (safe_filename, g.user["company"], g.user["department"]),
            )

            if cursor.rowcount == 0:
                return jsonify({"message": "권한이 없거나 파일이 없습니다."}), 403

        file_path = os.path.join(UPLOAD_FOLDER, safe_filename)
        if os.path.exists(file_path):
            os.remove(file_path)

        return jsonify({"message": "삭제 완료"}), 200

    finally:
        conn.close()


@app.route("/filebox/<path:filename>", methods=["GET"])
@token_required
def download_file(filename):
    safe_filename = secure_filename(filename)

    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT id FROM files
                WHERE fileName = %s AND company = %s AND department = %s
                """,
                (safe_filename, g.user["company"], g.user["department"]),
            )
            file_row = cursor.fetchone()

            if not file_row:
                return jsonify({"message": "권한이 없거나 존재하지 않는 파일입니다."}), 403

    finally:
        conn.close()

    return send_from_directory(UPLOAD_FOLDER, safe_filename, as_attachment=True)


@app.errorhandler(413)
def too_large_file(e):
    return jsonify({
        "message": "파일 크기가 너무 큽니다. 최대 10MB까지 업로드할 수 있습니다."
    }), 413


# ==========================================
# 7. AI 질문 API
# ==========================================
@app.route("/api/ai/ask", methods=["POST"])
@token_required
def ask_ai():
    try:
        print("\n--- 🤖 AI 요청 수신 ---")

        data = request.get_json() or {}
        question = (data.get("question") or "").strip()
        file_id = data.get("fileId")

        if not question:
            return jsonify({"answer": "질문을 입력해주세요."}), 400

        if not file_id:
            return jsonify({"answer": "질문할 파일을 먼저 업로드하거나 선택해주세요."}), 400

        print(f"질문: {question}")
        print(f"대상 fileId: {file_id}")

        conn = get_db_connection()
        target_file = None

        try:
            with conn.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT id, fileName, originalName
                    FROM files
                    WHERE id = %s
                      AND company = %s
                      AND department = %s
                    LIMIT 1
                    """,
                    (file_id, g.user["company"], g.user["department"]),
                )
                target_file = cursor.fetchone()

        except Exception as db_err:
            print(f"❌ DB 조회 에러: {db_err}")
            return jsonify({"answer": "파일 조회 중 오류가 발생했습니다."}), 500

        finally:
            conn.close()

        if not target_file:
            return jsonify({"answer": "해당 파일을 찾을 수 없거나 접근 권한이 없습니다."}), 404

        stored_file_name = target_file["fileName"]
        original_file_name = target_file.get("originalName") or stored_file_name

        file_path = os.path.join(UPLOAD_FOLDER, stored_file_name)

        if not os.path.exists(file_path):
            print(f"❌ 파일 찾기 실패: {file_path}")
            return jsonify({"answer": "서버에 파일이 존재하지 않습니다. 다시 업로드해주세요."}), 404

        print(f"📂 텍스트 추출 시도: {file_path}")
        full_text = extract_text_from_file(file_path)

        if not full_text or not full_text.strip():
            print("❌ 텍스트 추출 실패")
            return jsonify({
                "answer": "파일 내용을 읽을 수 없습니다. 지원하지 않는 형식이거나 내용이 비어 있습니다."
            }), 500

        print(f"텍스트 추출 성공 (길이: {len(full_text)}자)")

        if not gemini_client:
            return jsonify({"answer": "AI 클라이언트가 초기화되지 않았습니다."}), 500

        document_text = full_text[:30000]

        prompt = f"""
[역할]
당신은 제공된 문서를 바탕으로 사용자의 질문에 답변하는 전문적이고 친절한 AI 비서입니다.

[중요 규칙]
1. 반드시 한국어로만 답변하세요.
2. 문서에 없는 내용은 추측해서 지어내지 마세요.
3. 문서에 근거가 불충분하면 "문서에서 확인되지 않습니다."라고 답하세요.
4. 답변은 핵심부터 간결하고 명확하게 작성하세요.
5. 가능하면 항목별로 정리하세요.

[문서 파일명]
{original_file_name}

[문서 내용]
{document_text}

[사용자 질문]
{question}
"""

        print(f"🤖 Gemini 모델({CURRENT_GEMINI_MODEL}) 호출 중...")

        response = gemini_client.models.generate_content(
            model=CURRENT_GEMINI_MODEL,
            contents=prompt,
        )

        final_answer = getattr(response, "text", None)

        if not final_answer or not final_answer.strip():
            return jsonify({"answer": "AI가 응답을 생성하지 못했습니다."}), 500

        print("Gemini 답변 완료!")
        return jsonify({
            "answer": final_answer.strip(),
            "fileId": target_file["id"],
            "fileName": original_file_name,
            "model": "gemini"
        }), 200

    except Exception as total_err:
        print(f"❌ [최상위 에러 발생]: {total_err}")
        import traceback
        traceback.print_exc()
        return jsonify({"answer": f"서버 내부 오류가 발생했습니다: {str(total_err)}"}), 500


# ==========================================
# 8. 서버 실행
# ==========================================
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)