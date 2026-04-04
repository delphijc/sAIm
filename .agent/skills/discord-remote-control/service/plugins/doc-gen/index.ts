/**
 * Doc-Gen Plugin for Discord Remote Control
 *
 * Generates Word (.docx) and PowerPoint (.pptx) documents from Discord messages.
 * Supports a multi-message session model: user starts a doc session, sends markdown
 * content over multiple messages, then finalises with `!doc done` to generate and
 * upload the file.
 *
 * Commands:
 *   !doc help                       - Show help text
 *   !doc create report "Title"      - Start a DOCX report session
 *   !doc create slides "Title"      - Start a PPTX presentation session
 *   !doc convert <path>             - Convert a markdown file on disk to DOCX
 *   !doc list                       - List previously generated documents
 *   !doc retrieve <name>            - Re-attach a previously generated document
 *   !doc attach <filepath>          - Attach any file from the filesystem
 *   !doc done                       - Finalise and generate the active session document
 *   !doc cancel                     - Cancel active session without generating
 *
 * During an active session all plain messages (no !doc prefix) are appended to the
 * content buffer. `!doc done` triggers generation and file upload.
 */

import { join, basename as pathBasename } from "path";
import { mkdirSync, existsSync, readdirSync, readFileSync, statSync } from "fs";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  NumberFormat,
  LevelFormat,
  UnderlineType,
} from "docx";
import PptxGenJS from "pptxgenjs";
import type { Message } from "discord.js";
import type { Plugin, PluginResult, DiscordConfig, MessageContext } from "../types.ts";

// ============================================================================
// Types
// ============================================================================

type DocType = "report" | "slides";

interface DocSession {
  userId: string;
  channelId: string;
  type: DocType;
  title: string;
  contentLines: string[];
  createdAt: string;
}

// ============================================================================
// Session Store
// ============================================================================

const sessions = new Map<string, DocSession>();

function hasSession(userId: string): boolean {
  return sessions.has(userId);
}

function getDocSession(userId: string): DocSession | undefined {
  return sessions.get(userId);
}

function createDocSession(userId: string, channelId: string, type: DocType, title: string): DocSession {
  const session: DocSession = {
    userId,
    channelId,
    type,
    title,
    contentLines: [],
    createdAt: new Date().toISOString(),
  };
  sessions.set(userId, session);
  return session;
}

function appendContent(userId: string, line: string): void {
  const session = sessions.get(userId);
  if (session) {
    session.contentLines.push(line);
  }
}

function deleteSession(userId: string): void {
  sessions.delete(userId);
}

// ============================================================================
// Data directory
// ============================================================================

let dataDir = "";

