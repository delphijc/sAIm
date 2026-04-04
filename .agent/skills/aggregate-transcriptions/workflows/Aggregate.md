# Aggregate Workflow

Aggregate insights and actionable items from transcribed audio sessions.

## Procedure

1. **Locate Transcription Files**

   - List all `.md` files in `.claude/History/TranscribedAudio/`.
   - Filter for files that follow the transcription template (containing "Key Insights" and "Actionable Items").

2. **Extract Wisdom & Actions**

   - For each file, parse the content under `## 💡 Key Insights (The "Wisdom")`.
   - Parse the content under `## 🛠️ Actionable Items & Frameworks`.

3. **Format Aggregate Tables**

   - Create a markdown table for **Key Insights** with columns: `| filename | Key Insight |`.
   - Create a markdown table for **Actionable Items & Frameworks** with columns: `| filename | Actionable Item / Framework |`.

4. **Update followups.md**

   - Write the aggregated tables to `.claude/History/TranscribedAudio/followups.md`.
   - Include a header summarizing the purpose of the file.

5. **Final Review**
   - Verify that all identified files were included.
   - Ensure the table formatting is correct.
