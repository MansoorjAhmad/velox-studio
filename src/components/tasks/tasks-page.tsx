"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { getTasks, createTask, updateTask, updateTaskStatus, deleteTask } from "@/lib/tasks/actions";
import {
  TASK_CATEGORIES,
  TASK_PRIORITIES,
  PRIORITY_COLORS,
  STATUS_LABELS,
  type Task,
  type TaskInput,
} from "@/lib/tasks/types";
import {
  CheckSquare,
  Plus,
  Trash2,
  Edit2,
  Loader2,
  Inbox,
  LayoutGrid,
  ListFilter,
  Layers,
  Sparkles,
  Flame,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";

type ViewMode = "kanban" | "matrix";

export function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("kanban");
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await getTasks();
    if (res.error) setError(res.error);
    setTasks(res.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    async function init() {
      const res = await getTasks();
      if (active) {
        if (res.error) setError(res.error);
        setTasks(res.data ?? []);
        setLoading(false);
      }
    }
    init();
    return () => {
      active = false;
    };
  }, []);

  const todoTasks = useMemo(() => tasks.filter((t) => t.status === "todo"), [tasks]);
  const inProgressTasks = useMemo(() => tasks.filter((t) => t.status === "in_progress"), [tasks]);
  const doneTasks = useMemo(() => tasks.filter((t) => t.status === "done"), [tasks]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-md bg-brand/10 flex items-center justify-center">
            <CheckSquare className="w-5 h-5 text-brand" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-medium tracking-tight">Tasks Command Center</h1>
            <p className="text-sm text-foreground-muted">
              Organize execution. Kanban & Eisenhower Matrix view.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* View Mode Switcher */}
          <div className="flex items-center rounded-lg border border-border bg-surface p-1">
            <button
              onClick={() => setViewMode("kanban")}
              className={cn(
                "px-2.5 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5",
                viewMode === "kanban" ? "bg-brand text-white shadow-sm" : "text-foreground-muted hover:text-foreground",
              )}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Kanban
            </button>
            <button
              onClick={() => setViewMode("matrix")}
              className={cn(
                "px-2.5 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5",
                viewMode === "matrix" ? "bg-brand text-white shadow-sm" : "text-foreground-muted hover:text-foreground",
              )}
            >
              <Layers className="w-3.5 h-3.5" />
              Matrix
            </button>
          </div>

          <Button size="sm" onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4" />
            Add Task
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border-danger/30 bg-danger/5">
          <CardContent className="py-3 text-sm text-danger">{error}</CardContent>
        </Card>
      )}

      {/* Quick KPI stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-border bg-surface px-4 py-3">
          <p className="font-display font-medium text-2xl text-foreground">{todoTasks.length}</p>
          <p className="text-xs text-foreground-subtle">To Do</p>
        </div>
        <div className="rounded-lg border border-brand/30 bg-surface px-4 py-3">
          <p className="font-display font-medium text-2xl text-brand">{inProgressTasks.length}</p>
          <p className="text-xs text-foreground-subtle">In Progress</p>
        </div>
        <div className="rounded-lg border border-profit/30 bg-surface px-4 py-3">
          <p className="font-display font-medium text-2xl text-profit">{doneTasks.length}</p>
          <p className="text-xs text-foreground-subtle">Completed</p>
        </div>
      </div>

      {/* View Engine */}
      {loading ? (
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-64 w-full" />
          ))}
        </div>
      ) : viewMode === "kanban" ? (
        /* ── KANBAN BOARD VIEW ── */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* TO DO COLUMN */}
          <KanbanColumn
            title="To Do"
            badgeColor="bg-surface-3 text-foreground-muted"
            tasks={todoTasks}
            onChanged={load}
            onEdit={(t) => setEditingTask(t)}
          />

          {/* IN PROGRESS COLUMN */}
          <KanbanColumn
            title="In Progress"
            badgeColor="bg-brand/15 text-brand"
            tasks={inProgressTasks}
            onChanged={load}
            onEdit={(t) => setEditingTask(t)}
          />

          {/* DONE COLUMN */}
          <KanbanColumn
            title="Completed"
            badgeColor="bg-profit/15 text-profit"
            tasks={doneTasks}
            onChanged={load}
            onEdit={(t) => setEditingTask(t)}
          />
        </div>
      ) : (
        /* ── EISENHOWER MATRIX VIEW ── */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <MatrixQuadrant
            title="🔥 Urgent & Important"
            sub="Do First — Critical deadlines & trading actions"
            tasks={tasks.filter((t) => t.priority === "urgent" || t.priority === "high")}
            borderColor="border bg-surface-2"
            onChanged={load}
            onEdit={(t) => setEditingTask(t)}
          />
          <MatrixQuadrant
            title="🎯 Important (Long-Term)"
            sub="Schedule — Strategy rules, learning & goals"
            tasks={tasks.filter((t) => t.priority === "medium")}
            borderColor="border bg-surface-2"
            onChanged={load}
            onEdit={(t) => setEditingTask(t)}
          />
          <MatrixQuadrant
            title="⚡ Quick Wins / Delegate"
            sub="Do Next — Fast tasks & routine actions"
            tasks={tasks.filter((t) => t.priority === "low" && t.status !== "done")}
            borderColor="border bg-surface-2"
            onChanged={load}
            onEdit={(t) => setEditingTask(t)}
          />
          <MatrixQuadrant
            title="✅ Completed Archive"
            sub="Done — Finished items"
            tasks={tasks.filter((t) => t.status === "done")}
            borderColor="border bg-surface-2"
            onChanged={load}
            onEdit={(t) => setEditingTask(t)}
          />
        </div>
      )}

      {/* Create Modal */}
      <TaskFormModal
        key="new"
        open={showForm}
        onClose={() => setShowForm(false)}
        onSaved={() => {
          setShowForm(false);
          load();
        }}
      />

      {/* Edit Modal */}
      {editingTask && (
        <TaskFormModal
          key={editingTask.id}
          open={!!editingTask}
          taskToEdit={editingTask}
          onClose={() => setEditingTask(null)}
          onSaved={() => {
            setEditingTask(null);
            load();
          }}
        />
      )}
    </div>
  );
}

