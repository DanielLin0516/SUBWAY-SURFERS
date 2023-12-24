import Game from '.';
import * as THREE from 'three';
import {textureload, load3DModel} from '@/Game/utils/model';
import {shuffleArray} from '@/Game/utils/random';
// import {OctreeHelper} from 'three/examples/jsm/helpers/OctreeHelper.js';
export const roadWidth = 15;
export const roadLength = 330;
const threeRoad = [-roadWidth / 3, 0, roadWidth / 3];
const [house1SceneX, house1SceneY, house1RightRotation] = [roadWidth * 1.9, 0, Math.PI];
const [house2SceneX, house2SceneY, house2RightRotation] = [roadWidth * 1.6, 0, Math.PI];
const [house3SceneX, house3SceneY, house3RightRotation] = [roadWidth * 1.08, 10, Math.PI / 2];
const [house4SceneX, house4SceneY, house4RightRotation] = [roadWidth * 1.5, 0, Math.PI];
const [house5SceneX, house5SceneY, house5RightRotation] = [roadWidth * 1.2, 0, Math.PI];

// 所有环境配置
export default class Environment {
    static instance: Environment;
    game!: Game;
    scene: THREE.Scene = new THREE.Scene();
    planeGroup: THREE.Group = new THREE.Group();
    plane: THREE.Object3D[] = [];
    obstacal: THREE.Object3D[] = [];
    coin: THREE.Object3D[] = [];
    z!: number;
    house1Scene: any;
    house2Scene: any;
    house3Scene: any;
    house4Scene: any;
    house5Scene: any;

    constructor() {
        if (Environment.instance) {
            return Environment.instance;
        }
        Environment.instance = this;
        this.game = new Game();
        this.scene = this.game.scene;
        this.z = -1 * (roadLength / 2) + 10;
        this.startGame();
    }
    // 开始游戏环境配置
    startGame() {
        this.plane = [];
        this.obstacal = [];
        this.coin = [];
        this.setAmbientLight();
        this.setGroupScene(this.z, -5, true);
    }

    setGroupScene(z: number, houseZ: number, isloadAgain: boolean) {
        const modelGroup = new THREE.Group();
        // 设置地面
        this.setPlane(modelGroup, z);
        // 设置左右房屋
        this.loadmodelAndSize(modelGroup, houseZ, isloadAgain);
        // 设置障碍物
        this.loadObstacle(modelGroup, houseZ);
        this.scene.add(modelGroup);
    }
    // 设置环境光
    setAmbientLight() {
        const ambientLight = new THREE.AmbientLight(0xffffff);
        ambientLight.position.set(0, 10, 0);
        this.scene.add(ambientLight);
    }

