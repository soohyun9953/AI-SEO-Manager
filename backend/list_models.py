import os
from google import genai
from dotenv import load_dotenv
import traceback

load_dotenv()

def list_models():
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        print("GEMINI_API_KEY not found in .env")
        return

    try:
        client = genai.Client(api_key=api_key)
        print("--- Available Models ---")
        for model in client.models.list():
            print(f"- {model.name}")
    except Exception:
        traceback.print_exc()

if __name__ == "__main__":
    list_models()
