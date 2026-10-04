import {
  useEffect,
  useRef,
  useState,
} from "react";
import type { FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ShieldAlert,
  Terminal,
  LockKeyhole,
  Activity,
  Radio,
  Fingerprint,
  Crosshair,
} from "lucide-react";
import * as THREE from "three";

import { useAuth } from "../hooks/useAuth";

interface LoginLocationState {
  from?: {
    pathname?: string;
  };
}

interface Connection {
  line: THREE.Line<
    THREE.BufferGeometry,
    THREE.LineBasicMaterial
  >;
  start: THREE.Vector3;
  end: THREE.Vector3;
  progress: number;
  speed: number;
  particle?: THREE.Mesh;
}

function latLonToVector3(
  latitude: number,
  longitude: number,
  radius: number,
): THREE.Vector3 {
  const phi =
    (90 - latitude) *
    (Math.PI / 180);

  const theta =
    (longitude + 180) *
    (Math.PI / 180);

  return new THREE.Vector3(
    -(
      radius *
      Math.sin(phi) *
      Math.cos(theta)
    ),
    radius * Math.cos(phi),
    radius *
      Math.sin(phi) *
      Math.sin(theta),
  );
}

function createArcPoints(
  start: THREE.Vector3,
  end: THREE.Vector3,
  radius: number,
): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  const segments = 48;

  const midpoint = start
    .clone()
    .add(end)
    .normalize()
    .multiplyScalar(radius * 1.55);

  const curve =
    new THREE.QuadraticBezierCurve3(
      start.clone(),
      midpoint,
      end.clone(),
    );

  for (
    let i = 0;
    i <= segments;
    i += 1
  ) {
    points.push(
      curve.getPoint(i / segments),
    );
  }

  return points;
}

