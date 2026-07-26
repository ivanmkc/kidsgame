// Crimson Escape — hand-authored SVG wall art (web-only surface; the app
// ships web). Each wall is parameterized by the logic flags so the art
// always agrees with the state machine. viewBox is 400×300 on every wall.
import React from 'react';
import { CrimsonState } from './logic';

type Flags = CrimsonState['flags'];

const WALL = '#6E1D28';
const WALL_HI = '#7E2531';
const FLOOR = '#3B2620';
const BASE = '#2A1A15';
const WOOD = '#4A3226';
const WOOD_D = '#382619';
const WOOD_HI = '#5C4030';
const GOLD = '#C9A227';
const PAPER = '#E6DFD2';
const CLOTH = '#9A3542';

function Room({ children, dim }: { children: React.ReactNode; dim: boolean }) {
  return (
    <svg viewBox="0 0 400 300" width="100%" height="100%" preserveAspectRatio="none" style={{ display: 'block' }}>
      <rect x={0} y={0} width={400} height={252} fill={dim ? WALL : WALL_HI} />
      {/* wall panel moulding */}
      <rect x={0} y={20} width={400} height={4} fill="#5C1822" />
      <rect x={0} y={196} width={400} height={5} fill="#5C1822" />
      <rect x={0} y={240} width={400} height={12} fill={BASE} />
      <rect x={0} y={252} width={400} height={48} fill={FLOOR} />
      {/* floorboards */}
      {[268, 284].map((y) => (
        <rect key={y} x={0} y={y} width={400} height={1.5} fill="#2C1B15" />
      ))}
      {children}
      {/* dim the whole room until the curtains open */}
      {dim ? <rect x={0} y={0} width={400} height={300} fill="#14060A" opacity={0.34} /> : null}
      {/* soft vignette */}
      <rect x={0} y={0} width={400} height={300} fill="url(#crimsonVignette)" />
      <defs>
        <radialGradient id="crimsonVignette" cx="50%" cy="45%" r="75%">
          <stop offset="60%" stopColor="#000000" stopOpacity={0} />
          <stop offset="100%" stopColor="#000000" stopOpacity={0.38} />
        </radialGradient>
      </defs>
    </svg>
  );
}

function BedWall({ f }: { f: Flags }) {
  return (
    <Room dim={!f.curtainsOpen}>
      {/* wall lamp */}
      <rect x={330} y={60} width={8} height={26} fill={WOOD_D} />
      <path d="M316 60 L352 60 L344 40 L324 40 Z" fill="#D8B36A" opacity={0.9} />
      <ellipse cx={334} cy={64} rx={26} ry={8} fill="#F5D889" opacity={0.25} />
      {/* headboard */}
      <rect x={56} y={96} width={288} height={78} rx={10} fill={WOOD} />
      <rect x={68} y={108} width={264} height={54} rx={6} fill={WOOD_D} />
      {/* mattress + blanket */}
      <rect x={52} y={162} width={296} height={52} rx={10} fill="#8C2F3A" />
      <rect x={52} y={168} width={296} height={12} fill="#C8B9A6" opacity={0.9} />
      <rect x={52} y={196} width={296} height={18} rx={8} fill="#7A2531" />
      {/* pillow — askew once looted */}
      <g transform={f.pillowLooted ? 'rotate(-10 120 172)' : undefined}>
        <ellipse cx={120} cy={172} rx={48} ry={17} fill="#E8DCC8" />
        <ellipse cx={120} cy={169} rx={48} ry={13} fill="#F4EBDB" />
      </g>
      {/* bed frame + the dark under-bed */}
      <rect x={52} y={214} width={296} height={10} fill={WOOD} />
      <rect x={58} y={224} width={12} height={30} fill={WOOD_D} />
      <rect x={330} y={224} width={12} height={30} fill={WOOD_D} />
      <rect x={70} y={224} width={260} height={28} fill="#0E0608" />
      {f.cordTaken ? null : <path d="M96 246 q30 -10 52 2 q20 10 38 0" stroke="#111" strokeWidth={4} fill="none" opacity={0.5} />}
      {/* rug */}
      <ellipse cx={200} cy={282} rx={130} ry={14} fill="#5A1E29" />
      <ellipse cx={200} cy={282} rx={104} ry={10} fill="#6E2531" />
    </Room>
  );
}

