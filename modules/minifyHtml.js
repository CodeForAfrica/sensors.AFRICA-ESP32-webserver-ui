import fs from 'fs';
import { minify } from 'html-minifier-next';
import path from 'path';
import { logger } from './logger.js';
const fsp = fs.promises;

async function minifyHtml(htmlFiles, minifiedCss, minifiedScript, distDir) {
	const minifiedPaths = [];

	if (!minifiedCss || !minifiedScript) {
		logger.error(`Invalid asset paths: CSS=${minifiedCss}, JS=${minifiedScript}`);
		throw new Error("CSS or Script path is undefined. Check build.js return values.");
	}

	const cssBasename = path.basename(minifiedCss);
	const jsBasename = path.basename(minifiedScript);

	logger.info(`Injecting assets: CSS=${cssBasename}, JS=${jsBasename}`);

	for (const htmlFile of htmlFiles) {
		let content = await fsp.readFile(htmlFile, 'utf-8');
		const fileName = path.basename(htmlFile);

		// Regex for Stylesheets (handles extra attributes and no-quotes)
		content = content.replace(
			/<link\b[^>]*?rel=["']?stylesheet["']?[^>]*?href=["']?([^"'>\s]+)["']?[^>]*?\/?>/gi,
			`<link rel="stylesheet" href="${cssBasename}">`
		);

		// Regex for Scripts (handles type="module", extra attributes, and no-quotes)
		content = content.replace(
			/<script\b[^>]*?src=["']?([^"'>\s]+)["']?[^>]*?><\/script>/gi,
			`<script type="module" src="${jsBasename}"></script>`
		);

		// Perform HTML Minification
		const minifiedContent = await minify(content, {
			preset: 'comprehensive', // Recommended for maximum savings
			minifyJS: { engine: 'swc' }, // High-performance JS engine
			minifyCSS: true,
		});

		const minifiedPath = path.join(distDir, fileName);
		await fsp.writeFile(minifiedPath, minifiedContent, 'utf-8');

		logger.info(`Minified: ${fileName} (${minifiedContent.length} bytes)`);
		logger.debug({
			input: htmlFile,
			output: minifiedPath,
			inBytes: content.length,
			outBytes: minifiedContent.length,
		});
		minifiedPaths.push(minifiedPath);
	}

	return minifiedPaths;
}

export { minifyHtml };