function GlobeScene(): React.JSX.Element {
  const mountRef =
    useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const mount =
      mountRef.current;

    if (!mount) {
      return undefined;
    }

    const scene =
      new THREE.Scene();

    const camera =
      new THREE.PerspectiveCamera(
        42,
        mount.clientWidth /
          Math.max(
            mount.clientHeight,
            1,
          ),
        0.1,
        1000,
      );

    camera.position.set(
      0,
      0.2,
      8.8,
    );

    const renderer =
      new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
      });

    renderer.setPixelRatio(
      Math.min(
        window.devicePixelRatio,
        2,
      ),
    );

    renderer.setSize(
      mount.clientWidth,
      mount.clientHeight,
    );

    renderer.setClearColor(
      0x000000,
      0,
    );

    mount.appendChild(
      renderer.domElement,
    );

    const globeGroup =
      new THREE.Group();

    scene.add(globeGroup);

    const globeRadius = 2.45;

    /*
     * CORE GLOBE
     */

    const globeGeometry =
      new THREE.SphereGeometry(
        globeRadius,
        64,
        64,
      );

    const globeMaterial =
      new THREE.MeshBasicMaterial({
        color: 0x07100b,
        transparent: true,
        opacity: 0.96,
      });

    const globe = new THREE.Mesh(
      globeGeometry,
      globeMaterial,
    );

    globeGroup.add(globe);

    /*
     * WIREFRAME
     */

    const wireGeometry =
      new THREE.WireframeGeometry(
        globeGeometry,
      );

    const wireMaterial =
      new THREE.LineBasicMaterial({
        color: 0x42ff8a,
        transparent: true,
        opacity: 0.23,
      });

    const wireGlobe =
      new THREE.LineSegments(
        wireGeometry,
        wireMaterial,
      );

    globeGroup.add(wireGlobe);

    /*
     * ATMOSPHERE
     */

    const atmosphereGeometry =
      new THREE.SphereGeometry(
        globeRadius * 1.045,
        48,
        48,
      );

    const atmosphereMaterial =
      new THREE.MeshBasicMaterial({
        color: 0x75ffab,
        transparent: true,
        opacity: 0.06,
        side: THREE.BackSide,
      });

    const atmosphere =
      new THREE.Mesh(
        atmosphereGeometry,
        atmosphereMaterial,
      );

    globeGroup.add(atmosphere);

    /*
     * NETWORK NODES
     */

    const nodeGroup =
      new THREE.Group();

    globeGroup.add(nodeGroup);

    const nodeMaterial =
      new THREE.MeshBasicMaterial({
        color: 0xd9ffe7,
      });

    const nodePositions: THREE.Vector3[] =
      [];

    const locations = [
      { lat: 51.5, lon: -0.1 },
      { lat: 40.7, lon: -74.0 },
      { lat: 37.8, lon: -122.4 },
      { lat: 25.2, lon: 55.3 },
      { lat: 19.1, lon: 72.9 },
      { lat: 28.6, lon: 77.2 },
      { lat: 1.3, lon: 103.8 },
      { lat: 35.7, lon: 139.7 },
      { lat: 31.2, lon: 121.5 },
      { lat: -33.9, lon: 151.2 },
      { lat: -23.5, lon: -46.6 },
      { lat: 48.8, lon: 2.3 },
      { lat: 52.5, lon: 13.4 },
      { lat: 59.3, lon: 18.1 },
      { lat: 41.0, lon: 28.9 },
    ];

    locations.forEach(
      ({ lat, lon }) => {
        const position =
          latLonToVector3(
            lat,
            lon,
            globeRadius * 1.012,
          );

        nodePositions.push(
          position,
        );

        const nodeGeometry =
          new THREE.SphereGeometry(
            0.055,
            12,
            12,
          );

        const node = new THREE.Mesh(
          nodeGeometry,
          nodeMaterial,
        );

        node.position.copy(
          position,
        );

        nodeGroup.add(node);

        const pulseGeometry =
          new THREE.RingGeometry(
            0.085,
            0.105,
            24,
          );

        const pulseMaterial =
          new THREE.MeshBasicMaterial({
            color: 0x72ffab,
            transparent: true,
            opacity: 0.42,
            side: THREE.DoubleSide,
          });

        const pulse =
          new THREE.Mesh(
            pulseGeometry,
            pulseMaterial,
          );

        pulse.position.copy(
          position,
        );

        pulse.lookAt(
          position
            .clone()
            .multiplyScalar(2),
        );

        nodeGroup.add(pulse);
      },
    );

    /*
     * CONNECTION NETWORK
     */

    const connectionGroup =
      new THREE.Group();

    globeGroup.add(
      connectionGroup,
    );

    const pulseGroup =
      new THREE.Group();

    globeGroup.add(
      pulseGroup,
    );

    const connections: Connection[] =
      [];

    const createConnection = (
      sourceIndex: number,
      targetIndex: number,
      speed: number,
    ): void => {
      const start =
        nodePositions[
          sourceIndex
        ]
          .clone()
          .normalize()
          .multiplyScalar(
            globeRadius * 1.015,
          );

      const end =
        nodePositions[
          targetIndex
        ]
          .clone()
          .normalize()
          .multiplyScalar(
            globeRadius * 1.015,
          );

      const arcPoints =
        createArcPoints(
          start,
          end,
          globeRadius,
        );

      const geometry =
        new THREE.BufferGeometry().setFromPoints(
          arcPoints,
        );

      const material =
        new THREE.LineBasicMaterial({
          color: 0x48ff91,
          transparent: true,
          opacity: 0.34,
        });

      const line =
        new THREE.Line(
          geometry,
          material,
        );

      connectionGroup.add(
        line,
      );

      const pointGeometry =
        new THREE.SphereGeometry(
          0.035,
          8,
          8,
        );

      const pointMaterial =
        new THREE.MeshBasicMaterial({
          color: 0xffffff,
        });

      const particle =
        new THREE.Mesh(
          pointGeometry,
          pointMaterial,
        );

      pulseGroup.add(
        particle,
      );

      connections.push({
        line,
        start,
        end,
        progress:
          Math.random(),
        speed,
        particle,
      });
    };

    createConnection(
      0,
      1,
      0.005,
    );

    createConnection(
      1,
      2,
      0.004,
    );

    createConnection(
      2,
      4,
      0.005,
    );

    createConnection(
      4,
      6,
      0.006,
    );

    createConnection(
      6,
      7,
      0.004,
    );

    createConnection(
      7,
      8,
      0.005,
    );

    createConnection(
      8,
      9,
      0.004,
    );

    createConnection(
      10,
      11,
      0.006,
    );

    createConnection(
      11,
      12,
      0.005,
    );

    createConnection(
      12,
      13,
      0.004,
    );

    createConnection(
      13,
      14,
      0.005,
    );

    createConnection(
      3,
      4,
      0.005,
    );

    createConnection(
      1,
      12,
      0.004,
    );

    /*
     * PARTICLE FIELD
     */

    const particlesGeometry =
      new THREE.BufferGeometry();

    const particleCount = 650;

    const particlePositions =
      new Float32Array(
        particleCount * 3,
      );

    for (
      let i = 0;
      i < particleCount;
      i += 1
    ) {
      const radius =
        4.5 +
        Math.random() * 3.5;

      const theta =
        Math.random() *
        Math.PI *
        2;

      const phi =
        Math.acos(
          Math.random() * 2 -
            1,
        );

      particlePositions[
        i * 3
      ] =
        radius *
        Math.sin(phi) *
        Math.cos(theta);

      particlePositions[
        i * 3 + 1
      ] =
        radius *
        Math.cos(phi);

      particlePositions[
        i * 3 + 2
      ] =
        radius *
        Math.sin(phi) *
        Math.sin(theta);
    }

    particlesGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(
        particlePositions,
        3,
      ),
    );

    const particlesMaterial =
      new THREE.PointsMaterial({
        color: 0x9affba,
        size: 0.022,
        transparent: true,
        opacity: 0.52,
        sizeAttenuation: true,
      });

    const particleField =
      new THREE.Points(
        particlesGeometry,
        particlesMaterial,
      );

    scene.add(
      particleField,
    );

    /*
     * ORBITAL RINGS
     */

    const orbitGeometry =
      new THREE.TorusGeometry(
        globeRadius * 1.24,
        0.012,
        12,
        160,
      );

    const orbitMaterial =
      new THREE.MeshBasicMaterial({
        color: 0x8affb4,
        transparent: true,
        opacity: 0.47,
      });

    const orbit = new THREE.Mesh(
      orbitGeometry,
      orbitMaterial,
    );

    orbit.rotation.x =
      THREE.MathUtils.degToRad(
        63,
      );

    orbit.rotation.z =
      THREE.MathUtils.degToRad(
        -15,
      );

    globeGroup.add(
      orbit,
    );

    const orbit2Geometry =
      new THREE.TorusGeometry(
        globeRadius * 1.33,
        0.007,
        12,
        160,
      );

    const orbit2Material =
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.2,
      });

    const orbit2 = new THREE.Mesh(
      orbit2Geometry,
      orbit2Material,
    );

    orbit2.rotation.x =
      THREE.MathUtils.degToRad(
        -63,
      );

    globeGroup.add(
      orbit2,
    );

    /*
     * ANIMATION
     */

    const clock =
      new THREE.Clock();

    let animationFrame = 0;

    const animate = (): void => {
      animationFrame =
        requestAnimationFrame(
          animate,
        );

      const elapsed =
        clock.getElapsedTime();

      globeGroup.rotation.y =
        elapsed * 0.075;

      globeGroup.rotation.x =
        Math.sin(
          elapsed * 0.18,
        ) * 0.04;

      wireGlobe.rotation.y =
        elapsed * 0.075;

      orbit.rotation.z +=
        0.0022;

      orbit2.rotation.z -=
        0.0013;

      particleField.rotation.y =
        elapsed * 0.008;

      connections.forEach(
        (connection) => {
          connection.progress +=
            connection.speed;

          if (
            connection.progress >
            1
          ) {
            connection.progress = 0;
          }

          const arcPoints =
            createArcPoints(
              connection.start,
              connection.end,
              globeRadius,
            );

          if (
            connection.particle
          ) {
            const point =
              arcPoints[
                Math.min(
                  Math.floor(
                    connection.progress *
                      (arcPoints.length -
                        1),
                  ),
                  arcPoints.length -
                    1,
                )
              ];

            connection.particle.position.copy(
              point,
            );
          }
        },
      );

      nodeGroup.children.forEach(
        (child, index) => {
          if (
            child.type ===
              "Mesh" &&
            index % 2 === 1
          ) {
            const scale =
              1 +
              (
                (
                  Math.sin(
                    elapsed *
                      2.5 +
                      index,
                  ) +
                  1
                ) /
                2
              ) *
                0.8;

            child.scale.set(
              scale,
              scale,
              scale,
            );

            const material =
              (
                child as THREE.Mesh<
                  THREE.BufferGeometry,
                  THREE.MeshBasicMaterial
                >
              ).material;

            material.opacity =
              0.15 +
              scale * 0.18;
          }
        },
      );

      renderer.render(
        scene,
        camera,
      );
    };

    animate();

    const handleResize =
      (): void => {
        if (!mount) {
          return;
        }

        const width =
          mount.clientWidth;

        const height =
          Math.max(
            mount.clientHeight,
            1,
          );

        camera.aspect =
          width / height;

        camera.updateProjectionMatrix();

        renderer.setSize(
          width,
          height,
        );
      };

    window.addEventListener(
      "resize",
      handleResize,
    );

    return () => {
      cancelAnimationFrame(
        animationFrame,
      );

      window.removeEventListener(
        "resize",
        handleResize,
      );

      globeGeometry.dispose();
      globeMaterial.dispose();

      wireGeometry.dispose();
      wireMaterial.dispose();

      atmosphereGeometry.dispose();
      atmosphereMaterial.dispose();

      orbitGeometry.dispose();
      orbitMaterial.dispose();

      orbit2Geometry.dispose();
      orbit2Material.dispose();

      particlesGeometry.dispose();
      particlesMaterial.dispose();

      nodeMaterial.dispose();

      connections.forEach(
        (connection) => {
          connection.line.geometry.dispose();
          connection.line.material.dispose();

          if (
            connection.particle
          ) {
            connection.particle.geometry.dispose();

            (
              connection.particle
                .material as THREE.Material
            ).dispose();
          }
        },
      );

      nodeGroup.children.forEach(
        (child) => {
          if (
            child instanceof
            THREE.Mesh
          ) {
            child.geometry.dispose();

            (
              child.material as THREE.Material
            ).dispose();
          }
        },
      );

      renderer.dispose();

      if (
        renderer.domElement
          .parentElement ===
        mount
      ) {
        mount.removeChild(
          renderer.domElement,
        );
      }
    };
  }, []);

  return (
    <div
      ref={mountRef}
      className="absolute inset-0"
      aria-hidden="true"
    />
  );
}

