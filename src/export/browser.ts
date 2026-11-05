import { zipSync } from 'fflate';
import { download } from './download';
import { generateProject, type Sources } from './generate';
import { filename, type Project } from '../project/schema';
import { getStudioProject } from '../project/storage';
const raw = import.meta.glob(['../../templates/base/**/*', '../../templates/base/**/.*', '../../templates/auth/**/*', '../../templates/auth/**/.*', '../../templates/contact/**/*', '../../templates/contact/**/.*', '../../templates/cms/**/*', '../../templates/cms/**/.*', '../../templates/cms-common/**/*', '../../templates/portfolio/**/*', '../../templates/articles/**/*', '../site/*.tsx', '../site/authored-style.ts', '../site/layout-utils.ts', '../site/collection-designs.ts', '../site/site.css', '../project/schema.ts', '../project/appearance-schema.ts', '../project/service-schema.ts', '../project/portfolio-schema.ts', '../project/article-schema.ts', '../project/link-schema.ts', '../project/icon-schema.ts', '../project/theme.ts'], { query: '?raw', import: 'default', eager: true }) as Record<string,string>;
export const sources: Sources = Object.fromEntries(Object.entries(raw).map(([path, value]) => [path.startsWith('../../') ? path.slice(6) : 'src/' + path.slice(3), value]));
export async function downloadProject(p: Project) {
  const result = await generateProject(await getStudioProject(p), sources);
  download(filename(p.name) + '.zip', zipSync(result.files), 'application/zip');
}
