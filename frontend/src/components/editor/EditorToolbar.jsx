import { useState, useRef, useEffect } from "react";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  Quote,
  Code2,
  ImagePlus,
  Heading1,
  Heading2,
  Minus,
  CheckSquare,
} from "lucide-react";

const FONT_FAMILIES = [
  { label: "Inter", value: "Inter, sans-serif" },
  { label: "Poppins", value: "Poppins, sans-serif" },
  { label: "Roboto", value: "Roboto, sans-serif" },
  { label: "Open Sans", value: '"Open Sans", sans-serif' },
  { label: "Lato", value: "Lato, sans-serif" },
  { label: "Montserrat", value: "Montserrat, sans-serif" },
  { label: "Nunito", value: "Nunito, sans-serif" },
  { label: "Source Sans Pro", value: '"Source Sans Pro", sans-serif' },
  { label: "Merriweather", value: "Merriweather, serif" },
  { label: "Playfair Display", value: '"Playfair Display", serif' },
  { label: "Fira Sans", value: '"Fira Sans", sans-serif' },
  { label: "JetBrains Mono", value: '"JetBrains Mono", monospace' },
  { label: "Fira Code", value: '"Fira Code", monospace' },
];

const FONT_SIZES = [
  "12px",
  "14px",
  "16px",
  "18px",
  "20px",
  "24px",
  "28px",
  "32px",
];

const TEXT_COLORS = [
  "#111827", // Black / default
  "#6b7280", // Gray
  "#ef4444", // Red
  "#f97316", // Orange
  "#eab308", // Yellow
  "#22c55e", // Green
  "#06b6d4", // Cyan
  "#3b82f6", // Blue
  "#8b5cf6", // Purple
  "#ec4899", // Pink
];

export default function EditorToolbar({ editor, onImageUpload }) {
  const [showColors, setShowColors] = useState(false);
  const colorWrapRef = useRef(null);

  // Click outside to close color panel
  useEffect(() => {
    if (!showColors) return;
    const handleClick = (e) => {
      if (colorWrapRef.current && !colorWrapRef.current.contains(e.target)) {
        setShowColors(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showColors]);

  if (!editor) return null;

  const btn = (action, active, icon, title) => (
    <button
      type="button"
      className={`toolbar-btn ${active ? "is-active" : ""}`}
      onClick={action}
      title={title}
    >
      {icon}
    </button>
  );

  return (
    <div className="editor-toolbar">
      {/* Headings */}
      <div className="toolbar-group">
        {btn(
          () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
          editor.isActive("heading", { level: 1 }),
          <Heading1 size={15} />,
          "Heading 1",
        )}
        {btn(
          () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
          editor.isActive("heading", { level: 2 }),
          <Heading2 size={15} />,
          "Heading 2",
        )}
      </div>

      <div className="toolbar-divider" />

      {/* Text formatting */}
      <div className="toolbar-group">
        {btn(
          () => editor.chain().focus().toggleBold().run(),
          editor.isActive("bold"),
          <Bold size={15} />,
          "Bold",
        )}
        {btn(
          () => editor.chain().focus().toggleItalic().run(),
          editor.isActive("italic"),
          <Italic size={15} />,
          "Italic",
        )}
        {btn(
          () => editor.chain().focus().toggleUnderline().run(),
          editor.isActive("underline"),
          <Underline size={15} />,
          "Underline",
        )}
        {btn(
          () => editor.chain().focus().toggleStrike().run(),
          editor.isActive("strike"),
          <Strikethrough size={15} />,
          "Strikethrough",
        )}
      </div>

      <div className="toolbar-divider" />

      {/* Lists */}
      <div className="toolbar-group">
        {btn(
          () => editor.chain().focus().toggleBulletList().run(),
          editor.isActive("bulletList"),
          <List size={15} />,
          "Bullet list",
        )}
        {btn(
          () => editor.chain().focus().toggleOrderedList().run(),
          editor.isActive("orderedList"),
          <ListOrdered size={15} />,
          "Numbered list",
        )}
        {btn(
          () => editor.chain().focus().toggleBlockquote().run(),
          editor.isActive("blockquote"),
          <Quote size={15} />,
          "Quote",
        )}
        {btn(
          () => editor.chain().focus().toggleCodeBlock().run(),
          editor.isActive("codeBlock"),
          <Code2 size={15} />,
          "Code block",
        )}
        {btn(
          () => editor.chain().focus().toggleTaskList().run(),
          editor.isActive("taskList"),
          <CheckSquare size={15} />,
          "Checklist",
        )}
      </div>

      <div className="toolbar-divider" />

      {/* Font family */}
      <select
        className="toolbar-select"
        title="Font family"
        onChange={(e) =>
          editor.chain().focus().setFontFamily(e.target.value).run()
        }
        value={editor.getAttributes("textStyle").fontFamily || ""}
      >
        <option value="">Font</option>
        {FONT_FAMILIES.map((f) => (
          <option key={f.value} value={f.value}>
            {f.label}
          </option>
        ))}
      </select>

      {/* Text color — click toggle with outside-click to close */}
      <div
        className="toolbar-group toolbar-colors"
        title="Text color"
        ref={colorWrapRef}
      >
        <div className="color-swatch-wrap">
          <button
            type="button"
            className={`toolbar-btn color-picker-btn ${showColors ? "is-active" : ""}`}
            onClick={() => setShowColors((v) => !v)}
            title="Text color"
          >
            <span
              className="color-indicator"
              style={{
                background:
                  editor.getAttributes("textStyle").color || "#28251d",
              }}
            />
            <span style={{ fontSize: "10px" }}>A</span>
          </button>
          <div className={`color-swatch-panel ${showColors ? "is-visible" : ""}`}>
            {TEXT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className="color-swatch"
                style={{
                  background: c,
                  border: c === "#ffffff" ? "1px solid #ddd" : "none",
                }}
                onClick={() => {
                  editor.chain().focus().setColor(c).run();
                  setShowColors(false);
                }}
                title={c}
              />
            ))}
            <button
              type="button"
              className="color-swatch color-reset"
              onClick={() => {
                editor.chain().focus().unsetColor().run();
                setShowColors(false);
              }}
              title="Reset color"
            >
              ✕
            </button>
          </div>
        </div>
      </div>

      <div className="toolbar-divider" />

      {/* Image */}
      <button
        type="button"
        className="toolbar-btn"
        title="Insert image"
        onClick={onImageUpload}
      >
        <ImagePlus size={15} />
      </button>
    </div>
  );
}