function WindowWall({ f }: { f: Flags }) {
  const open = !!f.curtainsOpen;
  return (
    <Room dim={false}>
      {/* light pooling on the floor once the curtains open */}
      {open ? <path d="M130 200 L270 200 L318 296 L82 296 Z" fill="#F5E4AE" opacity={0.13} /> : null}
      {/* calendar */}
      <rect x={28} y={78} width={58} height={74} rx={3} fill={open ? PAPER : '#8A7B6C'} />
      <rect x={28} y={78} width={58} height={16} rx={3} fill="#A5303C" />
      <circle cx={57} cy={78} r={3} fill={WOOD_D} />
      {open ? (
        <text x={57} y={130} textAnchor="middle" fontFamily="sans-serif" fontWeight="bold" fontSize={22} fill="#6E1D28">
          2004
        </text>
      ) : (
        <g>
          <rect x={38} y={110} width={38} height={5} fill="#6B5D50" />
          <rect x={38} y={122} width={30} height={5} fill="#6B5D50" />
        </g>
      )}
      {/* window frame */}
      <rect x={102} y={48} width={196} height={150} rx={6} fill={WOOD} />
      <rect x={112} y={58} width={176} height={130} fill={open ? '#EFE1B4' : '#1D1016'} />
      {open ? (
        <g>
          <rect x={112} y={58} width={176} height={130} fill="url(#skyGlow)" />
          <rect x={196} y={58} width={8} height={130} fill={WOOD} />
          <rect x={112} y={118} width={176} height={8} fill={WOOD} />
        </g>
      ) : null}
      {/* curtains */}
      {open ? (
        <g>
          <path d="M96 46 q22 70 6 152 L84 198 L84 46 Z" fill={CLOTH} />
          <path d="M304 46 q-22 70 -6 152 L316 198 L316 46 Z" fill={CLOTH} />
        </g>
      ) : (
        <g>
          <rect x={98} y={44} width={104} height={156} fill={CLOTH} />
          <rect x={198} y={44} width={104} height={156} fill="#8D2F3B" />
          {[118, 140, 162, 218, 240, 262].map((x) => (
            <path key={x} d={`M${x} 48 q6 76 0 148`} stroke="#7A2531" strokeWidth={5} fill="none" />
          ))}
        </g>
      )}
      <rect x={92} y={38} width={216} height={8} rx={4} fill={WOOD_D} />
      {/* sill + battery */}
      <rect x={98} y={198} width={204} height={10} rx={3} fill={WOOD_HI} />
      {open && !f.sillLooted ? (
        <g>
          <rect x={206} y={188} width={20} height={9} rx={3} fill="#3E7C46" />
          <rect x={224} y={190} width={4} height={5} fill="#C9A227" />
        </g>
      ) : null}
      {/* radiator */}
      <rect x={130} y={214} width={140} height={30} rx={6} fill="#5A4A44" />
      {[142, 158, 174, 190, 206, 222, 238, 254].map((x) => (
        <rect key={x} x={x} y={218} width={8} height={22} rx={3} fill="#4A3C37" />
      ))}
      <defs>
        <linearGradient id="skyGlow" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F7ECC6" />
          <stop offset="100%" stopColor="#E3CD96" />
        </linearGradient>
      </defs>
    </Room>
  );
}

function DresserWall({ f }: { f: Flags }) {
  return (
    <Room dim={!f.curtainsOpen}>
      {/* dresser body */}
      <rect x={92} y={118} width={216} height={134} rx={6} fill={WOOD} />
      <rect x={86} y={112} width={228} height={12} rx={4} fill={WOOD_HI} />
      <rect x={98} y={252} width={14} height={14} fill={WOOD_D} />
      <rect x={288} y={252} width={14} height={14} fill={WOOD_D} />
      {/* top drawer (locked → open) */}
      {f.topDrawerOpen ? (
        <g>
          <rect x={108} y={136} width={184} height={10} fill="#17100C" />
          <rect x={104} y={146} width={192} height={30} rx={4} fill={WOOD_HI} />
          <circle cx={148} cy={161} r={5} fill={GOLD} />
          <circle cx={252} cy={161} r={5} fill={GOLD} />
          {/* brass key left in the lock */}
          <circle cx={200} cy={161} r={4.5} fill="#2A1C12" />
          <rect x={198} y={161} width={4} height={12} fill={GOLD} transform="rotate(18 200 161)" />
        </g>
      ) : (
        <g>
          <rect x={108} y={134} width={184} height={34} rx={4} fill={WOOD_HI} />
          <circle cx={148} cy={151} r={5} fill={GOLD} />
          <circle cx={252} cy={151} r={5} fill={GOLD} />
          <circle cx={200} cy={151} r={4.5} fill="#2A1C12" />
          <rect x={198.5} y={151} width={3} height={7} fill="#2A1C12" />
        </g>
      )}
      {/* bottom drawer (ajar once looted) */}
      <g transform={f.bottomDrawerLooted ? 'translate(0 6)' : undefined}>
        {f.bottomDrawerLooted ? <rect x={108} y={172} width={184} height={8} fill="#17100C" /> : null}
        <rect x={108} y={178} width={184} height={48} rx={4} fill={WOOD_HI} />
        <circle cx={148} cy={202} r={5} fill={GOLD} />
        <circle cx={252} cy={202} r={5} fill={GOLD} />
      </g>
      {/* projector */}
      <g>
        <rect x={150} y={70} width={84} height={42} rx={8} fill="#3C3C44" />
        <circle cx={172} cy={62} r={14} fill="#2E2E36" />
        <circle cx={204} cy={58} r={18} fill="#2E2E36" />
        <circle cx={172} cy={62} r={5} fill="#1C1C22" />
        <circle cx={204} cy={58} r={7} fill="#1C1C22" />
        {/* lens */}
        <rect x={230} y={82} width={16} height={18} rx={4} fill="#26262C" />
        <circle cx={246} cy={91} r={7} fill={f.clipPlayed ? '#F5D889' : '#15151A'} />
        {/* usb port / stick */}
        {f.usbInserted ? <rect x={142} y={86} width={10} height={10} rx={2} fill="#7D818A" /> : <rect x={150} y={88} width={6} height={6} fill="#15151A" />}
        {/* standby light */}
        <circle cx={162} cy={104} r={3.5} fill={f.cordPlugged ? '#FF5148' : '#4A2328'} />
        {/* power cord snaking down once plugged */}
        {f.cordPlugged ? <path d="M236 108 q26 30 20 64 q-4 40 30 52" stroke="#1B1B1F" strokeWidth={4} fill="none" /> : null}
      </g>
      {/* wall shelf with a dusty bottle */}
      <rect x={36} y={150} width={52} height={6} rx={2} fill={WOOD_D} />
      <path d="M42 156 l8 12 l-8 0 Z" fill={WOOD_D} />
      <path d="M82 156 l-8 12 l8 0 Z" fill={WOOD_D} />
      <rect x={56} y={128} width={12} height={22} rx={3} fill="#37515F" />
      <rect x={59} y={120} width={6} height={10} fill="#37515F" />
      <rect x={318} y={196} width={44} height={56} rx={4} fill={WOOD_D} />
      <rect x={324} y={202} width={32} height={40} rx={3} fill="#2E2431" />
    </Room>
  );
}

