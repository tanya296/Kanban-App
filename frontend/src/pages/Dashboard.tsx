import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import TextField from "../components/TextField";
import ConfirmDialog from "../components/ConfirmDialog";
import { Plus, LogOut, LayoutGrid, Clock, PinIcon, Pencil, Trash2, Check, X } from "lucide-react";

interface Board {
  id: string;
  title: string;
  createdAt: string;
}

const STYLES = [
  { rot: "-4deg", bg: "var(--sticky)", text: "var(--sticky-text)" },
  { rot: "3deg", bg: "var(--accent)", text: "var(--accent-dark)" },
  { rot: "-2deg", bg: "#F5F5F0", text: "#1B1D23" },
  { rot: "5deg", bg: "var(--sticky)", text: "var(--sticky-text)" },
];

export default function Dashboard() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const [deleteTarget, setDeleteTarget] = useState<Board | null>(null);

  const navigate = useNavigate();

  useEffect(() => {
    loadBoards();
  }, []);

  function loadBoards() {
    setLoading(true);
    api
      .get("/boards")
      .then((response) => setBoards(response.data))
      .catch(() => setError("Could not load boards."))
      .finally(() => setLoading(false));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;

    setCreating(true);
    try {
      await api.post("/boards", { title: newTitle });
      setNewTitle("");
      loadBoards();
    } catch {
      setError("Could not create board.");
    } finally {
      setCreating(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem("token");
    navigate("/login");
  }

  function startEditing(board: Board, e: React.MouseEvent) {
    e.stopPropagation();
    setEditingId(board.id);
    setEditValue(board.title);
  }

  async function saveEdit(boardId: string, e?: React.MouseEvent | React.FormEvent) {
    e?.stopPropagation();
    if (!editValue.trim()) return;

    try {
      await api.patch(`/boards/${boardId}`, { title: editValue });
      setEditingId(null);
      loadBoards();
    } catch {
      setError("Could not rename board.");
    }
  }

  function cancelEdit(e: React.MouseEvent) {
    e.stopPropagation();
    setEditingId(null);
  }

  function requestDelete(board: Board, e: React.MouseEvent) {
    e.stopPropagation();
    setDeleteTarget(board);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await api.delete(`/boards/${deleteTarget.id}`);
      setDeleteTarget(null);
      loadBoards();
    } catch {
      setError("Could not delete board.");
      setDeleteTarget(null);
    }
  }

  return (
    <div className="dot-bg" style={{ minHeight: "100vh" }}>
      <div
        style={{
          borderBottom: "1px solid var(--border)",
          background: "var(--surface)",
          padding: "18px 32px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 32, height: 32, borderRadius: 8,
              background: "var(--accent)", display: "flex",
              alignItems: "center", justifyContent: "center",
            }}
          >
            <PinIcon size={16} color="var(--accent-dark)" />
          </div>
          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 18 }}>
            Kanbo
          </span>
        </div>
        <button
          onClick={handleLogout}
          style={{
            background: "transparent",
            border: "1px solid var(--border)",
            color: "var(--text-primary)",
            padding: "9px 16px",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <LogOut size={16} />
          Log out
        </button>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "48px 24px" }}>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 30 }}>Your boards</h1>
          <p style={{ color: "var(--text-muted)", fontSize: 14, marginTop: 6 }}>
            {boards.length === 0 ? "Nothing pinned up yet." : `${boards.length} board${boards.length > 1 ? "s" : ""} pinned to your corkboard`}
          </p>
        </div>

        <form
          onSubmit={handleCreate}
          style={{
            display: "flex",
            gap: 12,
            alignItems: "flex-start",
            marginBottom: 40,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: "20px 20px 4px",
            maxWidth: 480,
          }}
        >
          <div style={{ flex: 1 }}>
            <TextField label="Board name" value={newTitle} onChange={setNewTitle} />
          </div>
          <button
            type="submit"
            disabled={creating}
            className="primary-btn"
            style={{
              background: "var(--accent)",
              color: "var(--accent-dark)",
              padding: "0 18px",
              height: 44,
              marginTop: 22,
              display: "flex",
              alignItems: "center",
              gap: 6,
              whiteSpace: "nowrap",
            }}
          >
            <Plus size={16} />
            {creating ? "Adding..." : "Create"}
          </button>
        </form>

        {error && <p style={{ color: "var(--danger)", marginBottom: 16 }}>{error}</p>}

        {loading ? (
          <p style={{ color: "var(--text-muted)" }}>Loading boards...</p>
        ) : boards.length === 0 ? (
          <div
            style={{
              border: "1px dashed var(--border)",
              borderRadius: 12,
              padding: "60px 40px",
              textAlign: "center",
              color: "var(--text-muted)",
              background: "var(--surface)",
            }}
          >
            <LayoutGrid size={36} style={{ marginBottom: 12, opacity: 0.6 }} />
            <p style={{ fontSize: 15 }}>Create your first board above to get started.</p>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
              gap: 30,
              paddingTop: 14,
            }}
          >
            {boards.map((board, i) => {
              const style = STYLES[i % STYLES.length];
              const isEditing = editingId === board.id;

              return (
                <div
                  key={board.id}
                  onClick={() => !isEditing && navigate(`/boards/${board.id}`)}
                  className="sticky-card board-tile"
                  style={{
                    background: style.bg,
                    color: style.text,
                    borderRadius: 6,
                    padding: 20,
                    height: 140,
                    boxShadow: "0 8px 20px rgba(0,0,0,0.3)",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    position: "relative",
                    ["--rot" as any]: style.rot,
                    animationDelay: `${i * 0.08}s, ${i * 0.3}s`,
                  }}
                >
                  {!isEditing && (
                    <div
                      className="tile-actions"
                      style={{ position: "absolute", top: 10, right: 10, display: "flex", gap: 4 }}
                    >
                      <button
                        onClick={(e) => startEditing(board, e)}
                        style={{
                          background: "rgba(0,0,0,0.15)", padding: 6, borderRadius: 6,
                          display: "flex", color: "inherit",
                        }}
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={(e) => requestDelete(board, e)}
                        style={{
                          background: "rgba(0,0,0,0.15)", padding: 6, borderRadius: 6,
                          display: "flex", color: "inherit",
                        }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}

                  {isEditing ? (
                    <div onClick={(e) => e.stopPropagation()} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <input
                        autoFocus
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && saveEdit(board.id)}
                        style={{
                          background: "rgba(255,255,255,0.5)",
                          border: "1px solid rgba(0,0,0,0.2)",
                          borderRadius: 6,
                          padding: "6px 8px",
                          fontSize: 14,
                          fontWeight: 700,
                          color: style.text,
                        }}
                      />
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={(e) => saveEdit(board.id, e)} style={{ background: "rgba(0,0,0,0.2)", padding: 6, borderRadius: 6, display: "flex", color: "inherit" }}>
                          <Check size={13} />
                        </button>
                        <button onClick={cancelEdit} style={{ background: "rgba(0,0,0,0.2)", padding: 6, borderRadius: 6, display: "flex", color: "inherit" }}>
                          <X size={13} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <span style={{ fontWeight: 700, fontSize: 16, paddingRight: 44 }}>{board.title}</span>
                      <span style={{ fontSize: 12, opacity: 0.75, display: "flex", alignItems: "center", gap: 5 }}>
                        <Clock size={12} />
                        {new Date(board.createdAt).toLocaleDateString()}
                      </span>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {deleteTarget && (
        <ConfirmDialog
          title="Delete board?"
          message={`"${deleteTarget.title}" and everything inside it (lists and cards) will be permanently deleted. This can't be undone.`}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}