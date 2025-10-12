import { defineConfig } from 'tsup';
import { copyFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  minify: false,
  target: 'node18',
  outDir: 'dist',
  splitting: false,
  treeshake: true,
  onSuccess: async () => {
    // Copy knowledge base files to dist directory
    const knowledgeBaseFiles = [
      'prompts.md',
      'schemas.md', 
      'forms.md'
    ];
    
    const sourceDir = join(__dirname, '../../../docs/knowledge_base');
    const targetDir = join(__dirname, 'dist/docs/knowledge_base');
    
    // Create target directory if it doesn't exist
    if (!existsSync(targetDir)) {
      mkdirSync(targetDir, { recursive: true });
    }
    
    // Copy each knowledge base file
    for (const file of knowledgeBaseFiles) {
      const sourcePath = join(sourceDir, file);
      const targetPath = join(targetDir, file);
      
      if (existsSync(sourcePath)) {
        copyFileSync(sourcePath, targetPath);
        console.log(`Copied ${file} to dist/docs/knowledge_base/`);
      } else {
        console.warn(`Warning: ${sourcePath} not found`);
      }
    }
  },
});
