import { zipSync } from 'fflate';
import { filename, type Project } from '../project/schema';
import { sources } from './browser';
import { download } from './download';
import { generateComponentBundle, type ComponentBundle } from './component';
export function prepareComponentBundle(project: Project, pageId: string, nodeId: string): Promise<ComponentBundle> {
  return generateComponentBundle(project, pageId, nodeId, sources);
}
export function downloadComponentBundle(bundle: ComponentBundle, projectName: string): void {
  download(filename(projectName + '-' + bundle.selection.kind + '-component') + '.zip', zipSync(bundle.files), 'application/zip');
}