// ── Kanban Column Component ─────────────────────────────────────

function KanbanColumn({
  title,
  badgeColor,
  tasks,
  onChanged,
  onEdit,
}: {
  title: string;
  badgeColor: string;
  tasks: Task[];
  onChanged: () => void;
  onEdit: (t: Task) => void;
}) {
  return (
    <Card className="bg-surface-2/40 flex flex-col h-full min-h-[400px]">
      <CardHeader className="py-3 px-4 flex flex-row items-center justify-between border-b border-border/60">
        <CardTitle className="text-sm font-bold flex items-center gap-2">
          {title}
        </CardTitle>
        <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full", badgeColor)}>
          {tasks.length}
        </span>
      </CardHeader>
      <CardContent className="p-3 space-y-2.5 flex-1 overflow-y-auto">
        {tasks.length === 0 ? (
          <div className="py-12 text-center text-xs text-foreground-subtle">
            No tasks in this stage
          </div>
        ) : (
          tasks.map((task) => (
            <TaskCard key={task.id} task={task} onChanged={onChanged} onEdit={onEdit} />
          ))
        )}
      </CardContent>
    </Card>
  );
}

// ── Matrix Quadrant Component ───────────────────────────────────

function MatrixQuadrant({
  title,
  sub,
  tasks,
  borderColor,
  onChanged,
  onEdit,
}: {
  title: string;
  sub: string;
  tasks: Task[];
  borderColor: string;
  onChanged: () => void;
  onEdit: (t: Task) => void;
}) {
  return (
    <Card className={cn("border transition-all", borderColor)}>
      <CardHeader className="py-3 px-4 border-b border-border/50">
        <CardTitle className="text-sm font-bold">{title}</CardTitle>
        <p className="text-[11px] text-foreground-subtle">{sub}</p>
      </CardHeader>
      <CardContent className="p-3 space-y-2 max-h-72 overflow-y-auto">
        {tasks.length === 0 ? (
          <p className="py-6 text-center text-xs text-foreground-subtle">No tasks</p>
        ) : (
          tasks.map((task) => (
            <TaskCard key={task.id} task={task} onChanged={onChanged} onEdit={onEdit} />
          ))
        )}
      </CardContent>
    </Card>
  );
}

