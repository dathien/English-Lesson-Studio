import * as THREE from 'three';

/**
 * Procedural PBR Material & CanvasTexture Library (Zero external URLs, zero 404s).
 * All albedo/color textures enforce SRGBColorSpace and calibrated roughness/metalness.
 */
export class MaterialLibrary {
  private textures: THREE.Texture[] = [];
  private materials: THREE.Material[] = [];

  private registerTex<T extends THREE.Texture>(tex: T, repeatX = 1, repeatY = 1): T {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
    tex.anisotropy = 4;
    this.textures.push(tex);
    return tex;
  }

  private registerMat<T extends THREE.Material>(mat: T): T {
    this.materials.push(mat);
    return mat;
  }

  private makeCanvas(
    w: number,
    h: number,
    draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void
  ): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (ctx) draw(ctx, w, h);
    return new THREE.CanvasTexture(canvas);
  }

  standard(
    color: string | number,
    roughness = 0.65,
    metalness = 0.08,
    extra: Partial<THREE.MeshStandardMaterialParameters> = {}
  ): THREE.MeshStandardMaterial {
    return this.registerMat(
      new THREE.MeshStandardMaterial({color, roughness, metalness, ...extra})
    );
  }

  wood(base = '#9a6b42', grain = '#7c502d', repeatX = 2, repeatY = 2): THREE.MeshStandardMaterial {
    const tex = this.registerTex(
      this.makeCanvas(256, 256, (ctx, w, h) => {
        ctx.fillStyle = base;
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = grain;
        for (let y = 0; y < h; y += 8) {
          ctx.globalAlpha = 0.16 + ((y * 13) % 10) * 0.02;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.bezierCurveTo(w * 0.3, y + 3, w * 0.7, y - 3, w, y);
          ctx.stroke();
        }
        ctx.globalAlpha = 0.28;
        ctx.strokeStyle = '#5c3a1e';
        ctx.lineWidth = 2;
        for (let y = 0; y < h; y += 64) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(w, y);
          ctx.stroke();
        }
      }),
      repeatX,
      repeatY
    );
    return this.registerMat(new THREE.MeshStandardMaterial({map: tex, roughness: 0.72, metalness: 0.04}));
  }

  tileFloor(base = '#f1f5f9', grout = '#cbd5e1', repeatX = 6, repeatY = 6): THREE.MeshStandardMaterial {
    const tex = this.registerTex(
      this.makeCanvas(256, 256, (ctx, w, h) => {
        ctx.fillStyle = base;
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = grout;
        ctx.lineWidth = 4;
        for (let i = 0; i <= w; i += 64) {
          ctx.beginPath();
          ctx.moveTo(i, 0);
          ctx.lineTo(i, h);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(0, i);
          ctx.lineTo(w, i);
          ctx.stroke();
        }
      }),
      repeatX,
      repeatY
    );
    return this.registerMat(new THREE.MeshStandardMaterial({map: tex, roughness: 0.38, metalness: 0.05}));
  }

  grass(base = '#4f9a53', accent = '#3d7f41', repeatX = 8, repeatY = 8): THREE.MeshStandardMaterial {
    const tex = this.registerTex(
      this.makeCanvas(256, 256, (ctx, w, h) => {
        ctx.fillStyle = base;
        ctx.fillRect(0, 0, w, h);
        for (let i = 0; i < 420; i++) {
          const x = (i * 73) % w;
          const y = (i * 137) % h;
          ctx.fillStyle = i % 2 === 0 ? accent : '#68b36b';
          ctx.globalAlpha = 0.35;
          ctx.fillRect(x, y, 4, 8);
        }
      }),
      repeatX,
      repeatY
    );
    return this.registerMat(new THREE.MeshStandardMaterial({map: tex, roughness: 0.92, metalness: 0.01}));
  }

  asphaltRoad(repeatX = 1, repeatY = 6): THREE.MeshStandardMaterial {
    const tex = this.registerTex(
      this.makeCanvas(256, 256, (ctx, w, h) => {
        ctx.fillStyle = '#334155';
        ctx.fillRect(0, 0, w, h);
        for (let i = 0; i < 360; i++) {
          ctx.fillStyle = i % 2 === 0 ? '#475569' : '#1e293b';
          ctx.globalAlpha = 0.25;
          ctx.fillRect((i * 59) % w, (i * 97) % h, 3, 3);
        }
        ctx.globalAlpha = 0.92;
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(10, 0, 6, h);
        ctx.fillRect(w - 16, 0, 6, h);
        ctx.fillStyle = '#facc15';
        for (let y = 12; y < h; y += 56) {
          ctx.fillRect(w / 2 - 4, y, 8, 30);
        }
      }),
      repeatX,
      repeatY
    );
    return this.registerMat(
      new THREE.MeshStandardMaterial({
        map: tex,
        roughness: 0.85,
        metalness: 0.05,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      })
    );
  }

  metal(color = '#cbd5e1', roughness = 0.24, metalness = 0.85): THREE.MeshStandardMaterial {
    return this.registerMat(new THREE.MeshStandardMaterial({color, roughness, metalness}));
  }

  glass(color = '#bae6fd', opacity = 0.42): THREE.MeshPhysicalMaterial {
    return this.registerMat(
      new THREE.MeshPhysicalMaterial({
        color,
        roughness: 0.08,
        metalness: 0.05,
        clearcoat: 1.0,
        transparent: true,
        opacity,
        depthWrite: false,
      })
    );
  }

  water(color = '#0284c7'): THREE.MeshStandardMaterial {
    const tex = this.registerTex(
      this.makeCanvas(256, 256, (ctx, w, h) => {
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = '#7dd3fc';
        ctx.lineWidth = 3;
        for (let y = 12; y < h; y += 24) {
          ctx.globalAlpha = 0.32;
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.bezierCurveTo(w * 0.25, y - 6, w * 0.75, y + 6, w, y);
          ctx.stroke();
        }
      }),
      3,
      3
    );
    return this.registerMat(
      new THREE.MeshStandardMaterial({
        map: tex,
        roughness: 0.16,
        metalness: 0.22,
        transparent: true,
        opacity: 0.88,
      })
    );
  }

  solarCell(): THREE.MeshStandardMaterial {
    const tex = this.registerTex(
      this.makeCanvas(256, 256, (ctx, w, h) => {
        ctx.fillStyle = '#0f294a';
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2;
        for (let i = 0; i <= w; i += 32) {
          ctx.beginPath();
          ctx.moveTo(i, 0);
          ctx.lineTo(i, h);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(0, i);
          ctx.lineTo(w, i);
          ctx.stroke();
        }
      }),
      1,
      1
    );
    return this.registerMat(
      new THREE.MeshStandardMaterial({
        map: tex,
        roughness: 0.2,
        metalness: 0.6,
        emissive: '#0369a1',
        emissiveIntensity: 0.18,
      })
    );
  }

  buildingFacade(wallHex = '#e2e8f0', windowHex = '#38bdf8'): THREE.MeshStandardMaterial {
    const tex = this.registerTex(
      this.makeCanvas(256, 256, (ctx, w, h) => {
        ctx.fillStyle = wallHex;
        ctx.fillRect(0, 0, w, h);
        for (let r = 0; r < 6; r++) {
          for (let c = 0; c < 4; c++) {
            ctx.fillStyle = windowHex;
            ctx.fillRect(16 + c * 60, 14 + r * 40, 38, 24);
            ctx.fillStyle = 'rgba(255,255,255,0.28)';
            ctx.fillRect(18 + c * 60, 16 + r * 40, 12, 20);
          }
        }
      }),
      1,
      2
    );
    return this.registerMat(new THREE.MeshStandardMaterial({map: tex, roughness: 0.42, metalness: 0.25}));
  }

  heritageStone(base = '#c4b59d'): THREE.MeshStandardMaterial {
    const tex = this.registerTex(
      this.makeCanvas(256, 256, (ctx, w, h) => {
        ctx.fillStyle = base;
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = '#8c7d65';
        ctx.lineWidth = 3;
        for (let r = 0; r < 8; r++) {
          const y = r * 32;
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(w, y);
          ctx.stroke();
          const offset = (r % 2) * 32;
          for (let x = offset; x < w; x += 64) {
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x, y + 32);
            ctx.stroke();
          }
        }
      }),
      3,
      3
    );
    return this.registerMat(new THREE.MeshStandardMaterial({map: tex, roughness: 0.88, metalness: 0.04}));
  }

  earthGlobe(): THREE.MeshStandardMaterial {
    const tex = this.registerTex(
      this.makeCanvas(512, 256, (ctx, w, h) => {
        ctx.fillStyle = '#1d4ed8';
        ctx.fillRect(0, 0, w, h);
        // Stylized realistic continents
        ctx.fillStyle = '#22c55e';
        const blobs = [
          [95, 90, 56, 36],
          [130, 165, 34, 48],
          [265, 86, 62, 34],
          [282, 152, 42, 46],
          [380, 96, 72, 42],
          [420, 178, 36, 24],
        ];
        blobs.forEach(([x, y, rx, ry]) => {
          ctx.beginPath();
          ctx.ellipse(x, y, rx, ry, 0.2, 0, Math.PI * 2);
          ctx.fill();
        });
        // Polar snow caps
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(0, 0, w, 22);
        ctx.fillRect(0, h - 22, w, 22);
      }),
      1,
      1
    );
    return this.registerMat(new THREE.MeshStandardMaterial({map: tex, roughness: 0.55, metalness: 0.06}));
  }

  signTexture(title: string, subtitle: string, bg = '#fef3c7', fg = '#1e293b'): THREE.MeshStandardMaterial {
    const tex = this.registerTex(
      this.makeCanvas(512, 256, (ctx, w, h) => {
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = '#92400e';
        ctx.lineWidth = 10;
        ctx.strokeRect(10, 10, w - 20, h - 20);
        ctx.fillStyle = fg;
        ctx.font = 'bold 38px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(title, w / 2, 105);
        ctx.font = '26px sans-serif';
        ctx.fillStyle = '#475569';
        ctx.fillText(subtitle, w / 2, 168);
      }),
      1,
      1
    );
    return this.registerMat(new THREE.MeshStandardMaterial({map: tex, roughness: 0.7, metalness: 0.04}));
  }

  dispose(): void {
    this.textures.forEach((t) => t.dispose());
    this.materials.forEach((m) => m.dispose());
    this.textures = [];
    this.materials = [];
  }
}

