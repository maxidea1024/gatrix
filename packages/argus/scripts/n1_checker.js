const ts = require("typescript");
const fs = require("fs");
const path = require("path");

function findNPlusOne(dir) {
  const files = [];
  function getFiles(d) {
    const items = fs.readdirSync(d);
    for (const item of items) {
      const fullPath = path.join(d, item);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        getFiles(fullPath);
      } else if (fullPath.endsWith(".ts")) {
        files.push(fullPath);
      }
    }
  }
  getFiles(dir);

  const results = [];

  for (const file of files) {
    const content = fs.readFileSync(file, "utf8");
    const sourceFile = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true);

    function visit(node, loopContext) {
      // Loop context can be a loop or a Promise.all(.map)
      let currentContext = loopContext;

      if (
        ts.isForStatement(node) ||
        ts.isForOfStatement(node) ||
        ts.isForInStatement(node) ||
        ts.isWhileStatement(node) ||
        ts.isDoStatement(node) ||
        (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && 
         (node.expression.name.text === "map" || node.expression.name.text === "forEach"))
      ) {
        currentContext = true;
      }

      const isQuery = 
        ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) &&
        (node.expression.expression.getText(sourceFile) === "mysqlPool" || node.expression.expression.getText(sourceFile) === "clickhouse") &&
        (node.expression.name.text === "query" || node.expression.name.text === "execute" || node.expression.name.text === "insert");

      if (isQuery && currentContext) {
        const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
        results.push({ file, line: line + 1, text: node.getText(sourceFile).split('\n')[0].substring(0, 80) });
      }

      ts.forEachChild(node, child => visit(child, currentContext));
    }

    visit(sourceFile, false);
  }

  return results;
}

const res = findNPlusOne(path.join(process.cwd(), "src"));
console.log(JSON.stringify(res, null, 2));
