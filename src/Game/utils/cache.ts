export class Cache {
  cacheData!: Record<string, any>;

  constructor() {
      this.initData();
  }

  initData() {
      this.cacheData = {};
  }

  clearCacheData() {
      this.initData();
  }
}