function initDataDir(dir: string): void {
  dataDir = dir;
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function resolveDataDir(): string {
  if (dataDir) return dataDir;
  const paiDir = process.env.PAI_DIR || join(process.env.HOME || "", "Projects", "sam");
  return join(paiDir, ".agent", "skills", "discord-remote-control", "service", "data", "doc-gen");
}

// ============================================================================
// Markdown Parser
// ============================================================================

/**
 * A minimal but functional markdown-to-docx element parser.
 * Handles: H1-H3 headings, bullet lists, numbered lists, paragraphs,
 * bold (**text**), italic (*text*), inline code (`text`), horizontal rules.
 */

interface ParsedBlock {
  type: "h1" | "h2" | "h3" | "paragraph" | "bullet" | "numbered" | "hr" | "blank";
  text: string;
  number?: number; // for ordered lists
}

function parseMarkdown(raw: string): ParsedBlock[] {
  const lines = raw.split("\n");
  const blocks: ParsedBlock[] = [];
  let orderedCounter = 0;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (line === "" || line === "\r") {
      orderedCounter = 0;
      blocks.push({ type: "blank", text: "" });
      continue;
    }

    if (/^---+$/.test(line) || /^\*\*\*+$/.test(line)) {
      blocks.push({ type: "hr", text: "" });
      orderedCounter = 0;
      continue;
    }

    const h1 = line.match(/^#\s+(.+)/);
    if (h1) { blocks.push({ type: "h1", text: h1[1].trim() }); orderedCounter = 0; continue; }

    const h2 = line.match(/^##\s+(.+)/);
    if (h2) { blocks.push({ type: "h2", text: h2[1].trim() }); orderedCounter = 0; continue; }

    const h3 = line.match(/^###\s+(.+)/);
    if (h3) { blocks.push({ type: "h3", text: h3[1].trim() }); orderedCounter = 0; continue; }

    const bullet = line.match(/^[-*+]\s+(.+)/);
    if (bullet) { blocks.push({ type: "bullet", text: bullet[1] }); orderedCounter = 0; continue; }

    const numbered = line.match(/^(\d+)\.\s+(.+)/);
    if (numbered) {
      orderedCounter++;
      blocks.push({ type: "numbered", text: numbered[2], number: orderedCounter });
      continue;
    }

    orderedCounter = 0;
    blocks.push({ type: "paragraph", text: line });
  }

  return blocks;
}

/**
 * Convert a markdown inline string into an array of TextRun objects,
 * handling **bold**, *italic*, `code`, ***bold-italic***, and plain text.
 */
function inlineToRuns(text: string): TextRun[] {
  const runs: TextRun[] = [];

  // Tokenise: split on bold-italic, bold, italic, code spans
  const tokenRe = /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRe.exec(text)) !== null) {
    // Plain text before this match
    if (match.index > lastIndex) {
      runs.push(new TextRun({ text: text.slice(lastIndex, match.index) }));
    }

    if (match[2] !== undefined) {
      // ***bold italic***
      runs.push(new TextRun({ text: match[2], bold: true, italics: true }));
    } else if (match[3] !== undefined) {
      // **bold**
      runs.push(new TextRun({ text: match[3], bold: true }));
    } else if (match[4] !== undefined) {
      // *italic*
      runs.push(new TextRun({ text: match[4], italics: true }));
    } else if (match[5] !== undefined) {
      // `code`
      runs.push(new TextRun({ text: match[5], font: "Courier New", size: 18 }));
    }

    lastIndex = tokenRe.lastIndex;
  }

  // Trailing plain text
  if (lastIndex < text.length) {
    runs.push(new TextRun({ text: text.slice(lastIndex) }));
  }

  if (runs.length === 0) {
    runs.push(new TextRun({ text }));
  }

  return runs;
}

/**
 * Convert ParsedBlocks to docx Paragraph array.
 */
function blocksToParagraphs(blocks: ParsedBlock[]): Paragraph[] {
  const paragraphs: Paragraph[] = [];

  for (const block of blocks) {
    switch (block.type) {
      case "h1":
        paragraphs.push(
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [new TextRun({ text: block.text, bold: true, size: 32 })],
            spacing: { before: 320, after: 120 },
          })
        );
        break;

      case "h2":
        paragraphs.push(
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            children: [new TextRun({ text: block.text, bold: true, size: 26 })],
            spacing: { before: 240, after: 80 },
          })
        );
        break;

      case "h3":
        paragraphs.push(
          new Paragraph({
            heading: HeadingLevel.HEADING_3,
            children: [new TextRun({ text: block.text, bold: true, size: 22 })],
            spacing: { before: 160, after: 60 },
          })
        );
        break;

      case "bullet":
        paragraphs.push(
          new Paragraph({
            bullet: { level: 0 },
            children: inlineToRuns(block.text),
            spacing: { before: 60, after: 60 },
          })
        );
        break;

      case "numbered":
        paragraphs.push(
          new Paragraph({
            numbering: { reference: "doc-gen-numbering", level: 0 },
            children: inlineToRuns(block.text),
            spacing: { before: 60, after: 60 },
          })
        );
        break;

      case "hr":
        paragraphs.push(
          new Paragraph({
            border: { bottom: { color: "CCCCCC", space: 1, style: "single", size: 6 } },
            children: [],
            spacing: { before: 120, after: 120 },
          })
        );
        break;

      case "blank":
        paragraphs.push(new Paragraph({ children: [new TextRun({ text: "" })], spacing: { before: 60 } }));
        break;

      case "paragraph":
      default:
        if (block.text.trim()) {
          paragraphs.push(
            new Paragraph({
              children: inlineToRuns(block.text),
              spacing: { before: 80, after: 80 },
            })
          );
        }
        break;
    }
  }

  return paragraphs;
}

