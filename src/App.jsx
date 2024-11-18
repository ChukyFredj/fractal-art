import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'

function JuliaSet() {
  const containerRef = useRef(null)
  const sceneRef = useRef(null)
  const rendererRef = useRef(null)
  const materialRef = useRef(null)
  const animationRef = useRef(null)
  const timeRef = useRef(0)
  const cameraRef = useRef(null)
  const stateRef = useRef({
    isPaused: false,
    speed: 0.01,
    maxIterations: 500,
    zoom: 1.0,
    offsetX: 0,
    offsetY: 0
  })

  const [isPaused, setIsPaused] = useState(false)
  const [speed, setSpeed] = useState(0.01)
  const [maxIterations, setMaxIterations] = useState(500)
  const [zoom, setZoom] = useState(1.0)

  // Mise à jour des refs quand les états changent
  useEffect(() => {
    stateRef.current.isPaused = isPaused
  }, [isPaused])

  useEffect(() => {
    stateRef.current.speed = speed
  }, [speed])

  useEffect(() => {
    stateRef.current.maxIterations = maxIterations
    if (materialRef.current) {
      materialRef.current.uniforms.maxIterations.value = maxIterations
    }
  }, [maxIterations])

  useEffect(() => {
    stateRef.current.zoom = zoom
    if (materialRef.current) {
      materialRef.current.uniforms.zoom.value = zoom
      materialRef.current.uniforms.offset.value.set(stateRef.current.offsetX, stateRef.current.offsetY)
    }
  }, [zoom])

  // Configuration initiale unique
  useEffect(() => {
    const scene = new THREE.Scene()
    sceneRef.current = scene
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -1, 1)
    cameraRef.current = camera
    const renderer = new THREE.WebGLRenderer({
      antialias: false,
      powerPreference: "high-performance"
    })
    rendererRef.current = renderer
    renderer.setSize(window.innerWidth - 200, window.innerHeight)
    containerRef.current.appendChild(renderer.domElement)

    const fragmentShader = `
      #ifdef GL_ES
      precision highp float;
      #endif

      uniform vec2 resolution;
      uniform float time;
      uniform vec3 baseColor;
      uniform float maxIterations;
      uniform float zoom;
      uniform vec2 offset;

      #define ESCAPE_RADIUS 4.0
      #define PI 3.14159265359

      const vec3 colorOffset = vec3(0.0, 0.33, 0.67);
      const float TWO_PI = 2.0 * PI;

      vec2 julia(vec2 z, vec2 c) {
        return vec2(
          z.x * z.x - z.y * z.y + c.x,
          2.0 * z.x * z.y + c.y
        );
      }

      vec3 getColor(float iterations) {
        float hue = (baseColor.x + iterations * 2.0) / 360.0;
        return 0.5 + 0.5 * cos(TWO_PI * (hue + colorOffset));
      }

      void main() {
        vec2 uv = ((gl_FragCoord.xy - 0.5 * resolution.xy) * (2.0 / min(resolution.x, resolution.y))) / zoom + offset;
        
        float slowTime = time * 0.15;
        float microTime = time * 0.05;
        vec2 c = 0.7885 * vec2(
          cos(slowTime + sin(microTime) * 0.2),
          sin(slowTime + cos(microTime) * 0.2)
        );
        
        vec2 z = uv;
        float iterations = 0.0;
        
        for(float i = 0.0; i < maxIterations; i += 1.0) {
          z = julia(z, c);
          float mag = dot(z, z);
          
          float escaped = step(ESCAPE_RADIUS, mag);
          iterations = mix(i + 1.0, iterations, escaped);
          
          if(mag > ESCAPE_RADIUS) break;
        }
        
        vec3 color = getColor(iterations);
        color *= 1.0 - step(maxIterations - 1.0, iterations);
        
        gl_FragColor = vec4(color, 1.0);
      }
    `

    const vertexShader = `
      void main() {
        gl_Position = vec4(position, 1.0);
      }
    `

    const material = new THREE.ShaderMaterial({
      uniforms: {
        resolution: { value: new THREE.Vector2(window.innerWidth - 200, window.innerHeight) },
        time: { value: 0.0 },
        baseColor: { value: new THREE.Vector3(Math.random() * 360, 100, 50) },
        maxIterations: { value: stateRef.current.maxIterations },
        zoom: { value: stateRef.current.zoom },
        offset: { value: new THREE.Vector2(0, 0) }
      },
      fragmentShader,
      vertexShader
    })
    materialRef.current = material

    const geometry = new THREE.PlaneGeometry(2, 2)
    const mesh = new THREE.Mesh(geometry, material)
    scene.add(mesh)

    let resizeTimeout
    function handleResize() {
      if (resizeTimeout) clearTimeout(resizeTimeout)
      resizeTimeout = setTimeout(() => {
        const width = window.innerWidth - 200
        const height = window.innerHeight
        renderer.setSize(width, height)
        material.uniforms.resolution.value.set(width, height)
      }, 100)
    }

    window.addEventListener('resize', handleResize)

    function animate() {
      if (!stateRef.current.isPaused) {
        timeRef.current += stateRef.current.speed
        material.uniforms.time.value = timeRef.current
      }
      renderer.render(scene, camera)
      animationRef.current = requestAnimationFrame(animate)
    }

    animate()

    // Gestion du zoom avec la molette
    function handleWheel(event) {
      event.preventDefault()

      const rect = renderer.domElement.getBoundingClientRect()
      const x = event.clientX - rect.left
      const y = event.clientY - rect.top

      // Convertir les coordonnées de la souris en coordonnées UV
      const uvX = (x / rect.width) * 2 - 1
      const uvY = -(y / rect.height) * 2 + 1

      // Facteur de zoom
      const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1
      const newZoom = stateRef.current.zoom * zoomFactor

      // Ajuster l'offset pour zoomer vers le curseur
      const offsetX = stateRef.current.offsetX
      const offsetY = stateRef.current.offsetY

      stateRef.current.offsetX = offsetX + (uvX / stateRef.current.zoom - uvX / newZoom)
      stateRef.current.offsetY = offsetY + (uvY / stateRef.current.zoom - uvY / newZoom)

      setZoom(newZoom)
    }

    renderer.domElement.addEventListener('wheel', handleWheel)

    return () => {
      window.removeEventListener('resize', handleResize)
      clearTimeout(resizeTimeout)
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
      renderer.dispose()
      geometry.dispose()
      material.dispose()
      if (containerRef.current?.contains(renderer.domElement)) {
        containerRef.current.removeChild(renderer.domElement)
      }
      renderer.domElement.removeEventListener('wheel', handleWheel)
    }
  }, [])

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', background: 'black' }}>
      <div style={{
        width: '200px',
        padding: '20px',
        background: '#1a1a1a',
        color: 'white',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px'
      }}>
        <div>
          <button
            onClick={() => setIsPaused(!isPaused)}
            style={{
              width: '100%',
              padding: '10px',
              background: isPaused ? '#4CAF50' : '#f44336',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            {isPaused ? 'Reprendre' : 'Pause'}
          </button>
        </div>

        <div>
          <label>Vitesse: {speed.toFixed(3)}</label>
          <input
            type="range"
            min="0.001"
            max="0.05"
            step="0.001"
            value={speed}
            onChange={(e) => setSpeed(parseFloat(e.target.value))}
            style={{
              width: '100%',
              marginTop: '5px'
            }}
          />
        </div>

        <div>
          <label>Iterations Max: {maxIterations}</label>
          <input
            type="range"
            min="100"
            max="1000"
            step="50"
            value={maxIterations}
            onChange={(e) => setMaxIterations(parseInt(e.target.value))}
            style={{
              width: '100%',
              marginTop: '5px'
            }}
          />
        </div>

        <div>
          <label>Zoom: {zoom.toFixed(2)}x</label>
          <input
            type="range"
            min="0.1"
            max="10"
            step="0.1"
            value={zoom}
            onChange={(e) => {
              const newZoom = parseFloat(e.target.value)
              setZoom(newZoom)
            }}
            style={{
              width: '100%',
              marginTop: '5px'
            }}
          />
        </div>

        <button
          onClick={() => {
            setZoom(1.0)
            stateRef.current.offsetX = 0
            stateRef.current.offsetY = 0
            if (materialRef.current) {
              materialRef.current.uniforms.offset.value.set(0, 0)
            }
          }}
          style={{
            width: '100%',
            padding: '10px',
            background: '#2196F3',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Réinitialiser le zoom
        </button>
      </div>

      <div ref={containerRef} style={{ flex: 1 }} />
    </div>
  )
}

function App() {
  return <JuliaSet />
}

export default App