/**
 * Shared procedural composite prop builders (3-12 parts, bottom-center grounded pivots).
 */
export function createDetailedTree(
  mats: MaterialLibrary,
  scale = 1,
  foliageHex = '#2e7d32'
): THREE.Group {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12 * scale, 0.2 * scale, 1.3 * scale, 10),
    mats.wood('#6d4c41', '#4e342e', 1, 1)
  );
  trunk.position.y = 0.65 * scale;
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  g.add(trunk);

  const leafMat1 = mats.standard(foliageHex, 0.85, 0.02);
  const leafMat2 = mats.standard('#43a047', 0.82, 0.02);
  const canopyOffsets: Array<[number, number, number, number, THREE.Material]> = [
    [0, 1.75, 0, 0.78, leafMat1],
    [-0.36, 1.5, 0.22, 0.52, leafMat2],
    [0.34, 1.54, -0.24, 0.54, leafMat1],
    [0.05, 2.25, 0.04, 0.5, leafMat2],
  ];
  for (const [x, y, z, r, m] of canopyOffsets) {
    const sphere = new THREE.Mesh(new THREE.DodecahedronGeometry(r * scale, 1), m);
    sphere.position.set(x * scale, y * scale, z * scale);
    sphere.castShadow = true;
    g.add(sphere);
  }
  return g;
}

