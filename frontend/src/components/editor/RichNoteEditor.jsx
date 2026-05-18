import { useEffect, useRef, useCallback, useState, useMemo } from "react";
import {
  useEditor,
  EditorContent,
  ReactNodeViewRenderer,
  NodeViewWrapper,
} from "@tiptap/react";
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


// ── Custom Image Node View with delete button ──
function ImageNodeView({ node, getPos, editor }) {
  const handleDelete = useCallback(() => {
    editor
      .chain()
      .focus()
      .deleteRange({ from: getPos(), to: getPos() + node.nodeSize })
      .run();
  }, [editor, getPos, node.nodeSize]);

  return (
    <NodeViewWrapper as="div" className="img-wrapper" contentEditable={false}>
      <img src={node.attrs.src} alt={node.attrs.alt || ""} />
      {editor.isEditable && (
        <button
          className="img-delete-btn"
          onClick={handleDelete}
          title="Delete image"
          type="button"
        >
          ×
        </button>
      )}
    </NodeViewWrapper>
  );
}


// ── Custom Image extension with NodeView ──
const CustomImage = Image.extend({
  addNodeView() {
    return ReactNodeViewRenderer(ImageNodeView);
  },
});


export default function RichNoteEditor({
  noteId,
  content,
  readOnly,
  onChange,
  onImageUploaded,
  onImageDeleted,
}) {
  const fileRef = useRef();
  const [isDragging, setIsDragging] = useState(false);
  const prevImageSrcs = useRef(new Set());

  // Helper: lấy tất cả src ảnh trong doc hiện tại
  const getImageSrcs = useCallback((doc) => {
    const srcs = new Set();
    doc.descendants((node) => {
      if (node.type.name === "image") srcs.add(node.attrs.src);
    });
    return srcs;
  }, []);

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
      CustomImage.configure({ inline: false, allowBase64: true }),
      Placeholder.configure({ placeholder: "Start writing…" }),
      TaskList,
      TaskItem.configure({ nested: true }),
    ],
    content: content || "",
    editable: !readOnly,
    onUpdate: ({ editor }) => {
      onChange?.(editor.getHTML());

      // Detect deleted images
      if (onImageDeleted) {
        const currentSrcs = getImageSrcs(editor.state.doc);
        prevImageSrcs.current.forEach((src) => {
          if (!currentSrcs.has(src)) {
            onImageDeleted(src);
          }
        });
        prevImageSrcs.current = currentSrcs;
      }
    },
  });

  // Update content when prop changes
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content || "");
      // Sync lại prevImageSrcs sau khi setContent
      prevImageSrcs.current = getImageSrcs(editor.state.doc);
    }
  }, [editor, content, getImageSrcs]);

  // Upload image and insert into editor
  const insertImage = useCallback(
    async (file) => {
      if (!file || !file.type.startsWith("image/")) return;

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
        // Track ảnh preview ngay để không bị detect là "deleted"
        prevImageSrcs.current = getImageSrcs(editor.state.doc);
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

          // Replace base64 preview với server URL
          if (base64Src && editor) {
            editor.state.doc.descendants((node, pos) => {
              if (node.type.name === "image" && node.attrs.src === base64Src) {
                editor.commands.command(({ tr }) => {
                  tr.setNodeMarkup(pos, null, {
                    ...node.attrs,
                    src: url,
                    alt: node.attrs.alt || file.name,
                  });
                  return true;
                });
                // Sync prevImageSrcs: đổi base64 → server url
                prevImageSrcs.current.delete(base64Src);
                prevImageSrcs.current.add(url);
                return false;
              }
            });
          }
        } catch {
          toast.error("Image upload failed");
        }
      }
    },
    [editor, noteId, onImageUploaded, getImageSrcs],
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
