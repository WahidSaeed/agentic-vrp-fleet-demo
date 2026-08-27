// Synthetic conference demo - no real data.
// Box/arrow data for the fleet architecture build-up. Coordinate space 1000x560.
// Labels match the real system exactly (Neo4j AuraDB, HiGHS, Amazon Bedrock).
export const BOXES = [
  { id: "sim", x: 24, y: 60, w: 150, h: 66, title: "Simulator", sub: "synthetic GPS", variant: "neutral" },
  { id: "kinesis", x: 210, y: 60, w: 130, h: 66, title: "Kinesis", sub: "data stream", variant: "neutral" },
  { id: "stream", x: 376, y: 60, w: 176, h: 66, title: "stream-processor", sub: "state · broadcast", variant: "neutral" },
  { id: "graph", x: 150, y: 270, w: 180, h: 66, title: "Neo4j AuraDB", sub: "road-graph lookup", variant: "teal" },
  { id: "mip", x: 366, y: 270, w: 180, h: 66, title: "HiGHS", sub: "open-TSP MIP solve", variant: "teal" },
  { id: "bedrock", x: 582, y: 270, w: 190, h: 66, title: "Amazon Bedrock", sub: "Nova Lite · explains", variant: "teal" },
  { id: "gate", x: 590, y: 60, w: 150, h: 66, title: "approval gate", sub: ">2 stops / >15 min", variant: "amber" },
  { id: "dispatch", x: 776, y: 60, w: 120, h: 66, title: "dispatcher", sub: "approve / reject", variant: "neutral" },
  { id: "map", x: 918, y: 60, w: 58, h: 66, title: "map", sub: "", variant: "neutral" },
];

export const ARROWS = [
  { from: "sim", to: "kinesis" },
  { from: "kinesis", to: "stream" },
  { from: "stream", to: "graph", label: "disruption" },
  { from: "graph", to: "mip" },
  { from: "mip", to: "bedrock" },
  { from: "bedrock", to: "gate" },
  { from: "gate", to: "dispatch" },
  { from: "dispatch", to: "map", label: "route_update" },
];

// how many beats the slide walks through (first box is shown on arrival)
export const STEPS = BOXES.length - 1;
