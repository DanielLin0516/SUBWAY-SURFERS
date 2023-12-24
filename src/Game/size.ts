
import { EventEmitter } from 'events';
export default class Sizes extends EventEmitter{
  width: number;
  height: number;
  aspect: any;
  pixelRatio: any;
  frustrum: any;

  constructor() {
    super();
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.aspect = this.width / this.height;
    this.pixelRatio = Math.min(window.devicePixelRatio, 2);
    this.frustrum = 5;
    
    window.addEventListener("resize", () => {
      this.width = window.innerWidth;
      this.height = window.innerHeight;
      this.aspect = this.width / this.height;
      this.pixelRatio = Math.min(window.devicePixelRatio, 2);
      super.emit("resize"); 
    })
  }
}