type RenderedNode = { type: unknown; children: (RenderedNode | string)[] };

/**
 * Whether a rendered lucide icon is `CircleAlert`: a circle and two lines (`CircleX` draws two paths instead).
 * Pass the element found by its testID (hidden icons need `includeHiddenElements`).
 */
export function drawsCircleAlert(icon: object): boolean {
  const hasLine = (node: RenderedNode): boolean =>
    node.type === 'RNSVGLine' || node.children.some((child) => typeof child !== 'string' && hasLine(child));
  return hasLine(icon as RenderedNode);
}
