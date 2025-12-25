import whisper
import sys
import warnings

warnings.filterwarnings("ignore")

audio_file = sys.argv[1]

model = whisper.load_model("tiny")
result = model.transcribe(audio_file)
text = result.get("text", "").strip()
print(text, flush=True)
