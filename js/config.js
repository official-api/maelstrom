// ============================================================================
// MAELSTROM DIGITAL TWIN — CONTENT CONFIG
// ----------------------------------------------------------------------------
// Every piece of user-facing copy lives in this one file. To change any
// description shown in the simulation, edit the strings below and reload
// the page — nothing else needs to change. See README.md for the full guide.
// ============================================================================

export const DESCRIPTIONS = {
  // Shown before the attack sequence starts, in the top-right panel.
  intro: {
    title: "MAELSTROM",
    body:
      "A solid-propellant micro-missile built to take down an entire drone " +
      "swarm with a single round. Press Begin Attack to run the intercept " +
      "sequence.",
  },

  // Shown once the radar pod detects the inbound swarm.
  detection: {
    title: "SWARM DETECTED",
    body:
      "Radar has picked up a hostile drone cluster inbound. Choose an " +
      "intercept method to load and fire MAELSTROM.",
  },

  hardKill: {
    title: "Hard Kill — Fragmentation",
    body:
      "A controlled, high-density fragmentation warhead detonates ahead of " +
      "the swarm, throwing a dense pattern of sub-munitions through the " +
      "formation to physically destroy multiple airframes in one burst.",
  },

  softKill: {
    title: "Soft Kill — Carbon Fibre",
    body:
      "A conductive carbon-fibre filament payload bursts open ahead of the " +
      "swarm, fouling rotors and shorting exposed electronics to bring " +
      "drones down without a high-explosive effect.",
  },

  // Top-right panel while the engine is firing / rocket is clearing the pod.
  engineCutaway: {
    title: "Solid Rocket Motor — Ignition",
    body:
      "MAELSTROM uses a case-bonded solid-propellant grain with a central " +
      "burn cavity. On ignition, the igniter charge lights the exposed " +
      "grain face; hot combustion gas accelerates through the converging–" +
      "diverging nozzle, producing thrust in well under a second with no " +
      "moving parts and no separate fuel/oxidiser handling.",
  },

  nextStage: {
    label: "Next Stage",
    hint: "Rocket has cleared the pod. Continue to optical tracking.",
  },

  // Top-right panel during the mid-course / terminal tracking phase.
  opticalTracking: {
    title: "Optical Tracking & Guidance",
    body:
      "A nose-mounted optical seeker streams frames to an onboard vision " +
      "model that detects each drone in the cluster, boxes it, and " +
      "computes the swarm's aim centroid in real time. Guidance " +
      "commands are sent to the four aft control fins, which deflect to " +
      "steer the airframe onto the centroid for intercept.",
  },

  intercept: {
    hard: "IMPACT — fragmentation pattern through swarm.",
    soft: "IMPACT — carbon-fibre burst through swarm.",
  },

  // Cost comparison, shown after the intercept resolves.
  costComparison: {
    title: "Cost Per Intercept",
    left: {
      label: "Patriot (PAC-3)",
      cost: "$3,400,000",
      note: "to down one $800 military FPV drone",
    },
    right: {
      label: "MAELSTROM",
      cost: "$8,000",
      note: "to down an entire FPV drone swarm",
    },
    footnote:
      "One MAELSTROM round replaces the one-interceptor-per-drone economics " +
      "of legacy air defence against low-cost swarms.",
  },

  replay: {
    label: "Replay",
  },

  // "Find out more" feature deep-dives, shown after the cost comparison.
  featureMenu: {
    title: "Find Out More",
  },

  features: {
    aerofoil: {
      label: "Control Fin Aerofoil",
      title: "Control Fin Aerodynamics",
      body:
        "Each control fin uses a low-drag aerofoil section tuned for " +
        "transonic manoeuvring. The streamlines below show attached flow " +
        "over the fin at cruise angle of attack — smooth flow over the " +
        "surface means predictable, high-authority control right up to " +
        "the corner of the flight envelope.",
    },
    fragWarhead: {
      label: "Fragmentation Warhead",
      title: "High-Density Fragmentation Warhead",
      body:
        "A machined liner surrounds the explosive fill so the case " +
        "fractures into a dense, controlled pattern of fragments on " +
        "detonation, rather than a few large uncontrolled pieces. The " +
        "pattern is shaped to spread wide enough to catch a loose swarm " +
        "formation in a single burst.",
    },
    carbonFibre: {
      label: "Carbon Fibre Package",
      title: "Carbon Fibre Entanglement Payload",
      body:
        "A compressed bundle of conductive carbon-fibre tow is ejected and " +
        "blown open ahead of the swarm. The expanding filament cloud " +
        "fouls rotors and can short exposed electrical contacts, bringing " +
        "drones down without a fragmentation effect.",
    },
  },

  panels: {
    mainTitle: "MAELSTROM — Digital Twin",
    trajectoryTitle: "Trajectory",
  },

  buttons: {
    begin: "Begin Attack",
    hardKill: "Hard Kill",
    softKill: "Soft Kill",
    findOutMore: "Find Out More",
    back: "Back",
  },
};

// ----------------------------------------------------------------------------
// Numeric / physical parameters used to build geometry and drive the
// simulation timeline. These are for visual showcase purposes only — see
// README.md — and are not meant to be physically exact.
// ----------------------------------------------------------------------------
export const PARAMS = {
  rocket: {
    totalLength: 0.84, // m
    bodyRadius: 0.045, // m (45mm)
    noseRadius: 0.045, // m hemisphere nose
    engineLength: 0.3, // m aft engine section
    fixedFinCount: 4,
    controlFinCount: 4,
  },
  timeline: {
    swarmApproachSeconds: 6,
    detectionAlertSeconds: 1.5,
    engineBurnSeconds: 3,
    trackingSeconds: 7,
    interceptEffectSeconds: 2.5,
  },
  world: {
    podPosition: [0, 0, 6],
    swarmStartPosition: [0, 8, -60],
    swarmEndPosition: [0, 6, -18],
    droneCount: 7,
  },
};