function BootSequence({
  completed,
}: {
  completed: boolean;
}): React.JSX.Element {
  const bootLines = [
    "SENTINEL-X CORE INITIALIZATION",
    "Loading security kernel ........ OK",
    "Establishing telemetry fabric .. OK",
    "Initializing threat engine ..... OK",
    "Initializing ML anomaly model .. OK",
    "Secure channel ................. ACTIVE",
  ];

  return (
    <div
      className={`pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-[#020603] transition-opacity duration-1000 ${
        completed
          ? "opacity-0"
          : "opacity-100"
      }`}
    >
      <div className="w-full max-w-xl px-8 font-mono text-[11px] tracking-[0.18em] text-emerald-300">
        <div className="mb-5 flex items-center gap-3 text-[18px] font-black tracking-[0.3em] text-white">
          <Fingerprint
            size={20}
            className="text-emerald-400"
          />

          SENTINEL-X
        </div>

        {bootLines.map(
          (line, index) => (
            <div
              key={line}
              className="mb-2 opacity-0"
              style={{
                animation:
                  "sentinelBootLine 420ms forwards",
                animationDelay: `${
                  index * 230
                }ms`,
              }}
            >
              <span className="mr-3 text-emerald-700">
                [
                {String(
                  index + 1,
                ).padStart(
                  2,
                  "0",
                )}
                ]
              </span>

              {line}
            </div>
          ),
        )}

        <div
          className="mt-5 h-px overflow-hidden bg-emerald-950"
          style={{
            animation:
              "sentinelBootProgress 1500ms ease-out forwards",
          }}
        >
          <div className="h-full w-full origin-left bg-emerald-400" />
        </div>

        <div className="mt-4 text-emerald-700">
          {">"} SECURE ENVIRONMENT READY
          <span className="animate-pulse">
            _
          </span>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage(): React.JSX.Element {
  const {
    login,
    isAuthenticated,
    isLoading,
  } = useAuth();

  const navigate =
    useNavigate();

  const location =
    useLocation();

  const [
    username,
    setUsername,
  ] = useState("");

  const [
    password,
    setPassword,
  ] = useState("");

  const [
    submitting,
    setSubmitting,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState<
    string | null
  >(null);

  const [
    bootComplete,
    setBootComplete,
  ] = useState(false);

  useEffect(() => {
    const timer =
      window.setTimeout(
        () => {
          setBootComplete(
            true,
          );
        },
        1850,
      );

    return () => {
      window.clearTimeout(
        timer,
      );
    };
  }, []);

  useEffect(() => {
    if (
      !isLoading &&
      isAuthenticated
    ) {
      navigate("/", {
        replace: true,
      });
    }
  }, [
    isAuthenticated,
    isLoading,
    navigate,
  ]);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    setError(null);
    setSubmitting(true);

    try {
      await login({
        username:
          username.trim(),
        password,
      });

      const state =
        location.state as LoginLocationState | null;

      navigate(
        state?.from?.pathname ??
          "/",
        {
          replace: true,
        },
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Authentication failed.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#010402] text-white">
      <style>
        {`
          @keyframes sentinelBootLine {
            from {
              opacity: 0;
              transform: translateX(-12px);
            }

            to {
              opacity: 1;
              transform: translateX(0);
            }
          }

          @keyframes sentinelBootProgress {
            from {
              transform: scaleX(0);
            }

            to {
              transform: scaleX(1);
            }
          }

          @keyframes sentinelScan {
            0% {
              transform: translateY(-120%);
            }

            100% {
              transform: translateY(120%);
            }
          }

          @keyframes sentinelFloat {
            0%,
            100% {
              transform: translateY(0);
            }

            50% {
              transform: translateY(-8px);
            }
          }

          .sentinel-grid {
            background-image:
              linear-gradient(
                rgba(75, 255, 145, 0.045) 1px,
                transparent 1px
              ),
              linear-gradient(
                90deg,
                rgba(75, 255, 145, 0.045) 1px,
                transparent 1px
              );
            background-size: 46px 46px;
          }

          .sentinel-vignette {
            background:
              radial-gradient(
                circle at 72% 45%,
                rgba(30, 255, 125, 0.09),
                transparent 30%
              ),
              radial-gradient(
                circle at 18% 82%,
                rgba(115, 255, 170, 0.055),
                transparent 24%
              ),
              linear-gradient(
                180deg,
                rgba(0, 4, 2, 0.08),
                rgba(0, 4, 2, 0.92)
              );
          }

          .sentinel-scan {
            animation:
              sentinelScan 6s linear infinite;
          }
        `}
      </style>

      <BootSequence
        completed={bootComplete}
      />

      <div className="sentinel-grid absolute inset-0 opacity-80" />

      <div className="sentinel-vignette absolute inset-0" />

      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="sentinel-scan absolute left-0 right-0 h-32 bg-gradient-to-b from-transparent via-emerald-300/[0.035] to-transparent" />
      </div>

      <main className="relative z-10 min-h-screen lg:grid lg:grid-cols-[1.05fr_0.95fr]">
        <section className="relative hidden min-h-screen overflow-hidden border-r border-emerald-950/70 lg:block">
          <GlobeScene />

          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#010402]/30 via-transparent to-[#010402]/35" />

          <div className="absolute left-8 top-8 z-20">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-300/35 bg-emerald-400/[0.06] shadow-[0_0_35px_rgba(50,255,130,.08)]">
                <ShieldAlert
                  size={22}
                  className="text-emerald-200"
                />
              </div>

              <div>
                <div className="text-sm font-black tracking-[0.28em] text-white">
                  SENTINEL-X
                </div>

                <div className="font-mono text-[9px] tracking-[0.18em] text-emerald-700">
                  CYBER DEFENSE GRID
                </div>
              </div>
            </div>
          </div>

          <div className="absolute right-8 top-8 z-20 hidden xl:block">
            <div className="rounded-lg border border-emerald-950 bg-black/35 px-3 py-2 backdrop-blur-md">
              <div className="flex items-center gap-2 text-[9px] font-mono tracking-[0.15em] text-emerald-700">
                <Radio size={11} />
                NETWORK STATUS
              </div>

              <div className="mt-1 text-xs font-mono text-emerald-200">
                ALL SYSTEMS NOMINAL
              </div>
            </div>
          </div>

          <div className="absolute bottom-10 left-8 z-20 max-w-md">
            <div className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-emerald-500">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300 shadow-[0_0_10px_rgba(110,255,170,.9)]" />

              Global telemetry mesh online
            </div>

            <h1 className="text-4xl font-black tracking-tight text-white xl:text-5xl">
              Threats move fast.
              <br />

              <span className="text-emerald-300">
                Sentinel-X moves faster.
              </span>
            </h1>

            <p className="mt-4 max-w-lg text-sm leading-6 text-slate-500">
              Real-time detection,
              behavioral analytics,
              incident correlation
              and defensive response
              across the security
              telemetry fabric.
            </p>

            <div className="mt-6 grid grid-cols-3 gap-3">
              {[
                [
                  "REALTIME",
                  "TELEMETRY",
                ],
                [
                  "AI / ML",
                  "ANOMALY",
                ],
                [
                  "24 / 7",
                  "MONITORING",
                ],
              ].map(
                ([value, label]) => (
                  <div
                    key={value}
                    className="rounded-lg border border-emerald-950/80 bg-black/45 p-3 backdrop-blur-md"
                  >
                    <div className="font-mono text-xs font-bold text-emerald-300">
                      {value}
                    </div>

                    <div className="mt-1 text-[9px] uppercase tracking-[0.18em] text-slate-600">
                      {label}
                    </div>
                  </div>
                ),
              )}
            </div>
          </div>
        </section>

        <section className="relative flex min-h-screen items-center justify-center px-5 py-10 sm:px-8">
          <div className="absolute inset-0 lg:hidden">
            <GlobeScene />

            <div className="absolute inset-0 bg-[#010402]/80" />
          </div>

          <div className="relative z-10 w-full max-w-md">
            <div className="mb-4 flex items-center justify-between px-1 font-mono text-[8px] tracking-[0.18em] text-emerald-800">
              <span>
                NODE // HYBRID-SOC
              </span>

              <span className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" />

                CHANNEL SECURE
              </span>
            </div>

            <div
              className="relative overflow-hidden rounded-2xl border border-emerald-900/70 bg-[#050b07]/88 p-6 shadow-[0_0_90px_rgba(70,255,145,.08)] backdrop-blur-2xl sm:p-8"
              style={{
                animation:
                  "sentinelFloat 5s ease-in-out infinite",
              }}
            >
              <div className="pointer-events-none absolute inset-0 rounded-2xl border border-white/[0.03]" />

              <div className="pointer-events-none absolute left-1/2 top-[-110px] h-[220px] w-[220px] -translate-x-1/2 rounded-full bg-emerald-400/[0.06] blur-3xl" />

              <div className="pointer-events-none absolute right-0 top-0 h-px w-40 bg-gradient-to-r from-transparent via-emerald-300/50 to-transparent" />

              <div className="pointer-events-none absolute bottom-0 left-0 h-px w-40 bg-gradient-to-r from-transparent via-emerald-300/25 to-transparent" />

              <div className="mb-8 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-400/30 bg-emerald-300/[0.055]">
                    <LockKeyhole
                      size={19}
                      className="text-emerald-200"
                    />
                  </div>

                  <div>
                    <div className="text-lg font-bold tracking-wide text-white">
                      Access Terminal
                    </div>

                    <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-emerald-700">
                      Security console
                    </div>
                  </div>
                </div>

                <div className="rounded-md border border-emerald-950 bg-black/35 px-2 py-1 font-mono text-[8px] tracking-[0.18em] text-emerald-600">
                  SECURE
                </div>
              </div>

              <div className="mb-6 rounded-lg border border-emerald-950/80 bg-black/30 p-3">
                <div className="flex items-center gap-2 font-mono text-[9px] text-emerald-700">
                  <Terminal size={12} />

                  SENTINEL AUTH GATEWAY
                </div>

                <div className="mt-2 flex items-center gap-2 font-mono text-[10px] text-emerald-300">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300 shadow-[0_0_10px_rgba(110,255,170,.7)]" />

                  ENCRYPTED SESSION CHANNEL READY
                </div>
              </div>

              <div className="mb-6">
                <h2 className="text-2xl font-black text-white">
                  Sign in
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Authenticate to access
                  the security operations
                  console.
                </p>
              </div>

              {error && (
                <div className="mb-5 rounded-lg border border-red-500/30 bg-red-950/30 px-3 py-3 text-sm text-red-300">
                  <div className="mb-1 font-mono text-[9px] uppercase tracking-[0.18em] text-red-500">
                    Authentication Error
                  </div>

                  {error}
                </div>
              )}

              <form
                onSubmit={
                  handleSubmit
                }
                className="space-y-5"
              >
                <label className="block">
                  <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-emerald-700">
                    Operator ID
                  </span>

                  <input
                    value={username}
                    onChange={(
                      event,
                    ) =>
                      setUsername(
                        event.target.value,
                      )
                    }
                    autoComplete="username"
                    required
                    placeholder="Enter username"
                    className="mt-2 w-full rounded-lg border border-emerald-950 bg-black/40 px-3 py-3 text-sm text-white outline-none transition placeholder:text-slate-700 focus:border-emerald-500/70 focus:bg-emerald-950/10 focus:shadow-[0_0_30px_rgba(70,255,145,.07)]"
                  />
                </label>

                <label className="block">
                  <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-emerald-700">
                    Access Key
                  </span>

                  <input
                    value={password}
                    onChange={(
                      event,
                    ) =>
                      setPassword(
                        event.target.value,
                      )
                    }
                    type="password"
                    autoComplete="current-password"
                    required
                    placeholder="Enter access key"
                    className="mt-2 w-full rounded-lg border border-emerald-950 bg-black/40 px-3 py-3 text-sm text-white outline-none transition placeholder:text-slate-700 focus:border-emerald-500/70 focus:bg-emerald-950/10 focus:shadow-[0_0_30px_rgba(70,255,145,.07)]"
                  />
                </label>

                <button
                  type="submit"
                  disabled={
                    submitting ||
                    !username ||
                    !password
                  }
                  className="group relative w-full overflow-hidden rounded-lg border border-emerald-500/60 bg-emerald-400/[0.07] px-4 py-3 text-sm font-bold tracking-[0.05em] text-white transition duration-300 hover:border-emerald-300 hover:bg-emerald-300/[0.11] hover:shadow-[0_0_35px_rgba(70,255,145,.13)] disabled:opacity-40"
                >
                  <span className="absolute inset-y-0 left-0 w-1/3 -translate-x-full bg-gradient-to-r from-transparent via-white/[0.06] to-transparent transition-transform duration-700 group-hover:translate-x-[400%]" />

                  <span className="relative flex items-center justify-center gap-2">
                    <Crosshair
                      size={15}
                      className="text-emerald-300"
                    />

                    {submitting
                      ? "AUTHENTICATING..."
                      : "ESTABLISH SECURE SESSION"}
                  </span>
                </button>
              </form>

              <div className="mt-7 border-t border-emerald-950/80 pt-5">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-md border border-emerald-950/70 bg-black/25 p-2">
                    <div className="font-mono text-[8px] uppercase tracking-[0.16em] text-emerald-700">
                      Transport
                    </div>

                    <div className="mt-1 text-[10px] text-emerald-300">
                      TLS / JWT
                    </div>
                  </div>

                  <div className="rounded-md border border-emerald-950/70 bg-black/25 p-2">
                    <div className="font-mono text-[8px] uppercase tracking-[0.16em] text-emerald-700">
                      ML Engine
                    </div>

                    <div className="mt-1 text-[10px] text-emerald-300">
                      Isolation Forest
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-center gap-2 text-[8px] font-mono tracking-[0.16em] text-slate-700">
                  <Activity
                    size={11}
                    className="text-emerald-800"
                  />

                  DEFENSIVE MONITORING SYSTEM
                </div>

                <p className="mt-3 text-center font-mono text-[8px] tracking-[0.18em] text-slate-700">
                  AUTHORIZED SECURITY OPERATIONS ONLY
                </p>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-center gap-2 text-[9px] font-mono tracking-[0.16em] text-emerald-950">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500/60" />

              NODE ONLINE

              <span className="text-slate-900">
                //
              </span>

              SENTINEL-X v1
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}