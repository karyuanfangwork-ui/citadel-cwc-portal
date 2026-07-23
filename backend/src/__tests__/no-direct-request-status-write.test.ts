/**
 * Task 15 architecture gate: production Request.status writes are legal only
 * inside workflowCommand.service.ts. Uses the TypeScript AST so formatting,
 * spread objects, data aliases, and tx.request delegates cannot bypass it.
 */

import fs from 'fs';
import path from 'path';
import ts from 'typescript';

const SRC_DIR = path.resolve(__dirname, '../../src');
const COMMAND_BOUNDARY = path.join('services', 'workflowCommand.service.ts');

interface Violation {
  file: string;
  line: number;
}

function propertyName(node: ts.PropertyName): string | undefined {
  if (ts.isIdentifier(node) || ts.isStringLiteral(node) || ts.isNumericLiteral(node)) return node.text;
  return undefined;
}

function unwrap(node: ts.Expression): ts.Expression {
  if (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node) || ts.isParenthesizedExpression(node)) {
    return unwrap(node.expression);
  }
  return node;
}

function scanFile(filePath: string): Violation[] {
  const source = fs.readFileSync(filePath, 'utf8');
  const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const declarations = new Map<string, ts.Expression[]>();
  const statusAssignments = new Set<string>();

  const collect = (node: ts.Node): void => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      const existing = declarations.get(node.name.text) ?? [];
      existing.push(node.initializer);
      declarations.set(node.name.text, existing);
    }
    if (
      ts.isBinaryExpression(node)
      && node.operatorToken.kind === ts.SyntaxKind.EqualsToken
      && ts.isPropertyAccessExpression(node.left)
      && ts.isIdentifier(node.left.expression)
      && node.left.name.text === 'status'
    ) {
      statusAssignments.add(node.left.expression.text);
    }
    ts.forEachChild(node, collect);
  };
  collect(sourceFile);

  const expressionWritesStatus = (raw: ts.Expression, seen = new Set<string>()): boolean => {
    const expression = unwrap(raw);
    if (ts.isObjectLiteralExpression(expression)) {
      return expression.properties.some((property) => {
        if (ts.isPropertyAssignment(property)) {
          return propertyName(property.name) === 'status'
            || expressionWritesStatus(property.initializer, new Set(seen));
        }
        if (ts.isShorthandPropertyAssignment(property)) return property.name.text === 'status';
        if (ts.isSpreadAssignment(property)) return expressionWritesStatus(property.expression, new Set(seen));
        return false;
      });
    }
    if (ts.isIdentifier(expression)) {
      if (seen.has(expression.text)) return false;
      seen.add(expression.text);
      if (statusAssignments.has(expression.text)) return true;
      return (declarations.get(expression.text) ?? [])
        .some((initializer) => expressionWritesStatus(initializer, new Set(seen)));
    }
    if (ts.isConditionalExpression(expression)) {
      return expressionWritesStatus(expression.whenTrue, new Set(seen))
        || expressionWritesStatus(expression.whenFalse, new Set(seen));
    }
    return false;
  };

  const violations: Violation[] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node)
      && ts.isPropertyAccessExpression(node.expression)
      && (node.expression.name.text === 'update' || node.expression.name.text === 'updateMany')
      && ts.isPropertyAccessExpression(node.expression.expression)
      && node.expression.expression.name.text === 'request'
    ) {
      const argument = node.arguments[0] ? unwrap(node.arguments[0]) : undefined;
      if (argument && ts.isObjectLiteralExpression(argument)) {
        const dataProperty = argument.properties.find(
          (property): property is ts.PropertyAssignment =>
            ts.isPropertyAssignment(property) && propertyName(property.name) === 'data',
        );
        if (dataProperty && expressionWritesStatus(dataProperty.initializer)) {
          const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
          violations.push({ file: path.relative(SRC_DIR, filePath), line });
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return violations;
}

function productionTsFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__') return [];
      return productionTsFiles(fullPath);
    }
    if (!entry.isFile() || !entry.name.endsWith('.ts') || /\.(test|spec)\.ts$/.test(entry.name)) return [];
    return [fullPath];
  });
}

describe('Architecture: Request.status writes use the versioned command boundary', () => {
  it('has zero production writes outside workflowCommand.service.ts', () => {
    const violations = productionTsFiles(SRC_DIR)
      .filter((file) => !file.endsWith(COMMAND_BOUNDARY))
      .flatMap(scanFile)
      .sort((left, right) => left.file.localeCompare(right.file) || left.line - right.line);

    expect(violations).toEqual([]);
  });
});