export function createArticulatedCharacter(
  mats: MaterialLibrary,
  shirtHex = '#2563eb',
  pantsHex = '#1e293b'
): {
  group: THREE.Group;
  limbs: {
    leftLeg: THREE.Object3D;
    rightLeg: THREE.Object3D;
    leftArm: THREE.Object3D;
    rightArm: THREE.Object3D;
  };
} {
  const group = new THREE.Group();
  const skinMat = mats.standard('#f5cba7', 0.72, 0.02);
  const shirtMat = mats.standard(shirtHex, 0.78, 0.04);
  const pantsMat = mats.standard(pantsHex, 0.84, 0.04);
  const shoeMat = mats.standard('#0f172a', 0.5, 0.12);
  const hairMat = mats.standard('#1e293b', 0.8, 0.05);

  const makeLeg = (x: number) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0.72, 0);
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.48, 6, 10), pantsMat);
    leg.position.y = -0.34;
    leg.castShadow = true;
    pivot.add(leg);
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.3), shoeMat);
    shoe.position.set(0, -0.65, 0.05);
    pivot.add(shoe);
    return pivot;
  };

  const leftLeg = makeLeg(-0.14);
  const rightLeg = makeLeg(0.14);
  group.add(leftLeg, rightLeg);

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.62, 0.26), shirtMat);
  torso.position.y = 1.05;
  torso.castShadow = true;
  group.add(torso);

  const backpack = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.44, 0.16), mats.standard('#0ea5e9', 0.7, 0.08));
  backpack.position.set(0, 1.06, -0.19);
  group.add(backpack);

  const makeArm = (x: number) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, 1.3, 0);
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.42, 6, 10), shirtMat);
    arm.position.y = -0.26;
    arm.castShadow = true;
    pivot.add(arm);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), skinMat);
    hand.position.y = -0.52;
    pivot.add(hand);
    return pivot;
  };

  const leftArm = makeArm(-0.33);
  const rightArm = makeArm(0.33);
  group.add(leftArm, rightArm);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 14), skinMat);
  head.position.y = 1.58;
  head.castShadow = true;
  group.add(head);

  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.21, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), hairMat);
  hair.position.y = 1.61;
  group.add(hair);

  // Subtle visor/hat for eco/ranger readability
  const capBrim = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.04, 0.2), mats.standard('#f59e0b', 0.6, 0.05));
  capBrim.position.set(0, 1.69, 0.16);
  group.add(capBrim);

  return {group, limbs: {leftLeg, rightLeg, leftArm, rightArm}};
}

export function tagInteractive(obj: THREE.Object3D, objectId: string, draggable = false): void {
  obj.userData.objectId = objectId;
  obj.userData.draggable = draggable;
  obj.traverse((child) => {
    child.userData.objectId = objectId;
    if (draggable) child.userData.draggable = true;
  });
}
