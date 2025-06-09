const fs = require('fs');
const path = require('path');
const { cwd } = require('process');
const jsyaml = require('js-yaml');
const elementsDir = cwd() + '/node_modules/@zerobias-org/framework-cncf-sscp-v1/elements';
console.log(path.resolve(elementsDir));
const map = {};

fs.readdirSync(elementsDir).forEach(filename => {
  const filePath = path.join(elementsDir, filename);
  if (fs.statSync(filePath).isFile() && filename.endsWith('.yml')) {
    const content = jsyaml.load(fs.readFileSync(filePath, 'utf8'));
    if (content.externalId) {
      map[content.externalId] = filename.replace(".yml", "");
    }
  }
});

const elementsYamlPath = path.join(cwd(), 'elements.yml');
const elementsData = jsyaml.load(fs.readFileSync(elementsYamlPath, 'utf8'));

if (Array.isArray(elementsData.elements)) {
  elementsData.elements.forEach(element => {
    console.log(`Processing element: ${element.sourceElement}`);
    element.sourceElement = map[element.sourceElement] || element.sourceElement;
  });
}

fs.writeFileSync(
  elementsYamlPath,
  jsyaml.dump(elementsData, { lineWidth: -1 })
);


