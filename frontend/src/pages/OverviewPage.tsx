import {
  useEffect,
  useRef,
  useState,
} from "react";
import type { JSX } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  Database,
  ShieldCheck,
  Radio,
  Globe2,
  ArrowUpRight,
  Crosshair,
  Cpu,
  Network,
  Zap,
} from "lucide-react";
import * as THREE from "three";

import { getDashboardSummary } from "../services/analyticsService";
import PageContainer from "../components/layout/PageContainer";

interface OverviewStats {
  total_events: number;
  active_incidents: number;
  critical_alerts: number;
  high_risk_events: number;
  anomaly_count: number;
  monitored_assets: number;
}

interface OverviewCard {
  key: keyof OverviewStats;
  label: string;
  icon: typeof Activity;
  code: string;
}

interface NetworkNode {
  position: THREE.Vector3;
  mesh: THREE.Mesh;
  pulse: THREE.Mesh;
}

interface NetworkConnection {
  line: THREE.Line<
    THREE.BufferGeometry,
    THREE.LineBasicMaterial
  >;
  start: THREE.Vector3;
  end: THREE.Vector3;
  particle: THREE.Mesh;
  progress: number;
  speed: number;
}

const cards: OverviewCard[] = [
  {
    key: "total_events",
    label: "Total Events",
    icon: Activity,
    code: "EVT",
  },
  {
    key: "active_incidents",
    label: "Active Incidents",
    icon: AlertTriangle,
    code: "INC",
  },
  {
    key: "critical_alerts",
    label: "Critical Alerts",
    icon: Bell,
    code: "CRT",
  },
  {
    key: "high_risk_events",
    label: "High-Risk Events",
    icon: ShieldCheck,
    code: "RSK",
  },
  {
    key: "anomaly_count",
    label: "ML Anomalies",
    icon: BarChart3,
    code: "ML",
  },
  {
    key: "monitored_assets",
    label: "Monitored Assets",
    icon: Database,
    code: "AST",
  },
];

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

  const controlPoint = start
    .clone()
    .add(end)
    .normalize()
    .multiplyScalar(radius * 1.58);

  const curve =
    new THREE.QuadraticBezierCurve3(
      start.clone(),
      controlPoint,
      end.clone(),
    );

  for (
    let index = 0;
    index <= 42;
    index += 1
  ) {
    points.push(
      curve.getPoint(index / 42),
    );
  }

  return points;
}

