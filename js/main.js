let camera, scene, renderer;
let controls, water, sun;

  init();
  animate();


function init() {
  // CONTAINER
  container = document.createElement( 'div' );
  document.body.appendChild( container );

  // SCENE
  // Create a new Three.js scene
  scene = new THREE.Scene();
  
  // CAMERA
  // Create a camera so we can view the scene
  camera = new THREE.PerspectiveCamera( 55, window.innerWidth / window.innerHeight, 1, 20000 );
  camera.position.set( 30, 30, 100 );

  // LIGHTS
  // Add initial ambient light to set the tone for the scene.
  const ambientLight = new THREE.AmbientLight( 0xEAEAEA );
  // A bit less intese to make it appear a bit dark (starting sunset).
  ambientLight.intensity = 0.75;
  scene.add( ambientLight );

  const sunlight = new THREE.DirectionalLight( 0xff0000, 1 );
  sunlight.position.set( 220, 250, -300 );
  sunlight.intensity = 2.5;
  sunlight.castShadow = true;
  // Quick way to put light further apart.
  sunlight.position.multiplyScalar( 2.3 );
  // Measurements used to define a (invisible) box which
  // is where light will be able to hit.
  sunlight.shadow.camera.left = -1200;
  sunlight.shadow.camera.right = 1200;
  sunlight.shadow.camera.top = 800;
  sunlight.shadow.camera.bottom = - 500;
  sunlight.shadow.camera.far = 2800;
  //scene.add( sunlight );

  buildObjects();

  // RENDERER
  // Create the Three.js renderer and attach it to our canvas
  renderer = new THREE.WebGLRenderer( { antialias: true } );
  renderer.setPixelRatio( window.devicePixelRatio );
  renderer.setSize( window.innerWidth, window.innerHeight );
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  document.body.appendChild( renderer.domElement );

  //SUN

  sun = new THREE.Vector3();

  // Water

  const waterGeometry = new THREE.PlaneGeometry( 100000, 100000 );

  water = new Water(
    waterGeometry,
    {
      textureWidth: 512,
      textureHeight: 512,
      waterNormals: new THREE.TextureLoader().load( 'assets/waternormals.jpg', function ( texture ) {

        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;

      } ),
      sunDirection: new THREE.Vector3(),
      sunColor: 0xffffff,
      waterColor: 0x001e0f,
      distortionScale: 3.7,
      fog: scene.fog !== undefined
    }
  );

  water.rotation.x = - Math.PI / 2;

  scene.add( water );

  // Sky

  const sky = new Sky();
  sky.scale.setScalar( 100000 );
  scene.add( sky );

  const skyUniforms = sky.material.uniforms;

  skyUniforms[ 'turbidity' ].value = 10;
  skyUniforms[ 'rayleigh' ].value = 2;
  skyUniforms[ 'mieCoefficient' ].value = 0.005;
  skyUniforms[ 'mieDirectionalG' ].value = 0.8;

  const parameters = {
    elevation: 2,
    azimuth: 180
  };

  const pmremGenerator = new THREE.PMREMGenerator( renderer );
  let renderTarget;

  function updateSun() {

    const phi = THREE.MathUtils.degToRad( 90 - parameters.elevation );
    const theta = THREE.MathUtils.degToRad( parameters.azimuth );

    sun.setFromSphericalCoords( 1, phi, theta );

    sky.material.uniforms[ 'sunPosition' ].value.copy( sun );
    water.material.uniforms[ 'sunDirection' ].value.copy( sun ).normalize();

    if ( renderTarget !== undefined ) renderTarget.dispose();

    renderTarget = pmremGenerator.fromScene( sky );

    scene.environment = renderTarget.texture;

  }

  updateSun();

  const waterUniforms = water.material.uniforms;

  window.addEventListener( 'resize', onWindowResize );

  // CONTROLS
  controls = new OrbitControls( camera, renderer.domElement );
  controls.maxPolarAngle = Math.PI * 0.495;
  //controls.target.set( 0, 10, 0 );
  controls.minDistance = 0;
  controls.maxDistance = 5000;
  controls.update();

  // FLY CONTROLS the camera is given as the first argument, and
  // the DOM element must now be given as a second argument
  var flyControls = new THREE.FlyControls(camera, renderer.domElement);
  flyControls.movementSpeed = 1000;
  flyControls.rollSpeed = 0.5;
  // loop
  var lt = new Date();
  var loop = function () {
    var now = new Date(),
    secs = (now - lt) / 1000;
    lt = now;
    requestAnimationFrame(loop);
    // UPDATE CONTROLS
    flyControls.update(1 * secs);
    renderer.render(scene, camera);
  };
 
  loop();
  
}

/*
 * ANIMATION AND RENDER
 * Functions used animate and render the scene.
 */

// Function to let the animations work correctly.
function animate() {
  // Do the animation each frame.
  requestAnimationFrame( animate );
  // Render the scene.
  render();
}

// Function to render the scene
function render() {
  water.material.uniforms[ 'time' ].value += 0.30 / 60.0;
  // Render the scene.
  renderer.render( scene, camera );

}

/*
 * BUILD
 * Functions used to build the objects and do any transformations required
 * to fit the entire scene.
 */

 // Function to create each object to be used in the scene.
