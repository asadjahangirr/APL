import { filename, type Project } from '../project/schema';
import { getStudioProject } from '../project/storage';
import { readStudioProject, type StudioProject } from '../project/studio-document';
import { legacyV8StudioSchema, type LegacyV8StudioProject } from '../project/legacy-v8-studio';
export function download(name: string, bytes: Uint8Array, type = 'application/octet-stream') {
  const url = URL.createObjectURL(new Blob([bytes as Uint8Array<ArrayBuffer>], { type }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
export async function downloadBackup(p: Project) {
  const studio = await getStudioProject(p);
  download(filename(studio.name) + '.apl.json', new TextEncoder().encode(JSON.stringify(studio, null, 2)), 'application/json');
}
export async function downloadWorkspace(projects: (Project | StudioProject | LegacyV8StudioProject)[]) {
  const { zipSync } = await import('fflate');
  const files: Record<string, Uint8Array> = {};
  const studios = await Promise.all(projects.map(p => {
    if ('website' in p) {
      // Keep the frozen v8 recovery envelope intact; normalize current Studio
      // documents through the actual current schema before archiving them.
      return p.schemaVersion === 8 ? legacyV8StudioSchema.parse(p) : readStudioProject(p);
    }
    return getStudioProject(p);
  }));
  for (const studio of studios) files[studio.id + '.apl.json'] = new TextEncoder().encode(JSON.stringify(studio, null, 2));
  files['RESTORE.txt'] = new TextEncoder().encode('APL workspace backup\n\nEach .apl.json contains the editable Design and Website documents, including uploaded image data and any confirmed conversion records. Frozen recovery archives retain their original document format. Extract this ZIP. In APL Studio, choose Import backup and select an .apl.json file. Each import creates an independent copy and never replaces a saved project. Repeat for the projects you want to restore.\n\nProjects remain local to your browser. Keep this ZIP outside the browser before clearing browser data.\n');
  download('apl-workspace-backup.zip', zipSync(files), 'application/zip');
}
