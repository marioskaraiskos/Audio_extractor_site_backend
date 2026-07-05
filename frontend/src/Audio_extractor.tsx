import React, { useState } from 'react';

export default function AudioExtractor() {
  const [url, setUrl] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleDownload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('http://localhost:5000/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) throw new Error('Network response failed.');

      // 1. Snag the Content-Disposition header safely
      const disposition = response.headers.get('content-disposition') || response.headers.get('Content-Disposition');
      let filename = 'audio.mp3';

      if (disposition) {
        // Precise regex matching to capture both wrapped quotes and unquoted filenames
        const filenameMatch = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1].replace(/['"]/g, '').trim();
        }
      }

      // 2. Binary stream handling
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', filename); // Dynamic real title injected here!
      
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      window.URL.revokeObjectURL(downloadUrl);
      setUrl('');
    } catch (err: any) {
      setError(err.message || "Failed to extract audio.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.backgroundGlow} />
      <div style={styles.card}>
        <div style={styles.badge}>Audio extraction</div>
        <h1 style={styles.title}>Turn any video into a polished MP3</h1>

        <p style={styles.subtitle}>
          Paste a video URL to extract clear audio in seconds.
        </p>

        <form onSubmit={handleDownload} style={styles.searchBox}>
          <input
            style={styles.input}
            type="text"
            placeholder="Paste video URL here..."
            value={url}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUrl(e.target.value)}
            disabled={loading}
          />

          <button
            type="submit"
            style={styles.button}
            disabled={loading || !url.trim()}
          >
            {loading ? "Extracting..." : "Extract MP3"}
          </button>
        </form>

        <div style={styles.infoRow}>
          <span style={styles.infoPill}>⚡ Fast conversion</span>
          <span style={styles.infoPill}>🎵 High-quality audio</span>
          <span style={styles.infoPill}>🔒 Local download</span>
        </div>

        {error && <div style={styles.errorBox}>{error}</div>}
        {loading && (
          <div style={styles.loadingBox}>Processing your video...</div>
        )}
      </div>
    </div>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  page: {
    position: 'relative',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    backgroundColor: '#0b0f19',
    overflow: 'hidden',
    fontFamily: 'Inter, system-ui, sans-serif',
  },
  backgroundGlow: {
    position: 'absolute',
    width: '500px',
    height: '500px',
    background: 'radial-gradient(circle, rgba(59,130,246,0.15) 0%, rgba(0,0,0,0) 70%)',
    top: '20%',
    left: '30%',
    zIndex: 0,
  },
  card: {
    position: 'relative',
    zIndex: 1,
    backgroundColor: '#111827',
    border: '1px solid #1f2937',
    borderRadius: '24px',
    padding: '3rem',
    width: '90%',
    maxWidth: '560px',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
    textAlign: 'center',
  },
  badge: {
    display: 'inline-block',
    padding: '0.35rem 0.85rem',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    color: '#60a5fa',
    borderRadius: '100px',
    fontSize: '0.8rem',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: '1.5rem',
  },
  title: {
    color: '#ffffff',
    fontSize: '2rem',
    fontWeight: 800,
    margin: '0 0 0.75rem 0',
    letterSpacing: '-0.025em',
    lineHeight: 1.25,
  },
  subtitle: {
    color: '#9ca3af',
    fontSize: '1rem',
    margin: '0 0 2.5rem 0',
  },
  searchBox: {
    display: 'flex',
    gap: '0.75rem',
    backgroundColor: '#1f2937',
    border: '1px solid #374151',
    borderRadius: '14px',
    padding: '0.5rem',
    marginBottom: '2rem',
  },
  input: {
    flex: 1,
    backgroundColor: 'transparent',
    border: 'none',
    outline: 'none',
    color: '#ffffff',
    fontSize: '1rem',
    paddingLeft: '0.75rem',
  },
  button: {
    backgroundColor: '#3b82f6',
    color: '#ffffff',
    border: 'none',
    borderRadius: '10px',
    padding: '0.75rem 1.5rem',
    fontSize: '0.95rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  infoRow: {
    display: 'flex',
    justifyContent: 'center',
    gap: '1rem',
    flexWrap: 'wrap',
  },
  infoPill: {
    color: '#9ca3af',
    fontSize: '0.85rem',
    backgroundColor: '#1f2937',
    padding: '0.4rem 0.8rem',
    borderRadius: '8px',
  },
  errorBox: {
    marginTop: '1.5rem',
    padding: '0.75rem',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.2)',
    borderRadius: '10px',
    color: '#f87171',
    fontSize: '0.9rem',
  },
  loadingBox: {
    marginTop: '1.5rem',
    color: '#60a5fa',
    fontSize: '0.9rem',
  },
};