function buildObjects() {
  buildGround();
  buildTrees();
}

/*
 * GROUND
 * Functions used to create the ground. This use texture and is placed to cover the entire XY space.
 */

// Function to build the ground.
function buildGround() {
  // Repeat the texture to fill everything, and repeat it multiple times to fit better.
  const texture = new THREE.TextureLoader().load( 'assets/grass.jpg', function ( texture ) {

        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;

      } );
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set( 100, 100 );
  texture.anisotropy = 10;
  const material = new THREE.MeshLambertMaterial( { map: texture } );
  let ground = new THREE.Mesh( new THREE.PlaneGeometry( 1000, 1000 ), material );
  ground.position.y = 1;
  ground.position.x = 1;
  ground.position.z = 1;
  // Rotate plane so it simulates the ground.
  ground.rotation.x = - Math.PI / 2;
  ground.receiveShadow = true;
  scene.add( ground );
}


/*
 * TREES
 * Functions used to create trees. These use texture and are randomly (position and geometry) created .
 */

// Function to build trees (aka. forest) randomly.
// Uses ranges to determine where each tree is going to be positioned.
// The ranges only include X and Z, so the log is essentially the same height 
// and stays at ground level.
function buildTrees() {
  // Generate a random number to determine the amount of trees.
  const treesToAdd = Math.floor(Math.random() * 50) + 10;
  // Generate trees to the left of the screen (cat's right side);
  for( let i = 0; i <= treesToAdd; i++) {
    let randomX = -1 * (Math.floor(Math.random() * 500)-500)* randomSign();
    let randomZ = (Math.floor(Math.random() * 500)-500) * randomSign();
    let newTree = buildTree(randomX, randomZ);
    scene.add(newTree);
  }
}

 // Function to build a tree.
 // Using a box geometry as its base.
function buildTree(x, z) {
  const geometry = new THREE.BoxGeometry(7.34, 26.67, 6);
  // Repeat the texture to fill everything, and repeat it in the Y component to make it look better.
  const texture = new THREE.TextureLoader().load('assets/treewood.jpg');
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set( 1, 4 );
  // Add a bump map to be a little more realistic, not required.
  const material = new THREE.MeshPhongMaterial( { map: texture, bumpMap: texture, bumpScale: 0.8 } );
  let tree = new THREE.Mesh(geometry, material);
  //tree.castShadow = true;
  //tree.receiveShadow = true;
  tree.position.set(x, 14, z);
  //scaleObject(tree, 10);
  let leaves = buildTreeLeaves();
  tree.add(leaves);
  return tree;
}

// Function to build a tree's leaves.
// Using a box geometry as the base on top of the tree log.
function buildTreeLeaves() {
  const geometry = new THREE.BoxGeometry(17.34, 16.67, 12.67);
  // Repeat the texture to fill everything, and keep the same sizes in this case.
  const texture = new THREE.TextureLoader().load('assets/leaves.jpg');
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set( 1, 1 );
  // Add a bump map to be a little more realistic, not required.
  const material = new THREE.MeshPhongMaterial( { map: texture, bumpMap: texture, bumpScale: 1 } );
  let leaves = new THREE.Mesh(geometry, material);
  leaves.position.y = 12.67;
  //leaves.castShadow = true;
  //leaves.receiveShadow = true;
  const leavesToAdd = Math.floor(Math.random() * 8) + 2;
  for( let i = 0; i <= leavesToAdd; i++) {
    leaves.add(buildTreeLeavesRandom());
  }
  return leaves;
}

// Function to build a tree's leaves randomly.
// Using a box geometry that's between some ranges depending on the component.
// This way each tree is unique in a way.
function buildTreeLeavesRandom() {
  let randomX = Math.floor(Math.random() * 300) + 150;
  let randomY = Math.floor(Math.random() * 400) + 200;
  let randomZ = Math.floor(Math.random() * 400) + 200;
  const geometry = new THREE.BoxGeometry(randomX / 30, randomY / 30, randomZ / 30);
  
  // Repeat the texture to fill everything, and keep the same sizes in this case.
  
  const texture = new THREE.TextureLoader().load('assets/leaves.jpg');
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set( 1, 1 );
  // Add a bump map to be a little more realistic, not required.
  const material = new THREE.MeshPhongMaterial( { map: texture, bumpMap: texture, bumpScale: 1 } );
  let leaves = new THREE.Mesh(geometry, material);
  leaves.position.y = Math.floor(Math.random() * 260 / 30) * randomSign();
  leaves.position.x = Math.floor(Math.random() * 260 / 30) * randomSign();
  leaves.position.z = Math.floor(Math.random() * 180 / 30) * randomSign();
  //leaves.castShadow = true;
  //leaves.receiveShadow = true;
  return leaves;
}

// Helper function to get a random sign, either positive or negative.
function randomSign() {
  return -1 + Math.round(Math.random()) * 2;
}


/*
 * LISTENERS
 * Functions used for listeners to generate some kind of output or interaction.
 */

// Function to detect if the window was resized to reset
// sizes depending on the new window.
function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize( window.innerWidth, window.innerHeight );
}



