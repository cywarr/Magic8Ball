import * as THREE from "./threeR136/build/three.module.js";
import { OrbitControls } from "./threeR136/examples/jsm/controls/OrbitControls.js";
import * as BufferGeometryUtils from "./threeR136/examples/jsm/utils/BufferGeometryUtils.js";
import { TWEEN } from "./threeR136/examples/jsm/libs/tween.module.min.js";

let scene = new THREE.Scene();
let camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 2000);
camera.position.set(0, 1, 0.375).setLength(15);
let renderer = new THREE.WebGLRenderer({
    antialias: true
});
renderer.setSize(innerWidth, innerHeight);
//renderer.setClearColor(0x7f7f7f);
document.body.appendChild(renderer.domElement);

window.addEventListener("resize", onWindowResize);

let controls = new OrbitControls(camera, renderer.domElement);
controls.enablePan = false;
controls.enableDamping = true;
//controls.autoRotate = true;
controls.minDistance = 8;
controls.maxDistance = 15;

const textureLoader = new THREE.TextureLoader();

let tex = await textureLoader.loadAsync('https://threejs.org/examples/textures/2294472375_24a3b8ef46_o.jpg');
tex.encoding = THREE.sRGBEncoding;
tex.mapping = THREE.EquirectangularReflectionMapping;

let light = new THREE.DirectionalLight(0xffffff, 0.5);
light.position.set(2, 1, -2);
scene.add(/*light, */new THREE.AmbientLight(0xffffff, 1));

let phraseTextures = createTextures();

let globalUniforms = {
    time: { value: 0 },
    baseVisibility: { value: 1 },
    textVisibility: { value: 0 },
    text: { value: null }
}

let g1 = new THREE.SphereGeometry(4, 200, 100, 0, Math.PI * 2, Math.PI * 0.15, Math.PI * 0.85);
shiftSphereSurface(g1, true); // outer sphere
let g2 = g1.clone().scale(0.9, 0.9, 0.9); // inner sphere
let g3 = buildSides(g1); // bridge between spheres
let g4 = new THREE.SphereGeometry(3.99, 200, 25, 0, Math.PI * 2, 0, Math.PI * 0.15); // lens
let g = BufferGeometryUtils.mergeBufferGeometries([g1, g2, g3, g4], true);
let m = [
    new THREE.MeshStandardMaterial({
        envMap: tex,
        color: new THREE.Color("indigo").addScalar(0.25).multiplyScalar(5),
        roughness: 0.75,
        metalness: 1,
        onBeforeCompile: shader => {
            shader.uniforms.time = globalUniforms.time;
            shader.vertexShader = `
      	varying vec3 vPos;
      	${shader.vertexShader}
      `.replace(
                `#include <begin_vertex>`,
                `#include <begin_vertex>
        	vPos = position;
       	`
            );
            //console.log(shader.vertexShader)
            shader.fragmentShader = `
      	#define ss(a, b, c) smoothstep(a, b, c)
      	uniform float time;
        varying vec3 vPos;
      	${fbm}
      	${shader.fragmentShader}
      `.replace(
                `#include <roughnessmap_fragment>`,
                `
        	float roughnessFactor = roughness;
          
          vec2 v2d = normalize(vPos.xz) * 1.;
          //vec3 nCoord = vec3(v2d.x, vPos.y * 4. - time * 0.5, v2d.y);
          vec3 nCoord = vPos + vec3(0, time, 0);
          
          float nd = clamp(fbm(nCoord) * 0.25, 0., 1.);
          nd = pow(nd, 0.5);
          float hFactor = vUv.y;
          nd = mix(0.25, nd, ss(0.4, 0.6, hFactor));
          nd = mix(nd, 0., ss(0.9, 1., hFactor));
          
          roughnessFactor *= clamp((nd * 0.8) + 0.2, 0., 1.);
          
        `
            );
            //console.log(shader.fragmentShader);
        }
    }),
    new THREE.MeshLambertMaterial({
        color: 0x000088,
        side: THREE.BackSide
    }),
    new THREE.MeshLambertMaterial({
        color: 0xaa0000,
        onBeforeCompile: shader => {
            shader.fragmentShader = `
      	#define ss(a, b, c) smoothstep(a, b, c)
      	mat2 rot(float a){
        	float c = cos(a), s = sin(a);
        	return mat2( c, s,
                			-s, c);
        }
      	${shader.fragmentShader}
      `.replace(
                `vec4 diffuseColor = vec4( diffuse, opacity );`,
                `
        vec3 col = diffuse;
        vec2 uv = vUv;
        
        
        vec2 wUv = uv - 0.5;
        wUv.y *= 5.;
        wUv.y += sin(uv.x * PI2 * 100.) * 0.1;
        float fw = length(fwidth(wUv * PI));
        float l = ss(fw, 0., abs(sin(wUv.y * PI)));
        
        col = mix(col * 0.5, col, l);
        
        vec4 diffuseColor = vec4( col, opacity );
        `
            );
            //console.log(shader.fragmentShader);
        }
    }),
    new THREE.MeshStandardMaterial({
        envMap: tex,
        envMapIntensity: 10,
        color: 0xffffff,
        transparent: true,
        opacity: 0.25,
        metalness: 1,
        roughness: 0
    })
]
m[0].defines = { USE_UV: "" };
m[2].defines = { USE_UV: "" };
let o = new THREE.Mesh(g, m);
//scene.add(o);

