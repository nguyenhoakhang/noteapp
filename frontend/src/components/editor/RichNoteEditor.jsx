import { useEffect, useRef, useCallback, useState, useMemo } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import FontFamily from "@tiptap/extension-font-family";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import CodeBlock from "@tiptap/extension-code-block";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import EditorToolbar from "./EditorToolbar";
import LinkPreview from "./LinkPreview";
import api from "../../api/axios";
import toast from "react-hot-toast";
import useAuthStore from "../../store/authStore";

export default function RichNoteEditor({
  noteId,
  content,
  readOnly,
  onChange,
  onImageUploaded,
}) {
  const { user } = useAuthStore();
  const token = localStorage.getItem("token");
  const fileRef = useRef();
  const [isDragging, setIsDragging] = useState(false);

  // Initialize editor
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
        heading: { levels: [1, 2, 3] },
      }),
      TextStyle,
      Color,
      FontFamily,
      CodeBlock,
      Image.configure({ inline: false, allowBase64: true }),
      Placeholder.configure({ placeholder: "Start writing…" }),
      TaskList,
      TaskItem.configure({ nested: true }),
    ],
    content: content || "",
    editable: !readOnly,
    onUpdate: ({ editor }) => {
      onChange?.(editor.getHTML());
    },
  });

  // Update content when prop changes
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content || "");
    }
  }, [editor, content]);

  // Upload image and insert into editor
  const insertImage = useCallback(
    async (file) => {
      if (!file || !file.type.startsWith("image/")) return;

      // Store base64 src for later replacement
      let base64Src = null;

      // Instant preview via base64
      const reader = new FileReader();
      reader.onload = (e) => {
        base64Src = e.target.result;
        editor
          ?.chain()
          .focus()
          .setImage({ src: base64Src, alt: file.name })
          .run();
      };
      reader.readAsDataURL(file);

      // Upload to server if note exists
      if (noteId) {
        try {
          const fd = new FormData();
          fd.append("files[]", file);
          const { data } = await api.post(`/notes/${noteId}/attachments`, fd, {
            headers: { "Content-Type": "multipart/form-data" },
          });
          const url = `/storage/${data[0].path}`;
          onImageUploaded?.(data[0]);

          // Replace base64 preview with server URL so it survives F5
          if (base64Src && editor) {
            editor.state.doc.descendants((node, pos) => {
              if (
                node.type.name === "image" &&
                node.attrs.src === base64Src
              ) {
                editor
                  .chain()
                  .setTextSelection(pos)
                  .updateAttributes("image", { src: url })
                  .run();
                return false;
              }
            });
          }
        } catch {
          toast.error("Image upload failed");
        }
      }
    },
    [editor, noteId, onImageUploaded],
  );

  // Paste image from clipboard
  const handlePaste = useCallback(
    (e) => {
      const items = [...(e.clipboardData?.items || [])];
      const imageItem = items.find((i) => i.type.startsWith("image/"));
      if (imageItem) {
        e.preventDefault();
        insertImage(imageItem.getAsFile());
      }
    },
    [insertImage],
  );

  // Drag & drop image
  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file?.type.startsWith("image/")) insertImage(file);
    },
    [insertImage],
  );

  const handleImageUploadClick = () => fileRef.current?.click();

  // Extract unique URLs from content for link previews
  const linkUrls = useMemo(() => {
    if (!content) return [];
    const urlRegex = /https?:\/\/[^\s<>"']+/gi;
    const matches = content.match(urlRegex);
    if (!matches) return [];
    // Deduplicate and limit to 3 previews
    return [...new Set(matches)].slice(0, 3);
  }, [content]);

  return (
    <div
      className={`rich-editor-wrap ${isDragging ? "dragging" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      {!readOnly && (
        <EditorToolbar editor={editor} onImageUpload={handleImageUploadClick} />
      )}

      <EditorContent
        editor={editor}
        className="rich-editor-content"
        onPaste={handlePaste}
      />

      {/* Link previews — rendered below editor content */}
      {linkUrls.length > 0 && (
        <div className="link-previews">
          {linkUrls.map((url) => (
            <LinkPreview key={url} url={url} />
          ))}
        </div>
      )}

      {isDragging && (
        <div className="drop-overlay">
          <div className="drop-hint">📎 Drop image to insert</div>
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => insertImage(e.target.files?.[0])}
      />
    </div>
  );
}
