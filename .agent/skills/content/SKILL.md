---
name: content
description: "End-to-end content creation including writing, design, image generation, and asset management. USE WHEN creating blog posts, articles, social media content, newsletters, or managing content production workflows."
triggers:
  - "create content"
  - "write blog post"
  - "create documentation"
  - "design user experience"
  - "manage assets"
---

# Content

## Purpose

End-to-end content creation encompassing technical writing, UX design, image generation, and asset management. Produces publication-ready content with visual polish and comprehensive documentation.

**Agents:** technical-writer (Paige), ux-designer

---

## Sub-Skills

### Content Creation & Blogging
Structured content creation using Markdown/Text orchestration.

**Capabilities:**
- Blog post creation from dictated essays
- Structured essay composition
- Content formatting and style guide application
- SEO optimization and readability enhancement

**Commands:**
- `write-blog` — Format dictated essays into blog posts
- `write-essay` — Create structured essays
- `format-content` — Apply formatting standards

---

### Image Creation
AI-powered image generation and visual asset creation.

**Capabilities:**
- Context-aware custom image generation
- Blog post header images and article banners
- Alt text and caption generation
- Brand-aligned visual creation

**Commands:**
- `create-custom-image` — Generate contextually relevant images
- `create-header` — Create blog/article header images
- `generate-caption` — Generate image captions and alt text

---

### Download Images
Image retrieval and asset archiving.

**Capabilities:**
- Download images from URLs
- Extract and download images from Markdown/HTML files
- Make pages self-contained with local image references
- Batch image downloading

**Commands:**
- `download-images --fpc` — Full Page Copying (download all assets)
- `download-images --io` — Image Only (download specific images)

---

### Rename Files to Title
Automated Markdown file organization.

**Capabilities:**
- Extract H1 titles from Markdown files
- Auto-generate URL-friendly slugs
- Enforce filename length limits
- Batch directory processing

**Commands:**
- `rename-files-to-title` — Rename all .md files based on H1 title

---

## Workflow Integration

### Documentation Workflow
1. **Analysis:** Project research and investigation
2. **Design:** UX and information architecture planning
3. **Documentation:** Create comprehensive guides and API references
4. **Visualization:** Generate diagrams and flowcharts
5. **Review:** Validate against documentation standards

### Content Creation Workflow
1. **Concept:** Define content topic and audience
2. **Writing:** Draft or dictate content
3. **Formatting:** Apply style guide and standards
4. **Visual Design:** Add header images and graphics
5. **Optimization:** SEO and readability enhancement
6. **Asset Management:** Download and organize referenced images

---

## Integration Points

- **Input:** PRD (Product Manager), Project Brief (Analyst), Source code, Codebase
- **Output:** Documentation artifacts, diagrams, blog posts, UX specifications
- **Skills Used:** Design Thinking, Research
- **Tools:** Markdown processors, Mermaid, Excalidraw, image generation APIs
- **Related Agents:** Architect, Developer, Product Manager, Analyst

## Output Deliverables

| Deliverable | Creator | Format |
|---|---|---|
| Project Documentation | Technical Writer | Markdown + Mermaid |
| UX Design Document | UX Designer | Markdown + Wireframes |
| Blog Posts | Content Creator | Markdown + Images |
| Visual Diagrams | Technical Writer | SVG/PNG + Source |
| Captions & Alt Text | Image Creator | Markdown references |

## Commands Reference

| Domain | Commands |
|---|---|
| Documentation | `*document-project`, `*generate-mermaid`, `*improve-readme` |
| UX Design | Design thinking principles, wireframe creation |
| Content Writing | `write-blog`, `write-essay`, `format-content` |
| Image Creation | `create-custom-image`, `create-header`, `generate-caption` |
| Asset Management | `download-images --fpc/--io`, `rename-files-to-title` |
