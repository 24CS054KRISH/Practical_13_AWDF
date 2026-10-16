import { useEffect, useState } from "react";
import "./App.css";

const API_BASE = "http://localhost:5000";
const TASKS_URL = `${API_BASE}/tasks`;
const AI_URL = `${API_BASE}/api/ai/generate-description`;

/* ── Inline SVG icons (clean, minimal, lightweight) ── */
const IconPlus = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="7" y1="1" x2="7" y2="13" />
    <line x1="1" y1="7" x2="13" y2="7" />
  </svg>
);

const IconSparkles = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3l1.912 5.813a2 2 0 0 0 1.275 1.275L21 12l-5.813 1.912a2 2 0 0 0-1.275 1.275L12 21l-1.912-5.813a2 2 0 0 0-1.275-1.275L3 12l5.813-1.912a2 2 0 0 0 1.275-1.275L12 3z" />
  </svg>
);

const IconEdit = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const IconTrash = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6M14 11v6" />
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
  </svg>
);

const IconAlert = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

const IconCheck = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6L9 17l-5-5" />
  </svg>
);

const IconSpinner = () => (
  <svg className="icon-spinner" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="12" />
  </svg>
);

const IconInfo = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
  </svg>
);

/* ─────────────────────────────── */

function App() {
  const [tasks, setTasks] = useState([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // AI-Specific state variables
  const [aiLoading, setAiLoading] = useState(false);
  const [aiNotice, setAiNotice] = useState(null); // { type: 'success'|'fallback'|'ratelimit', message: string, disclaimer?: string, provider?: string }
  const [isAiGenerated, setIsAiGenerated] = useState(false);

  // Edit modal state
  const [editingTask, setEditingTask] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editAiLoading, setEditAiLoading] = useState(false);

  // Fetch all tasks
  const fetchTasks = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await fetch(TASKS_URL);
      if (!response.ok) throw new Error("Failed to fetch tasks from server");
      const data = await response.json();
      setTasks(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  // Auto-dismiss standard notifications
  useEffect(() => {
    if (!message && !error) return;
    const t = setTimeout(() => {
      setMessage("");
      setError("");
    }, 4000);
    return () => clearTimeout(t);
  }, [message, error]);

  // Handle AI Description Generation
  const generateAiDescription = async (targetTitle, setDescriptionFn, setAiLoadingFn, isModal = false) => {
    if (!targetTitle || !targetTitle.trim()) {
      setError("Please enter a task title first to generate an AI description.");
      return;
    }

    try {
      setAiLoadingFn(true);
      setError("");
      if (!isModal) setAiNotice(null);

      const res = await fetch(AI_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: targetTitle.trim() }),
      });

      const data = await res.json();

      // Handle Rate Limiting (429)
      if (res.status === 429 || data.rateLimited) {
        const rateMsg = data.message || "Rate limit reached: Max 1 AI request per task per minute.";
        if (isModal) {
          setError(rateMsg);
        } else {
          setAiNotice({
            type: "ratelimit",
            message: rateMsg,
            disclaimer: "Rate limit active to prevent quota exhaustion.",
          });
        }
        return;
      }

      // Handle Graceful Degradation / Fallback Path (as tested in Step 6)
      if (data.fallback) {
        if (!isModal) {
          setIsAiGenerated(false);
          setAiNotice({
            type: "fallback",
            message: data.message || "AI service is currently in fallback mode. You can enter the description manually.",
            disclaimer: "Graceful degradation active: The core application remains fully functional.",
            provider: data.provider || "offline-fallback"
          });
        } else {
          setMessage("AI in fallback mode. Please type description manually.");
        }
        return;
      }

      // Successful AI Generation
      if (data.description) {
        setDescriptionFn(data.description);
        if (!isModal) {
          setIsAiGenerated(true);
          setAiNotice({
            type: "success",
            message: "Description generated! You can edit or adjust it before saving.",
            disclaimer: data.disclaimer || "AI-generated content. Please review and verify accuracy.",
            provider: data.provider || "openai"
          });
        } else {
          setMessage("AI suggestion applied. Review before saving.");
        }
      }
    } catch (err) {
      // Graceful error handling in case network drops or server is unavailable
      console.warn("AI generation request failed:", err);
      if (!isModal) {
        setAiNotice({
          type: "fallback",
          message: "Unable to reach AI endpoint. Manual entry is enabled.",
          disclaimer: "Graceful fallback: Core task creation is unimpeded.",
        });
      } else {
        setError("AI generation failed. Please enter description manually.");
      }
    } finally {
      setAiLoadingFn(false);
    }
  };

  // Add task
  const addTask = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    if (!title.trim()) {
      setError("Task title is required");
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(TASKS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          completed: false,
        }),
      });

      if (!res.ok) throw new Error("Failed to create task");
      const data = await res.json();
      setTasks((prev) => [...prev, data.task]);
      setTitle("");
      setDescription("");
      setIsAiGenerated(false);
      setAiNotice(null);
      setMessage("Task created successfully");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Open edit modal
  const openEdit = (task) => {
    setEditingTask(task);
    setEditTitle(task.title);
    setEditDescription(task.description || "");
  };

  // Save edit
  const saveEdit = async (e) => {
    e.preventDefault();
    if (!editTitle.trim()) {
      setError("Title cannot be empty");
      return;
    }
    try {
      setLoading(true);
      setError("");
      setMessage("");
      const res = await fetch(`${TASKS_URL}/${editingTask._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle.trim(),
          description: editDescription.trim(),
          completed: editingTask.completed,
        }),
      });
      if (!res.ok) throw new Error("Failed to update task");
      const data = await res.json();
      setTasks((prev) =>
        prev.map((item) => (item._id === editingTask._id ? data.task : item))
      );
      setMessage("Task updated successfully");
      setEditingTask(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Delete task
  const deleteTask = async (id) => {
    if (!window.confirm("Delete this task?")) return;
    try {
      setLoading(true);
      setError("");
      setMessage("");
      const res = await fetch(`${TASKS_URL}/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete task");
      setTasks((prev) => prev.filter((t) => t._id !== id));
      setMessage("Task deleted successfully");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Toggle completion
  const toggleCompleted = async (task) => {
    try {
      const res = await fetch(`${TASKS_URL}/${task._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...task,
          completed: !task.completed,
        }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      const data = await res.json();
      setTasks((prev) =>
        prev.map((t) => (t._id === task._id ? data.task : t))
      );
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="app-wrapper">
      {/* Subtle Header */}
      <header className="app-header">
        <div className="header-meta-row">
          <span className="badge-tag">AWDF Practical 13</span>
          <span className="badge-subtle">AI API Integration</span>
        </div>
        <h1>Task Management</h1>
        <p className="subtitle">
          Intelligent task workspace with backend AI assistance and graceful degradation
        </p>
      </header>

      <div className="divider" />

      {/* Notifications */}
      {error && (
        <div className="toast error">
          <IconAlert /> <span>{error}</span>
        </div>
      )}
      {message && (
        <div className="toast success">
          <IconCheck /> <span>{message}</span>
        </div>
      )}

      {/* New Task Creation Form */}
      <section className="form-card">
        <div className="form-header-row">
          <p className="section-label">Create New Task</p>
          <span className="privacy-badge">🔒 Server-side AI (.env)</span>
        </div>

        <form onSubmit={addTask}>
          <div className="form-fields">
            {/* Task Title */}
            <div className="field-group">
              <label className="input-label" htmlFor="task-title">
                Task Title <span className="required-star">*</span>
              </label>
              <div className="input-with-action">
                <input
                  id="task-title"
                  className="form-input"
                  type="text"
                  placeholder="e.g., Prepare semester 5 project presentation slides"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={loading}
                />
                <button
                  type="button"
                  className={`btn-ai-generate ${aiLoading ? "loading" : ""}`}
                  onClick={() => generateAiDescription(title, setDescription, setAiLoading)}
                  disabled={aiLoading || !title.trim()}
                  title="Generate a description using the backend AI API"
                >
                  {aiLoading ? (
                    <>
                      <IconSpinner />
                      <span>Generating...</span>
                    </>
                  ) : (
                    <>
                      <IconSparkles />
                      <span>Generate description</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* AI Status / Disclaimer Banner */}
            {aiNotice && (
              <div className={`ai-banner ${aiNotice.type}`}>
                <div className="ai-banner-header">
                  <IconInfo />
                  <span className="ai-banner-text">{aiNotice.message}</span>
                  {aiNotice.type === "success" && (
                    <span className="ai-source-tag">AI Suggested</span>
                  )}
                </div>
                {aiNotice.disclaimer && (
                  <p className="ai-disclaimer">{aiNotice.disclaimer}</p>
                )}
              </div>
            )}

            {/* Task Description (Editable suggestion) */}
            <div className="field-group">
              <div className="label-row">
                <label className="input-label" htmlFor="task-desc">
                  Task Description
                </label>
                {isAiGenerated && (
                  <span className="pill-editable">Editable AI draft</span>
                )}
              </div>
              <textarea
                id="task-desc"
                className={`form-textarea ${isAiGenerated ? "ai-suggested-input" : ""}`}
                rows={3}
                placeholder="Write description manually or click 'Generate description' above..."
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  if (isAiGenerated && !e.target.value) {
                    setIsAiGenerated(false);
                  }
                }}
                disabled={loading}
              />
              {isAiGenerated && (
                <div className="field-hint-row">
                  <span className="field-hint">
                    💡 You have full control: edit, expand, or adjust the text before saving.
                  </span>
                  <button
                    type="button"
                    className="btn-text-clear"
                    onClick={() => {
                      setDescription("");
                      setIsAiGenerated(false);
                      setAiNotice(null);
                    }}
                  >
                    Clear suggestion
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="form-submit-row">
            <button className="btn-add" type="submit" disabled={loading || !title.trim()}>
              <IconPlus /> Add Task to Workspace
            </button>
          </div>
        </form>
      </section>

      <div className="divider" />

      {/* Task List Section */}
      <section className="task-section">
        <div className="tasks-heading-row">
          <div>
            <p className="section-label" style={{ marginBottom: 2 }}>Workspace Tasks</p>
            <p className="section-subtext">Click checkmark to toggle status</p>
          </div>
          {tasks.length > 0 && (
            <span className="task-count-pill">{tasks.length} {tasks.length === 1 ? "task" : "tasks"}</span>
          )}
        </div>

        {loading && tasks.length === 0 && (
          <div className="loader-row">
            <IconSpinner />
            <span>Connecting to backend...</span>
          </div>
        )}

        {!loading && tasks.length === 0 && (
          <div className="empty-state">
            <p className="empty-title">No tasks recorded yet</p>
            <p className="empty-desc">Create your first task above. Use AI to auto-generate a description!</p>
          </div>
        )}

        {tasks.length > 0 && (
          <div className="task-list">
            {tasks.map((task) => (
              <div
                key={task._id}
                className={`task-card ${task.completed ? "completed" : ""}`}
              >
                <button
                  type="button"
                  className={`status-toggle-btn ${task.completed ? "done" : ""}`}
                  onClick={() => toggleCompleted(task)}
                  title={task.completed ? "Mark incomplete" : "Mark complete"}
                >
                  {task.completed && <IconCheck />}
                </button>

                <div className="task-content">
                  <div className="task-title-row">
                    <p className="task-title">{task.title}</p>
                    <span className={`status-pill ${task.completed ? "done" : "pending"}`}>
                      {task.completed ? "Done" : "Pending"}
                    </span>
                  </div>
                  {task.description ? (
                    <p className="task-desc">{task.description}</p>
                  ) : (
                    <p className="task-desc muted-desc">No description provided</p>
                  )}
                  {task.createdAt && (
                    <span className="task-timestamp">
                      Created: {new Date(task.createdAt).toLocaleDateString()}
                    </span>
                  )}
                </div>

                <div className="task-actions">
                  <button
                    className="btn-icon btn-edit"
                    title="Edit Task"
                    onClick={() => openEdit(task)}
                  >
                    <IconEdit />
                  </button>
                  <button
                    className="btn-icon btn-delete"
                    title="Delete Task"
                    onClick={() => deleteTask(task._id)}
                  >
                    <IconTrash />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Edit Modal with AI regeneration support */}
      {editingTask && (
        <div className="modal-overlay" onClick={() => setEditingTask(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <p className="modal-title">Edit Task</p>
              <button
                type="button"
                className="btn-close-modal"
                onClick={() => setEditingTask(null)}
              >
                ✕
              </button>
            </div>
            <form className="modal-form" onSubmit={saveEdit}>
              <div className="field-group">
                <label className="input-label">Task Title</label>
                <div className="input-with-action">
                  <input
                    className="form-input"
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    autoFocus
                  />
                  <button
                    type="button"
                    className="btn-ai-generate modal-ai-btn"
                    onClick={() => generateAiDescription(editTitle, setEditDescription, setEditAiLoading, true)}
                    disabled={editAiLoading || !editTitle.trim()}
                  >
                    {editAiLoading ? <IconSpinner /> : <IconSparkles />}
                    <span>AI Suggest</span>
                  </button>
                </div>
              </div>

              <div className="field-group">
                <label className="input-label">Task Description</label>
                <textarea
                  className="form-textarea"
                  rows={3}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Enter task description..."
                />
              </div>

              <div className="modal-actions">
                <button type="submit" className="btn-save" disabled={loading}>
                  Save Changes
                </button>
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setEditingTask(null)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
