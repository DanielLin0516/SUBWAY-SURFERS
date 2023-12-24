import { Scene } from 'three';

export class GameScene {
  scene!: THREE.Scene;
  constructor() {
    this.scene = new Scene();
  }

  update() { }
}