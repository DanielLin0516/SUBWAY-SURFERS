// 移除mesh, 释放内存
export function disposeNode(node: any, recursive = true) {
  if (!node) {
      return;
  }
  if (recursive && node.children) {
      for (let i = node.children.length - 1; i >= 0; i--) {
          const child = node.children[i];
          disposeNode(child, recursive);
      }
  }
  node.geometry && node.geometry.dispose();
  node.texture && node.texture.dispose();
  if (node.material) {
      node.material.dispose();
      node.material.map && node.material.map.dispose();
  }
  node.removeFromParent();
}