from google import genai
import os
from dotenv import load_dotenv

load_dotenv()

api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")

if not api_key:
    print("❌ .env 파일에서 GEMINI_API_KEY 또는 GOOGLE_API_KEY를 찾을 수 없습니다.")
else:
    print(f"🔑 API Key 확인됨: {api_key[:5]}...*****")
    print("📡 구글 서버에 모델 목록 조회 중...")

    try:
        client = genai.Client(api_key=api_key)

        available_models = []
        pager = client.models.list()

        for m in pager:
            model_name = getattr(m, "name", "")
            print(f"  - {model_name}")
            available_models.append(model_name)

        print("\n✅ 조회 완료!")
        print("\n[추천 설정]")

        flash_models = [m for m in available_models if "flash" in m.lower()]
        stable_candidates = [m for m in flash_models if "preview" not in m.lower()]

        if stable_candidates:
            print(f"👉 app.py에 '{stable_candidates[0]}' 라고 적으세요. (권장)")
        elif flash_models:
            print(f"👉 app.py에 '{flash_models[0]}' 라고 적으세요. (flash 계열)")
        elif available_models:
            gemini_models = [m for m in available_models if "gemini" in m.lower()]
            if gemini_models:
                print(f"👉 app.py에 '{gemini_models[0]}' 라고 적으세요.")
            else:
                print("👉 조회된 모델 중 텍스트 생성용 모델명을 직접 선택하세요.")
        else:
            print("👉 조회된 모델이 없습니다. API 키/권한/네트워크를 확인하세요.")

    except Exception as e:
        print(f"❌ 조회 실패: {e}")