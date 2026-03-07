import fs from 'fs';
import { glob } from 'glob';
import path from 'path';
import {
	logger,
	minifyCss,
	minifyHtml,
	minifyImages,
	minifyJs,
	minifySvg,
} from './modules/index.js';
const fsp = fs.promises;

async function build() {
	const srcDir = 'src';
	// gather page HTML files but ignore layout partials
	let htmlFiles = await glob(`${srcDir}/**/*.html`);
	htmlFiles = htmlFiles.filter((f) => !f.includes(`${srcDir}/partials/`));
	const distDir = 'dist';

	// clean dist directory
	if (fs.existsSync(distDir)) {
		await fsp.rm(distDir, { recursive: true, force: true });
		logger.info('Cleaned dist directory');
	}

	if (!fs.existsSync(distDir)) await fsp.mkdir(distDir, { recursive: true });

	// run minifiers and receive size info
	// also scan JS for classes that may appear dynamically
	let contentPaths = [...htmlFiles];
	const jsFiles = await glob(`${srcDir}/js/**/*.js`);
	contentPaths.push(...jsFiles);
	const cssResult = await minifyCss(distDir, srcDir, contentPaths);
	const jsResult = await minifyJs(htmlFiles, distDir, srcDir);
	const imgResult = await minifyImages(srcDir, distDir);
	const svgResult = await minifySvg(srcDir, distDir);

	// copy layout partials to dist so client-side injection can fetch them
	const partialDir = path.join(srcDir, 'partials');
	const distPartialDir = path.join(distDir, 'partials');
	if (fs.existsSync(partialDir)) {
		await fsp.mkdir(distPartialDir, { recursive: true });
		// copy each file, preserve relative structure
		const partialFiles = await glob(`${partialDir}/**/*`);
		for (const file of partialFiles) {
			const rel = path.relative(partialDir, file);
			const dest = path.join(distPartialDir, rel);
			await fsp.mkdir(path.dirname(dest), { recursive: true });
			await fsp.copyFile(file, dest);
		}
	}

	//  Check if paths actually exist before accessing index [0]
	if (!cssResult.paths || cssResult.paths.length === 0) {
		logger.error(
			'CSS Minification failed: no output path returned. Check your input CSS.',
		);
		process.exit(1);
	}

	const minifiedCss = cssResult.paths[0]; // Safer than destructuring
	const minifiedScript = jsResult.paths[0];

	await minifyHtml(htmlFiles, minifiedCss, minifiedScript, distDir, srcDir);

	// compute html before/after sizes
	let htmlBefore = 0,
		htmlAfter = 0;
	for (const file of htmlFiles) {
		const content = await fsp.readFile(file, 'utf-8');
		htmlBefore += content.length;
		const outPath = path.join(distDir, path.basename(file));
		if (fs.existsSync(outPath)) htmlAfter += fs.statSync(outPath).size;
	}

	logger.info('Build completed successfully!');
	const htmlColor = htmlAfter < htmlBefore ? 'green' : 'red';
	logger.info(
		`HTML size: ` +
		logger.colorize(`${htmlBefore}→${htmlAfter}`, htmlColor) +
		' bytes',
	);
	const cssColor = cssResult.after < cssResult.before ? 'green' : 'red';
	logger.info(
		`Minified CSS: ${minifiedCss} (` +
		logger.colorize(
			`${cssResult.before}→${cssResult.after}`,
			cssColor,
		) +
		` bytes)`,
	);
	const jsColor = jsResult.after < jsResult.before ? 'green' : 'red';
	logger.info(
		`Minified JS: ${minifiedScript} (` +
		logger.colorize(`${jsResult.before}→${jsResult.after}`, jsColor) +
		` bytes)`,
	);
	const imgColor = imgResult.after < imgResult.before ? 'green' : 'red';
	logger.info(
		`Minified Images: ${imgResult.paths} (` +
		logger.colorize(
			`${imgResult.before}→${imgResult.after}`,
			imgColor,
		) +
		` bytes)`,
	);
	const svgColor = svgResult.after < svgResult.before ? 'green' : 'red';
	logger.info(
		`Minified SVGs: ${svgResult.paths} (` +
		logger.colorize(
			`${svgResult.before}→${svgResult.after}`,
			svgColor,
		) +
		` bytes)`,
	);
	logger.info(`Total size: ${getDirectorySize(distDir)} bytes`);
	logger.info(`Dist directory: ${distDir}`);
}

function getDirectorySize(dir) {
	let total = 0;
	const files = fs.readdirSync(dir, { withFileTypes: true });
	for (const file of files) {
		const fullPath = path.join(dir, file.name);
		if (file.isDirectory()) {
			total += getDirectorySize(fullPath);
		} else {
			total += fs.statSync(fullPath).size;
		}
	}
	return total;
}

await build().catch((error) => {
	logger.error('Error during build:', error);
	process.exit(1);
});
