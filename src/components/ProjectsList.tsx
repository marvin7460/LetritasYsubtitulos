import { FolderOpen, HardDrive, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { formatBytes, formatDuration } from '../lib/media/validate';
import {
  deleteProject,
  listProjects,
  storageUsage,
  type ProjectSummary,
} from '../lib/storage/projects';
import { openProject } from '../state/persistence';

const relativeTime = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });

function ago(timestamp: number): string {
  const minutes = Math.round((timestamp - Date.now()) / 60_000);
  if (Math.abs(minutes) < 60) return relativeTime.format(minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return relativeTime.format(hours, 'hour');
  return relativeTime.format(Math.round(hours / 24), 'day');
}

/** Recent projects saved in this browser (IndexedDB + OPFS). */
export function ProjectsList() {
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [usage, setUsage] = useState<{ usage: number; quota: number } | null>(null);

  const refresh = () => {
    void listProjects()
      .then(setProjects)
      .catch(() => setProjects([]));
    void storageUsage().then(setUsage);
  };
  useEffect(refresh, []);

  if (!projects || projects.length === 0) return null;
  return (
    <section className="w-full text-left" aria-labelledby="projects-title">
      <div className="mb-2 flex items-end justify-between">
        <h2 id="projects-title" className="font-semibold">
          Tus proyectos
        </h2>
        {usage && (
          <span className="flex items-center gap-1 text-xs text-muted">
            <HardDrive className="size-3.5" aria-hidden /> {formatBytes(usage.usage)} usados en este
            navegador
          </span>
        )}
      </div>
      <ul className="space-y-2" data-testid="projects-list">
        {projects.map((project) => (
          <li
            key={project.id}
            className="flex items-center gap-3 rounded-xl border border-line bg-surface/60 p-3"
          >
            <FolderOpen className="size-5 shrink-0 text-violet" aria-hidden />
            <button
              type="button"
              onClick={() => void openProject(project.id)}
              className="min-w-0 flex-1 text-left"
            >
              <span className="block truncate font-medium">{project.name}</span>
              <span className="text-xs text-muted">
                {ago(project.updatedAt)} · {formatDuration(project.media.info.duration)} ·{' '}
                {project.captionCount} subtítulos
                {project.mediaStorage === 'none' && ' · sin video guardado'}
              </span>
            </button>
            <button
              type="button"
              aria-label={`Eliminar ${project.name}`}
              onClick={() => {
                if (window.confirm(`¿Eliminar "${project.name}" de este navegador?`)) {
                  void deleteProject(project.id).then(refresh);
                }
              }}
              className="rounded p-2 text-muted hover:bg-surface-2 hover:text-danger"
            >
              <Trash2 className="size-4" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