// ── Individual Task Card ────────────────────────────────────────

function TaskCard({
  task,
  onChanged,
  onEdit,
}: {
  task: Task;
  onChanged: () => void;
  onEdit: (t: Task) => void;
}) {
  const nextStatus =
    task.status === "todo"
      ? "in_progress"
      : task.status === "in_progress"
      ? "done"
      : "todo";

  return (
    <div
      className={cn(
        "group relative rounded-lg border border-border bg-surface p-3 space-y-2 hover:border-brand/40 transition-all",
        task.status === "done" && "opacity-60 bg-surface-2/30",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0">
          <button
            onClick={async () => {
              await updateTaskStatus(task.id, nextStatus);
              if (nextStatus === "done") toast.success("Task done", { description: task.title });
              onChanged();
            }}
            className={cn(
              "mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors",
              task.status === "done"
                ? "border-profit bg-profit text-white"
                : task.status === "in_progress"
                ? "border-brand bg-brand/20 text-brand"
                : "border-border text-transparent hover:border-brand",
            )}
            title={`Move to ${STATUS_LABELS[nextStatus]}`}
          >
            <CheckCircle2 className="w-3 h-3" />
          </button>

          <p
            className={cn(
              "text-xs font-semibold text-foreground leading-tight",
              task.status === "done" && "line-through text-foreground-muted",
            )}
          >
            {task.title}
          </p>
        </div>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onEdit(task)}
            className="p-1 rounded hover:bg-surface-2 text-foreground-subtle hover:text-foreground"
          >
            <Edit2 className="w-3 h-3" />
          </button>
          <button
            onClick={async () => {
              await deleteTask(task.id);
              onChanged();
            }}
            className="p-1 rounded hover:bg-loss/10 text-foreground-subtle hover:text-loss"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/40 text-[10px]">
        <span className="capitalize text-foreground-subtle">{task.category}</span>
        <Badge
          variant={
            task.priority === "urgent"
              ? "loss"
              : task.priority === "high"
              ? "warning"
              : "outline"
          }
          className="text-[9px] py-0 px-1.5 uppercase"
        >
          {task.priority}
        </Badge>
      </div>
    </div>
  );
}

// ── Task Form Modal ─────────────────────────────────────────────

function TaskFormModal({
  open,
  taskToEdit,
  onClose,
  onSaved,
}: {
  open: boolean;
  taskToEdit?: Task;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(taskToEdit?.title ?? "");
  const [category, setCategory] = useState<string>(taskToEdit?.category ?? "personal");
  const [priority, setPriority] = useState<string>(taskToEdit?.priority ?? "medium");
  const [dueDate, setDueDate] = useState(taskToEdit?.due_date ?? "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    if (!title.trim()) {
      setErr("Title is required.");
      setSaving(false);
      return;
    }

    let res;
    if (taskToEdit) {
      res = await updateTask(taskToEdit.id, {
        title: title.trim(),
        category,
        priority,
        due_date: dueDate || null,
      });
    } else {
      res = await createTask({
        title: title.trim(),
        category,
        priority,
        due_date: dueDate || null,
      } as TaskInput);
    }

    setSaving(false);
    if (res.error) {
      setErr(res.error);
      return;
    }
    setTitle("");
    setDueDate("");
    onSaved();
  };

  return (
    <Modal open={open} onClose={onClose} title={taskToEdit ? "Edit Task" : "Add Task"}>
      <form onSubmit={handleSave} className="space-y-4">
        <div className="space-y-1.5">
          <Label>Task Title *</Label>
          <Input
            placeholder="e.g. Review TJL 2 setups & backtest notes"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select value={category} onChange={(e) => setCategory(e.target.value)}>
              {TASK_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c.charAt(0).toUpperCase() + c.slice(1)}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Priority</Label>
            <Select value={priority} onChange={(e) => setPriority(e.target.value)}>
              {TASK_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Due Date (optional)</Label>
          <Input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>
        {err && <p className="text-sm text-danger">{err}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : taskToEdit ? "Update Task" : "Add Task"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
