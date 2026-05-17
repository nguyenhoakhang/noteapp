import { useState, useEffect, useRef } from "react";
import api from "../../api/axios";

/**
 * LinkPreview — Detects URLs in text content and fetches OG metadata
 * to display a rich preview card (thumbnail + title).
 *
 * Usage:
 *   <LinkPreview url="https://youtube.com/watch?v=..." />
 *
 * Renders nothing if no preview data is available.
 */
export default function LinkPreview({ url }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    setLoading(true);
    setError(false);

    if (!url || !url.startsWith("http")) {
      setLoading(false);
      return;
    }

    api
      .get("/link-preview", { params: { url } })
      .then(({ data: res }) => {
        if (mountedRef.current) {
          if (res.title || res.image) {
            setData(res);
          } else {
            setError(true);
          }
          setLoading(false);
        }
      })
      .catch(() => {
        if (mountedRef.current) {
          setError(true);
          setLoading(false);
        }
      });

    return () => {
      mountedRef.current = false;
    };
  }, [url]);

  if (loading) {
    return (
      <div className="link-preview link-preview--loading">
        <div className="link-preview-skeleton" />
      </div>
    );
  }

  if (error || !data) return null;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="link-preview"
      onClick={(e) => e.stopPropagation()}
    >
      {data.image && (
        <div className="link-preview-img-wrap">
          <img
            src={data.image}
            alt=""
            className="link-preview-img"
            onError={(e) => {
              e.target.style.display = "none";
            }}
          />
        </div>
      )}
      <div className="link-preview-body">
        {data.favicon && (
          <img
            src={data.favicon}
            alt=""
            className="link-preview-favicon"
            onError={(e) => {
              e.target.style.display = "none";
            }}
          />
        )}
        {data.title && <span className="link-preview-title">{data.title}</span>}
        {data.description && (
          <span className="link-preview-desc">{data.description}</span>
        )}
        <span className="link-preview-url">{new URL(url).hostname}</span>
      </div>
    </a>
  );
}