let ig = new THREE.PlaneGeometry(0.4 * 8, 0.4 * 8);
ig.rotateX(-Math.PI * 0.5);
ig.setAttribute("instId", new THREE.InstancedBufferAttribute(new Float32Array([0, 1, 2, 3]), 1));
let im = new THREE.MeshBasicMaterial({
    color: new THREE.Color(0, 0.5, 1),
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    onBeforeCompile: shader => {
        shader.uniforms.baseVisibility = globalUniforms.baseVisibility;
        shader.uniforms.textVisibility = globalUniforms.textVisibility;
        shader.uniforms.text = globalUniforms.text;
        shader.vertexShader = `
    	attribute float instId;
      
    	varying float vInstId;
      
      ${shader.vertexShader}
    `.replace(
            `#include <begin_vertex>`,
            `#include <begin_vertex>
      	vInstId = instId;
      `
        );
        //console.log(shader.vertexShader);
        shader.fragmentShader = `
    	#define ss(a, b, c) smoothstep(a, b, c)
      uniform float baseVisibility;
      uniform float textVisibility;
      uniform sampler2D text;
            
      varying float vInstId;
      
      float tri(vec2 uv, int N){
        float Pi = 3.1415926;
        float Pi2 = Pi * 2.;
        float a = atan(uv.x,uv.y)+Pi;
        float r = Pi2/float(N);
        return cos(floor(.5+a/r)*r-a)*length(uv);
      }
      
    	${shader.fragmentShader}
    `.replace(
            `vec4 diffuseColor = vec4( diffuse, opacity );`,
            `vec4 diffuseColor = vec4( diffuse, opacity * ((vInstId / 3.) * 0.9 + 0.1) );
      	
        vec2 uv = (vUv - 0.5) * 6.;
        
        float fw = length(fwidth(uv));
        
        float fb = tri(uv, 3);
        float b = 0.;
        b = max(b, ss(1.1 - fw, 1.1, fb) - ss(1.2, 1.2 + fw, fb));
        
        vec2 uv81 = uv - vec2(0, 0.5);
        fb = tri(uv81, 60);
        b = max(b, ss(0.25 - fw, 0.25, fb) - ss(0.45, 0.45 + fw, fb));
        
        vec2 uv82 = uv + vec2(0, 0.25);
        fb = tri(uv82, 60);
        b = max(b, ss(0.3 - fw, 0.3, fb) - ss(0.5, 0.5 + fw, fb));
        
        b *= baseVisibility;
        
        vec3 col = vec3(0);
        col = mix(col, diffuse, b);
        
        vec4 text = texture(text, (vUv - 0.5) + 0.5);
        float tx = text.a * textVisibility;
        col = mix(col, text.rgb * vec3(1, 0.5, 0), tx);
        
        
        float f = max(b, tx);
        
        diffuseColor.rgb = col;
        diffuseColor.a *= f;
      
      
      `
        );
    }
});
im.defines = { USE_UV: "" };
let iWriting = new THREE.InstancedMesh(ig, im, 4);
let step = 0.05;
iWriting.setMatrixAt(0, new THREE.Matrix4().setPosition(0, (0.75 * 4) - step * 3, 0));
iWriting.setMatrixAt(1, new THREE.Matrix4().setPosition(0, (0.75 * 4) - step * 2, 0));
iWriting.setMatrixAt(2, new THREE.Matrix4().setPosition(0, (0.75 * 4) - step * 1, 0));
iWriting.setMatrixAt(3, new THREE.Matrix4().setPosition(0, (0.75 * 4) - step * 0, 0));

iWriting.renderOrder = 9998;
o.renderOrder = 9999;
scene.add(o);
scene.add(iWriting);

// <BACKGROUND>
let bg = new THREE.SphereGeometry(1000, 100, 50);
let bm = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
        time: globalUniforms.time
    },
    vertexShader: `
    varying vec3 vNormal;
    void main() {
      vNormal = normal;
      gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
    }
  `,
    fragmentShader: `
    uniform float bloom;
    uniform float time;
    varying vec3 vNormal;
    ${noiseV3}
    void main() {
      vec3 col = vec3(0.375);
      float ns = snoise(vec4(vNormal * 2., time * 0.1));
      col = mix(col*1.5, col, pow(abs(ns), 0.5));
      gl_FragColor = vec4( col, 1.0 );
    }
  `
});
let bo = new THREE.Mesh(bg, bm);
scene.add(bo);
// </BACKGROUND>

