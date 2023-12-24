import Game from "./index";
import * as THREE from "three";

export default class Renderer {
  game;
  sizes;
  scene;
  canvas;
  camera;
  renderer!: THREE.WebGLRenderer;
  constructor() {
    this.game = new Game();
    this.sizes = this.game.sizes;
    this.scene = this.game.scene;
    this.canvas = this.game.canvas;
    this.camera = this.game.camera.perspectiveCamera;
    this.setRenderer();
  }

  setRenderer() {
    this.renderer = new THREE.WebGL1Renderer({
      canvas: this.canvas,
      antialias: true
    })
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;;
    this.renderer.toneMapping = THREE.LinearToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.renderer.shadowMap.enabled = true;
    this.renderer.setClearColor(new THREE.Color(0.529, 0.808, 0.922), 1);
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setSize(this.sizes.width, this.sizes.height);
    this.renderer.setPixelRatio(this.sizes.pixelRatio);
  }

  resize() {
    this.renderer.setSize(this.sizes.width, this.sizes.height);
    this.renderer.setPixelRatio(this.sizes.pixelRatio);
  }

  update() {
    this.renderer.render(this.scene, this.camera);
  }
  dispose() {
    this.renderer.dispose();
  }
}