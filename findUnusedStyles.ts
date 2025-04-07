import * as fs from 'fs';
import * as path from 'path';

interface StyleDefinition {
  name: string;
  file: string;
  used: boolean;
}

function getAllFiles(dir: string): string[] {
  const files: string[] = [];

  try {
    const items = fs.readdirSync(dir);

    for (const item of items) {
      try {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);

        if (
          stat.isDirectory() &&
          !fullPath.includes('node_modules') &&
          !fullPath.includes('.git') &&
          !fullPath.includes('ios/Pods') &&
          !fullPath.includes('android/build')
        ) {
          files.push(...getAllFiles(fullPath));
        } else if (
          stat.isFile() &&
          (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx'))
        ) {
          files.push(fullPath);
        }
      } catch (error: any) {
        // Skip files/directories that can't be accessed
        continue;
      }
    }
  } catch (error: any) {
    console.error(`Warning: Could not read directory ${dir}: ${error.message}`);
  }

  return files;
}

function extractStyleDefinitions(
  content: string,
  file: string,
): StyleDefinition[] {
  const definitions: StyleDefinition[] = [];

  // Match styles defined in objects or StyleSheet.create
  const styleRegex =
    /(?:const|let|var)\s+([A-Za-z0-9_]+)\s*=\s*(?:StyleSheet\.create\()?{([^}]+)}/g;
  let match;

  while ((match = styleRegex.exec(content)) !== null) {
    const [_, _objName, objContent] = match;
    const propertyRegex = /([A-Za-z0-9_]+)\s*:/g;
    let propMatch;

    while ((propMatch = propertyRegex.exec(objContent)) !== null) {
      definitions.push({
        name: propMatch[1],
        file,
        used: false,
      });
    }
  }

  // Match styles defined as individual exports
  const exportRegex = /export\s+const\s+([A-Za-z0-9_]+)\s*=/g;
  while ((match = exportRegex.exec(content)) !== null) {
    definitions.push({
      name: match[1],
      file,
      used: false,
    });
  }

  return definitions;
}

function findStyleUsage(searchPath: string = process.cwd()) {
  if (!fs.existsSync(searchPath)) {
    console.error(`Error: Directory "${searchPath}" does not exist`);
    process.exit(1);
  }

  const files = getAllFiles(searchPath);
  // eslint-disable-next-line no-console
  console.log(`Found ${files.length} files to analyze in ${searchPath}`);

  const styleDefinitions: StyleDefinition[] = [];
  let totalStyleFiles = 0;

  // First pass: collect all style definitions
  for (const file of files) {
    if (file.endsWith('style.ts') || file.endsWith('styles.ts')) {
      totalStyleFiles++;
      const content = fs.readFileSync(file, 'utf8');
      const definitions = extractStyleDefinitions(content, file);
      // eslint-disable-next-line no-console
      console.log(`Found ${definitions.length} style definitions in ${file}`);
      styleDefinitions.push(...definitions);
    }
  }

  // eslint-disable-next-line no-console
  console.log(
    `\nAnalyzed ${totalStyleFiles} style files, found ${styleDefinitions.length} total style definitions`,
  );

  // Second pass: check for usage
  for (const file of files) {
    if (!file.endsWith('style.ts') && !file.endsWith('styles.ts')) {
      const content = fs.readFileSync(file, 'utf8');

      for (const def of styleDefinitions) {
        // Check for direct usage of the style name
        if (content.includes(def.name)) {
          def.used = true;
        }
      }
    }
  }

  // Report unused styles
  const unusedStyles = styleDefinitions.filter(def => !def.used);
  // eslint-disable-next-line no-console
  console.log(`\nFound ${unusedStyles.length} unused styles:`);

  for (const style of unusedStyles) {
    // eslint-disable-next-line no-console
    console.log(`- ${style.name} in ${style.file}`);
  }
}

// Get the search path from command line arguments or use current working directory
const searchPath = process.argv[2] || process.cwd();
findStyleUsage(searchPath);