// <INTERACTION>
let isRunning = true;
function animation(param, valStart, valEnd, duration = 1000, delay = 0) {
    return new TWEEN.Tween({ val: valStart }).to({ val: valEnd }, duration).delay(delay)
        .onUpdate(val => {
            param.value = val.val;
        })
}
animation(globalUniforms.baseVisibility, 1, 0.375, 2000, 2000).start();
animation(globalUniforms.textVisibility, 0, 1, 2000, 4000)
    .onStart(() => { setNewText() })
    .onComplete(() => { isRunning = false; })
    .start();

let pointer = new THREE.Vector2();
let raycaster = new THREE.Raycaster();
let intersections;
window.addEventListener("pointerup", event => {
    if (isRunning) return;

    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = - (event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    intersections = raycaster.intersectObject(iWriting).filter(m => {
        return (m.uv.subScalar(0.5).length() * 2) < 0.5; // check, if we're in the central circle only
    });
    if (intersections.length > 0) {
        runAnimation();
    }

})

function runAnimation() {
    let fadeOut = animation(globalUniforms.textVisibility, 1, 0, 1000, 500);
    fadeOut.onStart(() => { isRunning = true; })
    let fadeIn = animation(globalUniforms.textVisibility, 0, 1, 2000, 1000);
    fadeIn.onStart(() => { setNewText() });
    fadeIn.onComplete(() => { isRunning = false });
    fadeOut.chain(fadeIn);
    fadeOut.start();
}

function setNewText() {
    globalUniforms.text.value = phraseTextures[THREE.MathUtils.randInt(0, 19)];
}

// </INTERACTION>


let clock = new THREE.Clock();

renderer.setAnimationLoop(() => {
    let t = clock.getElapsedTime();
    globalUniforms.time.value = t;
    controls.update();
    TWEEN.update();
    renderer.render(scene, camera);
});

function onWindowResize() {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
}

function buildSides(g) {
    let v3 = new THREE.Vector3();
    //console.log(g.parameters);
    let segs = g.parameters.widthSegments;
    let pts = new Array((segs + 1) * 2);
    for (let i = 0; i <= segs; i++) {
        v3.fromBufferAttribute(g.attributes.position, i);
        pts[i] = v3.clone().setLength(v3.length() * 0.9);
        pts[i + (segs + 1)] = v3.clone();
    }
    //console.log(pts)
    let sg = new THREE.PlaneGeometry(1, 1, segs, 1)
    sg.setFromPoints(pts);
    sg.computeVertexNormals();
    return sg;
}

function shiftSphereSurface(g, hole) {
    let sectors = 5;
    let sph = new THREE.Spherical();
    let v3 = new THREE.Vector3();
    let n = new THREE.Vector3();
    for (let i = 0; i < g.attributes.position.count; i++) {
        v3.fromBufferAttribute(g.attributes.position, i);
        sph.setFromVector3(v3);
        let localTheta = (Math.abs(sph.theta) * sectors / (Math.PI * 2)) % 1;
        let phiShift = 1 - (Math.cos(localTheta * Math.PI * 2) * 0.5 + 0.5);
        let phiAspect = sph.phi / Math.PI;
        phiAspect = hole ? 1 - phiAspect : phiAspect;
        let phiVal = Math.pow(phiShift, 0.9) * 0.05 * phiAspect;
        sph.phi += hole ? -phiVal : phiVal;
        v3.setFromSpherical(sph);
        g.attributes.position.setXYZ(i, v3.x, v3.y, v3.z);
        n.copy(v3).normalize();
        g.attributes.normal.setXYZ(i, n.x, n.y, n.z);
    }
}

function createTextures() {
    let canvases = [];
    [
        "It|is|certain",
        "It is|decidedly|so",
        "Without|a doubt",
        "Yes -|definitely",
        "You may|rely|on it",

        "As I|see it,|yes",
        "Most|likely",
        "Outlook|good",
        "Signs|point|to yes",
        "Yes",

        "Reply|hazy,|try|again",
        "Ask|again|later",
        "Better not|tell you|now",
        "Cannot|predict|now",
        "Concentrate|and ask|again",

        "Don’t|count|on it",
        "My|reply|is no",
        "My|sources|say no",
        "Outlook|not so|good",
        "Very|doubtful"
    ].forEach(phrase => {

        let c = document.createElement("canvas");
        c.style.fontSmooth = "never";
        c.width = c.height = 256;
        let ctx = c.getContext("2d");
        ctx.clearRect(0, 0, 256, 256);
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        let size = 30;
        let sizeRatio = 1.0;
        ctx.font = `bold ${size}px 'Courier New'`;


        let phraseChunks = phrase.split("|");
        let pcLength = phraseChunks.length;
        let startPoint = (pcLength - 1) * 0.5 * size * sizeRatio;
        ctx.fillStyle = "#fff";
        phraseChunks.forEach((pc, idx) => {
            ctx.fillText(pc.toUpperCase(), 127, 127 - startPoint + (idx * size * sizeRatio));
        })

        canvases.push(new THREE.CanvasTexture(c));
    })
    return canvases;
}
