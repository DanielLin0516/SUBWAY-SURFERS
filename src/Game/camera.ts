import Game from ".";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export default class Camera {
  game: Game;
  sizes;
  scene;
  canvas;
  perspectiveCamera!: THREE.PerspectiveCamera;
  controls: any;


  constructor() {
    this.game = new Game();
    this.sizes = this.game.sizes;
    this.scene = this.game.scene;
    this.canvas = this.game.canvas;
    this.createPerspectiveCamera();
    // this.setOrbitControls();
  }

  public createPerspectiveCamera() {
    this.perspectiveCamera = new THREE.PerspectiveCamera(45, this.sizes.aspect, 0.1, 200);
    // this.game.camera = this.perspectiveCamera;
    this.scene.add(this.perspectiveCamera);
  }


  setOrbitControls() {
    this.controls = new OrbitControls(this.perspectiveCamera, this.canvas);
    this.controls.enableDamping = true;
    this.controls.enableZoom = false;
  }
  resize() {
    this.perspectiveCamera.aspect = this.sizes.aspect;
    this.perspectiveCamera.updateProjectionMatrix();
  }

  update() {
  }
}