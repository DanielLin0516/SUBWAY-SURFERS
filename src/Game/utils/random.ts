export function shuffleArray(array: any[]) {
  for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1)); // 生成 0 到 i 之间的随机索引
      [array[i], array[j]] = [array[j], array[i]]; // 交换元素
  }
  return array;
}