import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { socket } from "../api/socket";
import ConfirmDialog from "../components/ConfirmDialog";
import { ArrowLeft, Plus, Trash2, X, Check, UserPlus, Users, Calendar, Tag } from "lucide-react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  useDroppable,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface Label {
  id: string;
  name: string;
  color: string;
  boardId: string;
}

interface CardLabelLink {
  cardId: string;
  labelId: string;
  label: Label;
}

interface Card {
  id: string;
  title: string;
  description: string | null;
  position: number;
  dueDate: string | null;
  assigneeId: string | null;
  assignee: { id: string; name: string; email: string } | null;
  labels: CardLabelLink[];
}

interface List {
  id: string;
  title: string;
  position: number;
  cards: Card[];
}

interface Member {
  id: string;
  userId: string;
  role: string;
  user: { id: string; name: string; email: string };
}

interface BoardData {
  id: string;
  title: string;
  ownerId: string;
  lists: List[];
  members: Member[];
  labels: Label[];
}

// A handful of preset colors so people aren't stuck typing hex codes
const LABEL_COLOR_PRESETS = ["#f59e0b", "#ef4444", "#10b981", "#3b82f6", "#8b5cf6", "#ec4899"];

function getDueDateStatus(dueDate: string | null): "overdue" | "soon" | "normal" | null {
  if (!dueDate) return null;
  const diffDays = (new Date(dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  if (diffDays < 0) return "overdue";
  if (diffDays <= 2) return "soon";
  return "normal";
}

function formatDueDate(dueDate: string) {
  return new Date(dueDate).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function SortableCard({ card, onDelete, onOpen }: { card: Card; onDelete: () => void; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
  });

  const dueDateStatus = getDueDateStatus(card.dueDate);
  const dueDateColor =
    dueDateStatus === "overdue" ? "var(--danger)" : dueDateStatus === "soon" ? "var(--sticky)" : "var(--text-muted)";

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={onOpen}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        background: "var(--bg)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: "10px 12px",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        cursor: "grab",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14 }}>{card.title}</div>
          {card.description && (
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>{card.description}</div>
          )}
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          style={{ background: "transparent", color: "var(--text-muted)", padding: 2, display: "flex", flexShrink: 0 }}
        >
          <X size={14} />
        </button>
      </div>

      {card.labels.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {card.labels.map((cl) => (
            <span
              key={cl.labelId}
              style={{
                background: cl.label.color,
                color: "#1a1a1a",
                fontSize: 11,
                fontWeight: 600,
                padding: "2px 8px",
                borderRadius: 999,
              }}
            >
              {cl.label.name}
            </span>
          ))}
        </div>
      )}

      {(card.dueDate || card.assignee) && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 2 }}>
          {card.dueDate ? (
            <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: dueDateColor }}>
              <Calendar size={12} />
              {formatDueDate(card.dueDate)}
            </span>
          ) : (
            <span />
          )}
          {card.assignee && <Avatar name={card.assignee.name} size={22} />}
        </div>
      )}
    </div>
  );
}

function DroppableArea({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef } = useDroppable({ id });
  return (
    <div ref={setNodeRef} style={{ minHeight: 30, display: "flex", flexDirection: "column", gap: 8 }}>
      {children}
    </div>
  );
}

// Small colored circle with the person's initial - a lightweight "avatar"
function Avatar({ name, size = 28 }: { name: string; size?: number }) {
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  return (
    <div
      title={name}
      style={{
        width: size, height: size, borderRadius: "50%",
        background: "var(--accent)", color: "var(--accent-dark)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: size <= 22 ? 11 : 12, fontWeight: 700, flexShrink: 0,
        border: "2px solid var(--surface)",
      }}
    >
      {initial}
    </div>
  );
}

