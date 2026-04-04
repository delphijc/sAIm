import os
import sys
import argparse
from pathlib import Path
import whisper
import ollama

def read_template(template_path):
    with open(template_path, 'r') as f:
        return f.read()

def transcribe_audio_local(audio_path, model_size="base"):
    """
    Transcribes audio using local OpenAI Whisper model.
    """
    print(f"Loading Whisper model ('{model_size}')...")
    model = whisper.load_model(model_size)
    
    print(f"Transcribing {audio_path}...")
    result = model.transcribe(str(audio_path), fp16=False)
    return result["text"]

def process_transcript_local(transcript_text, template_content, model_name="gpt-oss"):
    """
    Uses local Ollama model to format the transcript.
    """
    print(f"Processing transcript with Ollama ('{model_name}')...")
    
    system_prompt = """
    You are an expert editor and knowledge manager. Your task is to take a raw transcript and format it into a structured Markdown document based on a provided template.
    
    Follow these rules:
    1. Speaker Diarization: Label speakers consistently (e.g., **[Speaker Name]**:). If unknown, use logical labels like **[Speaker 1]**.
    2. Formatting: Output exclusively in Markdown. Add timestamps [MM:SS] occasionally if implied by context (though raw text might lack them, do your best or omit if impossible).
    3. Clean Verbatim: Remove filler words (ums, ahs) but keep technical jargon.
    4. Structure: 
        - Title
        - Key Insights (The "Wisdom")
        - Processed Transcript (Break into paragraphs)
        - Actionable Items & Frameworks
        - Related Concepts
    
    Fill in the provided template.
    """
    
    user_prompt = f"""
    TEMPLATE:
    {template_content}
    
    RAW TRANSCRIPT:
    {transcript_text}
    
    Please output ONLY the fully filled markdown file.
    """

    response = ollama.chat(model=model_name, messages=[
        {
            'role': 'system',
            'content': system_prompt,
        },
        {
            'role': 'user',
            'content': user_prompt,
        },
    ])
    
    return response['message']['content']

def main():
    parser = argparse.ArgumentParser(description="Transcribe and format audio files locally.")
    parser.add_argument("audio_file", help="Path to the audio file (.mp3, .wav, .m4a)")
    parser.add_argument("--output", help="Output markdown file path", default=None)
    parser.add_argument("--whisper-model", help="Whisper model size (tiny, base, small, medium, large)", default="base")
    parser.add_argument("--ollama-model", help="Ollama model name", default="gpt-oss")
    
    args = parser.parse_args()
    
    audio_path = Path(args.audio_file)
    if not audio_path.exists():
        print(f"Error: File not found: {audio_path}")
        sys.exit(1)
        
    # Setup Output Path
    if args.output:
        output_path = Path(args.output)
    else:
        # Determine output path: prioritize project .agent directory, then fall back to .claude
        # Script is in .../.claude/Skills/TranscribeAudio/tools/Transcribe.py
        # Audio might be in .../Projects/sam/.agent/Recordings/
        # We want to save to .../Projects/sam/.agent/History/TranscribedAudio/ if in a project
        # Or to .../.claude/History/TranscribedAudio/ if not in a project

        output_path = None

        # First, traverse up from the audio file to find .agent directory (project-based)
        current = audio_path.resolve().parent
        for parent in current.parents:
            if parent.name == ".agent":
                agent_dir = parent
                history_dir = agent_dir / "History" / "TranscribedAudio"
                history_dir.mkdir(parents=True, exist_ok=True)
                output_path = history_dir / audio_path.with_suffix('.md').name
                break

        # If not in a project, search for .claude directory (global)
        if not output_path:
            current = Path(__file__).resolve()
            claude_dir = None
            for parent in current.parents:
                if parent.name == ".claude":
                    claude_dir = parent
                    break

            if claude_dir:
                history_dir = claude_dir / "History" / "TranscribedAudio"
                history_dir.mkdir(parents=True, exist_ok=True)
                output_path = history_dir / audio_path.with_suffix('.md').name

        # Fallback if no .agent or .claude found
        if not output_path:
            output_path = audio_path.with_suffix('.md')
            
    # 1. Transcribe (Local Whisper)
    try:
        raw_transcript = transcribe_audio_local(audio_path, args.whisper_model)
        # Verify we got something
        if not raw_transcript:
            print("Error: Transcription returned empty.")
            sys.exit(1)
            
        print("Transcription complete. Length:", len(raw_transcript))
        
    except Exception as e:
        print(f"Error during transcription: {e}")
        sys.exit(1)
        
    # 2. Load Template
    script_dir = Path(__file__).parent
    template_path = script_dir / "MarkdownTemplate.md"
    if not template_path.exists():
        print(f"Warning: Template not found at {template_path}. Using default structure.")
        template_content = "Format nicely with headers."
    else:
        template_content = read_template(template_path)

    # 3. Process & Format (Local Ollama)
    try:
        formatted_md = process_transcript_local(raw_transcript, template_content, args.ollama_model)
    except Exception as e:
        print(f"Error during OAS processing: {e}")
        print("Ensure 'ollama serve' is running and the model is pulled.")
        sys.exit(1)
        
    # 4. Save
    with open(output_path, "w") as f:
        f.write(formatted_md)
        
    print(f"Success! Output saved to: {output_path}")

if __name__ == "__main__":
    main()
