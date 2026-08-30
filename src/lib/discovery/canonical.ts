import type { Difficulty, Resource, ResourceType } from "@/lib/domain/types";
import { SKILL_BY_ID } from "@/lib/catalog/skills";

// ── Layer 1b: canonical sources ───────────────────────────────────────────────
// Hand-verified PRIMARY sources (official docs, university/OER courses, free
// books) attached to SKILLS — never to careers — so one entry serves every goal
// that needs that skill. This is what makes an open goal land on real material
// without a search API, and it is the only place external URLs are written down.
//
// The LLM never contributes here. Nothing in this file is generated.

type Src = [
  title: string,
  url: string,
  provider: string,
  type: ResourceType,
  difficulty: Difficulty,
  hours: number,
];

const SOURCES: Record<string, Src[]> = {
  // ── Systems ────────────────────────────────────────────────────────────────
  "c-programming": [
    ["Beej's Guide to C Programming", "https://beej.us/guide/bgc/", "Beej", "book", "beginner", 25],
    ["C Reference", "https://en.cppreference.com/w/c", "cppreference", "documentation", "intermediate", 8],
  ],
  "cpp-programming": [
    ["Learn C++", "https://www.learncpp.com/", "LearnCpp", "tutorial", "beginner", 40],
    ["C++ Reference", "https://en.cppreference.com/w/", "cppreference", "documentation", "intermediate", 10],
  ],
  algorithms: [
    ["MIT 6.006 Introduction to Algorithms", "https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/", "MIT OpenCourseWare", "course", "intermediate", 40],
    ["VisuAlgo — algorithm visualizations", "https://visualgo.net/en", "VisuAlgo", "tutorial", "beginner", 10],
  ],
  "computer-architecture": [
    ["Nand to Tetris", "https://www.nand2tetris.org/", "Nand2Tetris", "course", "beginner", 40],
    ["MIT 6.004 Computation Structures", "https://ocw.mit.edu/courses/6-004-computation-structures-spring-2017/", "MIT OpenCourseWare", "course", "intermediate", 45],
  ],
  assembly: [
    ["x86 Assembly", "https://en.wikibooks.org/wiki/X86_Assembly", "Wikibooks", "book", "intermediate", 20],
    ["x86 and amd64 instruction reference", "https://www.felixcloutier.com/x86/", "Felix Cloutier", "documentation", "advanced", 6],
  ],
  "operating-systems": [
    ["Operating Systems: Three Easy Pieces", "https://pages.cs.wisc.edu/~remzi/OSTEP/", "UW–Madison", "book", "intermediate", 50],
    ["The Linux Programming Interface", "https://man7.org/tlpi/", "man7.org", "book", "advanced", 60],
  ],
  "memory-management": [
    ["Linux memory management docs", "https://www.kernel.org/doc/html/latest/mm/index.html", "kernel.org", "documentation", "advanced", 12],
    ["glibc malloc internals", "https://sourceware.org/glibc/wiki/MallocInternals", "sourceware", "documentation", "advanced", 5],
  ],
  concurrency: [
    ["The Little Book of Semaphores", "https://greenteapress.com/wp/semaphores/", "Green Tea Press", "book", "intermediate", 20],
    ["C++ std::atomic reference", "https://en.cppreference.com/w/cpp/atomic", "cppreference", "documentation", "advanced", 5],
  ],
  "systems-programming": [
    ["Linux man-pages", "https://man7.org/linux/man-pages/", "man7.org", "documentation", "intermediate", 10],
    ["The Linux Programming Interface", "https://man7.org/tlpi/", "man7.org", "book", "advanced", 60],
  ],
  "debugging-tools": [
    ["GDB User Manual", "https://sourceware.org/gdb/current/onlinedocs/gdb/", "GNU", "documentation", "intermediate", 8],
    ["Valgrind Manual", "https://valgrind.org/docs/manual/manual.html", "Valgrind", "documentation", "intermediate", 6],
  ],
  "build-systems": [
    ["GNU Make Manual", "https://www.gnu.org/software/make/manual/make.html", "GNU", "documentation", "intermediate", 8],
    ["CMake Tutorial", "https://cmake.org/cmake/help/latest/guide/tutorial/index.html", "Kitware", "tutorial", "intermediate", 6],
  ],
  filesystems: [
    ["Linux filesystems documentation", "https://www.kernel.org/doc/html/latest/filesystems/index.html", "kernel.org", "documentation", "advanced", 12],
  ],
  "network-programming": [
    ["Beej's Guide to Network Programming", "https://beej.us/guide/bgnet/", "Beej", "book", "intermediate", 20],
  ],
  "performance-optimization": [
    ["Linux Performance", "https://www.brendangregg.com/linuxperf.html", "Brendan Gregg", "documentation", "advanced", 15],
    ["Software optimization resources", "https://www.agner.org/optimize/", "Agner Fog", "book", "advanced", 25],
  ],
  "kernel-development": [
    ["The Linux Kernel documentation", "https://www.kernel.org/doc/html/latest/", "kernel.org", "documentation", "advanced", 30],
    ["Linux Kernel Module Programming Guide", "https://sysprog21.github.io/lkmpg/", "sysprog21", "tutorial", "advanced", 20],
    ["Linux Kernel Labs", "https://linux-kernel-labs.github.io/refs/heads/master/", "Linux Kernel Labs", "course", "advanced", 40],
  ],
  "device-drivers": [
    ["Linux Device Drivers, Third Edition", "https://lwn.net/Kernel/LDD3/", "LWN.net", "book", "advanced", 35],
    ["Driver Basics", "https://www.kernel.org/doc/html/latest/driver-api/basics.html", "kernel.org", "documentation", "advanced", 8],
  ],
  compilers: [
    ["Crafting Interpreters", "https://craftinginterpreters.com/", "Robert Nystrom", "book", "intermediate", 45],
    ["LLVM Tutorial: Building a Language", "https://llvm.org/docs/tutorial/", "LLVM", "tutorial", "advanced", 25],
  ],

  // ── Embedded ───────────────────────────────────────────────────────────────
  "digital-electronics": [
    ["All About Circuits — Digital textbook", "https://www.allaboutcircuits.com/textbook/digital/", "All About Circuits", "book", "beginner", 20],
  ],
  "embedded-c": [
    ["Interrupt — embedded engineering", "https://interrupt.memfault.com/", "Memfault", "tutorial", "intermediate", 15],
  ],
  microcontrollers: [
    ["Arduino Documentation", "https://docs.arduino.cc/", "Arduino", "documentation", "beginner", 12],
    ["ESP-IDF Programming Guide", "https://docs.espressif.com/projects/esp-idf/en/latest/", "Espressif", "documentation", "intermediate", 20],
  ],
  "hardware-interfaces": [
    ["I2C tutorial", "https://learn.sparkfun.com/tutorials/i2c", "SparkFun", "tutorial", "beginner", 3],
    ["Serial Peripheral Interface (SPI)", "https://learn.sparkfun.com/tutorials/serial-peripheral-interface-spi", "SparkFun", "tutorial", "beginner", 3],
  ],
  rtos: [
    ["FreeRTOS documentation", "https://www.freertos.org/", "FreeRTOS", "documentation", "intermediate", 15],
    ["Zephyr Project documentation", "https://docs.zephyrproject.org/latest/", "Zephyr", "documentation", "advanced", 20],
  ],
  "signal-processing": [
    ["The Scientist and Engineer's Guide to DSP", "https://www.dspguide.com/", "Analog Devices", "book", "intermediate", 30],
    ["Think DSP", "https://greenteapress.com/wp/think-dsp/", "Green Tea Press", "book", "beginner", 18],
  ],
  "fpga-verilog": [
    ["HDLBits — Verilog practice", "https://hdlbits.01xz.net/wiki/Main_Page", "HDLBits", "exercise", "intermediate", 25],
    ["Nandland FPGA tutorials", "https://nandland.com/", "Nandland", "tutorial", "beginner", 15],
  ],

  // ── Robotics ───────────────────────────────────────────────────────────────
  "robotics-fundamentals": [
    ["Modern Robotics (course & book)", "https://modernrobotics.northwestern.edu/", "Northwestern University", "course", "intermediate", 45],
  ],
  ros: [
    ["ROS 2 Tutorials", "https://docs.ros.org/en/humble/Tutorials.html", "Open Robotics", "tutorial", "intermediate", 30],
    ["ROS 2 Documentation", "https://docs.ros.org/en/humble/", "Open Robotics", "documentation", "intermediate", 15],
  ],
  kinematics: [
    ["Modern Robotics: Mechanics, Planning, and Control", "https://modernrobotics.northwestern.edu/", "Northwestern University", "book", "intermediate", 40],
  ],
  "control-systems": [
    ["Control Tutorials for MATLAB & Simulink", "https://ctms.engin.umich.edu/CTMS/index.php?aux=Home", "University of Michigan", "tutorial", "intermediate", 25],
    ["Underactuated Robotics", "https://underactuated.mit.edu/", "MIT", "course", "advanced", 40],
  ],
  "state-estimation": [
    ["Kalman Filter Tutorial", "https://www.kalmanfilter.net/", "kalmanfilter.net", "tutorial", "intermediate", 12],
    ["Kalman and Bayesian Filters in Python", "https://github.com/rlabbe/Kalman-and-Bayesian-Filters-in-Python", "Roger Labbe", "book", "intermediate", 30],
  ],
  "motion-planning": [
    ["Planning Algorithms", "https://lavalle.pl/planning/", "Steven LaValle", "book", "advanced", 45],
  ],
  "optimal-control": [
    ["Underactuated Robotics", "https://underactuated.mit.edu/", "MIT", "course", "advanced", 40],
  ],
  slam: [
    ["OpenSLAM", "https://openslam-org.github.io/", "OpenSLAM", "documentation", "advanced", 15],
  ],
  "robot-simulation": [
    ["Gazebo documentation", "https://gazebosim.org/docs", "Open Robotics", "documentation", "intermediate", 12],
  ],
  "sensors-actuators": [
    ["Adafruit Learn", "https://learn.adafruit.com/", "Adafruit", "tutorial", "beginner", 12],
  ],
  "autonomous-systems": [
    ["Self-Driving Cars Specialization", "https://www.coursera.org/specializations/self-driving-cars", "University of Toronto", "course", "advanced", 60],
    ["Autoware — open autonomous driving stack", "https://github.com/autowarefoundation/autoware", "Autoware Foundation", "project", "advanced", 30],
  ],

  // ── Graphics ───────────────────────────────────────────────────────────────
  "computer-graphics": [
    ["Scratchapixel", "https://www.scratchapixel.com/", "Scratchapixel", "tutorial", "intermediate", 30],
    ["MIT 6.837 Computer Graphics", "https://ocw.mit.edu/courses/6-837-computer-graphics-fall-2012/", "MIT OpenCourseWare", "course", "intermediate", 40],
  ],
  "graphics-apis": [
    ["Learn OpenGL", "https://learnopengl.com/", "LearnOpenGL", "tutorial", "intermediate", 35],
    ["Vulkan Tutorial", "https://vulkan-tutorial.com/", "Vulkan Tutorial", "tutorial", "advanced", 30],
  ],
  shaders: [
    ["The Book of Shaders", "https://thebookofshaders.com/", "Patricio Gonzalez Vivo", "book", "intermediate", 20],
    ["Shadertoy", "https://www.shadertoy.com/", "Shadertoy", "exercise", "intermediate", 10],
  ],
  "rendering-pipeline": [
    ["Real-Time Rendering resources", "https://www.realtimerendering.com/", "Real-Time Rendering", "documentation", "advanced", 20],
    ["Filament — physically based rendering", "https://google.github.io/filament/Filament.html", "Google", "documentation", "advanced", 15],
  ],
  "ray-tracing": [
    ["Ray Tracing in One Weekend", "https://raytracing.github.io/books/RayTracingInOneWeekend.html", "raytracing.github.io", "project", "intermediate", 15],
    ["Physically Based Rendering (PBR Book)", "https://pbr-book.org/", "PBR Book", "book", "advanced", 60],
  ],
  "gpu-programming": [
    ["CUDA C++ Programming Guide", "https://docs.nvidia.com/cuda/cuda-c-programming-guide/", "NVIDIA", "documentation", "advanced", 25],
  ],
  "physics-simulation": [
    ["Gaffer On Games — physics & networking", "https://gafferongames.com/", "Glenn Fiedler", "tutorial", "intermediate", 15],
    ["Box2D documentation", "https://box2d.org/documentation/", "Box2D", "documentation", "intermediate", 8],
  ],
  "game-programming": [
    ["Game Programming Patterns", "https://gameprogrammingpatterns.com/", "Robert Nystrom", "book", "intermediate", 20],
    ["Godot Engine documentation", "https://docs.godotengine.org/en/stable/", "Godot", "documentation", "beginner", 20],
  ],
  "game-engine-architecture": [
    ["Game Programming Patterns", "https://gameprogrammingpatterns.com/", "Robert Nystrom", "book", "intermediate", 20],
    ["Game Engine Architecture (companion site)", "https://www.gameenginebook.com/", "Jason Gregory", "book", "advanced", 60],
  ],

  // ── Quantitative finance ───────────────────────────────────────────────────
  "financial-markets": [
    ["MIT 15.401 Finance Theory I", "https://ocw.mit.edu/courses/15-401-finance-theory-i-fall-2008/", "MIT OpenCourseWare", "course", "beginner", 35],
  ],
  "time-series": [
    ["Forecasting: Principles and Practice", "https://otexts.com/fpp3/", "Hyndman & Athanasopoulos", "book", "intermediate", 30],
    ["statsmodels time-series analysis", "https://www.statsmodels.org/stable/tsa.html", "statsmodels", "documentation", "intermediate", 8],
  ],
  "stochastic-processes": [
    ["MIT 6.262 Discrete Stochastic Processes", "https://ocw.mit.edu/courses/6-262-discrete-stochastic-processes-spring-2011/", "MIT OpenCourseWare", "course", "advanced", 40],
  ],
  "derivatives-pricing": [
    ["MIT 18.S096 Mathematics with Applications in Finance", "https://ocw.mit.edu/courses/18-s096-topics-in-mathematics-with-applications-in-finance-fall-2013/", "MIT OpenCourseWare", "course", "advanced", 40],
    ["QuantLib documentation", "https://www.quantlib.org/docs.shtml", "QuantLib", "documentation", "advanced", 12],
  ],
  "portfolio-theory": [
    ["PyPortfolioOpt documentation", "https://pyportfolioopt.readthedocs.io/en/latest/", "PyPortfolioOpt", "documentation", "intermediate", 10],
  ],
  "quantitative-trading": [
    ["QuantEcon Lectures", "https://quantecon.org/lectures/", "QuantEcon", "course", "intermediate", 40],
    ["QuantStart articles", "https://www.quantstart.com/articles/", "QuantStart", "tutorial", "intermediate", 20],
  ],
  backtesting: [
    ["Backtesting.py documentation", "https://kernc.github.io/backtesting.py/", "backtesting.py", "documentation", "intermediate", 8],
    ["Backtrader documentation", "https://www.backtrader.com/docu/", "Backtrader", "documentation", "intermediate", 10],
  ],
  "low-latency-programming": [
    ["Software optimization resources", "https://www.agner.org/optimize/", "Agner Fog", "book", "advanced", 25],
  ],

  // ── Math ───────────────────────────────────────────────────────────────────
  calculus: [
    ["MIT 18.01SC Single Variable Calculus", "https://ocw.mit.edu/courses/18-01sc-single-variable-calculus-fall-2010/", "MIT OpenCourseWare", "course", "beginner", 40],
    ["Essence of Calculus", "https://www.3blue1brown.com/topics/calculus", "3Blue1Brown", "course", "beginner", 6],
  ],
  optimization: [
    ["Convex Optimization (Boyd & Vandenberghe)", "https://web.stanford.edu/~boyd/cvxbook/", "Stanford University", "book", "advanced", 50],
    ["CVXPY documentation", "https://www.cvxpy.org/", "CVXPY", "documentation", "intermediate", 8],
  ],
  "numerical-methods": [
    ["Python Programming and Numerical Methods", "https://pythonnumericalmethods.studentorg.berkeley.edu/", "UC Berkeley", "book", "intermediate", 25],
    ["SciPy documentation", "https://docs.scipy.org/doc/scipy/", "SciPy", "documentation", "intermediate", 10],
  ],
  "discrete-math": [
    ["MIT 6.042J Mathematics for Computer Science", "https://ocw.mit.edu/courses/6-042j-mathematics-for-computer-science-fall-2010/", "MIT OpenCourseWare", "course", "intermediate", 45],
  ],

  // ── Quantum ────────────────────────────────────────────────────────────────
  "quantum-mechanics": [
    ["MIT 8.04 Quantum Physics I", "https://ocw.mit.edu/courses/8-04-quantum-physics-i-spring-2016/", "MIT OpenCourseWare", "course", "advanced", 45],
    ["The Feynman Lectures, Vol. III", "https://www.feynmanlectures.caltech.edu/III_toc.html", "Caltech", "book", "advanced", 30],
  ],
  "quantum-computing": [
    ["IBM Quantum Learning", "https://learning.quantum.ibm.com/", "IBM", "course", "intermediate", 30],
    ["Quantum Computing for the Very Curious", "https://quantum.country/qcvc", "Quantum Country", "tutorial", "beginner", 10],
  ],
  "quantum-programming": [
    ["Qiskit documentation", "https://docs.quantum.ibm.com/", "IBM", "documentation", "intermediate", 15],
    ["Cirq documentation", "https://quantumai.google/cirq", "Google Quantum AI", "documentation", "intermediate", 12],
  ],
  "quantum-algorithms": [
    ["Quantum Algorithm Zoo", "https://quantumalgorithmzoo.org/", "Quantum Algorithm Zoo", "documentation", "advanced", 10],
  ],
  "quantum-error-correction": [
    ["Error Correction Zoo", "https://errorcorrectionzoo.org/", "Error Correction Zoo", "documentation", "advanced", 12],
  ],

  // ── Software / data / ML extras ────────────────────────────────────────────
  "web-frontend": [
    ["MDN Learn Web Development", "https://developer.mozilla.org/en-US/docs/Learn", "MDN", "course", "beginner", 40],
    ["The Modern JavaScript Tutorial", "https://javascript.info/", "javascript.info", "tutorial", "beginner", 35],
    ["React — Learn", "https://react.dev/learn", "Meta", "documentation", "intermediate", 15],
  ],
  "mobile-development": [
    ["Android Developer Courses", "https://developer.android.com/courses", "Google", "course", "beginner", 35],
    ["Flutter documentation", "https://docs.flutter.dev/", "Google", "documentation", "beginner", 25],
  ],
  "distributed-systems": [
    ["MIT 6.824 Distributed Systems", "https://pdos.csail.mit.edu/6.824/", "MIT", "course", "advanced", 50],
    ["Designing Data-Intensive Applications (companion)", "https://dataintensive.net/", "Martin Kleppmann", "book", "advanced", 45],
  ],
  "data-engineering": [
    ["Apache Airflow documentation", "https://airflow.apache.org/docs/", "Apache", "documentation", "intermediate", 15],
    ["dbt documentation", "https://docs.getdbt.com/", "dbt Labs", "documentation", "intermediate", 12],
  ],
  "big-data": [
    ["Apache Spark documentation", "https://spark.apache.org/docs/latest/", "Apache", "documentation", "intermediate", 18],
  ],
  "streaming-data": [
    ["Apache Kafka documentation", "https://kafka.apache.org/documentation/", "Apache", "documentation", "advanced", 18],
  ],
  "reinforcement-learning": [
    ["Reinforcement Learning: An Introduction", "http://incompleteideas.net/book/the-book-2nd.html", "Sutton & Barto", "book", "advanced", 50],
    ["Spinning Up in Deep RL", "https://spinningup.openai.com/", "OpenAI", "course", "advanced", 25],
  ],
  "computer-vision": [
    ["OpenCV documentation", "https://docs.opencv.org/4.x/", "OpenCV", "documentation", "intermediate", 12],
  ],
  "reverse-engineering": [
    ["Reverse Engineering for Beginners", "https://beginners.re/", "Dennis Yurichev", "book", "advanced", 45],
    ["Ghidra", "https://ghidra-sre.org/", "NSA", "documentation", "advanced", 10],
  ],
  "binary-exploitation": [
    ["pwn.college", "https://pwn.college/", "Arizona State University", "course", "advanced", 45],
    ["Nightmare — binary exploitation course", "https://guyinatuxedo.github.io/", "guyinatuxedo", "exercise", "advanced", 30],
  ],
  "cloud-security": [
    ["Azure security fundamentals", "https://learn.microsoft.com/en-us/azure/security/fundamentals/", "Microsoft", "documentation", "intermediate", 12],
  ],
};

/** Canonical (real, curated) sources for a skill. Empty if we have none. */
export function canonicalFor(skillId: string): Resource[] {
  const skill = SKILL_BY_ID[skillId];
  const rows = SOURCES[skillId];
  if (!skill || !rows) return [];
  return rows.map(([title, url, provider, type, difficulty, hours], i) => ({
    id: `canon-${skillId}-${i + 1}`,
    title,
    type,
    domain: skill.domain,
    difficulty,
    skills: [skillId],
    prerequisites: skill.prerequisites,
    durationHours: hours,
    description: `Primary source for ${skill.name}, published by ${provider}.`,
    url,
    tags: [skill.domain.toLowerCase(), provider.toLowerCase(), "canonical"],
    provider,
    origin: "canonical" as const,
  }));
}

export const CANONICAL_SKILL_IDS = Object.keys(SOURCES);

/** All canonical resources, flattened — used by recommendation scoring. */
export const CANONICAL_RESOURCES: Resource[] = CANONICAL_SKILL_IDS.flatMap((id) => canonicalFor(id));