function CardDetailModal({
  card,
  boardId,
  members,
  labels,
  onClose,
  onChange,
}: {
  card: Card;
  boardId: string;
  members: Member[];
  labels: Label[];
  onClose: () => void;
  onChange: () => void;
}) {
  const [descDraft, setDescDraft] = useState(card.description ?? "");
  const [newLabelName, setNewLabelName] = useState("");
  const [newLabelColor, setNewLabelColor] = useState(LABEL_COLOR_PRESETS[0]);
  const [showNewLabelForm, setShowNewLabelForm] = useState(false);
  const [saving, setSaving] = useState(false);

  // Re-sync the draft only when a DIFFERENT card is opened, not on every
  // keystroke or background refresh - otherwise typing would get clobbered
  // by the next "board-updated" socket event.
  useEffect(() => {
    setDescDraft(card.description ?? "");
  }, [card.id]);

  async function saveDescription() {
    if (descDraft === (card.description ?? "")) return;
    await api.patch(`/lists/cards/${card.id}`, { description: descDraft });
    onChange();
  }

  async function handleDueDateChange(value: string) {
    await api.patch(`/lists/cards/${card.id}`, {
      dueDate: value ? `${value}T00:00:00.000Z` : null,
    });
    onChange();
  }

  async function handleAssigneeChange(value: string) {
    await api.patch(`/lists/cards/${card.id}`, { assigneeId: value || null });
    onChange();
  }

  async function toggleLabel(label: Label) {
    const isAttached = card.labels.some((cl) => cl.labelId === label.id);
    if (isAttached) {
      await api.delete(`/lists/cards/${card.id}/labels/${label.id}`);
    } else {
      await api.post(`/lists/cards/${card.id}/labels/${label.id}`);
    }
    onChange();
  }

  async function handleCreateLabel(e: React.FormEvent) {
    e.preventDefault();
    if (!newLabelName.trim()) return;
    setSaving(true);
    try {
      const res = await api.post(`/boards/${boardId}/labels`, {
        name: newLabelName,
        color: newLabelColor,
      });
      // Immediately attach the new label to this card - nicer flow than
      // making the person open the picker again to turn it on.
      await api.post(`/lists/cards/${card.id}/labels/${res.data.id}`);
      setNewLabelName("");
      setShowNewLabelForm(false);
      onChange();
    } finally {
      setSaving(false);
    }
  }

  const dueDateInputValue = card.dueDate ? card.dueDate.slice(0, 10) : "";

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: 480, maxHeight: "85vh", overflowY: "auto", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 24 }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontFamily: "'Space Grotesk', sans-serif" }}>{card.title}</h2>
          <button onClick={onClose} style={{ background: "transparent", color: "var(--text-muted)", display: "flex" }}>
            <X size={18} />
          </button>
        </div>

        {/* Description */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 12, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>Description</label>
          <textarea
            value={descDraft}
            onChange={(e) => setDescDraft(e.target.value)}
            onBlur={saveDescription}
            placeholder="Add a more detailed description..."
            rows={3}
            className="text-input"
            style={{ width: "100%", padding: "8px 10px", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text-primary)", fontSize: 13, resize: "vertical" }}
          />
        </div>

        {/* Due date */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 12, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 4, marginBottom: 6 }}>
            <Calendar size={13} /> Due date
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="date"
              value={dueDateInputValue}
              onChange={(e) => handleDueDateChange(e.target.value)}
              className="text-input"
              style={{ flex: 1, padding: "8px 10px", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text-primary)", fontSize: 13 }}
            />
            {card.dueDate && (
              <button
                onClick={() => handleDueDateChange("")}
                style={{ background: "transparent", border: "1px solid var(--border)", color: "var(--text-primary)", padding: "0 12px", fontSize: 12 }}
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Assignee */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 12, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>Assignee</label>
          <select
            value={card.assigneeId ?? ""}
            onChange={(e) => handleAssigneeChange(e.target.value)}
            className="text-input"
            style={{ width: "100%", padding: "8px 10px", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text-primary)", fontSize: 13 }}
          >
            <option value="">Unassigned</option>
            {members.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.user.name}
              </option>
            ))}
          </select>
        </div>

        {/* Labels */}
        <div>
          <label style={{ fontSize: 12, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 4, marginBottom: 6 }}>
            <Tag size={13} /> Labels
          </label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
            {labels.map((label) => {
              const isAttached = card.labels.some((cl) => cl.labelId === label.id);
              return (
                <button
                  key={label.id}
                  onClick={() => toggleLabel(label)}
                  style={{
                    background: label.color,
                    color: "#1a1a1a",
                    fontSize: 12,
                    fontWeight: 600,
                    padding: "4px 10px",
                    borderRadius: 999,
                    opacity: isAttached ? 1 : 0.35,
                    border: isAttached ? "2px solid var(--text-primary)" : "2px solid transparent",
                  }}
                >
                  {label.name}
                </button>
              );
            })}
          </div>

          {showNewLabelForm ? (
            <form onSubmit={handleCreateLabel} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <input
                autoFocus
                value={newLabelName}
                onChange={(e) => setNewLabelName(e.target.value)}
                placeholder="Label name"
                className="text-input"
                style={{ padding: "8px 10px", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text-primary)", fontSize: 13 }}
              />
              <div style={{ display: "flex", gap: 6 }}>
                {LABEL_COLOR_PRESETS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setNewLabelColor(color)}
                    style={{
                      width: 24, height: 24, borderRadius: "50%", background: color,
                      border: newLabelColor === color ? "2px solid var(--text-primary)" : "2px solid transparent",
                    }}
                  />
                ))}
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  type="submit"
                  disabled={saving}
                  style={{ background: "var(--accent)", color: "var(--accent-dark)", padding: "6px 12px", fontSize: 13, display: "flex", alignItems: "center", gap: 4 }}
                >
                  <Check size={13} /> Create
                </button>
                <button
                  type="button"
                  onClick={() => setShowNewLabelForm(false)}
                  style={{ background: "transparent", border: "1px solid var(--border)", color: "var(--text-primary)", padding: "6px 12px", fontSize: 13 }}
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setShowNewLabelForm(true)}
              style={{ background: "transparent", border: "1px dashed var(--border)", color: "var(--text-muted)", padding: "6px 12px", fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}
            >
              <Plus size={13} /> New label
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function BoardPage() {
  const { boardId } = useParams();
  const navigate = useNavigate();

  const [board, setBoard] = useState<BoardData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [newListTitle, setNewListTitle] = useState("");
  const [addingCardToList, setAddingCardToList] = useState<string | null>(null);
  const [newCardTitle, setNewCardTitle] = useState("");

  const [deleteListTarget, setDeleteListTarget] = useState<List | null>(null);
  const [deleteCardTarget, setDeleteCardTarget] = useState<{ card: Card; listId: string } | null>(null);

  const [showMembers, setShowMembers] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [removeTarget, setRemoveTarget] = useState<Member | null>(null);

  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  useEffect(() => {
    api.get("/me").then((res) => setCurrentUserId(res.data.userId)).catch(() => {});
  }, []);

  useEffect(() => {
    loadBoard();

    if (!boardId) return;

    socket.emit("join-board", boardId);

    function handleBoardUpdated() {
      loadBoard(false);
    }

    socket.on("board-updated", handleBoardUpdated);

    return () => {
      socket.emit("leave-board", boardId);
      socket.off("board-updated", handleBoardUpdated);
    };
  }, [boardId]);

  function loadBoard(showLoading = true) {
    if (showLoading) setLoading(true);
    api
      .get(`/boards/${boardId}`)
      .then((res) => setBoard(res.data))
      .catch(() => setError("Could not load this board."))
      .finally(() => {
        if (showLoading) setLoading(false);
      });
  }

  async function handleAddList(e: React.FormEvent) {
    e.preventDefault();
    if (!newListTitle.trim()) return;
    try {
      await api.post(`/boards/${boardId}/lists`, { title: newListTitle });
      setNewListTitle("");
      loadBoard();
    } catch {
      setError("Could not create list.");
    }
  }

  async function handleAddCard(listId: string) {
    if (!newCardTitle.trim()) return;
    try {
      await api.post(`/lists/${listId}/cards`, { title: newCardTitle });
      setNewCardTitle("");
      setAddingCardToList(null);
      loadBoard();
    } catch {
      setError("Could not create card.");
    }
  }

  async function confirmDeleteList() {
    if (!deleteListTarget) return;
    try {
      await api.delete(`/lists/${deleteListTarget.id}`);
      setDeleteListTarget(null);
      loadBoard();
    } catch {
      setError("Could not delete list.");
      setDeleteListTarget(null);
    }
  }

  async function confirmDeleteCard() {
    if (!deleteCardTarget) return;
    try {
      await api.delete(`/lists/cards/${deleteCardTarget.card.id}`);
      setDeleteCardTarget(null);
      loadBoard();
    } catch {
      setError("Could not delete card.");
      setDeleteCardTarget(null);
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviteError("");
    if (!inviteEmail.trim()) return;

    setInviting(true);
    try {
      await api.post(`/boards/${boardId}/members`, { email: inviteEmail });
      setInviteEmail("");
      loadBoard();
    } catch (err: any) {
      setInviteError(err.response?.data?.error || "Could not invite user.");
    } finally {
      setInviting(false);
    }
  }

  async function confirmRemoveMember() {
    if (!removeTarget) return;
    try {
      await api.delete(`/boards/${boardId}/members/${removeTarget.userId}`);
      setRemoveTarget(null);
      loadBoard();
    } catch {
      setError("Could not remove member.");
      setRemoveTarget(null);
    }
  }

  function findContainer(id: string): string | undefined {
    if (!board) return undefined;
    if (board.lists.some((l) => l.id === id)) return id;
    return board.lists.find((l) => l.cards.some((c) => c.id === id))?.id;
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over || !board) return;

    const activeId = active.id as string;
    const overId = over.id as string;
    const activeContainer = findContainer(activeId);
    const overContainer = findContainer(overId);

    if (!activeContainer || !overContainer || activeContainer === overContainer) return;

    setBoard((prev) => {
      if (!prev) return prev;
      const activeList = prev.lists.find((l) => l.id === activeContainer)!;
      const overList = prev.lists.find((l) => l.id === overContainer)!;
      const movingCard = activeList.cards.find((c) => c.id === activeId)!;

      const remainingActiveCards = activeList.cards.filter((c) => c.id !== activeId);
      const overIndex = overList.cards.findIndex((c) => c.id === overId);
      const insertAt = overIndex >= 0 ? overIndex : overList.cards.length;

      const newOverCards = [...overList.cards];
      newOverCards.splice(insertAt, 0, movingCard);

      return {
        ...prev,
        lists: prev.lists.map((l) => {
          if (l.id === activeContainer) return { ...l, cards: remainingActiveCards };
          if (l.id === overContainer) return { ...l, cards: newOverCards };
          return l;
        }),
      };
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || !board) return;

    const activeId = active.id as string;
    const overId = over.id as string;
    const container = findContainer(overId) ?? findContainer(activeId);
    if (!container) return;

    const list = board.lists.find((l) => l.id === container);
    if (!list) return;

    const oldIndex = list.cards.findIndex((c) => c.id === activeId);
    const newIndex = list.cards.findIndex((c) => c.id === overId);

    let newCards = list.cards;
    if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
      newCards = arrayMove(list.cards, oldIndex, newIndex);
    }

    const updatedLists = board.lists.map((l) => (l.id === container ? { ...l, cards: newCards } : l));
    setBoard({ ...board, lists: updatedLists });
    persistPositions(updatedLists);
  }

  async function persistPositions(lists: List[]) {
    const requests = lists.flatMap((list) =>
      list.cards.map((card, index) => api.patch(`/lists/cards/${card.id}`, { listId: list.id, position: index }))
    );
    try {
      await Promise.all(requests);
    } catch {
      setError("Some changes couldn't be saved - reloading board.");
      loadBoard();
    }
  }

  const isOwner = board && currentUserId === board.ownerId;

  // Derive the selected card from the live board state (by id, not by a
  // stored object reference) so the modal always reflects the latest data -
  // including updates that arrive via socket while it's open.
  const selectedCard = board?.lists.flatMap((l) => l.cards).find((c) => c.id === selectedCardId) ?? null;

  if (loading) {
    return <div style={{ padding: 40, color: "var(--text-muted)" }}>Loading board...</div>;
  }

  if (error && !board) {
    return (
      <div style={{ padding: 40 }}>
        <p style={{ color: "var(--danger)", marginBottom: 16 }}>{error}</p>
        <button
          onClick={() => navigate("/dashboard")}
          style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-primary)", padding: "10px 16px" }}
        >
          Back to dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="dot-bg" style={{ minHeight: "100vh" }}>
      <div
        style={{
          borderBottom: "1px solid var(--border)",
          background: "var(--surface)",
          padding: "16px 32px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <button
            onClick={() => navigate("/dashboard")}
            style={{ background: "transparent", border: "1px solid var(--border)", color: "var(--text-primary)", padding: "9px 12px", display: "flex", alignItems: "center", gap: 6 }}
          >
            <ArrowLeft size={16} />
            Boards
          </button>
          <h1 style={{ fontSize: 20, fontFamily: "'Space Grotesk', sans-serif" }}>{board?.title}</h1>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* Overlapping avatar stack */}
          <div style={{ display: "flex" }}>
            {board?.members.slice(0, 5).map((m, i) => (
              <div key={m.id} style={{ marginLeft: i === 0 ? 0 : -8 }}>
                <Avatar name={m.user.name} />
              </div>
            ))}
          </div>
          <button
            onClick={() => setShowMembers(true)}
            style={{ background: "transparent", border: "1px solid var(--border)", color: "var(--text-primary)", padding: "9px 12px", display: "flex", alignItems: "center", gap: 6 }}
          >
            <Users size={16} />
            Members
          </button>
        </div>
      </div>

      {error && <p style={{ color: "var(--danger)", padding: "12px 32px 0" }}>{error}</p>}

      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
        <div style={{ display: "flex", gap: 20, padding: "28px 32px", overflowX: "auto", alignItems: "flex-start" }}>
          {board?.lists
            .slice()
            .sort((a, b) => a.position - b.position)
            .map((list) => (
              <div
                key={list.id}
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  width: 260,
                  flexShrink: 0,
                  padding: 14,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{list.title}</span>
                  <button
                    onClick={() => setDeleteListTarget(list)}
                    style={{ background: "transparent", color: "var(--text-muted)", padding: 4, display: "flex" }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                <SortableContext items={list.cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                  <DroppableArea id={list.id}>
                    {list.cards
                      .slice()
                      .sort((a, b) => a.position - b.position)
                      .map((card) => (
                        <SortableCard
                          key={card.id}
                          card={card}
                          onDelete={() => setDeleteCardTarget({ card, listId: list.id })}
                          onOpen={() => setSelectedCardId(card.id)}
                        />
                      ))}
                  </DroppableArea>
                </SortableContext>

                <div style={{ marginTop: 10 }}>
                  {addingCardToList === list.id ? (
                    <div>
                      <input
                        autoFocus
                        value={newCardTitle}
                        onChange={(e) => setNewCardTitle(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleAddCard(list.id)}
                        placeholder="Card title"
                        className="text-input"
                        style={{
                          width: "100%",
                          padding: "8px 10px",
                          background: "var(--bg)",
                          border: "1px solid var(--border)",
                          borderRadius: 6,
                          color: "var(--text-primary)",
                          fontSize: 13,
                          marginBottom: 6,
                        }}
                      />
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          onClick={() => handleAddCard(list.id)}
                          style={{ background: "var(--accent)", color: "var(--accent-dark)", padding: "6px 10px", display: "flex", alignItems: "center", gap: 4, fontSize: 13 }}
                        >
                          <Check size={13} />
                          Add
                        </button>
                        <button
                          onClick={() => { setAddingCardToList(null); setNewCardTitle(""); }}
                          style={{ background: "transparent", border: "1px solid var(--border)", color: "var(--text-primary)", padding: "6px 10px", fontSize: 13 }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setAddingCardToList(list.id)}
                      style={{
                        width: "100%",
                        background: "transparent",
                        color: "var(--text-muted)",
                        padding: "8px 0",
                        fontSize: 13,
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        justifyContent: "center",
                      }}
                    >
                      <Plus size={14} />
                      Add card
                    </button>
                  )}
                </div>
              </div>
            ))}

          <form
            onSubmit={handleAddList}
            style={{
              background: "var(--surface)",
              border: "1px dashed var(--border)",
              borderRadius: 12,
              width: 260,
              flexShrink: 0,
              padding: 14,
            }}
          >
            <input
              value={newListTitle}
              onChange={(e) => setNewListTitle(e.target.value)}
              placeholder="New list name"
              className="text-input"
              style={{
                width: "100%",
                padding: "8px 10px",
                background: "var(--bg)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                color: "var(--text-primary)",
                fontSize: 13,
                marginBottom: 8,
              }}
            />
            <button
              type="submit"
              style={{
                width: "100%",
                background: "var(--accent)",
                color: "var(--accent-dark)",
                padding: "8px 0",
                fontSize: 13,
                display: "flex",
                alignItems: "center",
                gap: 6,
                justifyContent: "center",
              }}
            >
              <Plus size={14} />
              Add list
            </button>
          </form>
        </div>
      </DndContext>

      {deleteListTarget && (
        <ConfirmDialog
          title="Delete list?"
          message={`"${deleteListTarget.title}" and all its cards will be permanently deleted.`}
          onConfirm={confirmDeleteList}
          onCancel={() => setDeleteListTarget(null)}
        />
      )}

      {deleteCardTarget && (
        <ConfirmDialog
          title="Delete card?"
          message={`"${deleteCardTarget.card.title}" will be permanently deleted.`}
          onConfirm={confirmDeleteCard}
          onCancel={() => setDeleteCardTarget(null)}
        />
      )}

      {removeTarget && (
        <ConfirmDialog
          title="Remove member?"
          message={`${removeTarget.user.name} will lose access to this board.`}
          confirmLabel="Remove"
          onConfirm={confirmRemoveMember}
          onCancel={() => setRemoveTarget(null)}
        />
      )}

      {selectedCard && board && (
        <CardDetailModal
          card={selectedCard}
          boardId={board.id}
          members={board.members}
          labels={board.labels}
          onClose={() => setSelectedCardId(null)}
          onChange={() => loadBoard(false)}
        />
      )}

      {/* Members side panel */}
      {showMembers && (
        <div
          onClick={() => setShowMembers(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100, display: "flex", justifyContent: "flex-end" }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: 340, background: "var(--surface)", borderLeft: "1px solid var(--border)", height: "100%", padding: 24, overflowY: "auto" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ fontSize: 18 }}>Members</h2>
              <button onClick={() => setShowMembers(false)} style={{ background: "transparent", color: "var(--text-muted)", display: "flex" }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleInvite} style={{ marginBottom: 24 }}>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="Invite by email"
                  type="email"
                  className="text-input"
                  style={{
                    flex: 1,
                    padding: "9px 12px",
                    background: "var(--bg)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    color: "var(--text-primary)",
                    fontSize: 14,
                  }}
                />
                <button
                  type="submit"
                  disabled={inviting}
                  style={{ background: "var(--accent)", color: "var(--accent-dark)", padding: "0 14px", display: "flex", alignItems: "center", gap: 6, borderRadius: 8 }}
                >
                  <UserPlus size={15} />
                </button>
              </div>
              {inviteError && <p style={{ color: "var(--danger)", fontSize: 13, marginTop: 8 }}>{inviteError}</p>}
            </form>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {board?.members.map((m) => (
                <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0" }}>
                  <Avatar name={m.user.name} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14 }}>{m.user.name}</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{m.user.email}</div>
                  </div>
                  <span style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase" }}>{m.role}</span>
                  {isOwner && m.role !== "owner" && (
                    <button onClick={() => setRemoveTarget(m)} style={{ background: "transparent", color: "var(--danger)", padding: 4, display: "flex" }}>
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}