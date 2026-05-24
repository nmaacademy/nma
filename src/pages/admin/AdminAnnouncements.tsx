import React, { useEffect, useState, useCallback } from "react";
import {
  Plus,
  Search,
  Pin,
  PinOff,
  Pencil,
  Trash2,
  X,
  ChevronLeft,
  ChevronRight,
  Megaphone,
} from "lucide-react";
import { courseService } from "../../services/courseService";
import {
  adminService,
  AdminAnnouncement,
  AdminAnnouncementPayload,
  AnnouncementStatus,
} from "../../services/adminService";
import { Course } from "../../types";
import LogoLoader from "../../components/ui/LogoLoader";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<AnnouncementStatus, string> = {
  draft: "Draft",
  published: "Publicat",
  hidden: "Ascuns",
};

const STATUS_COLORS: Record<AnnouncementStatus, string> = {
  draft: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20",
  published: "bg-green-500/15 text-green-400 border-green-500/20",
  hidden: "bg-gray-500/15 text-gray-400 border-gray-500/20",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ro-RO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── Empty form state ─────────────────────────────────────────────────────────

const EMPTY_FORM: AdminAnnouncementPayload = {
  title: "",
  body: "",
  status: "draft",
  is_pinned: false,
  published_at: "",
};

// ─── Modal ────────────────────────────────────────────────────────────────────

interface ModalProps {
  editing: AdminAnnouncement | null;
  onClose: () => void;
  onSaved: () => void;
  courseId: number;
}

function AnnouncementModal({ editing, onClose, onSaved, courseId }: ModalProps) {
  const [form, setForm] = useState<AdminAnnouncementPayload>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [loadingBody, setLoadingBody] = useState(false);

  // When editing, fetch full body from backend
  useEffect(() => {
    if (editing) {
      if (editing.body !== undefined) {
        setForm({
          title: editing.title,
          body: editing.body,
          status: editing.status,
          is_pinned: editing.is_pinned,
          published_at: editing.published_at
            ? new Date(editing.published_at).toISOString().slice(0, 16)
            : "",
        });
      } else {
        setLoadingBody(true);
        adminService.getAdminAnnouncement(editing.id).then((full) => {
          setForm({
            title: full.title,
            body: full.body ?? "",
            status: full.status,
            is_pinned: full.is_pinned,
            published_at: full.published_at
              ? new Date(full.published_at).toISOString().slice(0, 16)
              : "",
          });
          setLoadingBody(false);
        });
      }
    } else {
      setForm(EMPTY_FORM);
    }
    setErrors({});
  }, [editing]);

  const set = (field: keyof AdminAnnouncementPayload, value: unknown) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => { const e = { ...prev }; delete e[field]; return e; });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: AdminAnnouncementPayload = {
      ...form,
      published_at: form.published_at || null,
    };

    // Basic client-side validation
    const errs: Record<string, string> = {};
    if (!payload.title.trim() || payload.title.length < 3) errs.title = "Titlul trebuie să aibă cel puțin 3 caractere.";
    if (payload.title.length > 160) errs.title = "Titlul nu poate depăși 160 de caractere.";
    if (!payload.body.trim() || payload.body.length < 10) errs.body = "Conținutul trebuie să aibă cel puțin 10 caractere.";
    if (payload.body.length > 10000) errs.body = "Conținutul nu poate depăși 10.000 de caractere.";
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setSaving(true);
    try {
      if (editing) {
        await adminService.updateAdminAnnouncement(editing.id, payload);
      } else {
        await adminService.createAdminAnnouncement(courseId, payload);
      }
      onSaved();
    } catch (err: any) {
      if (err?.data?.errors) {
        const mapped: Record<string, string> = {};
        for (const [k, v] of Object.entries(err.data.errors)) {
          mapped[k] = Array.isArray(v) ? (v as string[])[0] : String(v);
        }
        setErrors(mapped);
      } else {
        setErrors({ _global: err?.message ?? "Eroare necunoscută." });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-2xl bg-[#0f0f14] border border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[90dvh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 shrink-0">
          <h2 className="text-white font-bold text-lg">
            {editing ? "Editează Anunț" : "Anunț Nou"}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        {loadingBody ? (
          <div className="p-8 flex justify-center">
            <LogoLoader minHeight={120} />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-5 p-6 overflow-y-auto">
            {errors._global && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3 rounded-xl">
                {errors._global}
              </div>
            )}

            {/* Title */}
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">
                Titlu <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                maxLength={160}
                placeholder="Titlul anunțului..."
                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-red-500/50 transition-colors"
              />
              <div className="flex justify-between mt-1">
                {errors.title ? (
                  <span className="text-red-400 text-xs">{errors.title}</span>
                ) : <span />}
                <span className="text-xs text-gray-600 ml-auto">{form.title.length}/160</span>
              </div>
            </div>

            {/* Body */}
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">
                Conținut <span className="text-red-400">*</span>
              </label>
              <textarea
                value={form.body}
                onChange={(e) => set("body", e.target.value)}
                maxLength={10000}
                rows={8}
                placeholder="Scrie anunțul..."
                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-red-500/50 transition-colors resize-y"
              />
              <div className="flex justify-between mt-1">
                {errors.body ? (
                  <span className="text-red-400 text-xs">{errors.body}</span>
                ) : <span />}
                <span className="text-xs text-gray-600 ml-auto">{form.body.length}/10000</span>
              </div>
            </div>

            {/* Status + Pinned row */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">
                  Status <span className="text-red-400">*</span>
                </label>
                <select
                  value={form.status}
                  onChange={(e) => set("status", e.target.value as AnnouncementStatus)}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-red-500/50 transition-colors"
                >
                  <option value="draft">Draft</option>
                  <option value="published">Publicat</option>
                  <option value="hidden">Ascuns</option>
                </select>
                {errors.status && <p className="text-red-400 text-xs mt-1">{errors.status}</p>}
              </div>

              <div className="flex-1">
                <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">
                  Data publicării
                </label>
                <input
                  type="datetime-local"
                  value={form.published_at as string}
                  onChange={(e) => set("published_at", e.target.value)}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-red-500/50 transition-colors"
                />
                <p className="text-xs text-gray-600 mt-1">Lasă gol pentru data curentă (dacă publicat).</p>
              </div>
            </div>

            {/* Pinned toggle */}
            <label className="flex items-center gap-3 cursor-pointer select-none w-fit">
              <div
                onClick={() => set("is_pinned", !form.is_pinned)}
                className={`w-10 h-5 rounded-full border transition-colors flex items-center ${
                  form.is_pinned
                    ? "bg-red-500/30 border-red-500/50"
                    : "bg-white/5 border-white/10"
                }`}
              >
                <div
                  className={`w-3.5 h-3.5 rounded-full transition-transform mx-0.5 ${
                    form.is_pinned ? "translate-x-[1.125rem] bg-red-400" : "translate-x-0 bg-gray-600"
                  }`}
                />
              </div>
              <span className="text-sm text-gray-300">Fixat (Important)</span>
            </label>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-2 border-t border-white/5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
              >
                Anulează
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 bg-red-500 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-sm font-bold transition-colors"
              >
                {saving ? "Se salvează…" : editing ? "Salvează" : "Creează Anunț"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ─── Delete confirmation ──────────────────────────────────────────────────────

interface DeleteDialogProps {
  announcement: AdminAnnouncement;
  onCancel: () => void;
  onConfirmed: () => void;
}

function DeleteDialog({ announcement, onCancel, onConfirmed }: DeleteDialogProps) {
  const [deleting, setDeleting] = useState(false);

  const confirm = async () => {
    setDeleting(true);
    try {
      await adminService.deleteAdminAnnouncement(announcement.id);
      onConfirmed();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-md bg-[#0f0f14] border border-white/10 rounded-2xl shadow-2xl p-6 space-y-4">
        <h2 className="text-white font-bold text-lg">Șterge Anunț</h2>
        <p className="text-gray-400 text-sm">
          Ești sigur că vrei să ștergi anunțul{" "}
          <span className="text-white font-medium">"{announcement.title}"</span>?
          Acțiunea nu poate fi anulată.
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            Anulează
          </button>
          <button
            onClick={confirm}
            disabled={deleting}
            className="px-5 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl text-sm font-bold transition-colors"
          >
            {deleting ? "Se șterge…" : "Șterge"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AdminAnnouncements() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [announcements, setAnnouncements] = useState<AdminAnnouncement[]>([]);
  const [meta, setMeta] = useState({ total: 0, current_page: 1, last_page: 1, per_page: 10 });
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [loadingList, setLoadingList] = useState(false);
  const [statusFilter, setStatusFilter] = useState<AnnouncementStatus | "">("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<AdminAnnouncement | null>(null);
  const [deletingAnnouncement, setDeletingAnnouncement] = useState<AdminAnnouncement | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load courses for the selector
  useEffect(() => {
    courseService.getAllCoursesForAdmin().then((data) => {
      setCourses(data);
      if (data.length > 0) {
        setSelectedCourseId(Number(data[0].course_id));
      }
      setLoadingCourses(false);
    });
  }, []);

  const loadAnnouncements = useCallback(async () => {
    if (!selectedCourseId) return;
    setLoadingList(true);
    setError(null);
    try {
      const result = await adminService.getAdminCourseAnnouncements(selectedCourseId, {
        page,
        per_page: 10,
        status: statusFilter || undefined,
        search: search || undefined,
      });
      setAnnouncements(result.announcements);
      setMeta(result.meta);
    } catch (err: any) {
      setError(err?.message ?? "Eroare la încărcarea anunțurilor.");
    } finally {
      setLoadingList(false);
    }
  }, [selectedCourseId, page, statusFilter, search]);

  useEffect(() => {
    loadAnnouncements();
  }, [loadAnnouncements]);

  // Reset page when filter/search/course changes
  useEffect(() => {
    setPage(1);
  }, [selectedCourseId, statusFilter, search]);

  const openCreate = () => {
    setEditingAnnouncement(null);
    setModalOpen(true);
  };

  const openEdit = (a: AdminAnnouncement) => {
    setEditingAnnouncement(a);
    setModalOpen(true);
  };

  const handleSaved = () => {
    setModalOpen(false);
    loadAnnouncements();
  };

  const handleDeleted = () => {
    setDeletingAnnouncement(null);
    loadAnnouncements();
  };

  if (loadingCourses) return <LogoLoader minHeight={320} />;

  if (courses.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-white">Administrare Anunțuri</h1>
        <div className="bg-[#141419]/50 border border-white/5 rounded-2xl p-10 text-center text-gray-500">
          Nu există cursuri. Creează mai întâi un curs.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <Megaphone className="w-6 h-6 text-red-400" />
          Administrare Anunțuri
        </h1>
        <button
          onClick={openCreate}
          disabled={!selectedCourseId}
          className="bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors"
        >
          <Plus className="w-4 h-4" /> Anunț Nou
        </button>
      </div>

      {/* Controls bar */}
      <div className="bg-[#141419]/50 border border-white/5 rounded-xl p-4 flex flex-col lg:flex-row gap-4 items-start lg:items-center">
        {/* Course selector */}
        <div className="w-full lg:w-auto">
          <select
            value={selectedCourseId ?? ""}
            onChange={(e) => setSelectedCourseId(Number(e.target.value))}
            className="w-full lg:w-[18rem] bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-red-500/50 transition-colors"
          >
            {courses.map((c) => (
              <option key={c.course_id} value={c.course_id}>
                {c.title}
              </option>
            ))}
          </select>
        </div>

        {/* Status filter */}
        <div className="flex gap-2 flex-wrap">
          {(["", "published", "draft", "hidden"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s as AnnouncementStatus | "")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors ${
                statusFilter === s
                  ? "bg-white/10 text-white"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              {s === "" ? "Toate" : STATUS_LABELS[s as AnnouncementStatus]}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full lg:w-[16rem] lg:ml-auto">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="Caută anunț..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-black/50 border border-white/10 rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-red-500/50"
          />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3 rounded-xl">
          {error}
        </div>
      )}

      {/* List */}
      <div className="space-y-3">
        {loadingList ? (
          <LogoLoader minHeight={200} />
        ) : announcements.length === 0 ? (
          <div className="bg-[#141419]/50 border border-white/5 rounded-2xl p-10 text-center text-gray-500">
            {search || statusFilter
              ? "Niciun anunț nu corespunde filtrelor."
              : "Nu există anunțuri pentru acest curs. Creează primul anunț."}
          </div>
        ) : (
          announcements.map((a) => (
            <div
              key={a.id}
              className="bg-[#141419]/50 border border-white/5 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-start gap-4 group"
            >
              {/* Left: pin indicator */}
              <div className="shrink-0 mt-0.5">
                {a.is_pinned ? (
                  <Pin className="w-4 h-4 text-red-400" />
                ) : (
                  <PinOff className="w-4 h-4 text-gray-700" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span
                    className={`text-[0.625rem] font-bold uppercase tracking-widest px-2 py-0.5 rounded border ${STATUS_COLORS[a.status]}`}
                  >
                    {STATUS_LABELS[a.status]}
                  </span>
                  {a.is_pinned && (
                    <span className="text-[0.625rem] font-bold uppercase tracking-widest px-2 py-0.5 rounded border bg-red-500/10 text-red-400 border-red-500/20">
                      Fixat
                    </span>
                  )}
                </div>
                <h3 className="font-semibold text-white text-sm leading-snug mb-1 truncate">{a.title}</h3>
                <p className="text-gray-500 text-xs leading-relaxed line-clamp-2">{a.body_excerpt}</p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-gray-600">
                  <span>Creat: {formatDate(a.created_at)}</span>
                  {a.published_at && (
                    <span>Publicat: {formatDate(a.published_at)}</span>
                  )}
                  {a.creator && <span>De: {a.creator.name}</span>}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => openEdit(a)}
                  className="w-9 h-9 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-lg flex items-center justify-center transition-colors"
                  title="Editează"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setDeletingAnnouncement(a)}
                  className="w-9 h-9 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg flex items-center justify-center transition-colors"
                  title="Șterge"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {!loadingList && meta.last_page > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>
            {meta.total} anunț{meta.total !== 1 ? "uri" : ""} · pagina {meta.current_page}/{meta.last_page}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 flex items-center justify-center text-white transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(meta.last_page, p + 1))}
              disabled={page >= meta.last_page}
              className="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 flex items-center justify-center text-white transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Create/Edit modal */}
      {modalOpen && selectedCourseId && (
        <AnnouncementModal
          editing={editingAnnouncement}
          courseId={selectedCourseId}
          onClose={() => setModalOpen(false)}
          onSaved={handleSaved}
        />
      )}

      {/* Delete confirmation */}
      {deletingAnnouncement && (
        <DeleteDialog
          announcement={deletingAnnouncement}
          onCancel={() => setDeletingAnnouncement(null)}
          onConfirmed={handleDeleted}
        />
      )}
    </div>
  );
}