// ============================================================================
// DOCX Generation
// ============================================================================

async function generateDocx(title: string, markdownContent: string): Promise<Uint8Array> {
  const blocks = parseMarkdown(markdownContent);
  const bodyParagraphs = blocksToParagraphs(blocks);

  const doc = new Document({
    numbering: {
      config: [
        {
          reference: "doc-gen-numbering",
          levels: [
            {
              level: 0,
              format: LevelFormat.DECIMAL,
              text: "%1.",
              alignment: AlignmentType.LEFT,
              style: {
                paragraph: { indent: { left: 720, hanging: 260 } },
              },
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {},
        children: [
          // Title page heading
          new Paragraph({
            heading: HeadingLevel.TITLE,
            children: [
              new TextRun({
                text: title,
                bold: true,
                size: 48,
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { before: 480, after: 240 },
          }),
          // Metadata line
          new Paragraph({
            children: [
              new TextRun({
                text: `Generated: ${new Date().toLocaleString()}`,
                color: "888888",
                size: 18,
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 480 },
          }),
          // Separator
          new Paragraph({
            border: { bottom: { color: "CCCCCC", space: 1, style: "single", size: 6 } },
            children: [],
            spacing: { before: 0, after: 480 },
          }),
          // Document body
          ...bodyParagraphs,
        ],
      },
    ],
  });

  return await Packer.toBuffer(doc);
}

// ============================================================================
// PPTX Generation
// ============================================================================

/**
 * Parse markdown content into slide definitions.
 * Each H1/H2 becomes a new slide. Bullet/numbered/paragraph lines under
 * a heading become that slide's content bullets.
 */
interface SlideData {
  title: string;
  bullets: string[];
}

function parseSlides(raw: string): SlideData[] {
  const lines = raw.split("\n");
  const slides: SlideData[] = [];
  let current: SlideData | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    const h1 = line.match(/^#\s+(.+)/);
    const h2 = line.match(/^##\s+(.+)/);
    const h3 = line.match(/^###\s+(.+)/);

    if (h1 || h2) {
      if (current) slides.push(current);
      current = { title: (h1 || h2)![1].trim(), bullets: [] };
      continue;
    }

    if (h3 && current) {
      // H3 becomes a bold bullet acting as a sub-section label
      current.bullets.push(`  ${h3[1].trim()}`);
      continue;
    }

    if (!current) {
      // Lines before any heading create an implicit title slide
      if (line.trim()) {
        current = { title: line.trim(), bullets: [] };
      }
      continue;
    }

    // Bullet or numbered list items
    const bullet = line.match(/^[-*+]\s+(.+)/);
    if (bullet) { current.bullets.push(bullet[1]); continue; }

    const numbered = line.match(/^\d+\.\s+(.+)/);
    if (numbered) { current.bullets.push(numbered[2]); continue; }

    // Strip inline markdown for slide content (keep it clean)
    const plain = line
      .replace(/\*\*\*(.+?)\*\*\*/g, "$1")
      .replace(/\*\*(.+?)\*\*/g, "$1")
      .replace(/\*(.+?)\*/g, "$1")
      .replace(/`(.+?)`/g, "$1")
      .trim();

    if (plain && plain !== "---") {
      current.bullets.push(plain);
    }
  }

  if (current) slides.push(current);

  return slides.filter(s => s.title);
}

async function generatePptx(title: string, markdownContent: string): Promise<Buffer> {
  const pptx = new PptxGenJS();

  // Presentation-level theme (dark SAM aesthetic)
  pptx.layout = "LAYOUT_16x9";
  pptx.title = title;
  pptx.author = "Sam";

  const DARK_BG = "1a1a2e";
  const ACCENT = "7c3aed"; // purple
  const TEXT_PRIMARY = "e2e8f0";
  const TEXT_SECONDARY = "94a3b8";
  const TITLE_FONT = "Segoe UI";
  const BODY_FONT = "Segoe UI";

  // ---- Title slide ----
  const titleSlide = pptx.addSlide();
  titleSlide.background = { color: DARK_BG };

  // Accent bar
  titleSlide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 2.5, w: "100%", h: 0.05,
    fill: { color: ACCENT },
    line: { color: ACCENT },
  });

  titleSlide.addText(title, {
    x: 0.5, y: 1.0, w: 9.0, h: 1.5,
    fontSize: 40,
    bold: true,
    color: TEXT_PRIMARY,
    fontFace: TITLE_FONT,
    align: "center",
  });

  titleSlide.addText(new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }), {
    x: 0.5, y: 3.2, w: 9.0, h: 0.5,
    fontSize: 16,
    color: TEXT_SECONDARY,
    fontFace: BODY_FONT,
    align: "center",
  });

  titleSlide.addText("Generated by Sam", {
    x: 0.5, y: 3.8, w: 9.0, h: 0.4,
    fontSize: 12,
    color: ACCENT,
    fontFace: BODY_FONT,
    align: "center",
  });

  // ---- Content slides ----
  const slides = parseSlides(markdownContent);

  for (const slideData of slides) {
    const slide = pptx.addSlide();
    slide.background = { color: DARK_BG };

    // Slide title bar
    slide.addShape(pptx.ShapeType.rect, {
      x: 0, y: 0, w: "100%", h: 1.0,
      fill: { color: "16213e" },
      line: { color: "16213e" },
    });

    // Accent line below title bar
    slide.addShape(pptx.ShapeType.rect, {
      x: 0, y: 1.0, w: "100%", h: 0.04,
      fill: { color: ACCENT },
      line: { color: ACCENT },
    });

    // Slide title
    slide.addText(slideData.title, {
      x: 0.4, y: 0.1, w: 9.2, h: 0.8,
      fontSize: 24,
      bold: true,
      color: TEXT_PRIMARY,
      fontFace: TITLE_FONT,
      valign: "middle",
    });

    // Slide number (bottom-right)
    slide.addText(`${slides.indexOf(slideData) + 1} / ${slides.length}`, {
      x: 8.5, y: 6.8, w: 1.2, h: 0.3,
      fontSize: 10,
      color: TEXT_SECONDARY,
      fontFace: BODY_FONT,
      align: "right",
    });

    // Content bullets
    if (slideData.bullets.length > 0) {
      // Limit visible bullets to avoid overflow; truncate with ellipsis
      const MAX_BULLETS = 8;
      const visibleBullets = slideData.bullets.slice(0, MAX_BULLETS);
      const overflow = slideData.bullets.length - MAX_BULLETS;

      const bulletObjects = visibleBullets.map((b) => {
        const isSubItem = b.startsWith("  ");
        return {
          text: b.trim(),
          options: {
            fontSize: isSubItem ? 14 : 16,
            color: isSubItem ? TEXT_SECONDARY : TEXT_PRIMARY,
            bullet: { type: "bullet" as const, indent: isSubItem ? 40 : 20 },
            breakLine: true,
          } as const,
        };
      });

      if (overflow > 0) {
        bulletObjects.push({
          text: `... and ${overflow} more item${overflow === 1 ? "" : "s"}`,
          options: {
            fontSize: 12,
            color: TEXT_SECONDARY,
            bullet: { type: "bullet" as const, indent: 20 },
            breakLine: true,
          } as const,
        });
      }

      slide.addText(bulletObjects, {
        x: 0.4,
        y: 1.3,
        w: 9.2,
        h: 5.3,
        valign: "top",
        fontFace: BODY_FONT,
      });
    } else {
      slide.addText("(No content)", {
        x: 0.4, y: 2.5, w: 9.2, h: 1.0,
        fontSize: 16,
        color: TEXT_SECONDARY,
        fontFace: BODY_FONT,
        align: "center",
        italic: true,
      });
    }
  }

  // pptxgenjs write returns a Buffer when target is "nodebuffer"
  return (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
}

// ============================================================================
// File Helpers
// ============================================================================

function safeName(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function timestampedFilename(title: string, ext: string): string {
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  return `${safeName(title)}_${ts}.${ext}`;
}

async function saveAndUploadDocx(
  message: Message,
  title: string,
  markdownContent: string
): Promise<void> {
  const dir = resolveDataDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const filename = timestampedFilename(title, "docx");
  const filePath = join(dir, filename);

  const buffer = await generateDocx(title, markdownContent);
  await Bun.write(filePath, buffer);

  await message.reply(`Report generated: **${filename}** (${(buffer.byteLength / 1024).toFixed(1)} KB)`);
  await message.channel.send({
    files: [{ attachment: filePath, name: filename }],
  });
}

async function saveAndUploadPptx(
  message: Message,
  title: string,
  markdownContent: string
): Promise<void> {
  const dir = resolveDataDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const filename = timestampedFilename(title, "pptx");
  const filePath = join(dir, filename);

  const buffer = await generatePptx(title, markdownContent);
  await Bun.write(filePath, buffer);

  const slideCount = parseSlides(markdownContent).length;
  await message.reply(
    `Presentation generated: **${filename}** (${slideCount} slide${slideCount === 1 ? "" : "s"}, ${(buffer.byteLength / 1024).toFixed(1)} KB)`
  );
  await message.channel.send({
    files: [{ attachment: filePath, name: filename }],
  });
}

// ============================================================================
// Command Handlers
// ============================================================================

async function handleHelp(message: Message): Promise<PluginResult> {
  await message.reply(
    "**Doc-Gen Commands:**\n" +
    "`!doc create report \"Title\"` — Start a Word document session\n" +
    "`!doc create slides \"Title\"` — Start a PowerPoint presentation session\n" +
    "`!doc convert <path>` — Convert a markdown file on disk to DOCX\n" +
    "`!doc list` — List generated documents\n" +
    "`!doc retrieve [name]` — Re-attach a generated document (latest if no name)\n" +
    "`!doc attach <path>` — Attach any file from the filesystem\n" +
    "`!doc done` — Finalise and generate the active document\n" +
    "`!doc cancel` — Cancel active session without generating\n" +
    "`!doc help` — Show this message\n\n" +
    "**During an active session:** just send your markdown content as messages. " +
    "Supports `# headings`, `**bold**`, `*italic*`, `- bullets`, `1. numbered lists`, `` `code` ``.\n" +
    "Say `!doc done` when finished."
  );
  return { handled: true, responseSent: true };
}

async function handleCreate(
  message: Message,
  args: string
): Promise<PluginResult> {
  const userId = message.author.id;

  if (hasSession(userId)) {
    const existing = getDocSession(userId)!;
    await message.reply(
      `You already have an active doc session: **${existing.type}** — "${existing.title}".\n` +
      `Use \`!doc done\` to generate it or \`!doc cancel\` to discard.`
    );
    return { handled: true, responseSent: true };
  }

  // Parse: "report \"Title\"" or "slides \"Title\""
  const match = args.match(/^(report|slides)\s+"(.+?)"\s*$/i) ||
                args.match(/^(report|slides)\s+(.+?)\s*$/i);

  if (!match) {
    await message.reply(
      "Usage: `!doc create report \"My Title\"` or `!doc create slides \"My Title\"`"
    );
    return { handled: true, responseSent: true };
  }

  const type = match[1].toLowerCase() as DocType;
  const title = match[2].trim();

  createDocSession(userId, message.channelId, type, title);

  const typeLabel = type === "report" ? "Word document (DOCX)" : "PowerPoint presentation (PPTX)";
  const hint = type === "report"
    ? "Send your markdown content. Use `# Heading 1`, `## Heading 2`, `- bullets`, `**bold**`, etc."
    : "Send an outline. Use `# Slide Title` for slides, `- bullet` for content, `## Sub-slide` for sections.";

  await message.reply(
    `**Doc session started:** "${title}" (${typeLabel})\n\n` +
    `${hint}\n\n` +
    `Send your content now. Type \`!doc done\` when ready to generate.`
  );
  return { handled: true, responseSent: true };
}

async function handleDone(message: Message): Promise<PluginResult> {
  const userId = message.author.id;
  const session = getDocSession(userId);

  if (!session) {
    await message.reply("No active doc session. Start one with `!doc create report \"Title\"` or `!doc create slides \"Title\"`.");
    return { handled: true, responseSent: true };
  }

  const content = session.contentLines.join("\n").trim();

  if (!content) {
    await message.reply(
      "Your document has no content yet. Send some markdown content before using `!doc done`."
    );
    return { handled: true, responseSent: true };
  }

  await message.reply(`Generating **${session.type === "report" ? "DOCX report" : "PPTX presentation"}** for "${session.title}"...`);

  try {
    await message.channel.sendTyping();
  } catch { /* ignore */ }

  deleteSession(userId);

  try {
    if (session.type === "report") {
      await saveAndUploadDocx(message, session.title, content);
    } else {
      await saveAndUploadPptx(message, session.title, content);
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("[DocGenPlugin] Generation error:", err);
    await message.reply(`Failed to generate document: ${errorMessage}`);
  }

  return { handled: true, responseSent: true };
}

async function handleCancel(message: Message): Promise<PluginResult> {
  const userId = message.author.id;

  if (!hasSession(userId)) {
    await message.reply("No active doc session to cancel.");
    return { handled: true, responseSent: true };
  }

  const session = getDocSession(userId)!;
  deleteSession(userId);

  await message.reply(
    `Session cancelled: "${session.title}" (${session.contentLines.length} line${session.contentLines.length === 1 ? "" : "s"} discarded).`
  );
  return { handled: true, responseSent: true };
}

async function handleConvert(message: Message, args: string): Promise<PluginResult> {
  const filePath = args.trim();

  if (!filePath) {
    await message.reply("Usage: `!doc convert /path/to/file.md`");
    return { handled: true, responseSent: true };
  }

  if (!existsSync(filePath)) {
    await message.reply(`File not found: \`${filePath}\``);
    return { handled: true, responseSent: true };
  }

  let markdownContent: string;
  try {
    markdownContent = readFileSync(filePath, "utf-8");
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    await message.reply(`Could not read file: ${errorMessage}`);
    return { handled: true, responseSent: true };
  }

  // Derive title from filename
  const basename = filePath.split("/").pop() || "document";
  const title = basename.replace(/\.(md|markdown|txt)$/i, "").replace(/[-_]/g, " ");

  await message.reply(`Converting \`${basename}\` to DOCX...`);

  try {
    await message.channel.sendTyping();
  } catch { /* ignore */ }

  try {
    await saveAndUploadDocx(message, title, markdownContent);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("[DocGenPlugin] Convert error:", err);
    await message.reply(`Conversion failed: ${errorMessage}`);
  }

  return { handled: true, responseSent: true };
}

async function handleList(message: Message): Promise<PluginResult> {
  const dir = resolveDataDir();

  if (!existsSync(dir)) {
    await message.reply("No documents generated yet.");
    return { handled: true, responseSent: true };
  }

  let entries: string[];
  try {
    entries = readdirSync(dir)
      .filter((f) => f.endsWith(".docx") || f.endsWith(".pptx"))
      .sort()
      .reverse(); // newest first
  } catch {
    await message.reply("Could not list documents.");
    return { handled: true, responseSent: true };
  }

  if (entries.length === 0) {
    await message.reply("No documents generated yet.");
    return { handled: true, responseSent: true };
  }

  const MAX_LIST = 20;
  const shown = entries.slice(0, MAX_LIST);
  const overflow = entries.length - MAX_LIST;

  const lines = shown.map((f) => {
    const icon = f.endsWith(".pptx") ? "📊" : "📄";
    return `${icon} \`${f}\``;
  });

  if (overflow > 0) {
    lines.push(`...and ${overflow} more`);
  }

  await message.reply(
    `**Generated documents** (${entries.length} total, newest first):\n${lines.join("\n")}\n\n` +
    `Stored in: \`${dir}\``
  );
  return { handled: true, responseSent: true };
}

// ============================================================================
// Retrieve & Attach Handlers
// ============================================================================

async function handleRetrieve(message: Message, args: string): Promise<PluginResult> {
  const dir = resolveDataDir();
  const searchTerm = args.trim().toLowerCase();

  if (!searchTerm) {
    // No search term — retrieve the most recently generated doc
    if (!existsSync(dir)) {
      await message.reply("No documents generated yet. Use `!doc create` to make one.");
      return { handled: true, responseSent: true };
    }

    const entries = readdirSync(dir)
      .filter((f) => f.endsWith(".docx") || f.endsWith(".pptx"))
      .sort()
      .reverse();

    if (entries.length === 0) {
      await message.reply("No documents generated yet.");
      return { handled: true, responseSent: true };
    }

    const latest = entries[0];
    const filePath = join(dir, latest);
    const stat = statSync(filePath);
    const icon = latest.endsWith(".pptx") ? "📊" : "📄";

    await message.reply(`${icon} Attaching most recent document: **${latest}** (${(stat.size / 1024).toFixed(1)} KB)`);
    await message.channel.send({
      files: [{ attachment: filePath, name: latest }],
    });
    return { handled: true, responseSent: true };
  }

  // Search by partial name match
  if (!existsSync(dir)) {
    await message.reply("No documents generated yet.");
    return { handled: true, responseSent: true };
  }

  const entries = readdirSync(dir)
    .filter((f) => (f.endsWith(".docx") || f.endsWith(".pptx")) && f.toLowerCase().includes(searchTerm))
    .sort()
    .reverse();

  if (entries.length === 0) {
    await message.reply(`No document matching "${args.trim()}" found. Use \`!doc list\` to see available documents.`);
    return { handled: true, responseSent: true };
  }

  if (entries.length > 1) {
    // Multiple matches — send the most recent and list others
    const latest = entries[0];
    const filePath = join(dir, latest);
    const stat = statSync(filePath);
    const icon = latest.endsWith(".pptx") ? "📊" : "📄";
    const others = entries.slice(1, 6).map(f => `\`${f}\``).join(", ");

    await message.reply(
      `${icon} Found ${entries.length} matches. Attaching most recent: **${latest}** (${(stat.size / 1024).toFixed(1)} KB)` +
      (entries.length > 1 ? `\nOther matches: ${others}${entries.length > 6 ? " ..." : ""}` : "")
    );
    await message.channel.send({
      files: [{ attachment: filePath, name: latest }],
    });
  } else {
    const filePath = join(dir, entries[0]);
    const stat = statSync(filePath);
    const icon = entries[0].endsWith(".pptx") ? "📊" : "📄";

    await message.reply(`${icon} **${entries[0]}** (${(stat.size / 1024).toFixed(1)} KB)`);
    await message.channel.send({
      files: [{ attachment: filePath, name: entries[0] }],
    });
  }

  return { handled: true, responseSent: true };
}

async function handleAttach(message: Message, args: string): Promise<PluginResult> {
  const filePath = args.trim();

  if (!filePath) {
    await message.reply("Usage: `!doc attach /path/to/file`");
    return { handled: true, responseSent: true };
  }

  if (!existsSync(filePath)) {
    await message.reply(`File not found: \`${filePath}\``);
    return { handled: true, responseSent: true };
  }

  try {
    const stat = statSync(filePath);
    const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB Discord limit

    if (stat.size > MAX_FILE_SIZE) {
      await message.reply(`File too large (${(stat.size / 1024 / 1024).toFixed(1)} MB). Discord limit is 25 MB.`);
      return { handled: true, responseSent: true };
    }

    const filename = pathBasename(filePath);
    await message.reply(`Attaching **${filename}** (${(stat.size / 1024).toFixed(1)} KB)`);
    await message.channel.send({
      files: [{ attachment: filePath, name: filename }],
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    await message.reply(`Failed to attach file: ${errorMessage}`);
  }

  return { handled: true, responseSent: true };
}

// ============================================================================
// Active Session Content Accumulator
// ============================================================================

async function handleSessionContent(message: Message): Promise<PluginResult> {
  const userId = message.author.id;
  const session = getDocSession(userId);

  if (!session) return { handled: false };

  const content = message.content.trim();

  // Guard against accidentally appending bot commands
  if (content.startsWith("!")) return { handled: false };

  appendContent(userId, content);

  const lineCount = session.contentLines.length;
  const wordCount = session.contentLines.join(" ").split(/\s+/).filter(Boolean).length;

  // Acknowledge periodically (every 5 messages) so the user knows content is being buffered
  if (lineCount % 5 === 0) {
    try {
      await message.react("✅");
    } catch {
      // Reactions may be disabled — silent fallback
    }
  }

  console.log(`[DocGenPlugin] Buffered content for ${userId}: ${lineCount} chunks, ~${wordCount} words`);
  return { handled: true, responseSent: true };
}

// ============================================================================
// Triggers
// ============================================================================

const DOC_TRIGGER = /^!doc\b/i;
const DONE_TRIGGER = /^!doc\s+done\s*$/i;

// ============================================================================
// Plugin Object
// ============================================================================

const docGenPlugin: Plugin = {
  name: "doc-gen",
  description: "Generate Word and PowerPoint documents from Discord markdown messages",
  version: "1.0.0",
  priority: 20,

  canHandle(message: Message, context: MessageContext): boolean {
    // Only handle text messages
    if (context.messageType !== "text") return false;

    const content = message.content.trim();

    // Explicit !doc command
    if (DOC_TRIGGER.test(content)) return true;

    // Messages during an active session (but not other ! commands)
    if (hasSession(message.author.id) && !content.startsWith("!")) return true;

    return false;
  },

  async handle(
    message: Message,
    config: DiscordConfig,
    context: MessageContext
  ): Promise<PluginResult> {
    const content = message.content.trim();
    const userId = message.author.id;

    // ====== Route !doc commands ======
    if (DOC_TRIGGER.test(content)) {
      const after = content.replace(DOC_TRIGGER, "").trim();
      const subcommand = after.split(/\s+/)[0]?.toLowerCase() ?? "";

      switch (subcommand) {
        case "":
        case "help":
          return await handleHelp(message);

        case "create": {
          const createArgs = after.replace(/^create\s*/i, "").trim();
          return await handleCreate(message, createArgs);
        }

        case "done":
        case "finish":
        case "generate":
          return await handleDone(message);

        case "cancel":
        case "quit":
          return await handleCancel(message);

        case "convert": {
          const convertArgs = after.replace(/^convert\s*/i, "").trim();
          return await handleConvert(message, convertArgs);
        }

        case "list":
          return await handleList(message);

        case "retrieve":
        case "get":
        case "download": {
          const retrieveArgs = after.replace(/^(retrieve|get|download)\s*/i, "").trim();
          return await handleRetrieve(message, retrieveArgs);
        }

        case "attach":
        case "send": {
          const attachArgs = after.replace(/^(attach|send)\s*/i, "").trim();
          return await handleAttach(message, attachArgs);
        }

        default:
          // Unknown subcommand — show help if no active session, else buffer
          if (hasSession(userId)) {
            return await handleSessionContent(message);
          }
          await message.reply(`Unknown doc command: \`${subcommand}\`. Try \`!doc help\`.`);
          return { handled: true, responseSent: true };
      }
    }

    // ====== Buffer content during active session ======
    if (hasSession(userId)) {
      return await handleSessionContent(message);
    }

    return { handled: false };
  },

  async onLoad(): Promise<void> {
    const dir = join(
      process.env.PAI_DIR || join(process.env.HOME || "", "Projects", "sam"),
      ".agent",
      "skills",
      "discord-remote-control",
      "service",
      "data",
      "doc-gen"
    );
    initDataDir(dir);
    console.log(`[DocGenPlugin] Loaded. Data directory: ${dir}`);
  },

  async onUnload(): Promise<void> {
    // Clear any lingering sessions on graceful shutdown
    sessions.clear();
    console.log("[DocGenPlugin] Unloaded. Sessions cleared.");
  },
};

// ============================================================================
// Export
// ============================================================================

export default docGenPlugin;