function DoorWall({ f }: { f: Flags }) {
  return (
    <Room dim={!f.curtainsOpen}>
      {/* door */}
      <rect x={116} y={40} width={128} height={212} rx={4} fill={WOOD} />
      <rect x={126} y={52} width={108} height={88} rx={4} fill={WOOD_D} />
      <rect x={126} y={150} width={108} height={92} rx={4} fill={WOOD_D} />
      <circle cx={228} cy={146} r={7} fill={GOLD} />
      <rect x={225} y={158} width={6} height={9} rx={2} fill="#2A1C12" />
      {/* outlet */}
      <rect x={78} y={226} width={18} height={14} rx={3} fill="#C9BCA8" />
      <circle cx={84} cy={233} r={1.6} fill="#3B2620" />
      <circle cx={90} cy={233} r={1.6} fill="#3B2620" />
      {/* safe behind the painting */}
      {f.paintingMoved ? (
        <g>
          <rect x={268} y={78} width={82} height={70} rx={5} fill="#7D818A" />
          <rect x={274} y={84} width={70} height={58} rx={4} fill={f.safeOpen ? '#17141A' : '#8E939D'} />
          {f.safeOpen ? (
            <rect x={338} y={80} width={12} height={66} rx={3} fill="#6A6E77" />
          ) : (
            <g>
              <circle cx={330} cy={113} r={7} fill="#5A5E66" />
              {[0, 1, 2].map((r) =>
                [0, 1, 2].map((c) => (
                  <rect key={`${r}${c}`} x={286 + c * 11} y={98 + r * 11} width={8} height={8} rx={2} fill="#5F646D" />
                ))
              )}
            </g>
          )}
        </g>
      ) : null}
      {/* painting — slides + tilts aside after the reveal */}
      <g transform={f.paintingMoved ? 'translate(64 14) rotate(7 320 120)' : undefined}>
        <rect x={272} y={76} width={78} height={74} rx={4} fill={GOLD} />
        <rect x={279} y={83} width={64} height={60} fill="#241C2B" />
        <path d="M279 128 q16 -22 30 -6 q14 14 34 -10 L343 143 L279 143 Z" fill="#161020" />
        <circle cx={330} cy={96} r={8} fill="#CDBF9A" opacity={0.85} />
      </g>
      {/* coat hook flavor */}
      <rect x={62} y={92} width={6} height={16} rx={3} fill={WOOD_D} />
      <circle cx={65} cy={110} r={4} fill={GOLD} opacity={0.8} />
    </Room>
  );
}

export function WallArt({ view, flags }: { view: number; flags: Flags }) {
  if (view === 0) return <BedWall f={flags} />;
  if (view === 1) return <WindowWall f={flags} />;
  if (view === 2) return <DresserWall f={flags} />;
  return <DoorWall f={flags} />;
}
