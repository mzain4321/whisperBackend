import { exec } from "child_process";

export const transcribeAudio = (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    exec(
      `python transcribe.py "${req.file.path}"`,
      { maxBuffer: 1024 * 1024 * 10 },
      (err, stdout, stderr) => {
        if (err) {
          console.error(stderr);
          return res.status(500).json({ error: "Whisper failed" });
        }

        res.json({ text: stdout.trim() });
      }
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
