# Using the Multi-Backend Wizard

The **jagentsWizard** allows you to choose the AI intelligence engine that best suits your needs for project planning and document generation.

## Selecting an AI Backend

When starting a new project or workflow in the Wizard:

1.  Navigate to the **Project Setup** screen.
2.  Enter your **Project Identity** and **Goals**.
3.  Locate the **AI Intelligence Engine** section at the bottom.
4.  Select your preferred **Backend Provider**:
    *   **Ollama (Local):** Best for privacy and offline usage. Requires Ollama running locally.
    *   **Google Gemini:** Fast and high-context window. Requires an API key.
    *   **Anthropic Claude:** High-quality reasoning. Requires an API key.
    *   **Qwen:** Evaluation of Qwen coder models via Ollama.

5.  (Optional) Update the **Model ID** if you wish to use a specific model version (e.g., `gemini-1.5-pro` instead of `flash`).

## API Key Configuration

For cloud providers (Gemini, Claude), you must provide API keys. The system looks for keys in a `.env` file located at `~/.claude/.env` or inside your project's `.claude/` directory.

**File:** `~/.claude/.env`

```env
# Google Gemini
GOOGLE_API_KEY=your_key_here
# OR
GEMINI_API_KEY=your_key_here

# Anthropic Claude
ANTHROPIC_API_KEY=your_key_here
```

## Troubleshooting

*   **Ollama Connection Error:** Ensure Ollama is running (`ollama serve`).
*   **Missing API Key:** Check that your `.env` file exists and has the correct permissions.
*   **Model Not Found:** Verify the Model ID exists in your Ollama library (`ollama list`) or is a valid API model name.
