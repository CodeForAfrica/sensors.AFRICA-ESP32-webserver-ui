import { minify } from 'csso';
import fs from 'fs';
import path from 'path'; // Better for cross-platform paths
import { PurgeCSS } from 'purgecss';
const fsp = fs.promises;

async function minifyCss(htmlFiles, distDir, srcDir) {
	const cssFiles = new Set();
	for (const htmlFile of htmlFiles) {
		const content = await fsp.readFile(htmlFile, 'utf-8');
		const regex =
			/<link\s+rel=["']stylesheet["']\s+href=["']([^"']+)["']\s*\/?>/g;
		let match;
		while ((match = regex.exec(content)) !== null) {
			cssFiles.add(match[1]);
		}
	}

	// Purge
	const purgeCSSResults = await new PurgeCSS().purge({
		content: htmlFiles,
		css: Array.from(cssFiles).map((file) => path.join(srcDir, file)),
	});

	// Combine & Minify in memory (don't write the unminified version)
	const combinedCss = purgeCSSResults.map((r) => r.css).join('\n');
	const minified = minify(combinedCss).css;

	// Save only the final version
	const minifiedPath = path.join(distDir, 'styles.min.css');
	await fsp.writeFile(minifiedPath, minified, 'utf-8');

	console.log(`✓ Created bundle: styles.min.css (${minified.length} bytes)`);

	return [minifiedPath];
}

export { minifyCss };
