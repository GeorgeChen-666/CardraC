import { expect } from 'vitest';

export const getPageSize = (page) => ({
  maxWidth: page.width,
  maxHeight: page.height,
});

const matchesSegment = (line, segment, epsilon = 0.1) => (
  Math.abs(line.x1 - segment.x1) < epsilon &&
  Math.abs(line.y1 - segment.y1) < epsilon &&
  Math.abs(line.x2 - segment.x2) < epsilon &&
  Math.abs(line.y2 - segment.y2) < epsilon
);

const hasDashPattern = (line, dashPattern) => {
  if (dashPattern === undefined) return true;
  return JSON.stringify(line.dashPattern ?? null) === JSON.stringify(dashPattern);
};

export const findMatchingLines = (lines, segment, { dashPattern, epsilon = 0.1 } = {}) => (
  lines.filter(line => matchesSegment(line, segment, epsilon) && hasDashPattern(line, dashPattern))
);

export const expectExactSegments = (lines, expectedSegments, options = {}) => {
  expect(lines).toHaveLength(expectedSegments.length);
  expectedSegments.forEach(segment => {
    expect(findMatchingLines(lines, segment, options)).toHaveLength(1);
  });
};

export const isCenterFoldDash = (line) => (
  Array.isArray(line.dashPattern) &&
  line.dashPattern.length === 1 &&
  line.dashPattern[0] === 0.5
);

export const createSplitLineSegments = ({ width, height, columns, rows, offsetX, offsetY }) => {
  const cellWidth = width / columns;
  const cellHeight = height / rows;

  return [
    ...Array.from({ length: columns - 1 }, (_, index) => ({
      x1: (index + 1) * cellWidth + offsetX,
      y1: 0,
      x2: (index + 1) * cellWidth + offsetX,
      y2: height,
    })),
    ...Array.from({ length: rows - 1 }, (_, index) => ({
      x1: 0,
      y1: (index + 1) * cellHeight + offsetY,
      x2: width,
      y2: (index + 1) * cellHeight + offsetY,
    })),
  ];
};

export const createCrossSegments = (rect, crossLength = 1) => ([
  { x1: rect.x - crossLength, y1: rect.y, x2: rect.x + crossLength, y2: rect.y },
  { x1: rect.x, y1: rect.y - crossLength, x2: rect.x, y2: rect.y + crossLength },
  { x1: rect.x - crossLength + rect.width, y1: rect.y, x2: rect.x + crossLength + rect.width, y2: rect.y },
  { x1: rect.x + rect.width, y1: rect.y - crossLength, x2: rect.x + rect.width, y2: rect.y + crossLength },
  { x1: rect.x - crossLength, y1: rect.y + rect.height, x2: rect.x + crossLength, y2: rect.y + rect.height },
  { x1: rect.x, y1: rect.y - crossLength + rect.height, x2: rect.x, y2: rect.y + crossLength + rect.height },
  { x1: rect.x - crossLength + rect.width, y1: rect.y + rect.height, x2: rect.x + crossLength + rect.width, y2: rect.y + rect.height },
  { x1: rect.x + rect.width, y1: rect.y - crossLength + rect.height, x2: rect.x + rect.width, y2: rect.y + crossLength + rect.height },
]);