    async setPlane(modelGroup: THREE.Group, z: number) {
        this.planeGroup = new THREE.Group();
        const [planeTexure, planeTexure1] = await Promise.all([
            await textureload('/assets/png/railway_texture.png'),
            await textureload('/assets/png/stone.png'),
        ]);
        planeTexure.colorSpace = THREE.SRGBColorSpace;
        planeTexure.rotation = -Math.PI / 2;
        planeTexure.wrapS = THREE.RepeatWrapping;
        planeTexure.wrapT = THREE.RepeatWrapping;
        planeTexure.repeat.set(roadWidth * 3, 3);
        const planGeometry = new THREE.PlaneGeometry(roadWidth, roadLength, 1, 1);
        const planMaterial = new THREE.MeshPhongMaterial({
            map: planeTexure,
        });
        const plane = new THREE.Mesh(planGeometry, planMaterial);
        plane.name = 'plane';
        plane.rotation.x = -Math.PI / 2;
        plane.position.set(0, 0, z);
        plane.receiveShadow = true;
        plane.castShadow = true;
        this.plane.push(plane);
        planeTexure1.rotation = -Math.PI / 2;
        planeTexure1.wrapS = THREE.RepeatWrapping;
        planeTexure1.wrapT = THREE.RepeatWrapping;
        planeTexure1.repeat.set(120, 30);
        const planGeometry1 = new THREE.PlaneGeometry(60, roadLength);
        const planMaterial1 = new THREE.MeshBasicMaterial({
            map: planeTexure1,
        });
        const plane1 = new THREE.Mesh(planGeometry1, planMaterial1);
        plane1.rotation.x = -Math.PI / 2;
        plane1.position.set(0, -0.01, z);
        const planGeometry2 = new THREE.PlaneGeometry(60, roadLength);
        const planMaterial2 = new THREE.MeshBasicMaterial({});
        const plane2 = new THREE.Mesh(planGeometry2, planMaterial2);
        plane2.position.set(roadWidth / 2, 3, -1 * (roadLength / 2) + 10);
        const plane3 = new THREE.Mesh(planGeometry2, planMaterial2);
        plane3.rotation.x = -Math.PI / 2;
        plane3.rotation.y = Math.PI / 2;
        plane3.position.set(-1 * (roadWidth / 2), 3, -1 * (roadLength / 2) + 10);
        modelGroup.add(plane);
        modelGroup.add(plane1);
    }
    async loadObstacle(modelGroup: THREE.Group, houseZ: number) {
        // 参与碰撞检测的组
        const obstacalGroup = new THREE.Group();
        // 不参与碰撞检测的组
        const sceneGroup = new THREE.Group();
        const [
            {scene: train},
            {scene: kerbStone},
            {scene: coin},
        ] = await Promise.all([
            await load3DModel('/assets/glb/train.glb'),
            await load3DModel('/assets/glb/kerb_stone.glb'),
            await load3DModel('/assets/glb/coin.glb'),
        ]);
        this.setThingName(train, 'train');
        this.setThingName(kerbStone, 'kerbStone');
        const planGeometry = new THREE.PlaneGeometry(5, 10);
        const planGeometry1 = new THREE.PlaneGeometry(5, 19);
        const planGeometry2 = new THREE.PlaneGeometry(5, 18);
        const planMaterial = new THREE.MeshPhongMaterial({
            opacity: 0,
            transparent: true,
        });
        train.scale.set(0.3, 0.3, 0.3);
        const trainSizeZ = this.comupteBox(train).z;

        let obstacle = houseZ - 20;
        let i = -1;
        let increase = true;
        // 放置静态火车
        while (obstacle > houseZ - roadLength) {
            if (i >= -1 && i < 2 && increase) {
                i++;
            }
            else if (i === 2) {
                increase = false;
                i--;
            }
            else if (!increase) {
                i--;
                if (i === -1) {
                    increase = true;
                }
            }
            this.cloneModel(train, threeRoad[i], 0, obstacle, Math.PI, obstacalGroup);
            const plane = new THREE.Mesh(planGeometry1, planMaterial);
            const plane1 = new THREE.Mesh(planGeometry2, planMaterial);
            const plane2 = new THREE.Mesh(planGeometry2, planMaterial);
            plane1.rotation.x = -Math.PI / 2;
            plane2.rotation.x = -Math.PI / 2;
            plane.position.set(threeRoad[i], 0, obstacle + 8);
            plane1.position.set(threeRoad[i], 8.4, obstacle);
            plane2.position.set(threeRoad[i], 8.3, obstacle);
            plane.name = 'train';
            plane1.name = 'train';
            plane2.name = 'train';
            obstacalGroup.add(plane, plane1, plane2);

            obstacle -= (trainSizeZ + 20);
        }

        const roadblockScene = kerbStone.clone();
        roadblockScene.scale.set(1.7, 3.5, 6);
        roadblockScene.traverse((child: any) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
                child.material.emissive = child.material.color;
                child.material.emissiveMap = child.material.map;
                child.material.metalness = 0;
            }
        });
        const blockZ = this.comupteBox(roadblockScene).z;
        let obstacleBlock = houseZ - 10;
        let j = -1;
        let increase1 = true;
        // 放置静态栅栏
        while (obstacleBlock > houseZ - roadLength) {
            if (j >= -1 && j < 2 && increase1) {
                j++;
            }
            else if (j === 2) {
                increase1 = false;
                j--;
            }
            else if (!increase1) {
                j--;
                if (j === -1) {
                    increase1 = true;
                }
            }
            this.cloneModel(roadblockScene, threeRoad[j], 0, obstacleBlock, Math.PI, obstacalGroup);

            const plane = new THREE.Mesh(planGeometry, planMaterial);
            plane.name = 'kerbStone';
            plane.position.set(threeRoad[j], 0, obstacleBlock);
            obstacalGroup.add(plane);
            obstacleBlock -= (blockZ + 25);
        }
        let coinBlock = houseZ - 5;
        let z = -1;
        let increase2 = true;
        coin.scale.set(10, 10, 10);
        coin.traverse((child: any) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
                child.material.emissive = child.material.color;
                child.material.emissiveMap = child.material.map;
                child.material.metalness = 0;
            }
        });
        this.setThingName(coin, 'coin');
        while (coinBlock > houseZ - roadLength) {
            if (z >= -1 && z < 2 && increase2) {
                z++;
            }
            else if (z === 2) {
                increase2 = false;
                z--;
            }
            else if (!increase2) {
                z--;
                if (z === -1) {
                    increase2 = true;
                }
            }
            this.cloneModel(coin, threeRoad[z], 1.5, coinBlock, Math.PI, sceneGroup);
            const randomInt = Math.floor(Math.random() * (4 - 2 + 1)) + 2;

            coinBlock -= randomInt;
        }
        this.obstacal.push(obstacalGroup);
        this.coin.push(sceneGroup);
        modelGroup.add(obstacalGroup, sceneGroup);
    }
    async loadmodelAndSize(modelGroup: THREE.Group, houseZ: number, load: boolean) {
        if (load) {
            const [
                {scene: house1Scene},
                {scene: house2Scene},
                {scene: house3Scene},
                {scene: house4Scene},
                {scene: house5Scene},
            ] = await Promise.all([
                await load3DModel('/assets/glb/house1.glb'),
                await load3DModel('/assets/glb/house2.glb'),
                await load3DModel('/assets/glb/house3.glb'),
                await load3DModel('/assets/glb/house4.glb'),
                await load3DModel('/assets/glb/house5.glb'),
            ]);
            console.log('建筑模型加载完成');
            this.house1Scene = house1Scene;
            this.house2Scene = house2Scene;
            this.house3Scene = house3Scene;
            this.house4Scene = house4Scene;
            this.house5Scene = house5Scene;
        }

        const house1Scene = this.house1Scene.clone();
        const house2Scene = this.house2Scene.clone();
        const house3Scene = this.house3Scene.clone();
        const house4Scene = this.house4Scene.clone();
        const house5Scene = this.house5Scene.clone();

        // 房子1参数
        house1Scene.scale.set(0.03, 0.03, 0.02);
        house1Scene.traverse((child: any) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
                child.material.emissive = child.material.color;
                child.material.emissiveMap = child.material.map;
            }
        });
        house1Scene.rotateY(-Math.PI / 2);
        house1Scene.position.set(roadWidth * 1.8, 0, houseZ - 5);
        const house1Size = this.comupteBox(house1Scene);
        // 房子2参数
        house2Scene.traverse((child: any) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
        house2Scene.scale.set(3, 3, 2);
        house2Scene.rotateY(Math.PI / 2);
        house2Scene.position.set(-roadWidth * 1.575, 0, houseZ - 10);
        const house2Size = this.comupteBox(house2Scene);
        // 房子3参数
        house3Scene.scale.set(10, 10, 8);
        house3Scene.rotateY(Math.PI);
        // house3Scene.position.set(-roadWidth * 1.05, 18, houseZ - 80);
        const house3Size = this.comupteBox(house3Scene);
        // 房子4参数
        house4Scene.traverse((child: any) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
                child.material.emissive = child.material.color;
                child.material.emissiveMap = child.material.map;
            }
        });
        house4Scene.rotateY((Math.PI / 2) * 2);
        house4Scene.scale.set(11, 11, 10);
        house4Scene.position.set(-roadWidth * 1.43, 0, houseZ - 35);
        const house4Size = this.comupteBox(house4Scene);
        // 房子5参数
        house5Scene.traverse((child: any) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
                child.material.emissive = child.material.color;
                child.material.emissiveMap = child.material.map;
            }
        });
        house5Scene.scale.set(0.1, 0.08, 0.1);
        house5Scene.rotateY(-Math.PI);
        house5Scene.position.set(roadWidth * 1.16, 0, houseZ - 35);
        const house5Size = this.comupteBox(house5Scene);
        let randomArray = [
            {name: 'house1Scene', scene: house1Scene},
            {name: 'house2Scene', scene: house2Scene},
            {name: 'house3Scene', scene: house3Scene},
            {name: 'house4Scene', scene: house4Scene},
            {name: 'house5Scene', scene: house5Scene},
        ];
        const sceneMap: any = {
            house1Scene: house1Size,
            house2Scene: house2Size,
            house3Scene: house3Size,
            house4Scene: house4Size,
            house5Scene: house5Size,
        };
        let j = 0;
        let rightStartHouse = houseZ;
        while (rightStartHouse > houseZ - roadLength) {
            const {name, scene} = shuffleArray(randomArray)[3];
            if (j !== 0) {
                rightStartHouse = rightStartHouse - Math.abs(sceneMap[name].z);
            }
            if (scene === house1Scene) {
                this.cloneModel(scene, house1SceneX, house1SceneY, rightStartHouse, 0, modelGroup);
            }
            else if (scene === house2Scene) {
                this.cloneModel(scene, house2SceneX, house2SceneY, rightStartHouse, 0, modelGroup);
            }
            else if (scene === house3Scene) {
                this.cloneModel(scene, house3SceneX, house3SceneY, rightStartHouse, 0, modelGroup);
            }
            else if (scene === house4Scene) {
                this.cloneModel(scene, house4SceneX, house4SceneY, rightStartHouse, 0, modelGroup);
            }
            else if (scene === house5Scene) {
                this.cloneModel(scene, house5SceneX, house5SceneY, rightStartHouse, 0, modelGroup);
            }
            j++;
            rightStartHouse -= Math.abs(sceneMap[name].z) - 20;
        }
        // for (let i = 0; i < numZ; i++) {
        //     randomArray = shuffleArray(randomArray);
        //     for (const {name, scene} of randomArray) {
        //         if (j !== 0) {
        //             rightStartHouse = rightStartHouse - Math.abs(sceneMap[name].z);
        //         }

        //         if (scene === house1Scene) {
        //             this.cloneModel(scene, house1SceneX, house1SceneY, rightStartHouse, 0, modelGroup);
        //         }
        //         else if (scene === house2Scene) {
        //             this.cloneModel(scene, house2SceneX, house2SceneY, rightStartHouse, 0, modelGroup);
        //         }
        //         else if (scene === house3Scene) {
        //             this.cloneModel(scene, house3SceneX, house3SceneY, rightStartHouse, 0, modelGroup);
        //         }
        //         else if (scene === house4Scene) {
        //             this.cloneModel(scene, house4SceneX, house4SceneY, rightStartHouse, 0, modelGroup);
        //         }
        //         else if (scene === house5Scene) {
        //             this.cloneModel(scene, house5SceneX, house5SceneY, rightStartHouse, 0, modelGroup);
        //         }
        //         j++;
        //     }
        // }
        let n = 0;
        let leftStartHouse = houseZ;
        while (leftStartHouse > houseZ - roadLength) {
            const {name, scene} = shuffleArray(randomArray)[3];
            if (n !== 0) {
                leftStartHouse = leftStartHouse - Math.abs(sceneMap[name].z);
            }
            if (scene === house1Scene) {
                this.cloneModel(
                    scene,
                    -1 * house1SceneX,
                    house1SceneY,
                    leftStartHouse,
                    house1RightRotation,
                    modelGroup
                );
            }
            else if (scene === house2Scene) {
                this.cloneModel(
                    scene,
                    -1 * house2SceneX,
                    house2SceneY,
                    leftStartHouse,
                    house2RightRotation,
                    modelGroup
                );
            }
            else if (scene === house3Scene) {
                this.cloneModel(
                    scene,
                    -1 * house3SceneX,
                    house3SceneY,
                    leftStartHouse,
                    house3RightRotation,
                    modelGroup
                );
            }
            else if (scene === house4Scene) {
                this.cloneModel(
                    scene,
                    -1 * house4SceneX,
                    house4SceneY,
                    leftStartHouse,
                    house4RightRotation,
                    modelGroup
                );
            }
            else if (scene === house5Scene) {
                this.cloneModel(
                    scene,
                    -1 * house5SceneX,
                    house5SceneY,
                    leftStartHouse,
                    house5RightRotation,
                    modelGroup
                );
            }
            n++;
            leftStartHouse -= Math.abs(sceneMap[name].z) - 20;
        }
    }

    comupteBox(scene: THREE.Group) {
        // 计算模型的包围盒
        const boundingBox = new THREE.Box3().setFromObject(scene);
        // 获取包围盒的尺寸
        const size = new THREE.Vector3();
        boundingBox.getSize(size);
        const modelWidth = size.x; // 模型的宽度
        const modelHeight = size.y; // 模型的高度
        const modelDepth = size.z; // 模型的深度
        const modelSize = {
            x: modelWidth,
            y: modelHeight,
            z: modelDepth,
            center: new THREE.Vector3(modelWidth / 2, 0, modelDepth / 2),
        };
        return modelSize;
    }
    setThingName(group: THREE.Group, name = '') {
        group.traverse((child: any) => {
            if (child.isMesh) {
                child.name = name;
            }
        });
    }
    cloneModel(
        obj: any,
        x: number,
        y: number,
        z: number,
        rotation: number,
        scene: THREE.Group,
        collision?: false
    ) {
        const cloneObj = obj.clone();
        cloneObj.children.map((v: any, i: number) => {
            if (v.material) {
                // @ts-ignore
                v.material = obj.children[i].material.clone();
            }
        });
        rotation && cloneObj.rotateY(rotation);
        cloneObj.position.set(x, y, z);
        if (collision) {

        }
        scene.add(cloneObj);
        return cloneObj;
    }
}