function TacticalGlobe(): JSX.Element {
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
        40,
        mount.clientWidth /
          Math.max(
            mount.clientHeight,
            1,
          ),
        0.1,
        100,
      );

    camera.position.set(
      0,
      0.15,
      8.5,
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

    const radius = 2.25;

    /*
     * GLOBE CORE
     */

    const globeGeometry =
      new THREE.SphereGeometry(
        radius,
        64,
        64,
      );

    const globeMaterial =
      new THREE.MeshBasicMaterial({
        color: 0x040906,
        transparent: true,
        opacity: 0.97,
      });

    const globe =
      new THREE.Mesh(
        globeGeometry,
        globeMaterial,
      );

    globeGroup.add(globe);

    /*
     * GEODETIC GRID
     */

    const gridGeometry =
      new THREE.WireframeGeometry(
        globeGeometry,
      );

    const gridMaterial =
      new THREE.LineBasicMaterial({
        color: 0x47ff91,
        transparent: true,
        opacity: 0.24,
      });

    const grid =
      new THREE.LineSegments(
        gridGeometry,
        gridMaterial,
      );

    globeGroup.add(grid);

    /*
     * ATMOSPHERIC SHELL
     */

    const shellGeometry =
      new THREE.SphereGeometry(
        radius * 1.045,
        48,
        48,
      );

    const shellMaterial =
      new THREE.MeshBasicMaterial({
        color: 0x6aff9f,
        transparent: true,
        opacity: 0.045,
        side: THREE.BackSide,
      });

    const shell =
      new THREE.Mesh(
        shellGeometry,
        shellMaterial,
      );

    globeGroup.add(shell);

    /*
     * NODES
     */

    const nodeGroup =
      new THREE.Group();

    globeGroup.add(nodeGroup);

    const nodes: NetworkNode[] = [];

    const locations = [
      { lat: 51.5, lon: -0.1 },
      { lat: 40.7, lon: -74.0 },
      { lat: 37.8, lon: -122.4 },
      { lat: 19.1, lon: 72.9 },
      { lat: 28.6, lon: 77.2 },
      { lat: 25.2, lon: 55.3 },
      { lat: 1.3, lon: 103.8 },
      { lat: 35.7, lon: 139.7 },
      { lat: 31.2, lon: 121.5 },
      { lat: -33.9, lon: 151.2 },
      { lat: -23.5, lon: -46.6 },
      { lat: 48.8, lon: 2.3 },
      { lat: 52.5, lon: 13.4 },
      { lat: 59.3, lon: 18.1 },
      { lat: 41.0, lon: 28.9 },
      { lat: 38.9, lon: -77.0 },
      { lat: 32.1, lon: 34.8 },
      { lat: 37.6, lon: 127.0 },
    ];

    locations.forEach(
      ({ lat, lon }) => {
        const position =
          latLonToVector3(
            lat,
            lon,
            radius * 1.012,
          );

        const nodeGeometry =
          new THREE.SphereGeometry(
            0.047,
            12,
            12,
          );

        const nodeMaterial =
          new THREE.MeshBasicMaterial({
            color: 0xffffff,
          });

        const mesh =
          new THREE.Mesh(
            nodeGeometry,
            nodeMaterial,
          );

        mesh.position.copy(
          position,
        );

        nodeGroup.add(mesh);

        const pulseGeometry =
          new THREE.RingGeometry(
            0.075,
            0.092,
            24,
          );

        const pulseMaterial =
          new THREE.MeshBasicMaterial({
            color: 0x58ff9b,
            transparent: true,
            opacity: 0.38,
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

        nodes.push({
          position,
          mesh,
          pulse,
        });
      },
    );

    /*
     * CONNECTIONS
     */

    const connectionGroup =
      new THREE.Group();

    globeGroup.add(
      connectionGroup,
    );

    const particleGroup =
      new THREE.Group();

    globeGroup.add(
      particleGroup,
    );

    const connections: NetworkConnection[] =
      [];

    const linkPairs = [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
      [5, 6],
      [6, 7],
      [7, 8],
      [8, 9],
      [10, 11],
      [11, 12],
      [12, 13],
      [13, 14],
      [14, 16],
      [15, 1],
      [15, 17],
      [16, 3],
      [2, 11],
      [5, 14],
    ];

    linkPairs.forEach(
      ([sourceIndex, targetIndex], index) => {
        const start =
          nodes[sourceIndex]
            .position.clone();

        const end =
          nodes[targetIndex]
            .position.clone();

        const points =
          createArcPoints(
            start,
            end,
            radius,
          );

        const lineGeometry =
          new THREE.BufferGeometry().setFromPoints(
            points,
          );

        const lineMaterial =
          new THREE.LineBasicMaterial({
            color:
              index % 3 === 0
                ? 0xffffff
                : 0x43ff8d,
            transparent: true,
            opacity:
              index % 3 === 0
                ? 0.18
                : 0.34,
          });

        const line =
          new THREE.Line(
            lineGeometry,
            lineMaterial,
          );

        connectionGroup.add(
          line,
        );

        const particleGeometry =
          new THREE.SphereGeometry(
            0.032,
            8,
            8,
          );

        const particleMaterial =
          new THREE.MeshBasicMaterial({
            color:
              index % 3 === 0
                ? 0xffffff
                : 0x9cffc3,
          });

        const particle =
          new THREE.Mesh(
            particleGeometry,
            particleMaterial,
          );

        particleGroup.add(
          particle,
        );

        connections.push({
          line,
          start,
          end,
          particle,
          progress:
            Math.random(),
          speed:
            0.0028 +
            Math.random() *
              0.0035,
        });
      },
    );

    /*
     * DATA PARTICLES
     */

    const particlesGeometry =
      new THREE.BufferGeometry();

    const count = 500;

    const positionArray =
      new Float32Array(
        count * 3,
      );

    for (
      let index = 0;
      index < count;
      index += 1
    ) {
      const particleRadius =
        4.2 +
        Math.random() * 3.2;

      const theta =
        Math.random() *
        Math.PI *
        2;

      const phi =
        Math.acos(
          Math.random() * 2 -
            1,
        );

      positionArray[
        index * 3
      ] =
        particleRadius *
        Math.sin(phi) *
        Math.cos(theta);

      positionArray[
        index * 3 + 1
      ] =
        particleRadius *
        Math.cos(phi);

      positionArray[
        index * 3 + 2
      ] =
        particleRadius *
        Math.sin(phi) *
        Math.sin(theta);
    }

    particlesGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(
        positionArray,
        3,
      ),
    );

    const particlesMaterial =
      new THREE.PointsMaterial({
        color: 0x7effaa,
        size: 0.018,
        transparent: true,
        opacity: 0.4,
        sizeAttenuation: true,
      });

    const particles =
      new THREE.Points(
        particlesGeometry,
        particlesMaterial,
      );

    scene.add(particles);

    /*
     * ORBITS
     */

    const orbitGeometry =
      new THREE.TorusGeometry(
        radius * 1.24,
        0.01,
        10,
        160,
      );

    const orbitMaterial =
      new THREE.MeshBasicMaterial({
        color: 0x7affab,
        transparent: true,
        opacity: 0.48,
      });

    const orbit =
      new THREE.Mesh(
        orbitGeometry,
        orbitMaterial,
      );

    orbit.rotation.x =
      THREE.MathUtils.degToRad(
        62,
      );

    orbit.rotation.z =
      THREE.MathUtils.degToRad(
        -18,
      );

    globeGroup.add(orbit);

    const orbit2Geometry =
      new THREE.TorusGeometry(
        radius * 1.36,
        0.006,
        10,
        160,
      );

    const orbit2Material =
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.16,
      });

    const orbit2 =
      new THREE.Mesh(
        orbit2Geometry,
        orbit2Material,
      );

    orbit2.rotation.x =
      THREE.MathUtils.degToRad(
        -54,
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
        elapsed * 0.055;

      globeGroup.rotation.x =
        Math.sin(
          elapsed * 0.15,
        ) * 0.025;

      particles.rotation.y =
        elapsed * 0.006;

      orbit.rotation.z +=
        0.0018;

      orbit2.rotation.z -=
        0.0011;

      nodes.forEach(
        (node, index) => {
          const pulseScale =
            1 +
            (
              (
                Math.sin(
                  elapsed *
                    2.4 +
                    index,
                ) +
                1
              ) /
              2
            ) *
              0.9;

          node.pulse.scale.set(
            pulseScale,
            pulseScale,
            pulseScale,
          );

          (
            node.pulse
              .material as THREE.MeshBasicMaterial
          ).opacity =
            0.1 +
            pulseScale *
              0.14;
        },
      );

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

          const points =
            createArcPoints(
              connection.start,
              connection.end,
              radius,
            );

          const position =
            points[
              Math.min(
                Math.floor(
                  connection.progress *
                    (points.length -
                      1),
                ),
                points.length -
                  1,
              )
            ];

          connection.particle.position.copy(
            position,
          );
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
      gridGeometry.dispose();
      gridMaterial.dispose();
      shellGeometry.dispose();
      shellMaterial.dispose();
      particlesGeometry.dispose();
      particlesMaterial.dispose();
      orbitGeometry.dispose();
      orbitMaterial.dispose();
      orbit2Geometry.dispose();
      orbit2Material.dispose();

      nodes.forEach(
        (node) => {
          node.mesh.geometry.dispose();

          (
            node.mesh
              .material as THREE.Material
          ).dispose();

          node.pulse.geometry.dispose();

          (
            node.pulse
              .material as THREE.Material
          ).dispose();
        },
      );

      connections.forEach(
        (connection) => {
          connection.line.geometry.dispose();
          connection.line.material.dispose();
          connection.particle.geometry.dispose();

          (
            connection.particle
              .material as THREE.Material
          ).dispose();
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

function MetricCard({
  card,
  value,
  index,
}: {
  card: OverviewCard;
  value: number;
  index: number;
}): JSX.Element {
  const Icon = card.icon;

  return (
    <div
      className="group relative overflow-hidden rounded-xl border border-emerald-950/80 bg-[#050a07]/85 p-4 transition duration-300 hover:-translate-y-1 hover:border-emerald-700/70 hover:shadow-[0_14px_45px_rgba(50,255,130,.06)]"
      style={{
        animationDelay: `${
          index * 70
        }ms`,
      }}
    >
      <div className="pointer-events-none absolute right-0 top-0 h-px w-20 bg-gradient-to-r from-transparent via-emerald-300/45 to-transparent" />

      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[8px] tracking-[0.2em] text-emerald-800">
              {card.code}
            </span>

            <span className="h-1 w-1 rounded-full bg-emerald-500/50" />
          </div>

          <p className="mt-2 text-[10px] uppercase tracking-[0.15em] text-slate-600">
            {card.label}
          </p>
        </div>

        <div className="rounded-lg border border-emerald-950 bg-emerald-400/[0.04] p-2">
          <Icon
            size={16}
            className="text-emerald-300"
            aria-hidden="true"
          />
        </div>
      </div>

      <div className="mt-4 flex items-end justify-between">
        <p className="font-mono text-2xl font-black tracking-tight text-white">
          {value.toLocaleString()}
        </p>

        <ArrowUpRight
          size={14}
          className="mb-1 text-emerald-800 transition duration-300 group-hover:text-emerald-300"
        />
      </div>

      <div className="mt-3 h-px overflow-hidden bg-emerald-950">
        <div
          className="h-full origin-left bg-emerald-400/70"
          style={{
            width: `${Math.min(
              100,
              16 +
                (value % 84),
            )}%`,
          }}
        />
      </div>
    </div>
  );
}

export default function OverviewPage(): JSX.Element {
  const [
    summary,
    setSummary,
  ] = useState<OverviewStats | null>(
    null,
  );

  const [
    error,
    setError,
  ] = useState<string | null>(
    null,
  );

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    lastSync,
    setLastSync,
  ] = useState(
    new Date(),
  );

  useEffect(() => {
    let mounted = true;

    const loadSummary =
      async (): Promise<void> => {
        try {
          const data =
            await getDashboardSummary();

          if (mounted) {
            setSummary(
              data as unknown as OverviewStats,
            );

            setLastSync(
              new Date(),
            );

            setError(null);
          }
        } catch (err) {
          if (mounted) {
            setError(
              err instanceof Error
                ? err.message
                : "Unable to load security overview.",
            );
          }
        } finally {
          if (mounted) {
            setLoading(false);
          }
        }
      };

    void loadSummary();

    const interval =
      window.setInterval(
        () => {
          void loadSummary();
        },
        10000,
      );

    return () => {
      mounted = false;
      window.clearInterval(
        interval,
      );
    };
  }, []);

  const threatLevel =
    summary &&
    summary.critical_alerts >
      0
      ? "ELEVATED"
      : summary &&
          summary.high_risk_events >
            0
        ? "GUARDED"
        : "NOMINAL";

  return (
    <PageContainer
      title="Security Overview"
      subtitle="SENTINEL-X command center // defensive telemetry posture"
    >
      <style>
        {`
          @keyframes sentinelHudPulse {
            0%,
            100% {
              opacity: .28;
            }

            50% {
              opacity: .8;
            }
          }

          @keyframes sentinelScanLine {
            0% {
              transform: translateY(-120%);
            }

            100% {
              transform: translateY(120%);
            }
          }

          @keyframes sentinelBootUp {
            from {
              opacity: 0;
              transform: translateY(8px);
            }

            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          .sentinel-hud-grid {
            background-image:
              linear-gradient(
                rgba(70, 255, 140, .035) 1px,
                transparent 1px
              ),
              linear-gradient(
                90deg,
                rgba(70, 255, 140, .035) 1px,
                transparent 1px
              );
            background-size: 38px 38px;
          }
        `}
      </style>

      {loading && (
        <div className="rounded-xl border border-emerald-950 bg-[#050a07]/85 px-5 py-4 font-mono text-xs tracking-[0.12em] text-emerald-500">
          INITIALIZING SECURITY TELEMETRY...
        </div>
      )}

      {!loading && error && (
        <div className="rounded-xl border border-red-900/70 bg-red-950/20 px-5 py-4 text-sm text-red-300">
          <div className="mb-1 font-mono text-[9px] tracking-[0.18em] text-red-500">
            TELEMETRY LINK ERROR
          </div>

          {error}
        </div>
      )}

      {!loading && summary && (
        <div
          className="relative space-y-4"
          style={{
            animation:
              "sentinelBootUp .55s ease-out",
          }}
        >
          <section className="relative min-h-[560px] overflow-hidden rounded-2xl border border-emerald-950/90 bg-[#020603] shadow-[0_20px_80px_rgba(0,0,0,.4)]">
            <div className="sentinel-hud-grid pointer-events-none absolute inset-0 opacity-80" />

            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_53%_50%,rgba(60,255,140,.08),transparent_26%),linear-gradient(90deg,rgba(0,0,0,.18),transparent_35%,transparent_70%,rgba(0,0,0,.18))]" />

            <div className="absolute left-5 top-5 z-10">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-800/70 bg-emerald-400/[0.04]">
                  <Globe2
                    size={19}
                    className="text-emerald-300"
                  />
                </div>

                <div>
                  <div className="font-mono text-[9px] font-bold tracking-[0.22em] text-emerald-400">
                    GLOBAL DEFENSE MESH
                  </div>

                  <div className="mt-1 text-[10px] text-slate-600">
                    Distributed security telemetry visualization
                  </div>
                </div>
              </div>
            </div>

            <div className="absolute right-5 top-5 z-10 flex gap-2">
              <div className="hidden rounded-lg border border-emerald-950 bg-black/40 px-3 py-2 sm:block">
                <div className="font-mono text-[8px] tracking-[0.18em] text-slate-700">
                  LAST SYNC
                </div>

                <div className="mt-1 font-mono text-[10px] text-emerald-300">
                  {lastSync.toLocaleTimeString()}
                </div>
              </div>

              <div className="rounded-lg border border-emerald-800/70 bg-emerald-400/[0.04] px-3 py-2">
                <div className="flex items-center gap-2 font-mono text-[8px] tracking-[0.18em] text-emerald-600">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300 shadow-[0_0_10px_rgba(100,255,160,.9)]" />
                  AUTO SYNC
                </div>

                <div className="mt-1 font-mono text-[10px] text-white">
                  10 SEC CYCLE
                </div>
              </div>
            </div>

            <div className="absolute inset-0">
              <TacticalGlobe />
            </div>

            <div className="pointer-events-none absolute bottom-5 left-5 z-10 max-w-[280px]">
              <div className="mb-2 flex items-center gap-2 font-mono text-[8px] tracking-[0.2em] text-emerald-700">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" />
                NETWORK FABRIC ACTIVE
              </div>

              <div className="font-mono text-lg font-bold tracking-wide text-white">
                SENTINEL-X
                <span className="text-emerald-300">
                  {" // "}
                </span>
                GLOBAL SOC
              </div>

              <p className="mt-1 text-[10px] leading-5 text-slate-600">
                Animated visualization of monitored
                telemetry routes and active security nodes.
              </p>
            </div>

            <div className="absolute bottom-5 right-5 z-10 hidden md:block">
              <div className="grid grid-cols-2 gap-2">
                {[
                  [
                    "NODES",
                    summary.monitored_assets,
                  ],
                  [
                    "EVENTS",
                    summary.total_events,
                  ],
                  [
                    "ANOMALIES",
                    summary.anomaly_count,
                  ],
                  [
                    "INCIDENTS",
                    summary.active_incidents,
                  ],
                ].map(
                  ([label, value]) => (
                    <div
                      key={label}
                      className="min-w-[108px] rounded-lg border border-emerald-950 bg-black/45 px-3 py-2 backdrop-blur-md"
                    >
                      <div className="font-mono text-[8px] tracking-[0.15em] text-slate-700">
                        {label}
                      </div>

                      <div className="mt-1 font-mono text-xs font-bold text-emerald-300">
                        {Number(
                          value,
                        ).toLocaleString()}
                      </div>
                    </div>
                  ),
                )}
              </div>
            </div>

            <div className="pointer-events-none absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-emerald-300/[0.04] to-transparent" />

            <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-emerald-300/[0.02] to-transparent" />

            <div
              className="pointer-events-none absolute left-0 right-0 h-20 bg-gradient-to-b from-transparent via-emerald-300/[0.025] to-transparent"
              style={{
                animation:
                  "sentinelScanLine 8s linear infinite",
              }}
            />
          </section>

          <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            {cards.map(
              (card, index) => (
                <MetricCard
                  key={card.key}
                  card={card}
                  value={summary[card.key]}
                  index={index}
                />
              ),
            )}
          </section>

          <section className="grid gap-4 xl:grid-cols-[1.15fr_.85fr]">
            <div className="rounded-xl border border-emerald-950/80 bg-[#050a07]/90 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Activity
                      size={16}
                      className="text-emerald-300"
                    />

                    <h2 className="text-sm font-bold tracking-wide text-white">
                      Security Telemetry
                    </h2>
                  </div>

                  <p className="mt-1 text-[10px] text-slate-600">
                    Current aggregate telemetry reported by Sentinel-X.
                  </p>
                </div>

                <div className="flex items-center gap-2 rounded-md border border-emerald-950 bg-black/20 px-2 py-1">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" />

                  <span className="font-mono text-[8px] tracking-[0.16em] text-emerald-700">
                    POLLING ACTIVE
                  </span>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
                <div className="rounded-lg border border-emerald-950 bg-black/20 p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[8px] tracking-[0.16em] text-slate-700">
                      EVENTS
                    </span>

                    <Zap
                      size={13}
                      className="text-emerald-800"
                    />
                  </div>

                  <p className="mt-3 font-mono text-xl font-black text-white">
                    {summary.total_events.toLocaleString()}
                  </p>
                </div>

                <div className="rounded-lg border border-emerald-950 bg-black/20 p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[8px] tracking-[0.16em] text-slate-700">
                      INCIDENTS
                    </span>

                    <AlertTriangle
                      size={13}
                      className="text-emerald-800"
                    />
                  </div>

                  <p className="mt-3 font-mono text-xl font-black text-white">
                    {summary.active_incidents.toLocaleString()}
                  </p>
                </div>

                <div className="rounded-lg border border-emerald-950 bg-black/20 p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[8px] tracking-[0.16em] text-slate-700">
                      HIGH RISK
                    </span>

                    <ShieldCheck
                      size={13}
                      className="text-emerald-800"
                    />
                  </div>

                  <p className="mt-3 font-mono text-xl font-black text-white">
                    {summary.high_risk_events.toLocaleString()}
                  </p>
                </div>

                <div className="rounded-lg border border-emerald-950 bg-black/20 p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[8px] tracking-[0.16em] text-slate-700">
                      ML
                    </span>

                    <Cpu
                      size={13}
                      className="text-emerald-800"
                    />
                  </div>

                  <p className="mt-3 font-mono text-xl font-black text-white">
                    {summary.anomaly_count.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-emerald-950/80 bg-[#050a07]/90 p-5">
              <div className="flex items-center gap-2">
                <Crosshair
                  size={16}
                  className="text-emerald-300"
                />

                <div>
                  <h2 className="text-sm font-bold text-white">
                    Threat Posture
                  </h2>

                  <p className="mt-1 text-[10px] text-slate-600">
                    Current defensive state derived from telemetry.
                  </p>
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between rounded-lg border border-emerald-950 bg-black/25 p-4">
                <div>
                  <div className="font-mono text-[8px] tracking-[0.18em] text-slate-700">
                    SYSTEM STATE
                  </div>

                  <div className="mt-2 font-mono text-lg font-black tracking-[0.12em] text-emerald-300">
                    {threatLevel}
                  </div>
                </div>

                <div className="relative flex h-16 w-16 items-center justify-center rounded-full border border-emerald-900/70">
                  <div className="absolute inset-2 animate-pulse rounded-full border border-emerald-400/30" />

                  <ShieldCheck
                    size={25}
                    className="text-emerald-200"
                  />
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="rounded-md border border-emerald-950 bg-black/20 px-3 py-2">
                  <div className="font-mono text-[8px] text-slate-700">
                    CRITICAL
                  </div>

                  <div className="mt-1 font-mono text-xs text-white">
                    {summary.critical_alerts}
                  </div>
                </div>

                <div className="rounded-md border border-emerald-950 bg-black/20 px-3 py-2">
                  <div className="font-mono text-[8px] text-slate-700">
                    ASSETS
                  </div>

                  <div className="mt-1 font-mono text-xs text-white">
                    {summary.monitored_assets}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-emerald-950/80 bg-[#050a07]/90 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Network
                    size={16}
                    className="text-emerald-300"
                  />

                  <h2 className="text-sm font-bold text-white">
                    Command Shortcuts
                  </h2>
                </div>

                <p className="mt-1 text-[10px] text-slate-600">
                  Open the primary monitoring systems.
                </p>
              </div>

              <div className="flex items-center gap-2 font-mono text-[8px] tracking-[0.16em] text-emerald-800">
                <Radio size={11} />
                COMMAND LINK READY
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                {
                  to: "/events",
                  label: "LIVE EVENTS",
                  code: "01",
                  icon: Activity,
                },
                {
                  to: "/events/explorer",
                  label: "EVENT EXPLORER",
                  code: "02",
                  icon: Database,
                },
                {
                  to: "/incidents",
                  label: "INCIDENTS",
                  code: "03",
                  icon: AlertTriangle,
                },
                {
                  to: "/analytics",
                  label: "ANALYTICS",
                  code: "04",
                  icon: BarChart3,
                },
              ].map(
                ({
                  to,
                  label,
                  code,
                  icon: Icon,
                }) => (
                  <Link
                    key={to}
                    to={to}
                    className="group relative overflow-hidden rounded-lg border border-emerald-950 bg-black/25 p-4 transition duration-300 hover:-translate-y-1 hover:border-emerald-600/70 hover:bg-emerald-400/[0.03]"
                  >
                    <div className="absolute inset-x-0 bottom-0 h-px origin-left scale-x-0 bg-emerald-300/70 transition-transform duration-300 group-hover:scale-x-100" />

                    <div className="flex items-center justify-between">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-950 bg-emerald-400/[0.035]">
                        <Icon
                          size={15}
                          className="text-emerald-300"
                        />
                      </div>

                      <span className="font-mono text-[8px] tracking-[0.18em] text-emerald-900">
                        CMD {code}
                      </span>
                    </div>

                    <div className="mt-4 flex items-center justify-between">
                      <span className="font-mono text-[10px] font-bold tracking-[0.15em] text-slate-300 transition group-hover:text-white">
                        {label}
                      </span>

                      <ArrowUpRight
                        size={14}
                        className="text-emerald-900 transition group-hover:text-emerald-300"
                      />
                    </div>
                  </Link>
                ),
              )}
            </div>
          </section>

          <div className="flex flex-wrap items-center justify-between gap-2 px-1 pb-1 font-mono text-[8px] tracking-[0.16em] text-slate-800">
            <span>
              SENTINEL-X // DEFENSIVE SECURITY OPERATIONS
            </span>

            <span className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500/70" />
              TELEMETRY CHANNEL OPERATIONAL
            </span>
          </div>
        </div>
      )}
    </PageContainer>
  );
}